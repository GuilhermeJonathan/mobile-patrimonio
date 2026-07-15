import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking, Modal, TextInput } from 'react-native';
import {
  patrimonioService, assessoriaService, gestaoService, investimentosService,
  MeuAssessorDto, ResumoPatrimonialDto, DashboardDto, MetaDto, ResumoInvestimentosDto, RecomendacaoDto,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
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
  topClientes: { clienteId: string; nome: string; liquido: number }[];
  composicao: { categoria: string; totalBRL: number }[];
}

const PALETA = ['#f59e0b', '#8b5cf6', '#3b82f6', '#eab308', '#22c55e', '#ec4899', '#14b8a6', '#f97316'];
const TIPO_INVEST_LABEL: Record<number, string> = {
  1: 'Ações', 2: 'FII', 3: 'ETF', 4: 'Renda Fixa', 5: 'Multimercado', 6: 'Cripto', 7: 'Exterior', 99: 'Outro',
};

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
  const { navigate } = useRouter();
  const { entrar } = useAssessoria();
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
            .map(x => ({ clienteId: x.c.clienteId, nome: x.c.nomeCliente ?? 'Cliente', liquido: x.r?.patrimonioLiquidoBRL ?? 0 }))
            .sort((a, b) => b.liquido - a.liquido)
            .slice(0, 5);

          const compMap = new Map<string, number>();
          for (const x of comResumo)
            for (const cat of (x.r?.composicao ?? []))
              compMap.set(cat.categoria, (compMap.get(cat.categoria) ?? 0) + cat.totalBRL);
          const composicao = [...compMap.entries()]
            .map(([categoria, totalBRL]) => ({ categoria, totalBRL }))
            .sort((a, b) => b.totalBRL - a.totalBRL);

          if (vivo) setAssessorHome({ aum, totalLiquido, totalDividas, qtdAtivos, qtdClientes: ativos.length, pendentes, topClientes, composicao });
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
            <Text style={s.verDetalhes}>Ver detalhes ↗</Text>
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
        <Text style={s.saudacao}>Bem-vindo 👋</Text>
        <Text style={s.sub}>Painel do assessor</Text>

        {/* Patrimônio líquido sob gestão */}
        <View style={s.destaque}>
          <Text style={s.destaqueLabel}>Patrimônio líquido sob gestão (BRL)</Text>
          <Text style={s.destaqueValor}>{fmt(h?.totalLiquido ?? 0)}</Text>
          <Text style={s.destaqueQtd}>Bens {fmt(h?.aum ?? 0)} · Dívidas {fmt(h?.totalDividas ?? 0)}</Text>
        </View>

        {/* Métricas */}
        <View style={s.metricas}>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>👥</Text>
            <Text style={s.metricaValor}>{h?.qtdClientes ?? 0}</Text>
            <Text style={s.metricaLabel}>Clientes ativos</Text>
          </View>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>🏛️</Text>
            <Text style={s.metricaValor}>{h?.qtdAtivos ?? 0}</Text>
            <Text style={s.metricaLabel}>Ativos na carteira</Text>
          </View>
        </View>

        {/* Convites pendentes */}
        {(h?.pendentes ?? 0) > 0 && (
          <TouchableOpacity style={s.pendentesCard} onPress={() => navigate('clientes')}>
            <Text style={s.pendentesTxt}>⏳ {h!.pendentes} convite(s) pendente(s) de aceite</Text>
            <Text style={s.verDetalhes}>Ver ↗</Text>
          </TouchableOpacity>
        )}

        {/* Top clientes */}
        {(h?.topClientes.length ?? 0) > 0 && (
          <View style={{ ...StyleSheet.flatten(s.card), marginTop: 16 }}>
            <View style={s.cardHead}>
              <Text style={s.cardTitulo}>Top clientes por patrimônio</Text>
              <TouchableOpacity onPress={() => navigate('clientes')}>
                <Text style={s.verDetalhes}>Ver todos ↗</Text>
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
            <Text style={{ ...StyleSheet.flatten(s.cardTitulo), marginBottom: 12 }}>Composição da carteira</Text>
            <View style={s.donutWrap}>
              <DonutChart
                data={bookSlices} size={150}
                centerTop="Sob gestão" centerMain={ocultar ? 'R$ ••' : `R$ ${resumido(bookTotal)}`}
                centerSub={`${bookSlices.length} categorias`}
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
  const metasAtivas = metas.filter(m => m.status === 1).slice(0, 3);
  const invItens = invest?.investimentos ?? [];
  const porClasse = agrupar(invItens, (i: any) => TIPO_INVEST_LABEL[i.tipo] ?? 'Outro');
  const porCustodiante = agrupar(invItens, (i: any) => i.corretora ?? 'Sem custodiante');

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

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={s.saudacao}>Bem-vindo 👋</Text>
      <Text style={s.sub}>Painel de gestão patrimonial</Text>

      {consultor?.temAssessor && (
        <View style={s.consultor}>
          <View style={{ flex: 1 }}>
            <Text style={s.consultorLabel}>👤 Seu consultor</Text>
            <Text style={s.consultorNome}>{consultor.nomeAssessor ?? 'Seu assessor'}</Text>
          </View>
          {consultor.whatsApp
            ? (
              <TouchableOpacity style={s.whatsBtn} onPress={() => abrirWhatsApp(consultor.whatsApp!, consultor.nomeAssessor)}>
                <Text style={s.whatsTxt}>💬  Falar pelo WhatsApp</Text>
              </TouchableOpacity>
            )
            : <Text style={s.semWhats}>WhatsApp não informado</Text>}
        </View>
      )}

      {/* Banner: recomendações pendentes do assessor */}
      {recomendacoes.length > 0 && (
        <View style={s.recomBanner}>
          <View style={s.recomBannerHeader}>
            <Text style={s.recomBannerTitulo}>💬 {recomendacoes.length} recomendação{recomendacoes.length > 1 ? 'ões' : ''} do seu assessor</Text>
          </View>
          {recomendacoes.map(r => {
            const icone = r.tipo === 1 ? '📋' : r.tipo === 3 ? '🚨' : '💡';
            const label = r.tipo === 1 ? 'Ajuste de orçamento' : r.tipo === 3 ? 'Alerta' : 'Dica';
            return (
              <TouchableOpacity key={r.id} style={s.recomItem} onPress={() => abrirRecom(r)}>
                <Text style={s.recomItemIcon}>{icone}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.recomItemTipo}>{label}</Text>
                  <Text style={s.recomItemTexto} numberOfLines={2}>{r.texto}</Text>
                </View>
                <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>Responder →</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={s.destaque}>
        <Text style={s.destaqueLabel}>Meu patrimônio líquido (consolidado em BRL)</Text>
        <Text style={s.destaqueValor}>{fmt(patrim?.patrimonioLiquidoBRL ?? 0)}</Text>
        <Text style={s.destaqueQtd}>{patrim?.qtdAtivos ?? 0} bem(ns) · {patrim?.passivos.length ?? 0} dívida(s)</Text>
      </View>

      {/* Patrimônio · Distribuição */}
      {slices.length > 0 && (
        <Widget titulo="Patrimônio · Distribuição" rota="patrimonio">
          <View style={s.donutWrap}>
            <DonutChart
              data={slices} size={150}
              centerTop="Total em bens"
              centerMain={ocultar ? 'R$ ••' : `R$ ${resumido(patrim?.totalBensBRL ?? 0)}`}
              centerSub={`${slices.length} categorias`}
              textColor={colors.text} subColor={colors.textSecondary} trackColor={colors.border}
            />
            <View style={s.legend}>
              {(patrim?.composicao ?? []).slice(0, 5).map((c, i) => (
                <View key={c.categoria} style={s.legendRow}>
                  <View style={[s.dot, { backgroundColor: PALETA[i % PALETA.length] }]} />
                  <Text style={s.legendNome} numberOfLines={1}>{c.categoria}</Text>
                  <Text style={s.legendPct}>{c.pct.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </View>
        </Widget>
      )}

      {/* Visão do mês */}
      {dash && (
        <Widget titulo="Visão do mês" rota="gp-dashboard">
          <View style={s.mesRow}>
            <View style={s.mesItem}>
              <Text style={s.mesLabel}>Receitas</Text>
              <Text style={[s.mesValor, { color: colors.green }]}>{fmt(dash.totalCreditos)}</Text>
            </View>
            <View style={s.mesItem}>
              <Text style={s.mesLabel}>Despesas</Text>
              <Text style={[s.mesValor, { color: colors.red }]}>{fmt(dash.totalDebitos)}</Text>
            </View>
            <View style={s.mesItem}>
              <Text style={s.mesLabel}>Saldo</Text>
              <Text style={[s.mesValor, { color: dash.saldo >= 0 ? colors.green : colors.red }]}>{fmt(dash.saldo)}</Text>
            </View>
          </View>
        </Widget>
      )}

      {/* Investimentos · Alocação */}
      {invItens.length > 0 && (
        <Widget titulo="Investimentos · Alocação" rota="investimentos">
          <View style={s.allocWrap}>
            <AllocDonut titulo="Por classe" dados={porClasse} unidade={porClasse.length === 1 ? 'Classe' : 'Classes'} />
            <AllocDonut titulo="Por custodiante" dados={porCustodiante} unidade={porCustodiante.length === 1 ? 'Custodiante' : 'Custodiantes'} />
          </View>
        </Widget>
      )}

      {/* Metas */}
      {metasAtivas.length > 0 && (
        <Widget titulo="Metas" rota="gp-metas">
          {metasAtivas.map(m => {
            const pct = m.valorMeta > 0 ? Math.min(m.valorAtual / m.valorMeta, 1) : 0;
            return (
              <View key={m.id} style={{ marginBottom: 12 }}>
                <View style={s.metaTop}>
                  <Text style={s.metaNome} numberOfLines={1}>{m.titulo}</Text>
                  <Text style={s.metaPct}>{(pct * 100).toFixed(0)}%</Text>
                </View>
                <View style={s.barBg}><View style={[s.barFill, { width: `${(pct * 100).toFixed(0)}%` as any }]} /></View>
                <Text style={s.metaValores}>{fmt(m.valorAtual)} de {fmt(m.valorMeta)}</Text>
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
                {recomSel?.tipo === 1 ? 'Ajuste de orcamento' : recomSel?.tipo === 3 ? 'Alerta' : 'Dica'}
              </Text>
              <TouchableOpacity onPress={() => setRecomModal(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 20 }}>X</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.recomModalTexto}>{recomSel?.texto}</Text>
            <Text style={[s.recomModalLabel, { marginTop: 16 }]}>Comentario (opcional)</Text>
            <TextInput
              style={s.recomModalInput}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Adicione um comentario..."
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              numberOfLines={2}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.recomBtnRecusar} onPress={() => responder(false)} disabled={respondendo}>
                {respondendo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Recusar</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.recomBtnAceitar} onPress={() => responder(true)} disabled={respondendo}>
                {respondendo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Aceitar</Text>}
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
  metricas: { flexDirection: 'row', gap: 14 },
  metricaCard: { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 20 },
  metricaIcon: { fontSize: 22 },
  metricaValor: { color: c.text, fontSize: 30, fontWeight: '800', marginTop: 8 },
  metricaLabel: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  pendentesCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f59e0b18', borderWidth: 1, borderColor: '#f59e0b55', borderRadius: 12, padding: 14, marginTop: 16 },
  pendentesTxt: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border },
  topPos: { color: c.textTertiary, fontSize: 13, fontWeight: '800', width: 18 },
  topNome: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
  topValor: { color: c.green, fontSize: 14, fontWeight: '700' },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border, marginBottom: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitulo: { color: c.text, fontSize: 15, fontWeight: '800' },
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
