import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { assessoriaService, RecomendacaoDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import { dataBR } from '../utils/format';

const TIPO_LABEL: Record<number, string> = { 1: 'recomendacoes.tipoAjuste', 2: 'recomendacoes.tipoDica', 3: 'recomendacoes.tipoAlerta' };
const STATUS = {
  1: { label: 'recomendacoes.statusPendente',  cor: '#f59e0b' },
  2: { label: 'recomendacoes.statusAceita',    cor: '#22c55e' },
  3: { label: 'recomendacoes.statusRecusada',  cor: '#ef4444' },
} as Record<number, { label: string; cor: string }>;

interface RecComCliente extends RecomendacaoDto { nomeCliente: string; }

function dataFmt(iso: string) {
  return dataBR(iso);
}

export default function RecomendacoesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const [recs, setRecs]         = useState<RecComCliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca]       = useState('');
  const [filtro, setFiltro]     = useState<number | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const clientes = (await assessoriaService.clientes()).filter(c => c.ativo);
      const porCliente = await Promise.all(
        clientes.map(c =>
          assessoriaService.getRecomendacoes(c.clienteId)
            .then(rs => rs.map(r => ({ ...r, nomeCliente: c.nomeCliente ?? 'Cliente' })))
            .catch(() => [] as RecComCliente[])),
      );
      setRecs(porCliente.flat().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)));
    } catch {
      // silencioso
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function excluir(r: RecComCliente) {
    Alert.alert(t('common.excluir'), t('recomendacoes.confirmarExclusao'), [
      { text: t('common.cancelar'), style: 'cancel' },
      { text: t('common.excluir'), style: 'destructive', onPress: async () => {
        try { await assessoriaService.excluirRecomendacao(r.id); await load(); }
        catch { Alert.alert(t('recomendacoes.erroTitulo'), t('recomendacoes.erroExcluir')); }
      }},
    ]);
  }

  const total     = recs.length;
  const pendentes = recs.filter(r => r.status === 1).length;
  const aceitas   = recs.filter(r => r.status === 2).length;
  const recusadas = recs.filter(r => r.status === 3).length;

  const filtradas = recs
    .filter(r => !busca.trim() || r.nomeCliente.toLowerCase().includes(busca.trim().toLowerCase()))
    .filter(r => filtro === null || r.status === filtro);

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={s.title}>{t('recomendacoes.titulo')}</Text>
      <Text style={s.sub}>{t('recomendacoes.subtitulo')}</Text>

      {/* Métricas */}
      <View style={s.metricas}>
        <View style={s.metrica}><Text style={s.mNum}>{total}</Text><Text style={s.mLbl}>{t('recomendacoes.enviadas')}</Text></View>
        <View style={s.metrica}><Text style={[s.mNum, { color: '#f59e0b' }]}>{pendentes}</Text><Text style={s.mLbl}>{t('recomendacoes.pendentes')}</Text></View>
        <View style={s.metrica}><Text style={[s.mNum, { color: colors.green }]}>{aceitas}</Text><Text style={s.mLbl}>{t('recomendacoes.aceitas')}</Text></View>
        <View style={s.metrica}><Text style={[s.mNum, { color: colors.red }]}>{recusadas}</Text><Text style={s.mLbl}>{t('recomendacoes.recusadas')}</Text></View>
      </View>

      {/* Busca + filtros */}
      <TextInput
        style={s.busca} value={busca} onChangeText={setBusca}
        placeholder={t('recomendacoes.buscarPlaceholder')} placeholderTextColor={colors.inputPlaceholder}
      />
      <View style={s.filtros}>
        {([
          { v: null, l: t('recomendacoes.filtroContagem', { label: t('common.todos'), n: total }) },
          { v: 1, l: t('recomendacoes.filtroContagem', { label: t('recomendacoes.pendentes'), n: pendentes }) },
          { v: 2, l: t('recomendacoes.filtroContagem', { label: t('recomendacoes.aceitas'), n: aceitas }) },
          { v: 3, l: t('recomendacoes.filtroContagem', { label: t('recomendacoes.recusadas'), n: recusadas }) },
        ] as const).map(f => (
          <TouchableOpacity key={String(f.v)} style={[s.chip, filtro === f.v && s.chipAtivo]} onPress={() => setFiltro(f.v)}>
            <Text style={[s.chipTxt, filtro === f.v && s.chipTxtAtivo]}>{f.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtradas.length === 0 && (
        <View style={s.vazio}>
          <Text style={s.vazioIcon}>💬</Text>
          <Text style={s.vazioTxt}>{filtro !== null ? t('recomendacoes.vazioComStatus') : t('recomendacoes.vazioAinda')}</Text>
          <Text style={s.vazioSub}>{t('recomendacoes.vazioSub')}</Text>
        </View>
      )}

      {filtradas.map(r => {
        const st = STATUS[r.status] ?? STATUS[1];
        const aberto = expandido === r.id;
        const longo = r.texto.length > 120;
        return (
          <View key={r.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cliente}>{r.nomeCliente}</Text>
                <Text style={s.meta}>{t(TIPO_LABEL[r.tipo] ?? 'recomendacoes.tipoPadrao')} · {dataFmt(r.criadoEm)}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: st.cor + '22', borderColor: st.cor + '55' }]}>
                <Text style={[s.badgeTxt, { color: st.cor }]}>{t(st.label)}</Text>
              </View>
            </View>

            <Text style={s.texto}>
              {aberto || !longo ? r.texto : `${r.texto.slice(0, 120)}…`}
            </Text>
            {longo && (
              <TouchableOpacity onPress={() => setExpandido(aberto ? null : r.id)}>
                <Text style={s.verMais}>{aberto ? t('recomendacoes.verMenos') : t('recomendacoes.verMais')}</Text>
              </TouchableOpacity>
            )}

            {r.respostaCliente ? (
              <View style={s.resposta}>
                <Text style={s.respostaLbl}>{t('recomendacoes.respostaCliente')}</Text>
                <Text style={s.respostaTxt}>{r.respostaCliente}</Text>
              </View>
            ) : null}

            {r.status === 1 && (
              <TouchableOpacity style={s.excluir} onPress={() => excluir(r)}>
                <Text style={s.excluirTxt}>{t('common.excluir')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: c.background },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:  { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '900' },
  sub:    { color: c.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 16 },
  metricas: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  metrica: { flex: 1, minWidth: 80, backgroundColor: c.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.border },
  mNum:   { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '800' },
  mLbl:   { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  busca:  { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, marginBottom: 12 },
  filtros:{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip:   { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipAtivo: { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipTxt: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTxtAtivo: { color: c.green },
  vazio:  { alignItems: 'center', marginTop: 50 },
  vazioIcon: { fontSize: 44, marginBottom: 10 },
  vazioTxt: { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  card:   { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  cardTop:{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cliente:{ color: c.text, fontSize: 15, fontWeight: '700' },
  meta:   { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  badge:  { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  texto:  { color: c.text, fontSize: 14, lineHeight: 20 },
  verMais:{ color: c.green, fontSize: 12, fontWeight: '600', marginTop: 4 },
  resposta: { backgroundColor: c.background, borderRadius: 10, padding: 10, marginTop: 10 },
  respostaLbl: { color: c.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  respostaTxt: { color: c.text, fontSize: 13 },
  excluir: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  excluirTxt: { color: c.red, fontSize: 13, fontWeight: '600' },
});
