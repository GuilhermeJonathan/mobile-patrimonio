import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { adminService, AdminOverviewDto, AssessoriaResumoDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import { useRouter } from '../navigation/router';
import { numBR } from '../utils/format';

const GOLD = '#C79A4E';

function origemWeb(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://app.findog.com.br';
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${numBR(v / 1_000_000, 2)}M`;
  if (v >= 1_000) return `R$ ${numBR(v / 1_000, 1)}k`;
  return `R$ ${numBR(v, 2)}`;
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);
  const { navigate } = useRouter();

  const [dados, setDados] = useState<AdminOverviewDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Form de assessoria (criar/editar) — no editar, o admin ajusta a marca completa.
  type FormAssessoria = {
    assessorId?: string; nome: string; email: string; senha: string;
    nomeConsultoria: string; logo: string | null; cor: string; whats: string; rodape: string; slug: string;
  };
  const [form, setForm] = useState<FormAssessoria | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Copia texto para a área de transferência (web: Clipboard API, com fallback p/ execCommand).
  async function copiar(txt: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(txt);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 1800);
    } catch { /* silencioso — sem clipboard disponível */ }
  }

  function novaAssessoria() {
    setErroForm(null);
    setForm({ nome: '', email: '', senha: '', nomeConsultoria: '', logo: null, cor: '#16a34a', whats: '', rodape: '', slug: '' });
  }
  async function editarAssessoria(a: AssessoriaResumoDto) {
    setErroForm(null);
    // Abre já com o nome; carrega a marca completa (logo/cor/rodapé/rota) em seguida.
    setForm({ assessorId: a.assessorId, nome: a.nome, email: '', senha: '', nomeConsultoria: a.nome, logo: null, cor: '#16a34a', whats: '', rodape: '', slug: '' });
    try {
      const c = await adminService.getAssessoriaConsultoria(a.assessorId);
      setForm(f => f && f.assessorId === a.assessorId ? {
        ...f,
        nomeConsultoria: c.nomeConsultoria || a.nome,
        logo: c.logoBase64 ?? null,
        cor: c.corMarca ?? '#16a34a',
        whats: c.whatsApp ?? '',
        rodape: c.mensagemRodape ?? '',
        slug: c.slug ?? '',
      } : f);
    } catch { /* mantém o que já está no form */ }
  }

  async function escolherLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.6, allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]?.base64) setForm(f => f && { ...f, logo: `data:image/jpeg;base64,${res.assets[0].base64}` });
  }

  async function salvarAssessoria() {
    if (!form) return;
    if (!form.nomeConsultoria.trim()) { setErroForm(t('admin.erroNomeConsultoria')); return; }
    if (!form.assessorId) {
      if (!form.nome.trim()) { setErroForm(t('admin.erroNomeAssessor')); return; }
      if (!form.email.trim()) { setErroForm(t('admin.erroEmail')); return; }
      if (form.senha.length < 6) { setErroForm(t('admin.erroSenha')); return; }
    }
    setSalvando(true); setErroForm(null);
    try {
      if (form.assessorId) {
        await adminService.atualizarAssessoria(form.assessorId, {
          nomeConsultoria: form.nomeConsultoria.trim(),
          logoBase64: form.logo,
          corMarca: form.cor,
          whatsApp: form.whats.trim() || null,
          mensagemRodape: form.rodape.trim() || null,
          slug: form.slug.trim() || null,
        });
      } else {
        await adminService.criarAssessoria({ nome: form.nome.trim(), email: form.email.trim(), senha: form.senha, nomeConsultoria: form.nomeConsultoria.trim() });
      }
      setForm(null); await load();
    } catch (e: any) {
      setErroForm(e?.response?.data ?? t('admin.erroSalvar'));
    } finally { setSalvando(false); }
  }

  const CORES_MARCA = ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#f59e0b', '#0f766e', '#111827'];

  const load = useCallback(async () => {
    try {
      setErro(null);
      setDados(await adminService.overview());
    } catch (e: any) {
      setErro(e?.response?.status === 403
        ? t('admin.erroAcessoRestrito')
        : t('admin.erroCarregar'));
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const kpis = dados ? [
    { label: t('admin.assessorias'), valor: String(dados.qtdAssessorias) },
    { label: t('admin.clientes'), valor: String(dados.qtdClientes) },
    { label: t('admin.corretores'), valor: String(dados.qtdCorretores) },
    { label: t('admin.aumTotal'), valor: fmtBRL(dados.aumTotalBRL) },
    { label: t('admin.parametrosGlobais'), valor: String(dados.qtdParametrosGlobais) },
  ] : [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('admin.title')}</Text>
          <Text style={s.subtitle}>{t('admin.subtitle')}</Text>
        </View>
        <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>{t('admin.badge')}</Text></View>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {/* KPIs */}
      <View style={s.kpiRow}>
        {kpis.map(k => (
          <View key={k.label} style={s.kpiCard}>
            <Text style={s.kpiLabel}>{k.label}</Text>
            <Text style={s.kpiValor}>{k.valor}</Text>
          </View>
        ))}
      </View>

      {/* Atalhos do catálogo global */}
      <View style={s.atalhoRow}>
        <TouchableOpacity style={s.atalho} onPress={() => navigate('cadastros-moedas')}>
          <Text style={s.atalhoIcon}>💱</Text>
          <Text style={s.atalhoTxt}>{t('admin.atalhoMoedas')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.atalho} onPress={() => navigate('cadastros-tipos-ativo')}>
          <Text style={s.atalhoIcon}>🏷️</Text>
          <Text style={s.atalhoTxt}>{t('admin.atalhoTiposAtivo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.atalho} onPress={() => navigate('cadastros-tipos-investimento')}>
          <Text style={s.atalhoIcon}>📈</Text>
          <Text style={s.atalhoTxt}>{t('admin.atalhoTiposInvestimento')}</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de assessorias */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>{t('admin.assessorias')}</Text>
          <TouchableOpacity style={s.btnNova} onPress={novaAssessoria}><Text style={s.btnNovaTxt}>{t('admin.btnNovaAssessoria')}</Text></TouchableOpacity>
        </View>
        <View style={[s.row, s.rowHead, { borderBottomColor: colors.border }]}>
          <Text style={[s.cNome, s.hCell]}>{t('admin.colAssessoria')}</Text>
          <Text style={[s.cNum, s.hCell]}>{t('admin.clientes')}</Text>
          <Text style={[s.cNum, s.hCell]}>{t('admin.corretores')}</Text>
          <Text style={[s.cAum, s.hCell]}>{t('admin.colAum')}</Text>
          <Text style={[s.cAcao, s.hCell]}> </Text>
        </View>
        {(dados?.assessorias ?? []).length === 0 ? (
          <Text style={s.vazio}>{t('admin.vazio')}</Text>
        ) : (
          dados!.assessorias.map(a => (
            <View key={a.assessorId} style={[s.row, { borderBottomColor: colors.border }]}>
              <Text style={[s.cNome, { color: colors.text }]} numberOfLines={1}>{a.nome}</Text>
              <Text style={s.cNum}>{a.qtdClientes}</Text>
              <Text style={s.cNum}>{a.qtdCorretores}</Text>
              <Text style={[s.cAum, { color: colors.text }]}>{fmtBRL(a.aumBRL)}</Text>
              <TouchableOpacity style={s.cAcao} onPress={() => editarAssessoria(a)}><Text style={s.editLink}>{t('common.editar')}</Text></TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={s.rodape}>
        {t('admin.rodape')}
      </Text>

      {/* Modal criar / editar assessoria */}
      <Modal visible={form !== null} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={s.modalTitulo}>{form?.assessorId ? t('admin.editarAssessoria') : t('admin.novaAssessoria')}</Text>

            {!form?.assessorId && (
              <>
                <Text style={s.label}>{t('admin.labelNomeAssessor')}</Text>
                <TextInput style={s.input} value={form?.nome ?? ''} onChangeText={v => setForm(f => f && { ...f, nome: v })}
                  placeholder={t('admin.phNomeAssessor')} placeholderTextColor={colors.inputPlaceholder} />
                <Text style={s.label}>{t('admin.labelEmail')}</Text>
                <TextInput style={s.input} value={form?.email ?? ''} onChangeText={v => setForm(f => f && { ...f, email: v })}
                  placeholder={t('admin.phEmail')} placeholderTextColor={colors.inputPlaceholder} autoCapitalize="none" keyboardType="email-address" />
                <Text style={s.label}>{t('admin.labelSenha')}</Text>
                <TextInput style={s.input} value={form?.senha ?? ''} onChangeText={v => setForm(f => f && { ...f, senha: v })}
                  placeholder={t('admin.phSenha')} placeholderTextColor={colors.inputPlaceholder} secureTextEntry />
                <Text style={s.hint}>{t('admin.hintSenha')}</Text>
              </>
            )}

            <Text style={s.label}>{t('admin.labelNomeConsultoria')}</Text>
            <TextInput style={s.input} value={form?.nomeConsultoria ?? ''} onChangeText={v => setForm(f => f && { ...f, nomeConsultoria: v })}
              placeholder={t('admin.phNomeConsultoria')} placeholderTextColor={colors.inputPlaceholder} />

            {/* Marca da assessoria (mesmas preferências do assessor) */}
            <Text style={s.label}>{t('admin.labelLogo')}</Text>
            <View style={s.logoRow}>
              <View style={[s.logoBox, { backgroundColor: (form?.cor ?? '#16a34a') + '18', borderColor: (form?.cor ?? '#16a34a') + '55' }]}>
                {form?.logo
                  ? <Image source={{ uri: form.logo }} style={{ width: 64, height: 64, borderRadius: 8 }} resizeMode="contain" />
                  : <Text style={{ fontSize: 26 }}>💎</Text>}
              </View>
              <View style={{ gap: 8 }}>
                <TouchableOpacity style={s.btnSec} onPress={escolherLogo}><Text style={s.btnSecTxt}>{t('admin.escolherLogo')}</Text></TouchableOpacity>
                {form?.logo && <TouchableOpacity onPress={() => setForm(f => f && { ...f, logo: null })}><Text style={s.remover}>{t('common.remover')}</Text></TouchableOpacity>}
              </View>
            </View>

            <Text style={s.label}>{t('admin.labelCorMarca')}</Text>
            <View style={s.cores}>
              {CORES_MARCA.map(hex => (
                <TouchableOpacity key={hex} onPress={() => setForm(f => f && { ...f, cor: hex })}
                  style={[s.corItem, { backgroundColor: hex }, form?.cor === hex && s.corSel]} />
              ))}
            </View>

            <Text style={s.label}>{t('admin.labelWhats')}</Text>
            <TextInput style={s.input} value={form?.whats ?? ''} onChangeText={v => setForm(f => f && { ...f, whats: v })}
              placeholder={t('admin.phWhats')} placeholderTextColor={colors.inputPlaceholder} keyboardType="phone-pad" />

            <Text style={s.label}>{t('admin.labelRodape')}</Text>
            <TextInput style={[s.input, { height: 68 }]} value={form?.rodape ?? ''} onChangeText={v => setForm(f => f && { ...f, rodape: v })} multiline
              placeholder={t('admin.phRodape')} placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>{t('admin.labelSlug')}</Text>
            <TextInput style={s.input} value={form?.slug ?? ''} onChangeText={v => setForm(f => f && { ...f, slug: v })}
              placeholder={t('admin.phSlug')} placeholderTextColor={colors.inputPlaceholder} autoCapitalize="none" />
            {!!form?.slug?.trim() && (() => {
              const link = `${origemWeb()}/login/${form.slug.trim().toLowerCase().replace(/\s+/g, '-')}`;
              return (
                <View style={s.linkRow}>
                  <Text style={[s.hint, { flex: 1 }]} numberOfLines={1}>{t('admin.linkCliente', { link })}</Text>
                  <TouchableOpacity style={[s.copyBtn, linkCopiado && s.copyBtnOk]} onPress={() => copiar(link)}>
                    <Text style={[s.copyBtnTxt, linkCopiado && s.copyBtnTxtOk]}>{linkCopiado ? t('common.copiado') : `📋 ${t('common.copiar')}`}</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {erroForm && <Text style={s.erroForm}>{erroForm}</Text>}

            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, s.btnCancel]} onPress={() => setForm(null)}><Text style={s.btnCancelTxt}>{t('common.cancelar')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.btnOk]} onPress={salvarAssessoria} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnOkTxt}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:       { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  adminBadge:  { backgroundColor: GOLD + '22', borderColor: GOLD + '66', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  adminBadgeTxt: { color: GOLD, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  erro:        { color: c.red, fontSize: 14, marginBottom: 12 },
  kpiRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard:     { flexGrow: 1, minWidth: 140, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  kpiLabel:    { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValor:    { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '900', marginTop: 6 },
  atalhoRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  atalho:      { flexGrow: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.greenBorder, padding: 14 },
  atalhoIcon:  { fontSize: 20 },
  atalhoTxt:   { color: c.green, fontSize: 14, fontWeight: '700' },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 },
  cardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  btnNova:     { backgroundColor: c.green, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  btnNovaTxt:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  cAcao:       { width: 60, textAlign: 'right' },
  editLink:    { color: c.blue, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  modalOverlay:{ flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', padding: 20 },
  modalCard:   { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 20, maxHeight: '90%', alignSelf: 'center', width: '100%', maxWidth: 460 },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  label:       { color: c.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 6 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  hint:        { color: c.textTertiary, fontSize: 11, marginTop: 6 },
  linkRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  copyBtn:     { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: c.greenBorder, backgroundColor: c.greenDim },
  copyBtnOk:   { borderColor: c.green, backgroundColor: c.green },
  copyBtnTxt:  { color: c.green, fontSize: 12, fontWeight: '700' },
  copyBtnTxtOk:{ color: '#fff' },
  logoRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  logoBox:     { width: 76, height: 76, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btnSec:      { backgroundColor: c.surfaceElevated, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  btnSecTxt:   { color: c.text, fontWeight: '700', fontSize: 13 },
  remover:     { color: c.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cores:       { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  corItem:     { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  corSel:      { borderColor: c.text },
  erroForm:    { color: c.red, fontSize: 13, marginTop: 10 },
  modalBtns:   { flexDirection: 'row', gap: 12, marginTop: 18 },
  modalBtn:    { flex: 1, borderRadius: 10, padding: 13, alignItems: 'center' },
  btnCancel:   { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border },
  btnCancelTxt:{ color: c.textSecondary, fontWeight: '700' },
  btnOk:       { backgroundColor: c.green },
  btnOkTxt:    { color: '#fff', fontWeight: '700' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, gap: 8 },
  rowHead:     { paddingBottom: 6 },
  hCell:       { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cNome:       { flex: 2, fontSize: 13, fontWeight: '600' },
  cNum:        { flex: 1, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  cAum:        { flex: 1.3, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  vazio:       { color: c.textSecondary, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  rodape:      { color: c.textTertiary, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
});
