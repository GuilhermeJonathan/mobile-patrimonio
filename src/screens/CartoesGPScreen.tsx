import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { gestaoService, CartaoDto, CartaoLancamentoDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import { brl, dataBR } from '../utils/format';

const SITUACAO_COR: Record<number, string> = { 1: '#22c55e', 2: '#f59e0b', 3: '#3b82f6' };

function fmt(v: number) {
  return brl(v);
}

export default function CartoesGPScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const MESES = t('gpCartoes.meses').split(',');

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const [cartoes,    setCartoes]    = useState<CartaoDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro,       setErro]       = useState<string | null>(null);
  const [expandido,  setExpandido]  = useState<Record<string, boolean>>({});

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId,  setEditandoId]  = useState<string | null>(null);
  const [fNome,       setFNome]       = useState('');
  const [fDia,        setFDia]        = useState('');
  const [salvando,    setSalvando]    = useState(false);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const res = await gestaoService.cartoes(mes, ano);
      setCartoes(res.items ?? []);
    } catch {
      setErro(t('gpCartoes.erroCarregar'));
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [mes, ano]);

  useEffect(() => { load(); }, [load]);

  function navMes(delta: number) {
    let m = mes + delta; let a = ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1;  a++; }
    setMes(m); setAno(a); setCarregando(true);
  }

  function toggleExpandido(id: string) {
    setExpandido(e => ({ ...e, [id]: !e[id] }));
  }

  function abrirNovo() {
    setEditandoId(null); setFNome(''); setFDia('');
    setModalAberto(true);
  }

  function abrirEditar(c: CartaoDto) {
    setEditandoId(c.id); setFNome(c.nome);
    setFDia(c.diaVencimento != null ? String(c.diaVencimento) : '');
    setModalAberto(true);
  }

  async function salvar() {
    if (!fNome.trim()) { Alert.alert(t('gpCartoes.validacao'), t('gpCartoes.nomeObrigatorio')); return; }
    setSalvando(true);
    const payload = { nome: fNome.trim(), diaVencimento: fDia ? parseInt(fDia) : null };
    try {
      if (editandoId) await gestaoService.atualizarCartao(editandoId, payload);
      else            await gestaoService.criarCartao(payload);
      setModalAberto(false);
      setCarregando(true);
      await load();
    } catch { Alert.alert(t('gpCartoes.erro'), t('gpCartoes.erroSalvar')); }
    finally { setSalvando(false); }
  }

  async function confirmarExclusao(c: CartaoDto) {
    Alert.alert(t('common.remover'), t('gpCartoes.confirmarRemocao', { nome: c.nome }), [
      { text: t('common.cancelar'), style: 'cancel' },
      { text: t('common.remover'), style: 'destructive', onPress: async () => {
        try { await gestaoService.deletarCartao(c.id); setCarregando(true); await load(); }
        catch { Alert.alert(t('gpCartoes.erro'), t('gpCartoes.erroRemover')); }
      }},
    ]);
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const totalGeral = cartoes.reduce((acc, c) => acc + c.totalMes, 0);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.root}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Navegador de mes */}
        <View style={s.mesNav}>
          <TouchableOpacity style={s.mesBtn} onPress={() => navMes(-1)}>
            <Text style={s.mesBtnTxt}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={s.mesTitulo}>{MESES[mes - 1]} {ano}</Text>
          <TouchableOpacity style={s.mesBtn} onPress={() => navMes(1)}>
            <Text style={s.mesBtnTxt}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
          <Text style={s.btnNovoTxt}>{t('gpCartoes.btnNovoCartao')}</Text>
        </TouchableOpacity>

        {erro && <Text style={s.erro}>{erro}</Text>}

        {cartoes.length > 0 && (
          <View style={s.resumo}>
            <Text style={s.resumoLabel}>{t('gpCartoes.totalNoMes')}</Text>
            <Text style={s.resumoValor}>{fmt(totalGeral)}</Text>
          </View>
        )}

        {cartoes.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIco}>💳</Text>
            <Text style={s.vazioTxt}>{t('gpCartoes.vazioTitulo')}</Text>
            <Text style={s.vazioSub}>{t('gpCartoes.vazioSub')}</Text>
          </View>
        )}

        {cartoes.map(c => {
          const aberto = expandido[c.id] ?? true;
          return (
            <View key={c.id} style={s.cartaoCard}>
              <TouchableOpacity style={s.cartaoHeader} onPress={() => toggleExpandido(c.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cartaoNome}>{c.nome}</Text>
                  <Text style={s.cartaoSub}>
                    {c.diaVencimento ? t('gpCartoes.venceDia', { dia: c.diaVencimento }) : ''}
                    {t('gpCartoes.lancamentosCount', { n: c.lancamentos.length })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.cartaoTotal}>{fmt(c.totalMes)}</Text>
                  <Text style={s.cartaoSub}>{t('gpCartoes.noMes')}</Text>
                </View>
                <Text style={[s.chevron, { marginLeft: 8 }]}>{aberto ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity style={s.btnAcao} onPress={() => abrirEditar(c)}>
                  <Text style={[s.btnAcaoTxt, { color: colors.blue }]}>{t('common.editar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnAcao} onPress={() => confirmarExclusao(c)}>
                  <Text style={[s.btnAcaoTxt, { color: colors.red }]}>{t('common.excluir')}</Text>
                </TouchableOpacity>
              </View>

              {aberto && c.lancamentos.map(l => (
                <LancamentoRow key={l.id} l={l} colors={colors} s={s} />
              ))}

              {aberto && c.lancamentos.length === 0 && (
                <Text style={[s.semLanc, { color: colors.textTertiary }]}>
                  {t('gpCartoes.semLancamentos')}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalAberto} transparent animationType="fade" onRequestClose={() => setModalAberto(false)}>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>
              {editandoId ? t('gpCartoes.editarCartao') : t('gpCartoes.novoCartaoTitulo')}
            </Text>

            <Text style={s.lbl}>{t('gpCartoes.nomeLabel')}</Text>
            <TextInput
              style={[s.inp, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fNome} onChangeText={setFNome}
              placeholder={t('gpCartoes.nomePlaceholder')} placeholderTextColor={colors.textSecondary}
            />

            <Text style={s.lbl}>{t('gpCartoes.diaVencimentoLabel')}</Text>
            <TextInput
              style={[s.inp, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fDia} onChangeText={setFDia}
              keyboardType="numeric" placeholder={t('gpCartoes.diaPlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.surfaceElevated }]} onPress={() => setModalAberto(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.green }]} onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LancamentoRow({ l, colors, s }: {
  l: CartaoLancamentoDto;
  colors: ReturnType<typeof useTheme>['colors'];
  s: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  const SITUACAO_LABEL: Record<number, string> = {
    1: t('gpCartoes.pago'), 2: t('gpCartoes.pendente'), 3: t('gpCartoes.agendado'),
  };
  const cor = SITUACAO_COR[l.situacao] ?? colors.textSecondary;
  return (
    <View style={s.lancRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.lancDesc} numberOfLines={1}>
          {l.categoriaIcone ? `${l.categoriaIcone} ` : ''}{l.descricao}
        </Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Text style={s.lancMeta}>{dataBR(l.data)}</Text>
          {l.parcelaAtual && l.totalParcelas && (
            <Text style={s.lancMeta}>{l.parcelaAtual}/{l.totalParcelas}x</Text>
          )}
          {l.categoriaNome && <Text style={s.lancMeta}>· {l.categoriaNome}</Text>}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={[s.lancValor, { color: colors.text }]}>{fmt(l.valor)}</Text>
        <View style={[s.badge, { backgroundColor: cor + '22' }]}>
          <Text style={[s.badgeTxt, { color: cor }]}>{SITUACAO_LABEL[l.situacao] ?? '-'}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:         { flex: 1, backgroundColor: c.background, padding: 16 },
  center:       { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  erro:         { color: c.red, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  mesNav:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 20 },
  mesBtn:       { backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  mesBtnTxt:    { color: c.text, fontSize: 16, fontWeight: '700' },
  mesTitulo:    { color: c.text, fontSize: 18, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  btnNovo:      { backgroundColor: c.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  btnNovoTxt:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  resumo:       { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  resumoLabel:  { color: c.textSecondary, fontSize: 12 },
  resumoValor:  { fontFamily: FONT_SERIF, color: c.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  vazio:        { alignItems: 'center', marginTop: 60 },
  vazioIco:     { fontSize: 48, marginBottom: 12 },
  vazioTxt:     { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:     { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  cartaoCard:   { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 14 },
  cartaoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cartaoNome:   { color: c.text, fontSize: 15, fontWeight: '700' },
  cartaoSub:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  cartaoTotal:  { color: c.text, fontSize: 16, fontWeight: '800' },
  chevron:      { color: c.textSecondary, fontSize: 14 },
  btnAcao:      { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnAcaoTxt:   { fontSize: 12, fontWeight: '600' },
  lancRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  lancDesc:     { color: c.text, fontSize: 13, fontWeight: '500' },
  lancMeta:     { color: c.textSecondary, fontSize: 11 },
  lancValor:    { fontSize: 13, fontWeight: '700' },
  badge:        { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeTxt:     { fontSize: 10, fontWeight: '700' },
  semLanc:      { fontSize: 12, fontStyle: 'italic', paddingVertical: 8, textAlign: 'center' },
  overlay:      { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:        { width: '100%', maxWidth: 420, borderRadius: 16, padding: 24 },
  modalTitulo:  { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  lbl:          { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
  inp:          { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  btn:          { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
