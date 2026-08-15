import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Modal, TextInput } from 'react-native';
import {
  patrimonioService, assessoriaService, gestaoService, investimentosService,
  MeuAssessorDto, ResumoPatrimonialDto, DashboardDto, MetaDto, ResumoInvestimentosDto, RecomendacaoDto,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { useTranslation } from '../i18n';
import { useRouter, Rota } from '../navigation/router';
import { useAssessoria } from '../contexts/AssessoriaContext';
import DonutChart, { DonutSlice } from '../components/charts/DonutChart';

interface AssessorHome {
  aum: number;            // patrimônio (bens) sob gestão
  totalLiquido: number;
  totalDividas: number;
  qtdAtivos: number;
  qtdClientes: number;
  pendentes: number;
  emAtencao: number;             // clientes com saúde em Atenção/Crítica
  respostasNaoVistas: number;    // clientes que responderam recomendações (não lidas)
  topClientes: { clienteId: string; nome: string; liquido: number }[];
  composicao: { categoria: string; totalBRL: number }[];
}

const PALETA = ['#f59e0b', '#8b5cf6', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#14b8a6', '#f97316'];

// Agrupa investimentos por uma chave (classe/custodiante) somando o valor em BRL.
function agrupar(items: { valorAtualBRL?: number; valorAtual: number }[], chave: (i: any) => string) {
  const map = new Map<string, number>();
  for (const i of items) {
    const v = i.valorAtualBRL ?? i.valorAtual;
    map.set(chave(i), (map.get(chave(i)) ?? 0) + v);
  }
  return [...map.entries()]
    .map(([label, valor], idx) => ({ label, value: valor, color: PALETA[idx % PALETA.length] }))
    .sort((a, b) => b.value - a.value);
}

function resumido(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

function abrirWhatsApp(numero: string, nome: string | null) {
  const digits = numero.replace(/\D/g, '');
  const comDdi = digits.startsWith('55') ? digits : `55${digits}`;
  const msg = encodeURIComponent(`Olá${nome ? `, ${nome}` : ''}! Falo pelo app de patrimônio.`);
  Linking.openURL(`https://wa.me/${comDdi}?text=${msg}`);
}

export default function HomeScreen({ isAssessor = false }: { isAssessor?: boolean }) {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const { navigate, param, clearParam } = useRouter();
  const { entrar } = useAssessoria();
  const { t } = useTranslation();
  const s = makeStyles(colors);
  const fmt = (v: number) => formatMoney(v, ocultar);

  const [assessorHome, setAssessorHome] = useState<AssessorHome | null>(null);
  const [patrim, setPatrim]             = useState<ResumoPatrimonialDto | null>(null);
  const [dash, setDash]                 = useState<DashboardDto | null>(null);
  const [metas, setMetas]               = useState<MetaDto[]>([]);
  const [invest, setInvest]             = useState<ResumoInvestimentosDto | null>(null);
  const [consultor, setConsultor]       = useState<MeuAssessorDto | null>(null);
  const [recomendacoes, setRecomendacoes] = useState<RecomendacaoDto[]>([]);
  const [carregando, setCarregando]     = useState(true);

  // modal recomendações do cliente
  const [recomModal, setRecomModal]         = useState(false);
  const [recomSel, setRecomSel]             = useState<RecomendacaoDto | null>(null);
  const [comentario, setComentario]         = useState('');
  const [respondendo, setRespondendo]       = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (isAssessor) {
          const todos = await assessoriaService.clientes();
          const ativos = todos.filter(c => c.ativo);
          const pendentes = todos.filter(c => !c.ativo).length;

          const comResumo = await Promise.all(
            ativos.map(async c => ({ c, r: await assessoriaService.resumoCliente(c.clienteId).catch(() => null) })),
          );

          const aum          = comResumo.reduce((sum, x) => sum + (x.r?.totalBensBRL ?? x.r?.totalConsolidadoBRL ?? 0), 0);
          const totalLiquido = comResumo.reduce((sum, x) => sum + (x.r?.patrimonioLiquidoBRL ?? 0), 0);
          const totalDividas = comResumo.reduce((sum, x) => sum + (x.r?.totalDividasBRL ?? 0), 0);
          const qtdAtivos    = comResumo.reduce((sum, x) => sum + (x.r?.qtdAtivos ?? 0), 0);

          const topClientes = comResumo
            .map(x => ({ clienteId: x.c.clienteId, nome: x.c.nomeCliente ?? t('home.cliente'), liquido: x.r?.patrimonioLiquidoBRL ?? 0 }))
            .sort((a, b) => b.liquido - a.liquido)
            .slice(0, 5);

          const compMap = new Map<string, number>();
          for (const x of comResumo)
            for (const cat of (x.r?.composicao ?? []))
              compMap.set(cat.categoria, (compMap.get(cat.categoria) ?? 0) + cat.totalBRL);
          const composicao = [...compMap.entries()]
            .map(([categoria, totalBRL]) => ({ categoria, totalBRL }))
            .sort((a, b) => b.totalBRL - a.totalBRL);

          // Clientes em atenção (saúde) + respostas dos clientes — em paralelo
          const agora = new Date();
          const [saudes, respostas] = await Promise.all([
            Promise.all(ativos.map(c =>
              assessoriaService.saude(c.clienteId, agora.getMonth() + 1, agora.getFullYear()).catch(() => null))),
            assessoriaService.respostasRecomendacoes().catch(() => ({ naoVistas: 0, itens: [] })),
          ]);
          const emAtencao = saudes.filter(s =>
            s && s.classificacao !== 'Excelente' && s.classificacao !== 'Boa' && s.classificacao !== 'Sem dados').length;

          if (vivo) setAssessorHome({
            aum, totalLiquido, totalDividas, qtdAtivos, qtdClientes: ativos.length, pendentes,
            emAtencao, respostasNaoVistas: respostas.naoVistas, topClientes, composicao,
          });
        } else {
          const now = new Date();
          const [r, cons, d, m, inv] = await Promise.all([
            patrimonioService.resumo().catch(() => null),
            assessoriaService.meuAssessor().catch(() => null),
            gestaoService.dashboard(now.getMonth() + 1, now.getFullYear()).catch(() => null),
            gestaoService.metas().catch(() => [] as MetaDto[]),
            investimentosService.resumo().catch(() => null),
          ]);
          if (vivo) { setPatrim(r); setConsultor(cons); setDash(d); setMetas(m); setInvest(inv); }
          // Carrega recomendações pendentes do assessor
          assessoriaService.minhasRecomendacoes()
            .then(lista => { if (vivo) setRecomendacoes(lista.filter(rec => rec.status === 1)); })
            .catch(() => {});
        }
      } catch {
        // silencioso — cada bloco trata o próprio vazio
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [isAssessor]);

  async function abrirRecom(r: RecomendacaoDto) {
    setRecomSel(r); setComentario(''); setRecomModal(true);
  }

  // Abre direto a recomendação indicada pelo sino (navigate('home', 'rec:<id>')).
  useEffect(() => {
    if (!param?.startsWith('rec:') || recomendacoes.length === 0) return;
    const id = param.slice(4);
    const alvo = recomendacoes.find(r => r.id === id);
    if (alvo) abrirRecom(alvo);
    clearParam();
  }, [param, recomendacoes]);

  async function responder(aceitar: boolean) {
    if (!recomSel) return;
    setRespondendo(true);
    try {
      await assessoriaService.responderRecomendacao(recomSel.id, aceitar, comentario || undefined);
      setRecomendacoes(prev => prev.filter(r => r.id !== recomSel.id));
      setRecomModal(false);
    } catch { /* silencia */ }
    finally { setRespondendo(false); }
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const Widget = ({ titulo, rota, children }: { titulo: string; rota?: Rota; children: React.ReactNode }) => (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={s.cardTitulo}>{titulo}</Text>
        {rota && (
          <TouchableOpacity onPress={() => navigate(rota)}>
            <Text style={s.verDetalhes}>{t('home.verDetalhes')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );

  // ── Visão do assessor (painel do book) ──
  if (isAssessor) {
    const h = assessorHome;
    const bookSlices: DonutSlice[] = (h?.composicao ?? []).map((c, i) => ({
      label: c.categoria, value: c.totalBRL, color: PALETA[i % PALETA.length],
    }));
    const bookTotal = (h?.composicao ?? []).reduce((sum, c) => sum + c.totalBRL, 0);

    function verPainel(clienteId: string, nome: string) {
      entrar({ clienteId, nome });
      navigate('patrimonio');
    }

    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
        <Text style={s.saudacao}>{t('home.bemVindo')} 👋</Text>
        <Text style={s.sub}>{t('home.painelAssessor')}</Text>

        {/* Patrimônio líquido sob gestão */}
        <View style={s.destaque}>
          <Text style={s.destaqueLabel}>{t('home.patrimonioLiquidoSobGestao')}</Text>
          <Text style={s.destaqueValor}>{fmt(h?.totalLiquido ?? 0)}</Text>
          <Text style={s.destaqueQtd}>{t('home.bensDividasValor', { bens: fmt(h?.aum ?? 0), dividas: fmt(h?.totalDividas ?? 0) })}</Text>
        </View>

        {/* Métricas */}
        <View style={s.metricas}>
          <TouchableOpacity style={s.metricaCard} onPress={() => navigate('clientes')}>
            <Text style={s.metricaIcon}>👥</Text>
            <Text style={s.metricaValor}>{h?.qtdClientes ?? 0}</Text>
            <Text style={s.metricaLabel}>{t('home.clientesAtivos')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.metricaCard} onPress={() => navigate('clientes')}>
            <Text style={s.metricaIcon}>⚠️</Text>
            <Text style={[s.metricaValor, (h?.emAtencao ?? 0) > 0 && { color: '#f59e0b' }]}>{h?.emAtencao ?? 0}</Text>
            <Text style={s.metricaLabel}>{t('home.emAtencao')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.metricaCard} onPress={() => navigate('recomendacoes')}>
            <Text style={s.metricaIcon}>💬</Text>
            <Text style={[s.metricaValor, (h?.respostasNaoVistas ?? 0) > 0 && { color: colors.green }]}>{h?.respostasNaoVistas ?? 0}</Text>
            <Text style={s.metricaLabel}>{t('home.respostasNovas')}</Text>
          </TouchableOpacity>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>🏛️</Text>
            <Text style={s.metricaValor}>{h?.qtdAtivos ?? 0}</Text>
            <Text style={s.metricaLabel}>{t('home.ativosNaCarteira')}</Text>
          </View>
        </View>

        {/* Convites pendentes */}
        {(h?.pendentes ?? 0) > 0 && (
          <TouchableOpacity style={s.pendentesCard} onPress={() => navigate('clientes')}>
            <Text style={s.pendentesTxt}>⏳ {t('home.convitesPendentes', { n: h!.pendentes })}</Text>
            <Text style={s.verDetalhes}>{t('home.ver')}</Text>
          </TouchableOpacity>
        )}

        {/* Top clientes */}
        {(h?.topClientes.length ?? 0) > 0 && (
          <View style={{ ...StyleSheet.flatten(s.card), marginTop: 16 }}>
            <View style={s.cardHead}>
              <Text style={s.cardTitulo}>{t('home.topClientes')}</Text>
              <TouchableOpacity onPress={() => navigate('clientes')}>
                <Text style={s.verDetalhes}>{t('home.verTodos')}</Text>
              </TouchableOpacity>
            </View>
            {h!.topClientes.map((c, i) => (
              <TouchableOpacity key={c.clienteId} style={s.topRow} onPress={() => verPainel(c.clienteId, c.nome)}>
                <Text style={s.topPos}>{i + 1}</Text>
                <Text style={s.topNome} numberOfLines={1}>{c.nome}</Text>
                <Text style={s.topValor}>{fmt(c.liquido)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Composição agregada do book */}
        {bookSlices.length > 0 && (
          <View style={s.card}>
            <Text style={{ ...StyleSheet.flatten(s.cardTitulo), marginBottom: 12 }}>{t('home.composicaoCarteira')}</Text>
            <View style={s.donutWrap}>
              <DonutChart
                data={bookSlices} size={150}
                centerTop={t('home.sobGestao')} centerMain={ocultar ? 'R$ ••' : `R$ ${resumido(bookTotal)}`}
                centerSub={t('home.categoriaPlur', { n: bookSlices.length })}
                textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
              />
              <View style={s.legend}>
                {(h?.composicao ?? []).slice(0, 6).map((c, i) => (
                  <View key={c.categoria} style={s.legendRow}>
                    <View style={[s.dot, { backgroundColor: PALETA[i % PALETA.length] }]} />
                    <Text style={s.legendNome} numberOfLines={1}>{c.categoria}</Text>
                    <Text style={s.legendPct}>{bookTotal > 0 ? `${(c.totalBRL / bookTotal * 100).toFixed(0)}%` : '—'}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // ── Visão do cliente (dashboard) ──
  const slices: DonutSlice[] = (patrim?.composicao ?? []).map((c, i) => ({
    label: c.categoria, value: c.totalBRL, color: PALETA[i % PALETA.length],
  }));
  // Dívidas agrupadas por prazo (curto/longo) → pizza ao lado dos bens
  const DIVIDA_PALETA = ['#E5573F', '#E5943F', '#B23A2E'];
  const PRAZO_DIVIDA_LABEL: Record<number, string> = { 1: t('home.curtoPrazo'), 2: t('home.longoPrazo') };
  const dividaMap = new Map<string, number>();
  for (const p of (patrim?.passivos ?? []))
    dividaMap.set(PRAZO_DIVIDA_LABEL[p.prazo] ?? t('home.outros'), (dividaMap.get(PRAZO_DIVIDA_LABEL[p.prazo] ?? t('home.outros')) ?? 0) + p.valorBRL);
  const dividaSlices: DonutSlice[] = [...dividaMap.entries()].map(([label, value], i) => ({
    label, value, color: DIVIDA_PALETA[i % DIVIDA_PALETA.length],
  }));
  const totalDividas = patrim?.totalDividasBRL ?? 0;
  const metasAtivas = metas.filter(m => m.status === 1).slice(0, 3);
  const invItens = invest?.investimentos ?? [];
  const TIPO_INVEST_LABEL: Record<number, string> = {
    1: t('home.classeAcoes'), 2: 'FII', 3: 'ETF', 4: t('home.classeRendaFixa'),
    5: t('home.classeMultimercado'), 6: t('home.classeCripto'), 7: t('home.classeExterior'), 99: t('home.classeOutro'),
  };
  const porClasse = agrupar(invItens, (i: any) => TIPO_INVEST_LABEL[i.tipo] ?? t('home.classeOutro'));
  const porCustodiante = agrupar(invItens, (i: any) => i.corretora ?? t('home.semCustodiante'));

  const AllocDonut = ({ titulo, dados, unidade }: { titulo: string; dados: DonutSlice[]; unidade: string }) => {
    const total = dados.reduce((sum, d) => sum + d.value, 0);
    return (
      <View style={s.allocCol}>
        <Text style={s.allocTitulo}>{titulo}</Text>
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <DonutChart
            data={dados} size={130} strokeWidth={20}
            centerMain={String(dados.length)} centerSub={unidade}
            textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
          />
        </View>
        {dados.slice(0, 4).map((d, i) => (
          <View key={d.label} style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: d.color }]} />
            <Text style={s.legendNome} numberOfLines={1}>{d.label}</Text>
            <Text style={s.legendPct}>{total > 0 ? `${(d.value / total * 100).toFixed(0)}%` : '—'}</Text>
          </View>
        ))}
      </View>
    );
  };

  // Cliente recém-entrado, sem nada cadastrado → onboarding
  const semDados =
    (patrim?.qtdAtivos ?? 0) === 0 &&
    (patrim?.passivos?.length ?? 0) === 0 &&
    invItens.length === 0 &&
    metas.length === 0 &&
    (dash?.totalCreditos ?? 0) === 0 &&
    (dash?.totalDebitos ?? 0) === 0;

  const passosOnboarding = [
    { icon: '🏛️', label: t('home.passoAtivo'),        rota: 'ativos' as const },
    { icon: '💸', label: t('home.passoLancamento'),   rota: 'gp-lancamentos' as const },
    { icon: '🎯', label: t('home.passoMeta'),         rota: 'gp-metas' as const },
    { icon: '💹', label: t('home.passoInvestimento'), rota: 'investimentos' as const },
  ];

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={s.saudacao}>{t('home.bemVindo')} 👋</Text>
      <Text style={s.sub}>{t('home.painelGestao')}</Text>

      {consultor?.temAssessor && (
        <View style={s.consultor}>
          <View style={{ flex: 1 }}>
            <Text style={s.consultorLabel}>👤 {t('home.seuConsultor')}</Text>
            <Text style={s.consultorNome}>{consultor.nomeAssessor ?? t('home.seuAssessor')}</Text>
          </View>
          {consultor.whatsApp
            ? (
              <TouchableOpacity style={s.whatsBtn} onPress={() => abrirWhatsApp(consultor.whatsApp!, consultor.nomeAssessor)}>
                <Text style={s.whatsTxt}>💬  {t('home.falarWhatsApp')}</Text>
              </TouchableOpacity>
            )
            : <Text style={s.semWhats}>{t('home.whatsappNaoInformado')}</Text>}
        </View>
      )}

      {/* Banner: recomendações pendentes do assessor */}
      {recomendacoes.length > 0 && (
        <View style={s.recomBanner}>
          <View style={s.recomBannerHeader}>
            <Text style={s.recomBannerTitulo}>💬 {recomendacoes.length > 1 ? t('home.recomendacaoPlur', { n: recomendacoes.length }) : t('home.recomendacaoSing', { n: recomendacoes.length })}</Text>
          </View>
          {recomendacoes.map(r => {
            const icone = r.tipo === 1 ? '📋' : r.tipo === 3 ? '🚨' : '💡';
            const label = r.tipo === 1 ? t('home.tipoAjuste') : r.tipo === 3 ? t('home.tipoAlerta') : t('home.tipoDica');
            return (
              <TouchableOpacity key={r.id} style={s.recomItem} onPress={() => abrirRecom(r)}>
                <Text style={s.recomItemIcon}>{icone}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.recomItemTipo}>{label}</Text>
                  <Text style={s.recomItemTexto} numberOfLines={2}>{r.texto}</Text>
                </View>
                <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>{t('home.responder')}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {semDados && (
        <View style={s.onboard}>
          <Text style={s.onboardTitulo}>{t('home.vamosComecar')} 🚀</Text>
          <Text style={s.onboardSub}>{t('home.onboardSub')}</Text>
          {passosOnboarding.map(p => (
            <TouchableOpacity key={p.rota} style={s.onboardPasso} onPress={() => navigate(p.rota)}>
              <Text style={s.onboardIcon}>{p.icon}</Text>
              <Text style={s.onboardLabel}>{p.label}</Text>
              <Text style={s.onboardSeta}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.destaque}>
        <Text style={s.destaqueLabel}>{t('home.meuPatrimonioLiquido')}</Text>
        <Text style={s.destaqueValor}>{fmt(patrim?.patrimonioLiquidoBRL ?? 0)}</Text>
        <Text style={s.destaqueQtd}>{t('home.bensDividasQtd', { bens: patrim?.qtdAtivos ?? 0, dividas: patrim?.passivos.length ?? 0 })}</Text>
      </View>

      {/* Patrimônio · Composição (bens × dívidas) */}
      {(slices.length > 0 || dividaSlices.length > 0) && (
        <Widget titulo={t('home.composicaoPatrimonio')} rota="patrimonio">
          <View style={s.allocWrap}>
            {/* Bens */}
            <View style={s.allocCol}>
              <Text style={s.allocTitulo}>{t('home.bens')}</Text>
              <View style={{ alignItems: 'center', marginVertical: 8 }}>
                <DonutChart
                  data={slices} size={130} strokeWidth={20}
                  centerTop={t('common.total')}
                  centerMain={ocultar ? 'R$ ••' : `R$ ${resumido(patrim?.totalBensBRL ?? 0)}`}
                  centerSub={slices.length === 1 ? t('home.categoriaSing', { n: slices.length }) : t('home.categoriaPlur', { n: slices.length })}
                  textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
                />
              </View>
              {(patrim?.composicao ?? []).slice(0, 4).map((c, i) => (
                <View key={c.categoria} style={s.legendRow}>
                  <View style={[s.dot, { backgroundColor: PALETA[i % PALETA.length] }]} />
                  <Text style={s.legendNome} numberOfLines={1}>{c.categoria}</Text>
                  <Text style={s.legendPct}>{c.pct.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
            {/* Dívidas */}
            <View style={s.allocCol}>
              <Text style={s.allocTitulo}>{t('home.dividas')}</Text>
              {dividaSlices.length > 0 ? (
                <>
                  <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <DonutChart
                      data={dividaSlices} size={130} strokeWidth={20}
                      centerTop={t('common.total')}
                      centerMain={ocultar ? 'R$ ••' : `R$ ${resumido(totalDividas)}`}
                      centerSub={dividaSlices.length === 1 ? t('home.prazoSing', { n: dividaSlices.length }) : t('home.prazoPlur', { n: dividaSlices.length })}
                      textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
                    />
                  </View>
                  {dividaSlices.map(d => (
                    <View key={d.label} style={s.legendRow}>
                      <View style={[s.dot, { backgroundColor: d.color }]} />
                      <Text style={s.legendNome} numberOfLines={1}>{d.label}</Text>
                      <Text style={s.legendPct}>{totalDividas > 0 ? `${(d.value / totalDividas * 100).toFixed(1)}%` : '—'}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={s.semDivida}>{t('home.semDividas')} 🎉</Text>
              )}
            </View>
          </View>
        </Widget>
      )}

      {/* Visão do mês */}
      {dash && (
        <Widget titulo={t('home.visaoDoMes')} rota="gp-dashboard">
          <View style={s.mesRow}>
            <View style={s.mesItem}>
              <Text style={s.mesLabel}>{t('home.receitas')}</Text>
              <Text style={[s.mesValor, { color: colors.green }]}>{fmt(dash.totalCreditos)}</Text>
            </View>
            <View style={s.mesItem}>
              <Text style={s.mesLabel}>{t('home.despesas')}</Text>
              <Text style={[s.mesValor, { color: colors.red }]}>{fmt(dash.totalDebitos)}</Text>
            </View>
            <View style={s.mesItem}>
              <Text style={s.mesLabel}>{t('home.saldo')}</Text>
              <Text style={[s.mesValor, { color: dash.saldo >= 0 ? colors.green : colors.red }]}>{fmt(dash.saldo)}</Text>
            </View>
          </View>
        </Widget>
      )}

      {/* Investimentos · Alocação */}
      {invItens.length > 0 && (
        <Widget titulo={t('home.investimentosAlocacao')} rota="investimentos">
          <View style={s.allocWrap}>
            <AllocDonut titulo={t('home.porClasse')} dados={porClasse} unidade={porClasse.length === 1 ? t('home.classe') : t('home.classes')} />
            <AllocDonut titulo={t('home.porCustodiante')} dados={porCustodiante} unidade={porCustodiante.length === 1 ? t('home.custodiante') : t('home.custodiantes')} />
          </View>
        </Widget>
      )}

      {/* Metas */}
      {metasAtivas.length > 0 && (
        <Widget titulo={t('home.metas')} rota="gp-metas">
          {metasAtivas.map(m => {
            const pct = m.valorMeta > 0 ? Math.min(m.valorAtual / m.valorMeta, 1) : 0;
            return (
              <View key={m.id} style={{ marginBottom: 12 }}>
                <View style={s.metaTop}>
                  <Text style={s.metaNome} numberOfLines={1}>{m.titulo}</Text>
                  <Text style={s.metaPct}>{(pct * 100).toFixed(0)}%</Text>
                </View>
                <View style={s.barBg}><View style={[s.barFill, { width: `${(pct * 100).toFixed(0)}%` as any }]} /></View>
                <Text style={s.metaValores}>{t('home.deValores', { atual: fmt(m.valorAtual), meta: fmt(m.valorMeta) })}</Text>
              </View>
            );
          })}
        </Widget>
      )}
    </ScrollView>

      {/* Modal: responder recomendação */}
      <Modal visible={recomModal} transparent animationType="slide" onRequestClose={() => setRecomModal(false)}>
        <View style={s.overlay}>
          <View style={s.recomModalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.recomModalTitulo}>
                {recomSel?.tipo === 1 ? t('home.tipoAjuste') : recomSel?.tipo === 3 ? t('home.tipoAlerta') : t('home.tipoDica')}
              </Text>
              <TouchableOpacity onPress={() => setRecomModal(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 20 }}>X</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.recomModalTexto}>{recomSel?.texto}</Text>
            <Text style={[s.recomModalLabel, { marginTop: 16 }]}>{t('home.comentarioOpcional')}</Text>
            <TextInput
              style={s.recomModalInput}
              value={comentario}
              onChangeText={setComentario}
              placeholder={t('home.comentarioPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              numberOfLines={2}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.recomBtnRecusar} onPress={() => responder(false)} disabled={respondendo}>
                {respondendo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('home.recusar')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.recomBtnAceitar} onPress={() => responder(true)} disabled={respondendo}>
                {respondendo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('home.aceitar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  // Banner de recomendações
  recomBanner:       { backgroundColor: '#f59e0b18', borderWidth: 1, borderColor: '#f59e0b55', borderRadius: 14, padding: 14, marginBottom: 16 },
  recomBannerHeader: { marginBottom: 10 },
  recomBannerTitulo: { color: '#f59e0b', fontWeight: '800', fontSize: 14 },
  recomItem:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f59e0b33' },
  recomItemIcon:     { fontSize: 20 },
  recomItemTipo:     { color: c.text, fontWeight: '700', fontSize: 13 },
  recomItemTexto:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  // Modal de resposta
  overlay:           { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  recomModalCard:    { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  recomModalTitulo:  { color: c.text, fontSize: 16, fontWeight: '800' },
  recomModalTexto:   { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  recomModalLabel:   { color: c.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  recomModalInput:   { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
  recomBtnRecusar:   { flex: 1, backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  recomBtnAceitar:   { flex: 1, backgroundColor: c.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saudacao: { color: c.text, fontSize: 26, fontWeight: '800' },
  sub: { color: c.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 24 },
  consultor: { backgroundColor: c.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  consultorLabel: { color: c.textSecondary, fontSize: 12 },
  consultorNome: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
  whatsBtn: { backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  whatsTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  semWhats: { color: c.textTertiary, fontSize: 12, fontStyle: 'italic' },
  destaque: { backgroundColor: c.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: c.greenBorder, marginBottom: 16 },
  destaqueLabel: { color: c.textSecondary, fontSize: 13 },
  destaqueValor: { color: c.green, fontSize: 34, fontWeight: '800', marginTop: 8 },
  destaqueQtd: { color: c.textSecondary, fontSize: 12, marginTop: 8 },
  metricas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricaCard: { flexGrow: 1, flexBasis: '22%', minWidth: 120, backgroundColor: c.surface, borderRadius: 12, padding: 14 },
  metricaIcon: { fontSize: 16 },
  metricaValor: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  metricaLabel: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  onboard:       { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.greenBorder, padding: 20, marginBottom: 16 },
  onboardTitulo: { color: c.text, fontSize: 18, fontWeight: '800' },
  onboardSub:    { color: c.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 12 },
  onboardPasso:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border },
  onboardIcon:   { fontSize: 20 },
  onboardLabel:  { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
  onboardSeta:   { color: c.green, fontSize: 22, fontWeight: '700' },
  pendentesCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f59e0b18', borderWidth: 1, borderColor: '#f59e0b55', borderRadius: 12, padding: 14, marginTop: 16 },
  pendentesTxt: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border },
  topPos: { color: c.textTertiary, fontSize: 13, fontWeight: '800', width: 18 },
  topNome: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
  topValor: { color: c.green, fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitulo: { fontFamily: FONT_SERIF, color: c.text, fontSize: 16, fontWeight: '700' },
  verDetalhes: { color: c.textSecondary, fontSize: 12 },
  donutWrap: { flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  legend: { flex: 1, minWidth: 150, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendNome: { color: c.textSecondary, fontSize: 13, flex: 1 },
  legendPct: { color: c.text, fontSize: 13, fontWeight: '700' },
  allocWrap: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  allocCol: { flex: 1, minWidth: 200, gap: 4 },
  allocTitulo: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  semDivida: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 24 },
  mesRow: { flexDirection: 'row', gap: 10 },
  mesItem: { flex: 1 },
  mesLabel: { color: c.textSecondary, fontSize: 12 },
  mesValor: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  metaTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  metaNome: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  metaPct: { color: c.green, fontSize: 13, fontWeight: '700' },
  barBg: { backgroundColor: c.border, borderRadius: 4, height: 7, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: c.green },
  metaValores: { color: c.textSecondary, fontSize: 11, marginTop: 4 },
});
