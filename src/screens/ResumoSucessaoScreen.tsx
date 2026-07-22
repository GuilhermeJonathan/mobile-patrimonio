import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import {
  estruturasService, SucessaoDto, contasService, ContaDto,
  planoAcaoService, PlanoAcaoDto, GrafoEstruturasDto, relatorioService,
} from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { numBR } from '../utils/format';
import DonutChart, { DonutSlice } from '../components/charts/DonutChart';
import PlanoTrilha from '../components/charts/PlanoTrilha';
import { computeLayout } from './EstruturasScreen';

const GOLD = '#C79A4E';
const PALETA = ['#C79A4E', '#6C8EBF', '#B784D6', '#4E9A7E', '#D6795B', '#9AA5B1', '#C7574E', '#4E7EC7'];
const PAPEL_LABEL: Record<number, string> = { 1: 'Cônjuge', 2: 'Filho', 3: 'Neto', 99: 'Outro' };
const STATUS: Record<number, { label: string; cor: string }> = {
  1: { label: 'Pendente', cor: '#9AA5B1' },
  2: { label: 'Em andamento', cor: '#6C8EBF' },
  3: { label: 'Concluída', cor: '#4E9A7E' },
};
const TIPO_CONTA: Record<number, string> = { 1: 'Corrente', 2: 'Investimento / Custódia', 3: 'Internacional', 99: 'Conta' };
// Bandeiras emoji não renderizam de forma confiável no web/desktop → usamos um badge com o código do país.
function codigoPais(p?: string | null): string {
  const k = (p ?? '').toLowerCase();
  if (k.includes('bras')) return 'BR';
  if (k.includes('suí') || k.includes('sui') || k.includes('swi')) return 'CH';
  if (k.includes('eua') || k.includes('estados') || k.includes('usa') || k.includes('améric') || k.includes('americ')) return 'US';
  if (k.includes('baham')) return 'BS';
  if (k.includes('cayman')) return 'KY';
  if (k.includes('virgens') || k.includes('bvi')) return 'VG';
  if (k.includes('portug')) return 'PT';
  if (k.includes('reino') || k.includes('ingl') || k.includes('brit') || k === 'uk') return 'GB';
  if (!p?.trim()) return '—';
  return p.trim().slice(0, 2).toUpperCase();
}

function fmtBRL(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${numBR(v / 1_000_000, 2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${numBR(v / 1_000, 1)}k`;
  return `R$ ${numBR(v, 0)}`;
}
function fmtData(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function iniciais(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

export default function ResumoSucessaoScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { navigate } = useRouter();
  const { cliente } = useAssessoria();
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [suc, setSuc] = useState<SucessaoDto | null>(null);
  const [grafo, setGrafo] = useState<GrafoEstruturasDto | null>(null);
  const [contas, setContas] = useState<ContaDto[]>([]);
  const [totalContas, setTotalContas] = useState(0);
  const [planos, setPlanos] = useState<PlanoAcaoDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trilhaW, setTrilhaW] = useState(0);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [sucRes, grafoRes, contasRes, planosRes] = await Promise.all([
        estruturasService.sucessao(),
        estruturasService.grafo().catch(() => null),
        contasService.listar().catch(() => null),
        planoAcaoService.listar().catch(() => []),
      ]);
      setSuc(sucRes);
      setGrafo(grafoRes);
      setContas(contasRes?.contas ?? []);
      setTotalContas(contasRes?.totalBRL ?? 0);
      setPlanos(planosRes ?? []);
    } catch { setErro('Não foi possível carregar o resumo.'); }
    finally { setCarregando(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function gerarPdf() {
    setGerandoPdf(true);
    try {
      const blob = await relatorioService.gerarSucessao({
        clienteNome: cliente?.nome ?? null, nomeConsultoria: null, logoBase64: null, corMarca: null,
      });
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-sucessao-${(cliente?.nome ?? 'cliente').replace(/\s+/g, '-').toLowerCase()}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Relatório', 'O download do PDF está disponível na versão web por enquanto.');
      }
    } catch { Alert.alert('Erro', 'Não foi possível gerar o relatório.'); }
    finally { setGerandoPdf(false); }
  }

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const beneficiarios = suc?.beneficiarios ?? [];
  const distribuicoes = suc?.distribuicoes ?? [];
  const totalDistribuido = distribuicoes.reduce((a, d) => a + d.valorBRL, 0);
  const somaPlanejado = beneficiarios.reduce((a, b) => a + b.percentualDistribuicao, 0);

  // Distribuído por beneficiário (BRL) — inclui "sem beneficiário" no donut.
  const porBenef = new Map<string, number>();
  for (const d of distribuicoes) {
    const k = d.beneficiarioNome ?? 'Sem beneficiário';
    porBenef.set(k, (porBenef.get(k) ?? 0) + d.valorBRL);
  }
  const slices: DonutSlice[] = [...porBenef.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: PALETA[i % PALETA.length] }));

  // Planejado (%) × distribuído (R$/%) por beneficiário.
  const linhas = beneficiarios.map(b => {
    const distBRL = distribuicoes.filter(d => d.beneficiarioId === b.id).reduce((a, d) => a + d.valorBRL, 0);
    const distPct = totalDistribuido > 0 ? (distBRL / totalDistribuido) * 100 : 0;
    return { id: b.id, nome: b.nome, papel: b.papel, planejado: b.percentualDistribuicao, distBRL, distPct };
  });

  // Progresso agregado de TODOS os planos de ação (para o medidor).
  const totalEtapas = planos.reduce((a, p) => a + p.etapas.length, 0);
  const totalConcluidas = planos.reduce((a, p) => a + p.etapas.filter(e => e.status === 3).length, 0);
  const progressoPlano = totalEtapas ? Math.round((totalConcluidas / totalEtapas) * 100) : 0;

  const totalFamilia = (grafo?.totalEmEstruturasBRL ?? 0) + (grafo?.totalPessoaFisicaBRL ?? 0);
  const layoutMapa = computeLayout(grafo);
  const temMapa = (grafo?.estruturas.length ?? 0) > 0;

  // Contas agrupadas em Nacionais (onshore/Brasil) × Internacionais (offshore/exterior).
  const isNacional = (c: ContaDto) => {
    const p = (c.pais ?? '').toLowerCase();
    if (p.includes('bras')) return true;
    if (!p.trim() && c.moeda === 'BRL') return true;
    return false;
  };
  const gruposContasArr = [
    { chave: 'Nacionais', icone: '🏠', contas: contas.filter(isNacional) },
    { chave: 'Internacionais', icone: '🌐', contas: contas.filter(c => !isNacional(c)) },
  ].filter(g => g.contas.length > 0)
    .map(g => ({ ...g, total: g.contas.reduce((a, c) => a + c.valorBRL, 0) }));

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Resumo · Sucessão</Text>
          <Text style={s.subtitle}>Visão consolidada de beneficiários, distribuições, contas e plano de ação.</Text>
        </View>
        <TouchableOpacity style={s.btnPdf} onPress={gerarPdf} disabled={gerandoPdf}>
          {gerandoPdf ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPdfTxt}>📄 Gerar PDF</Text>}
        </TouchableOpacity>
      </View>
      {erro && <Text style={s.erro}>{erro}</Text>}

      {/* Hero: patrimônio total + KPIs + medidor de planejamento */}
      <View style={s.heroCard}>
        <View style={s.heroLeft}>
          <Text style={s.heroLabel}>Patrimônio total da família</Text>
          <Text style={s.heroValor}>{fmtBRL(totalFamilia)}</Text>
          <Text style={s.heroSub}>{grafo?.estruturas.length ?? 0} estrutura(s) · {fmtBRL(grafo?.totalPessoaFisicaBRL ?? 0)} pessoa física</Text>
        </View>
        <View style={s.heroStats}>
          <View style={s.statItem}><Text style={s.statValor}>{fmtBRL(totalDistribuido)}</Text><Text style={s.statLabel}>Distribuído</Text></View>
          <View style={s.statItem}><Text style={s.statValor}>{beneficiarios.length}</Text><Text style={s.statLabel}>Beneficiários</Text></View>
          <View style={s.statItem}><Text style={[s.statValor, somaPlanejado > 100 && { color: colors.red }]}>{numBR(somaPlanejado, 0)}%</Text><Text style={s.statLabel}>Planejado</Text></View>
          <View style={s.statItem}><Text style={s.statValor}>{fmtBRL(totalContas)}</Text><Text style={s.statLabel}>Em contas</Text></View>
        </View>
        <View style={s.heroGauge}>
          <DonutChart
            data={[{ label: 'Concluído', value: progressoPlano, color: GOLD }, { label: 'Restante', value: Math.max(0, 100 - progressoPlano), color: colors.border }]}
            size={104} strokeWidth={12} centerMain={`${progressoPlano}%`} centerSub="plano"
            textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
          />
          <Text style={s.gaugeLabel}>Planejamento sucessório</Text>
        </View>
      </View>

      {/* Estrutura Patrimonial Lógica (mapa read-only) */}
      {temMapa && (
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitulo}>Estrutura Patrimonial Lógica</Text>
            <TouchableOpacity onPress={() => navigate('estruturas')}><Text style={s.link}>abrir ›</Text></TouchableOpacity>
          </View>
          <View style={s.legendaTopo}>
            <View style={s.legItem}><View style={[s.legLinha, { backgroundColor: GOLD }]} /><Text style={s.legTxt}>propriedade direta</Text></View>
            <View style={s.legItem}><View style={[s.legLinha, { backgroundColor: colors.blue }]} /><Text style={s.legTxt}>benefício / família</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator style={s.mapaScroll}>
            <View style={{ width: layoutMapa.width, height: layoutMapa.height }}>
              <Svg width={layoutMapa.width} height={layoutMapa.height} style={{ position: 'absolute', left: 0, top: 0 }}>
                {layoutMapa.edges.map((e, i) => (
                  <Path key={i} d={e.d} stroke={e.benef ? colors.blue : GOLD} strokeWidth={e.benef ? 1.2 : 1.6}
                    strokeOpacity={e.benef ? 0.7 : 0.85} strokeDasharray={e.benef ? '4,4' : undefined} fill="none" />
                ))}
              </Svg>
              {layoutMapa.nodes.map(n => (
                <View key={n.id} style={[s.mapNode, {
                  left: n.x, top: n.y, width: n.w, height: n.h,
                  borderColor: (n.familia || n.benef) ? colors.blue : GOLD,
                  borderWidth: n.familia ? 2 : 1.4,
                }]}>
                  <Text style={[s.mapNodeTit, n.benef && { fontSize: 11 }]} numberOfLines={1}>{n.titulo}</Text>
                  <Text style={s.mapNodeSub} numberOfLines={1}>{n.sub}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Planejado × Distribuído */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>Planejado × Distribuído</Text>
          <TouchableOpacity onPress={() => navigate('beneficiarios')}><Text style={s.link}>gerenciar ›</Text></TouchableOpacity>
        </View>
        {linhas.length === 0 ? (
          <Text style={s.vazio}>Nenhum beneficiário cadastrado.</Text>
        ) : (
          <View style={s.pdRow}>
            {/* Tabela por beneficiário */}
            <View style={s.pdTable}>
              <View style={s.tHead}>
                <Text style={[s.tHeadTxt, { flex: 1.7 }]}>Beneficiário</Text>
                <Text style={[s.tHeadTxt, { flex: 1 }]}>Planejado</Text>
                <Text style={[s.tHeadTxt, { flex: 1.2 }]}>Distribuído</Text>
                <Text style={[s.tHeadTxt, { flex: 0.9, textAlign: 'right' }]}>Status</Text>
              </View>
              {linhas.map((l, i) => {
                const recebeu = l.distBRL > 0;
                return (
                  <View key={l.id} style={s.tRow}>
                    <View style={[s.tCel, { flex: 1.7, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                      <View style={[s.tAvatar, { backgroundColor: PALETA[i % PALETA.length] }]}><Text style={s.tAvatarTxt}>{iniciais(l.nome)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tNome} numberOfLines={1}>{l.nome}</Text>
                        <Text style={s.tPapel}>{PAPEL_LABEL[l.papel] ?? 'Outro'}</Text>
                      </View>
                    </View>
                    <View style={[s.tCel, { flex: 1 }]}>
                      <Text style={s.tPct}>{numBR(l.planejado, 0)}%</Text>
                      <View style={s.tBar}><View style={[s.tBarFill, { width: `${Math.min(l.planejado, 100)}%`, backgroundColor: GOLD }]} /></View>
                    </View>
                    <View style={[s.tCel, { flex: 1.2 }]}>
                      <Text style={s.tPct}>{fmtBRL(l.distBRL)} · {numBR(l.distPct, 0)}%</Text>
                      <View style={s.tBar}><View style={[s.tBarFill, { width: `${Math.min(l.distPct, 100)}%`, backgroundColor: colors.blue }]} /></View>
                    </View>
                    <View style={[s.tCel, { flex: 0.9, alignItems: 'flex-end' }]}>
                      <Text style={[s.statusChip, recebeu ? s.statusOk : s.statusPend]}>{recebeu ? 'Distribuído' : 'A distribuir'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Pizza ao lado */}
            {slices.length > 0 && (
              <View style={s.pdPizza}>
                <Text style={s.subTitulo}>Distribuições por beneficiário</Text>
                <View style={{ alignItems: 'center' }}>
                  <DonutChart
                    data={slices} size={132} strokeWidth={20} interactive
                    centerMain={String(slices.length)} centerSub="beneficiários"
                    textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
                  />
                </View>
                <View style={{ marginTop: 10, gap: 6 }}>
                  {slices.map((sl, i) => (
                    <View key={i} style={s.legendRow}>
                      <View style={[s.legDot, { backgroundColor: sl.color }]} />
                      <Text style={s.legendNome} numberOfLines={1}>{sl.label}</Text>
                      <Text style={s.legendPct}>{totalDistribuido > 0 ? `${(sl.value / totalDistribuido * 100).toFixed(0)}%` : '—'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Contas — visão de contas financeiras por jurisdição */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>Contas financeiras</Text>
          <TouchableOpacity onPress={() => navigate('contas')}><Text style={s.link}>gerenciar ›</Text></TouchableOpacity>
        </View>
        {contas.length === 0 ? (
          <Text style={s.vazio}>Nenhuma conta cadastrada.</Text>
        ) : gruposContasArr.map(g => (
          <View key={g.chave} style={s.grupoWrap}>
            <View style={s.grupoHead}>
              <View style={s.grupoTituloWrap}>
                <Text style={s.grupoTitulo}>{g.icone}  {g.chave}</Text>
                <Text style={s.grupoQtd}>· {g.contas.length}</Text>
              </View>
              <Text style={s.grupoTotal}>{fmtBRL(g.total)}</Text>
            </View>
            <View style={s.ccWrap}>
              {g.contas.map(c => (
                <View key={c.id} style={s.cc}>
                  <View style={s.ccTop}>
                    <View style={s.ccBadge}><Text style={s.ccBadgeTxt}>{codigoPais(c.pais)}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.ccNome} numberOfLines={1}>{c.nome}</Text>
                      <Text style={s.ccInst} numberOfLines={1}>{c.instituicao || (TIPO_CONTA[c.tipo] ?? 'Conta')}</Text>
                    </View>
                    {!!c.status && <Text style={s.ccStatus} numberOfLines={1}>{c.status}</Text>}
                  </View>
                  <View style={s.ccDivider} />
                  {c.valorPortfolio != null && (
                    <View style={s.ccLinha}><Text style={s.ccLabel}>Portfólio</Text><Text style={s.ccValor}>{c.moeda} {numBR(c.valorPortfolio, 0)}</Text></View>
                  )}
                  <View style={s.ccLinha}>
                    <Text style={s.ccLabel}>{c.agregaInvestimentos ? 'Valor (derivado)' : (c.valorPortfolio != null ? 'Caixa' : 'Saldo')}</Text>
                    <Text style={s.ccValor}>{c.moeda} {numBR(c.agregaInvestimentos ? c.valorBRL : c.saldo, 0)}</Text>
                  </View>
                  <View style={s.ccLinha}>
                    <Text style={s.ccLabel}>Em BRL</Text>
                    <Text style={s.ccValorBRL}>{fmtBRL(c.valorBRL)}</Text>
                  </View>
                  {c.lombardLimite != null && (
                    <View style={s.ccLinha}>
                      <Text style={s.ccLabel}>Lombard (disp.)</Text>
                      <Text style={s.ccValor}>{c.moeda} {numBR(c.lombardDisponivel ?? 0, 0)} / {numBR(c.lombardLimite, 0)}</Text>
                    </View>
                  )}
                  {c.agregaInvestimentos && (
                    <View style={s.ccLinha}><Text style={s.ccLabel}>Investimentos</Text><Text style={s.ccValor}>{c.qtdInvestimentos}</Text></View>
                  )}
                  {!!c.identificador && (
                    <View style={s.ccLinha}><Text style={s.ccLabel}>Conta</Text><Text style={s.ccValor} numberOfLines={1}>{c.identificador}</Text></View>
                  )}
                  <Text style={s.ccEstrutura} numberOfLines={1}>{c.estruturaNome ? `🏛 ${c.estruturaNome}` : 'Pessoa física'} · {TIPO_CONTA[c.tipo] ?? 'Conta'}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Plano de ação */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>{planos.length > 1 ? `Planos de ação (${planos.length})` : 'Plano de ação'}</Text>
          <TouchableOpacity onPress={() => navigate('plano-acao')}><Text style={s.link}>abrir ›</Text></TouchableOpacity>
        </View>
        {planos.length === 0 ? (
          <Text style={s.vazio}>Nenhum plano de ação definido.</Text>
        ) : (
          <View style={{ width: '100%' }} onLayout={e => setTrilhaW(Math.round(e.nativeEvent.layout.width))}>
            {planos.map((p, idx) => {
              const feitas = p.etapas.filter(e => e.status === 3).length;
              return (
                <View key={p.id} style={idx > 0 ? s.planoDivider : undefined}>
                  <Text style={s.planoObj}>{p.objetivo}{p.prazo ? ` · ${p.prazo}` : ''}</Text>
                  <Text style={s.planoProg}>{feitas}/{p.etapas.length} etapas concluídas</Text>
                  {p.etapas.length > 0 && trilhaW > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <PlanoTrilha
                        etapas={p.etapas.map(e => ({ titulo: e.titulo, descricao: e.descricao, prazo: e.prazo, status: e.status }))}
                        objetivo={p.objetivo} objetivoPrazo={p.prazo} width={trilhaW}
                        mutedColor={colors.border} surfaceColor={colors.surface} textColor={colors.text} fadeColor={colors.textTertiary} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  btnPdf:      { backgroundColor: GOLD, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, minWidth: 110, alignItems: 'center' },
  btnPdfTxt:   { color: '#241a08', fontWeight: '800', fontSize: 13 },
  erro:        { color: c.red, fontSize: 13, marginBottom: 8 },
  vazio:       { color: c.textSecondary, fontSize: 13, paddingVertical: 8 },
  heroCard:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 18, marginBottom: 12 },
  heroLeft:    { minWidth: 220 },
  heroLabel:   { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  heroValor:   { color: c.text, fontSize: 30, fontWeight: '900', marginTop: 4 },
  heroSub:     { color: c.textTertiary, fontSize: 11, marginTop: 4 },
  heroStats:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 16, minWidth: 240 },
  statItem:    { alignItems: 'center', minWidth: 68 },
  statValor:   { color: c.text, fontSize: 18, fontWeight: '900' },
  statLabel:   { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  heroGauge:   { alignItems: 'center' },
  gaugeLabel:  { color: c.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 6, maxWidth: 120, textAlign: 'center' },
  avatarRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  avatarItem:  { alignItems: 'center', width: 72 },
  avatar:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { color: '#fff', fontSize: 15, fontWeight: '800' },
  avatarNome:  { color: c.text, fontSize: 12, fontWeight: '600', marginTop: 4 },
  avatarPct:   { color: c.textSecondary, fontSize: 10, marginTop: 1, textAlign: 'center' },
  legLinha:    { width: 16, height: 3, borderRadius: 2 },
  mapaScroll:  { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSubtle },
  mapNode:     { position: 'absolute', backgroundColor: c.surfaceElevated, borderRadius: 10, paddingHorizontal: 10, justifyContent: 'center' },
  mapNodeTit:  { color: c.text, fontSize: 12.5, fontWeight: '700' },
  mapNodeSub:  { color: c.textSecondary, fontSize: 10.5, marginTop: 1 },
  kpiRow:      { flexDirection: 'row', gap: 12, marginBottom: 12 },
  kpiCard:     { flex: 1, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  kpiLabel:    { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
  kpiValor:    { color: c.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 },
  cardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '800' },
  link:        { color: c.green, fontSize: 13, fontWeight: '700' },
  legendaTopo: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  legItem:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legDot:      { width: 10, height: 10, borderRadius: 5 },
  legTxt:      { color: c.textSecondary, fontSize: 11 },
  tHead:       { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, gap: 8 },
  tHeadTxt:    { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  tRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  tCel:        { justifyContent: 'center' },
  tAvatar:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tAvatarTxt:  { color: '#fff', fontSize: 11, fontWeight: '800' },
  tNome:       { color: c.text, fontSize: 13, fontWeight: '700' },
  tPapel:      { color: c.textSecondary, fontSize: 10.5, marginTop: 1 },
  tPct:        { color: c.text, fontSize: 11.5, fontWeight: '600' },
  tBar:        { height: 5, borderRadius: 3, backgroundColor: c.border, marginTop: 4, overflow: 'hidden' },
  tBarFill:    { height: 5, borderRadius: 3 },
  statusChip:  { fontSize: 10.5, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden' },
  statusOk:    { color: '#4E9A7E', backgroundColor: '#4E9A7E22' },
  statusPend:  { color: c.textSecondary, backgroundColor: c.border },
  benefRow:    { paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
  benefTopo:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  benefNome:   { color: c.text, fontSize: 14, fontWeight: '700', flex: 1 },
  benefPapel:  { color: c.textSecondary, fontSize: 12, fontWeight: '400' },
  benefValor:  { color: c.text, fontSize: 14, fontWeight: '800' },
  benefMeta:   { color: c.textTertiary, fontSize: 11, marginTop: 3 },
  barBg:       { height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 4, overflow: 'hidden' },
  barFill:     { height: 6, borderRadius: 3 },
  subTitulo:   { color: c.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  pdRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' },
  pdTable:     { flexGrow: 1, flexBasis: 440, minWidth: 300 },
  pdPizza:     { flexGrow: 1, flexBasis: 240, minWidth: 220 },
  donutWrap:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutLegenda:{ flex: 1, gap: 6 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendNome:  { flex: 1, color: c.text, fontSize: 12 },
  legendPct:   { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  nome:        { color: c.text, fontSize: 14, fontWeight: '600' },
  meta:        { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  valor:       { color: c.text, fontSize: 14, fontWeight: '800' },
  grupoWrap:   { marginTop: 14 },
  grupoHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  grupoTituloWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grupoTitulo: { color: c.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  grupoQtd:    { color: c.textTertiary, fontSize: 12, fontWeight: '600' },
  grupoTotal:  { color: GOLD, fontSize: 13, fontWeight: '800' },
  ccWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cc:          { flexGrow: 1, flexBasis: 190, maxWidth: 300, backgroundColor: c.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10 },
  ccTop:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ccBadge:     { minWidth: 26, height: 22, borderRadius: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ccBadgeTxt:  { color: c.textSecondary, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  ccNome:      { color: c.text, fontSize: 13, fontWeight: '800' },
  ccInst:      { color: c.textSecondary, fontSize: 10, marginTop: 1 },
  ccStatus:    { color: GOLD, fontSize: 9.5, fontWeight: '700', backgroundColor: GOLD + '1e', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  ccDivider:   { height: 1, backgroundColor: c.border, marginVertical: 8 },
  ccLinha:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  ccLabel:     { color: c.textSecondary, fontSize: 10.5 },
  ccValor:     { color: c.text, fontSize: 11.5, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  ccValorBRL:  { color: GOLD, fontSize: 12.5, fontWeight: '800' },
  ccEstrutura: { color: c.textTertiary, fontSize: 9.5, marginTop: 5 },
  planoDivider:{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: c.border },
  planoObj:    { color: c.text, fontSize: 14, fontWeight: '700' },
  planoProg:   { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 6 },
  etapaRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border },
  etapaDot:    { width: 10, height: 10, borderRadius: 5 },
  etapaTitulo: { color: c.text, fontSize: 13, fontWeight: '600' },
});
