import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { patrimonioService, ResumoPatrimonialDto, ProjecaoDividasDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import DonutChart, { DonutSlice } from '../components/charts/DonutChart';
import LineChart from '../components/charts/LineChart';

// Paleta fixa para categorias (ordem estável = cores estáveis)
const PALETA = ['#f59e0b', '#8b5cf6', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#14b8a6', '#f97316'];
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function mesLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
}

function resumido(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

export default function PatrimonioDashboardScreen({ onLogout }: { onLogout: () => void }) {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const fmt = (v: number, moeda = 'BRL') => formatMoney(v, ocultar, moeda);

  const [dados, setDados] = useState<ResumoPatrimonialDto | null>(null);
  const [projecao, setProjecao] = useState<ProjecaoDividasDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [resumo, proj] = await Promise.all([
        patrimonioService.resumo(),
        patrimonioService.projecaoDividas().catch(() => null),
      ]);
      setDados(resumo);
      setProjecao(proj);
    } catch (e: any) {
      if (e?.response?.status === 401) { onLogout(); return; }
      setErro('Não foi possível carregar o patrimônio.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const slices: DonutSlice[] = (dados?.composicao ?? []).map((c, i) => ({
    label: c.categoria, value: c.totalBRL, color: PALETA[i % PALETA.length],
  }));

  const temProjecao = !!projecao && projecao.pontos.length > 1 && projecao.saldoInicialBRL > 0;

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={s.title}>Patrimônio</Text>
      <Text style={s.subtitle}>Seu balanço patrimonial consolidado</Text>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {dados && (
        <>
          {/* ── Balanço Patrimonial ── */}
          <View style={s.card}>
            <Text style={s.cardTitulo}>Balanço Patrimonial</Text>

            <View style={s.balancoRow}>
              <Text style={s.balancoLabel}>BENS</Text>
              <Text style={s.balancoBens}>{fmt(dados.totalBensBRL)}</Text>
            </View>

            {/* Composição */}
            {dados.composicao.map((c, i) => (
              <View key={c.categoria} style={s.compRow}>
                <View style={s.compLeft}>
                  <View style={[s.dot, { backgroundColor: PALETA[i % PALETA.length] }]} />
                  <Text style={s.compNome}>{c.categoria}</Text>
                </View>
                <View style={s.compRight}>
                  <Text style={s.compValor}>{fmt(c.totalBRL)}</Text>
                  <View style={s.pctBadge}><Text style={s.pctTxt}>{c.pct.toFixed(1)}%</Text></View>
                </View>
              </View>
            ))}
            {dados.composicao.length === 0 && (
              <Text style={s.vazio}>Nenhum bem cadastrado ainda.</Text>
            )}

            <View style={s.divider} />

            <View style={s.balancoRow}>
              <Text style={s.balancoLabel}>DÍVIDAS</Text>
              <Text style={s.balancoDividas}>{fmt(dados.totalDividasBRL)}</Text>
            </View>
            {dados.passivos.map(p => (
              <View key={p.id} style={s.compRow}>
                <View style={s.compLeft}>
                  <View style={[s.dot, { backgroundColor: colors.red }]} />
                  <Text style={s.compNome}>{p.nome} <Text style={s.prazoTag}>{p.prazo === 1 ? 'Curto' : 'Longo'}</Text></Text>
                </View>
                <Text style={s.compValor}>{fmt(p.valorBRL)}</Text>
              </View>
            ))}

            {/* Patrimônio líquido */}
            <View style={s.plBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.plLabel}>PATRIMÔNIO LÍQUIDO</Text>
                <Text style={s.plValor}>{fmt(dados.patrimonioLiquidoBRL)}</Text>
              </View>
              <View style={s.alavBox}>
                <Text style={s.alavNum}>{dados.alavancagemPct.toFixed(1)}%</Text>
                <Text style={s.alavLbl}>alavancagem</Text>
              </View>
            </View>
          </View>

          {/* ── Métricas mensais ── */}
          <View style={s.metricRow}>
            <View style={s.metric}>
              <Text style={s.metricLbl}>Receita mensal</Text>
              <Text style={[s.metricVal, { color: colors.green }]}>{fmt(dados.receitaMensalBRL)}</Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLbl}>Despesa mensal</Text>
              <Text style={[s.metricVal, { color: colors.red }]}>{fmt(dados.despesaMensalBRL)}</Text>
            </View>
          </View>
          <View style={s.metricRow}>
            <View style={s.metric}>
              <Text style={s.metricLbl}>Saldo líquido</Text>
              <Text style={[s.metricVal, { color: dados.saldoLiquidoMensalBRL >= 0 ? colors.green : colors.red }]}>
                {fmt(dados.saldoLiquidoMensalBRL)}
              </Text>
            </View>
            <View style={s.metric}>
              <Text style={s.metricLbl}>ROI anual</Text>
              <Text style={[s.metricVal, { color: colors.text }]}>
                {dados.roiAnualPct != null ? `${dados.roiAnualPct.toFixed(1)}% a.a.` : '—'}
              </Text>
            </View>
          </View>

          {/* ── Distribuição (donut) ── */}
          {slices.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitulo}>Distribuição</Text>
              <Text style={s.cardSub}>Como seu patrimônio está alocado</Text>
              <View style={s.donutWrap}>
                <DonutChart
                  data={slices}
                  size={170}
                  centerTop="Total em bens"
                  centerMain={ocultar ? 'R$ ••••' : `R$ ${resumido(dados.totalBensBRL)}`}
                  centerSub={`${slices.length} categorias`}
                  textColor={colors.text}
                  subColor={colors.textSecondary}
                  trackColor={colors.border}
                />
                <View style={s.legend}>
                  {dados.composicao.map((c, i) => (
                    <View key={c.categoria} style={s.legendRow}>
                      <View style={[s.dot, { backgroundColor: PALETA[i % PALETA.length] }]} />
                      <Text style={s.legendNome} numberOfLines={1}>{c.categoria}</Text>
                      <Text style={s.legendPct}>{c.pct.toFixed(1)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ── Projeção de pagamento das dívidas ── */}
          {temProjecao && (
            <View style={s.card}>
              <Text style={s.cardTitulo}>Projeção de Pagamento das Dívidas</Text>
              <Text style={s.cardSub}>Saldo devedor estimado ao longo do tempo</Text>
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <LineChart
                  values={projecao!.pontos.map(p => p.saldoBRL)}
                  width={300}
                  height={170}
                  color={colors.green}
                  gridColor={colors.border}
                  labelColor={colors.textSecondary}
                  xStart={mesLabel(0)}
                  xEnd={mesLabel(projecao!.horizonteMeses)}
                  formatY={(v) => ocultar ? '•••' : `R$ ${resumido(v)}`}
                />
              </View>
            </View>
          )}

          {dados.cambioEstimado && (
            <Text style={s.cambioNota}>* valores em moeda estrangeira convertidos por câmbio estimado</Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: c.background, padding: 16 },
  center:       { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:        { color: c.text, fontSize: 24, fontWeight: '900' },
  subtitle:     { color: c.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 16 },
  erro:         { color: c.red, fontSize: 14, marginBottom: 12 },
  card:         { backgroundColor: c.surface, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  cardTitulo:   { color: c.text, fontSize: 16, fontWeight: '800' },
  cardSub:      { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  balancoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, marginBottom: 8 },
  balancoLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  balancoBens:  { color: c.text, fontSize: 18, fontWeight: '800' },
  balancoDividas:{ color: c.red, fontSize: 18, fontWeight: '800' },
  compRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  compLeft:     { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  compRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:          { width: 9, height: 9, borderRadius: 5 },
  compNome:     { color: c.text, fontSize: 14, flexShrink: 1 },
  prazoTag:     { color: c.textTertiary, fontSize: 11 },
  compValor:    { color: c.text, fontSize: 14, fontWeight: '600' },
  pctBadge:     { backgroundColor: c.surfaceElevated, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, minWidth: 46, alignItems: 'center' },
  pctTxt:       { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
  divider:      { height: 1, backgroundColor: c.border, marginVertical: 12 },
  vazio:        { color: c.textTertiary, fontSize: 13, paddingVertical: 8 },
  plBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: c.greenDim, borderRadius: 12, padding: 14, marginTop: 14 },
  plLabel:      { color: c.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  plValor:      { color: c.green, fontSize: 24, fontWeight: '900', marginTop: 2 },
  alavBox:      { alignItems: 'flex-end' },
  alavNum:      { color: c.text, fontSize: 18, fontWeight: '800' },
  alavLbl:      { color: c.textSecondary, fontSize: 11 },
  metricRow:    { flexDirection: 'row', gap: 12, marginBottom: 12 },
  metric:       { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: c.border },
  metricLbl:    { color: c.textSecondary, fontSize: 12 },
  metricVal:    { fontSize: 18, fontWeight: '800', marginTop: 4 },
  donutWrap:    { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' },
  legend:       { flex: 1, minWidth: 150, gap: 7 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendNome:   { color: c.textSecondary, fontSize: 13, flex: 1 },
  legendPct:    { color: c.text, fontSize: 13, fontWeight: '700' },
  cambioNota:   { color: c.textTertiary, fontSize: 11, fontStyle: 'italic', marginBottom: 24 },
});
