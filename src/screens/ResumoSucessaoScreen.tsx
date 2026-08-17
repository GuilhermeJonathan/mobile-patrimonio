import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Alert, Modal, TextInput,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import {
  estruturasService, SucessaoDto, contasService, ContaDto,
  planoAcaoService, PlanoAcaoDto, GrafoEstruturasDto, relatorioService,
  indicadoresService, IndicadoresSucessaoDto,
  patrimonioService, ResumoPatrimonialDto, investimentosService, ResumoInvestimentosDto,
} from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { numBR } from '../utils/format';
import DonutChart, { DonutSlice } from '../components/charts/DonutChart';
import PlanoTrilha from '../components/charts/PlanoTrilha';
import { computeLayout } from './EstruturasScreen';

const GOLD = '#C79A4E';
const PALETA = ['#C79A4E', '#6C8EBF', '#B784D6', '#4E9A7E', '#D6795B', '#9AA5B1', '#C7574E', '#4E7EC7'];
const PAPEL_LABEL: Record<number, string> = { 1: 'papelConjuge', 2: 'papelFilho', 3: 'papelNeto', 99: 'papelOutro' };
const STATUS: Record<number, { label: string; cor: string }> = {
  1: { label: 'Pendente', cor: '#9AA5B1' },
  2: { label: 'Em andamento', cor: '#6C8EBF' },
  3: { label: 'Concluída', cor: '#4E9A7E' },
};
const TIPO_CONTA: Record<number, string> = { 1: 'tipoContaCorrente', 2: 'tipoContaInvestimento', 3: 'tipoContaInternacional', 99: 'tipoContaGenerica' };
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
  const { t } = useTranslation();
  const s = makeStyles(colors);
  const { navigate } = useRouter();
  const { cliente } = useAssessoria();
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const [suc, setSuc] = useState<SucessaoDto | null>(null);
  const [grafo, setGrafo] = useState<GrafoEstruturasDto | null>(null);
  const [contas, setContas] = useState<ContaDto[]>([]);
  const [totalContas, setTotalContas] = useState(0);
  const [patrim, setPatrim] = useState<ResumoPatrimonialDto | null>(null);
  const [invest, setInvest] = useState<ResumoInvestimentosDto | null>(null);
  const [planos, setPlanos] = useState<PlanoAcaoDto[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadoresSucessaoDto | null>(null);
  const [editInd, setEditInd] = useState<{ gov: string; conf: string } | null>(null);
  const [salvandoInd, setSalvandoInd] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trilhaW, setTrilhaW] = useState(0);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [sucRes, grafoRes, contasRes, planosRes, indRes, patrimRes, investRes] = await Promise.all([
        estruturasService.sucessao(),
        estruturasService.grafo().catch(() => null),
        contasService.listar().catch(() => null),
        planoAcaoService.listar().catch(() => []),
        indicadoresService.obter().catch(() => null),
        patrimonioService.resumo().catch(() => null),
        investimentosService.resumo().catch(() => null),
      ]);
      setSuc(sucRes);
      setGrafo(grafoRes);
      setContas(contasRes?.contas ?? []);
      setTotalContas(contasRes?.totalBRL ?? 0);
      setPlanos(planosRes ?? []);
      setIndicadores(indRes);
      setPatrim(patrimRes);
      setInvest(investRes);
    } catch { setErro(t('resumo.erroCarregar')); }
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
        Alert.alert(t('resumo.alertRelatorioTitulo'), t('resumo.alertPdfWebOnly'));
      }
    } catch { Alert.alert(t('resumo.alertErroTitulo'), t('resumo.erroGerarRelatorio')); }
    finally { setGerandoPdf(false); }
  }

  async function salvarIndicadores() {
    if (!editInd) return;
    const parse = (v: string) => { const n = parseInt(v, 10); return v.trim() && !isNaN(n) ? Math.max(0, Math.min(100, n)) : null; };
    setSalvandoInd(true);
    try {
      await indicadoresService.salvar(parse(editInd.gov), parse(editInd.conf));
      setEditInd(null); await load();
    } catch { Alert.alert(t('resumo.alertErroTitulo'), t('resumo.erroSalvarIndicadores')); }
    finally { setSalvandoInd(false); }
  }

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const beneficiarios = suc?.beneficiarios ?? [];
  const distribuicoes = suc?.distribuicoes ?? [];
  const totalDistribuido = distribuicoes.reduce((a, d) => a + d.valorBRL, 0);
  const somaPlanejado = beneficiarios.reduce((a, b) => a + b.percentualDistribuicao, 0);

  // Distribuído por beneficiário (BRL) — inclui "sem beneficiário" no donut.
  const porBenef = new Map<string, number>();
  for (const d of distribuicoes) {
    const k = d.beneficiarioNome ?? t('resumo.semBeneficiario');
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
  const layoutMapa = computeLayout(grafo, {}, t);
  const temMapa = (grafo?.estruturas.length ?? 0) > 0;

  // Contas agrupadas em Nacionais (onshore/Brasil) × Internacionais (offshore/exterior).
  const isNacional = (c: ContaDto) => {
    const p = (c.pais ?? '').toLowerCase();
    if (p.includes('bras')) return true;
    if (!p.trim() && c.moeda === 'BRL') return true;
    return false;
  };
  const gruposContasArr = [
    { chave: 'Nacionais', tituloKey: 'contasNacionais', icone: '🏠', contas: contas.filter(isNacional) },
    { chave: 'Internacionais', tituloKey: 'contasInternacionais', icone: '🌐', contas: contas.filter(c => !isNacional(c)) },
  ].filter(g => g.contas.length > 0)
    .map(g => ({ ...g, total: g.contas.reduce((a, c) => a + c.valorBRL, 0) }));

  // Composição do patrimônio da família: cada estrutura (valor direto, sem dupla contagem
  // do aninhamento) + pessoa física. Mostra como o patrimônio está distribuído/organizado.
  const PALETA_COMP = ['#d4a24e', '#3b82f6', '#8b5cf6', '#22c55e', '#ec4899', '#14b8a6', '#f97316', '#eab308'];
  const compSlices: DonutSlice[] = [
    ...(grafo?.estruturas ?? [])
      .filter(e => e.valorDiretoBRL > 0)
      .map((e, i) => ({ label: e.nome, value: e.valorDiretoBRL, color: PALETA_COMP[i % PALETA_COMP.length] })),
    ...((grafo?.totalPessoaFisicaBRL ?? 0) > 0
      ? [{ label: t('resumo.pessoaFisica'), value: grafo!.totalPessoaFisicaBRL, color: '#6b7280' }]
      : []),
  ];

  // Composição POR NATUREZA (pedido do Adriel): societária × patrimonial × financeiro.
  // Bens vêm da composição do patrimônio (por categoria); financeiro = investimentos + caixa
  // das contas (exclui custódia, que agrega investimentos, p/ não duplicar).
  const bensComp = patrim?.composicao ?? [];
  const vSocietaria  = bensComp.filter(c => /particip/i.test(c.categoria)).reduce((a, c) => a + c.totalBRL, 0);
  const vPatrimonial = bensComp.filter(c => !/particip/i.test(c.categoria)).reduce((a, c) => a + c.totalBRL, 0);
  const vCaixa       = contas.filter(c => !c.agregaInvestimentos).reduce((a, c) => a + c.valorBRL, 0);
  const vFinanceiro  = (invest?.totalAtualBRL ?? 0) + vCaixa;
  const totalNatureza = vSocietaria + vPatrimonial + vFinanceiro;
  const naturezaSlices: DonutSlice[] = [
    { label: t('resumo.natSocietaria'),  value: vSocietaria,  color: '#8b5cf6' },
    { label: t('resumo.natPatrimonial'), value: vPatrimonial, color: '#d4a24e' },
    { label: t('resumo.natFinanceiro'),  value: vFinanceiro,  color: '#22c55e' },
  ].filter(x => x.value > 0);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('resumo.titulo')}</Text>
          <Text style={s.subtitle}>{t('resumo.subtitulo')}</Text>
        </View>
        <TouchableOpacity style={s.btnPdf} onPress={gerarPdf} disabled={gerandoPdf}>
          {gerandoPdf ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPdfTxt}>📄 {t('resumo.gerarPdf')}</Text>}
        </TouchableOpacity>
      </View>
      {erro && <Text style={s.erro}>{erro}</Text>}

      {/* Hero: patrimônio total + KPIs + medidor de planejamento */}
      <View style={s.heroCard}>
        <View style={s.heroLeft}>
          <Text style={s.heroLabel}>{t('resumo.patrimonioTotalFamilia')}</Text>
          <Text style={s.heroValor}>{fmtBRL(totalFamilia)}</Text>
          <Text style={s.heroSub}>{t('resumo.heroEstruturasResumo', { n: grafo?.estruturas.length ?? 0, valor: fmtBRL(grafo?.totalPessoaFisicaBRL ?? 0) })}</Text>
        </View>
        <View style={s.heroStats}>
          <View style={s.statItem}><Text style={s.statValor}>{fmtBRL(totalDistribuido)}</Text><Text style={s.statLabel}>{t('resumo.distribuido')}</Text></View>
          <View style={s.statItem}><Text style={s.statValor}>{beneficiarios.length}</Text><Text style={s.statLabel}>{t('resumo.beneficiarios')}</Text></View>
          <View style={s.statItem}><Text style={[s.statValor, somaPlanejado > 100 && { color: colors.red }]}>{numBR(somaPlanejado, 0)}%</Text><Text style={s.statLabel}>{t('resumo.planejado')}</Text></View>
          <View style={s.statItem}><Text style={s.statValor}>{fmtBRL(totalContas)}</Text><Text style={s.statLabel}>{t('resumo.emContas')}</Text></View>
        </View>
        <View style={s.heroGauge}>
          <DonutChart
            data={[{ label: t('resumo.concluido'), value: progressoPlano, color: GOLD }, { label: t('resumo.restante'), value: Math.max(0, 100 - progressoPlano), color: colors.border }]}
            size={104} strokeWidth={12} centerMain={`${progressoPlano}%`} centerSub={t('resumo.plano')}
            textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
          />
          <Text style={s.gaugeLabel}>{t('resumo.planejamentoSucessorioGauge')}</Text>
        </View>
      </View>

      {/* Composição do patrimônio — duas metades: por estrutura × por natureza */}
      {((compSlices.length > 1) || (naturezaSlices.length > 1)) && totalFamilia > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitulo}>{t('resumo.composicaoPatrimonio')}</Text>
          <Text style={s.cardSub}>{t('resumo.composicaoPatrimonioSub')}</Text>
          <View style={s.compRow}>
            {/* Metade 1: por estrutura */}
            <View style={s.compHalf}>
              <Text style={s.compHalfTit}>{t('resumo.porEstrutura')}</Text>
              <View style={s.compWrap}>
                <DonutChart
                  data={compSlices} size={140}
                  centerMain={fmtBRL(totalFamilia)} centerSub={t('resumo.grupos', { n: compSlices.length })}
                  textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
                />
                <View style={s.compLegend}>
                  {compSlices.map(sl => (
                    <View key={sl.label} style={s.compLegendRow}>
                      <View style={[s.compDot, { backgroundColor: sl.color }]} />
                      <Text style={s.compLegendNome} numberOfLines={1}>{sl.label}</Text>
                      <Text style={s.compLegendPct}>{(sl.value / totalFamilia * 100).toFixed(0)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Metade 2: por natureza (societária × patrimonial × financeiro) */}
            <View style={s.compHalf}>
              <Text style={s.compHalfTit}>{t('resumo.porNatureza')}</Text>
              {totalNatureza > 0 ? (
                <View style={s.compWrap}>
                  <DonutChart
                    data={naturezaSlices} size={140}
                    centerMain={fmtBRL(totalNatureza)} centerSub={t('resumo.grupos', { n: naturezaSlices.length })}
                    textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
                  />
                  <View style={s.compLegend}>
                    {naturezaSlices.map(sl => (
                      <View key={sl.label} style={s.compLegendRow}>
                        <View style={[s.compDot, { backgroundColor: sl.color }]} />
                        <Text style={s.compLegendNome} numberOfLines={1}>{sl.label}</Text>
                        <Text style={s.compLegendPct}>{(sl.value / totalNatureza * 100).toFixed(0)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : <Text style={s.cardSub}>{t('resumo.semDadosNatureza')}</Text>}
            </View>
          </View>
        </View>
      )}

      {/* "Fora de estruturas" foi movido para DENTRO do card do grafo (coluna de resumo à direita). */}

      {/* Indicadores (gauges) */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>{t('resumo.indicadores')}</Text>
          <TouchableOpacity style={s.gerenciarBtn} onPress={() => setEditInd({ gov: indicadores?.governancaOverride != null ? String(indicadores.governancaOverride) : '', conf: indicadores?.conformidadeOverride != null ? String(indicadores.conformidadeOverride) : '' })}>
            <Text style={s.gerenciarBtnTxt}>✎ {t('resumo.ajustar')}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.gaugeRow}>
          <Gauge label={`${t('resumo.governancaTrust')}${indicadores?.governancaOverride != null ? t('resumo.sufixoManual') : ''}`} val={indicadores?.governancaScore ?? null} colors={colors} s={s} />
          <Gauge label={`${t('resumo.conformidade')}${indicadores?.conformidadeOverride != null ? t('resumo.sufixoManual') : ''}`} val={indicadores?.conformidadeScore ?? null} colors={colors} s={s} />
          <Gauge label={t('resumo.planejamentoSucessorio')} val={progressoPlano} colors={colors} s={s} />
        </View>
        <Text style={s.gaugeNota}>{t('resumo.indicadoresNota')}</Text>
      </View>

      {/* Estrutura Patrimonial Lógica (mapa read-only) + resumo à direita (estruturas + fora de estruturas) */}
      {(temMapa || (grafo?.isolados?.length ?? 0) > 0) && (
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitulo}>{t('resumo.estruturaPatrimonialLogica')}</Text>
            <TouchableOpacity style={s.gerenciarBtn} onPress={() => navigate('estruturas')}>
              <Text style={s.gerenciarBtnTxt}>⚙ {t('resumo.gerenciar')}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.mapaRow}>
            {/* Mapa (esquerda) */}
            {temMapa && (
              <View style={s.mapaCol}>
                <View style={s.legendaTopo}>
                  <View style={s.legItem}><View style={[s.legLinha, { backgroundColor: GOLD }]} /><Text style={s.legTxt}>{t('resumo.propriedadeDireta')}</Text></View>
                  <View style={s.legItem}><View style={[s.legLinha, { backgroundColor: colors.blue }]} /><Text style={s.legTxt}>{t('resumo.beneficioFamilia')}</Text></View>
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

            {/* Resumo (direita): proporção por estrutura + itens fora de estrutura por membro */}
            <View style={s.resumoCol}>
              {temMapa && (
                <View style={s.estResumo}>
                  {[...(grafo?.estruturas ?? [])].sort((a, b) => b.valorTotalBRL - a.valorTotalBRL).map(e => {
                    const pct = totalFamilia > 0 ? e.valorTotalBRL / totalFamilia * 100 : 0;
                    return (
                      <View key={e.id} style={s.estResumoRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.estResumoNome} numberOfLines={1}>{e.nome}</Text>
                          <View style={s.estBarTrack}><View style={[s.estBarFill, { width: `${Math.min(100, pct)}%` }]} /></View>
                        </View>
                        <Text style={s.estResumoVal}>{fmtBRL(e.valorTotalBRL)}</Text>
                      </View>
                    );
                  })}
                  {(grafo?.totalPessoaFisicaBRL ?? 0) > 0 && (
                    <View style={s.estResumoRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.estResumoNome, { color: colors.textSecondary }]} numberOfLines={1}>{t('resumo.pessoaFisicaForaEstruturas')}</Text>
                        <View style={s.estBarTrack}><View style={[s.estBarFill, { width: `${totalFamilia > 0 ? Math.min(100, grafo!.totalPessoaFisicaBRL / totalFamilia * 100) : 0}%`, backgroundColor: colors.textTertiary }]} /></View>
                      </View>
                      <Text style={s.estResumoVal}>{fmtBRL(grafo?.totalPessoaFisicaBRL ?? 0)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Fora de estruturas — agrupado por membro da família */}
              {(grafo?.isolados?.length ?? 0) > 0 && (() => {
                const isolados = grafo!.isolados!;
                const grupos: Record<string, typeof isolados> = {} as any;
                isolados.forEach(it => { const k = it.beneficiarioNome ?? '__none__'; (grupos[k] ??= []).push(it); });
                const ordem = Object.keys(grupos).sort((a, b) => a === '__none__' ? 1 : b === '__none__' ? -1 : a.localeCompare(b));
                return (
                  <View style={s.foraBox}>
                    <Text style={s.foraTit}>⚠ {t('resumo.foraDeEstruturas')}</Text>
                    <Text style={s.cardSub}>{t('resumo.foraDeEstruturasSub')}</Text>
                    {ordem.map(k => (
                      <View key={k} style={{ marginTop: 8 }}>
                        <Text style={s.foraGrupo}>{k === '__none__' ? t('resumo.naoAtribuido') : `👤 ${k}`}</Text>
                        {grupos[k].map(it => (
                          <View key={`${it.tipo}-${it.id}`} style={s.isoRow}>
                            <Text style={s.isoNome} numberOfLines={1}>
                              {it.tipo === 'ativo' ? '🏛️' : it.tipo === 'investimento' ? '💹' : '🏦'} {it.nome}
                            </Text>
                            <Text style={s.isoVal}>{fmtBRL(it.valorBRL)}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          </View>
        </View>
      )}

      {/* Planejado × Distribuído */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>{t('resumo.planejadoXDistribuido')}</Text>
          <TouchableOpacity style={s.gerenciarBtn} onPress={() => navigate('beneficiarios')}><Text style={s.gerenciarBtnTxt}>⚙ {t('resumo.gerenciar')}</Text></TouchableOpacity>
        </View>
        {linhas.length === 0 ? (
          <Text style={s.vazio}>{t('resumo.nenhumBeneficiario')}</Text>
        ) : (
          <View style={s.pdRow}>
            {/* Tabela por beneficiário */}
            <View style={s.pdTable}>
              <View style={s.tHead}>
                <Text style={[s.tHeadTxt, { flex: 1.7 }]}>{t('resumo.beneficiario')}</Text>
                <Text style={[s.tHeadTxt, { flex: 1 }]}>{t('resumo.planejado')}</Text>
                <Text style={[s.tHeadTxt, { flex: 1.2 }]}>{t('resumo.distribuido')}</Text>
                <Text style={[s.tHeadTxt, { flex: 0.9, textAlign: 'right' }]}>{t('resumo.status')}</Text>
              </View>
              {linhas.map((l, i) => {
                const recebeu = l.distBRL > 0;
                return (
                  <View key={l.id} style={s.tRow}>
                    <View style={[s.tCel, { flex: 1.7, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                      <View style={[s.tAvatar, { backgroundColor: PALETA[i % PALETA.length] }]}><Text style={s.tAvatarTxt}>{iniciais(l.nome)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.tNome} numberOfLines={1}>{l.nome}</Text>
                        <Text style={s.tPapel}>{t(`resumo.${PAPEL_LABEL[l.papel] ?? 'papelOutro'}`)}</Text>
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
                      <Text style={[s.statusChip, recebeu ? s.statusOk : s.statusPend]}>{recebeu ? t('resumo.distribuido') : t('resumo.aDistribuir')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Pizza ao lado */}
            {slices.length > 0 && (
              <View style={s.pdPizza}>
                <Text style={s.subTitulo}>{t('resumo.distribuicoesPorBeneficiario')}</Text>
                <View style={{ alignItems: 'center' }}>
                  <DonutChart
                    data={slices} size={132} strokeWidth={20} interactive
                    centerMain={String(slices.length)} centerSub={t('resumo.beneficiariosMin')}
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
          <Text style={s.cardTitulo}>{t('resumo.contasFinanceiras')}</Text>
          <TouchableOpacity style={s.gerenciarBtn} onPress={() => navigate('contas')}><Text style={s.gerenciarBtnTxt}>⚙ {t('resumo.gerenciar')}</Text></TouchableOpacity>
        </View>
        {/* Gráfico das contas (composição por conta) ao lado do total */}
        {contas.length > 0 && (() => {
          const ccSlices = contas.filter(c => c.valorBRL > 0)
            .map((c, i) => ({ label: c.nome, value: c.valorBRL, color: PALETA_COMP[i % PALETA_COMP.length] }));
          const totalCC = ccSlices.reduce((a, sl) => a + sl.value, 0);
          if (totalCC <= 0) return null;
          return (
            <View style={[s.compWrap, { marginBottom: 14, maxWidth: 420 }]}>
              <DonutChart data={ccSlices} size={120} strokeWidth={16}
                centerMain={fmtBRL(totalCC)} centerSub={t('resumo.emContas')}
                textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border} />
              <View style={s.compLegend}>
                {ccSlices.map(sl => (
                  <View key={sl.label} style={s.compLegendRow}>
                    <View style={[s.compDot, { backgroundColor: sl.color }]} />
                    <Text style={s.compLegendNome} numberOfLines={1}>{sl.label}</Text>
                    <Text style={s.compLegendPct}>{(sl.value / totalCC * 100).toFixed(0)}%</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}
        {contas.length === 0 ? (
          <Text style={s.vazio}>{t('resumo.nenhumaConta')}</Text>
        ) : gruposContasArr.map(g => (
          <View key={g.chave} style={s.grupoWrap}>
            <View style={s.grupoHead}>
              <View style={s.grupoTituloWrap}>
                <Text style={s.grupoTitulo}>{g.icone}  {t(`resumo.${g.tituloKey}`)}</Text>
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
                      <Text style={s.ccInst} numberOfLines={1}>{c.instituicao || t(`resumo.${TIPO_CONTA[c.tipo] ?? 'tipoContaGenerica'}`)}</Text>
                    </View>
                    {!!c.status && <Text style={s.ccStatus} numberOfLines={1}>{c.status}</Text>}
                  </View>
                  <View style={s.ccDivider} />
                  {c.valorPortfolio != null && (
                    <View style={s.ccLinha}><Text style={s.ccLabel}>{t('resumo.portfolio')}</Text><Text style={s.ccValor}>{c.moeda} {numBR(c.valorPortfolio, 0)}</Text></View>
                  )}
                  <View style={s.ccLinha}>
                    <Text style={s.ccLabel}>{c.agregaInvestimentos ? t('resumo.valorDerivado') : (c.valorPortfolio != null ? t('resumo.caixa') : t('resumo.saldo'))}</Text>
                    <Text style={s.ccValor}>{c.moeda} {numBR(c.agregaInvestimentos ? c.valorBRL : c.saldo, 0)}</Text>
                  </View>
                  <View style={s.ccLinha}>
                    <Text style={s.ccLabel}>{t('resumo.emBrl')}</Text>
                    <Text style={s.ccValorBRL}>{fmtBRL(c.valorBRL)}</Text>
                  </View>
                  {c.lombardLimite != null && (
                    <View style={s.ccLinha}>
                      <Text style={s.ccLabel}>{t('resumo.lombardDisp')}</Text>
                      <Text style={s.ccValor}>{c.moeda} {numBR(c.lombardDisponivel ?? 0, 0)} / {numBR(c.lombardLimite, 0)}</Text>
                    </View>
                  )}
                  {c.agregaInvestimentos && (
                    <View style={s.ccLinha}><Text style={s.ccLabel}>{t('resumo.investimentos')}</Text><Text style={s.ccValor}>{c.qtdInvestimentos}</Text></View>
                  )}
                  {!!c.identificador && (
                    <View style={s.ccLinha}><Text style={s.ccLabel}>{t('resumo.conta')}</Text><Text style={s.ccValor} numberOfLines={1}>{c.identificador}</Text></View>
                  )}
                  <Text style={s.ccEstrutura} numberOfLines={1}>{c.estruturaNome ? `🏛 ${c.estruturaNome}` : t('resumo.pessoaFisica')} · {t(`resumo.${TIPO_CONTA[c.tipo] ?? 'tipoContaGenerica'}`)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Plano de ação */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Text style={s.cardTitulo}>{planos.length > 1 ? t('resumo.planosAcao', { n: planos.length }) : t('resumo.planoAcao')}</Text>
          <TouchableOpacity style={s.gerenciarBtn} onPress={() => navigate('plano-acao')}><Text style={s.gerenciarBtnTxt}>⚙ {t('resumo.gerenciar')}</Text></TouchableOpacity>
        </View>
        {planos.length === 0 ? (
          <Text style={s.vazio}>{t('resumo.nenhumPlanoAcao')}</Text>
        ) : (
          <View style={{ width: '100%' }} onLayout={e => setTrilhaW(Math.round(e.nativeEvent.layout.width))}>
            {planos.map((p, idx) => {
              const feitas = p.etapas.filter(e => e.status === 3).length;
              return (
                <View key={p.id} style={idx > 0 ? s.planoDivider : undefined}>
                  <Text style={s.planoObj}>{p.objetivo}{p.prazo ? ` · ${p.prazo}` : ''}</Text>
                  <Text style={s.planoProg}>{t('resumo.etapasConcluidas', { feitas, total: p.etapas.length })}</Text>
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

      {/* Modal: editar indicadores */}
      <Modal visible={editInd !== null} animationType="slide" transparent onRequestClose={() => setEditInd(null)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('resumo.ajustarIndicadores')}</Text>
            <Text style={s.modalSub}>{t('resumo.ajustarIndicadoresSub')}</Text>
            <Text style={s.mLabel}>{t('resumo.governancaTrust')}</Text>
            <TextInput style={s.mInput} value={editInd?.gov ?? ''} onChangeText={v => setEditInd(f => f && { ...f, gov: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder={t('resumo.exemplo90')} placeholderTextColor={colors.inputPlaceholder} />
            <Text style={s.mLabel}>{t('resumo.conformidade')}</Text>
            <TextInput style={s.mInput} value={editInd?.conf ?? ''} onChangeText={v => setEditInd(f => f && { ...f, conf: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" placeholder={t('resumo.exemplo95')} placeholderTextColor={colors.inputPlaceholder} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[s.mBtn, s.mBtnCancel]} onPress={() => setEditInd(null)}><Text style={s.mBtnCancelTxt}>{t('common.cancelar')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.mBtn, s.mBtnOk]} onPress={salvarIndicadores} disabled={salvandoInd}>
                {salvandoInd ? <ActivityIndicator color="#fff" /> : <Text style={s.mBtnOkTxt}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Gauge({ label, val, colors, s }: { label: string; val: number | null; colors: any; s: any }) {
  const { t } = useTranslation();
  const cor = val == null ? colors.border : val >= 80 ? '#4E9A7E' : val >= 50 ? GOLD : '#C7574E';
  const data: DonutSlice[] = [
    { label: 'v', value: val ?? 0, color: cor },
    { label: 'r', value: 100 - (val ?? 0), color: colors.border },
  ];
  return (
    <View style={s.gaugeItem}>
      <DonutChart data={data} size={96} strokeWidth={10}
        centerMain={val == null ? '—' : String(val)} centerSub={val == null ? t('resumo.semNota') : '/100'}
        textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border} />
      <Text style={s.gaugeLbl} numberOfLines={2}>{label}</Text>
    </View>
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
  heroValor:   { fontFamily: FONT_SERIF, color: c.text, fontSize: 32, fontWeight: '700', marginTop: 4 },
  heroSub:     { color: c.textTertiary, fontSize: 11, marginTop: 4 },
  heroStats:   { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 16, minWidth: 240 },
  statItem:    { alignItems: 'center', minWidth: 68 },
  statValor:   { color: c.text, fontSize: 18, fontWeight: '900' },
  statLabel:   { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  heroGauge:   { alignItems: 'center' },
  gaugeLabel:  { color: c.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 6, maxWidth: 120, textAlign: 'center' },
  gaugeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-around', marginTop: 4 },
  gaugeItem:   { alignItems: 'center', width: 120 },
  gaugeLbl:    { color: c.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  gaugeNota:   { color: c.textTertiary, fontSize: 10, marginTop: 10, fontStyle: 'italic' },
  overlay:     { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard:   { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 24, width: '100%', maxWidth: 420 },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800' },
  modalSub:    { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 8 },
  mLabel:      { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  mInput:      { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  mBtn:        { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  mBtnCancel:  { backgroundColor: c.surfaceElevated },
  mBtnCancelTxt:{ color: c.textSecondary, fontWeight: '700' },
  mBtnOk:      { backgroundColor: c.green },
  mBtnOkTxt:   { color: '#fff', fontWeight: '700' },
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
  cardTitulo:  { fontFamily: FONT_SERIF, color: c.text, fontSize: 16, fontWeight: '700' },
  cardSub:     { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 10 },
  compRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  compHalf:    { flexGrow: 1, flexBasis: 300, minWidth: 260 },
  compHalfTit: { color: c.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  compWrap:    { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  compLegend:  { flex: 1, minWidth: 140, gap: 6 },
  compLegendRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compDot:     { width: 10, height: 10, borderRadius: 5 },
  compLegendNome: { flex: 1, color: c.text, fontSize: 13 },
  compLegendPct:  { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  mapaRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8, alignItems: 'flex-start' },
  mapaCol:        { flexGrow: 1, flexBasis: 380, minWidth: 300 },
  resumoCol:      { flexGrow: 1, flexBasis: 260, minWidth: 240, gap: 8 },
  gerenciarBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: c.greenDim, borderColor: c.greenBorder, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  gerenciarBtnTxt:{ color: c.green, fontSize: 13, fontWeight: '700' },
  foraBox:        { marginTop: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  foraTit:        { color: c.orange, fontSize: 13, fontWeight: '800' },
  foraGrupo:      { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  estResumo:      { marginTop: 12, gap: 10 },
  estResumoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  estResumoNome:  { color: c.text, fontSize: 13, fontWeight: '600' },
  estBarTrack:    { height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 5, overflow: 'hidden' },
  estBarFill:     { height: 6, borderRadius: 3, backgroundColor: GOLD },
  estResumoVal:   { color: c.text, fontSize: 13, fontWeight: '700', minWidth: 96, textAlign: 'right' },
  isoRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border },
  isoNome:     { flex: 1, color: c.text, fontSize: 13 },
  isoVal:      { color: c.text, fontSize: 13, fontWeight: '700' },
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
  pdPizza:     { flexGrow: 1, flexBasis: 240, minWidth: 220, maxWidth: 320 },
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
