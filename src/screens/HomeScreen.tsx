import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import {
  patrimonioService, assessoriaService, gestaoService, investimentosService,
  MeuAssessorDto, ResumoPatrimonialDto, DashboardDto, MetaDto, ResumoInvestimentosDto,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { useRouter, Rota } from '../navigation/router';
import DonutChart, { DonutSlice } from '../components/charts/DonutChart';

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
  const s = makeStyles(colors);
  const fmt = (v: number) => formatMoney(v, ocultar);

  const [assessorResumo, setAssessorResumo] = useState<{ total: number; qtdAtivos: number; qtdClientes: number } | null>(null);
  const [patrim, setPatrim]       = useState<ResumoPatrimonialDto | null>(null);
  const [dash, setDash]           = useState<DashboardDto | null>(null);
  const [metas, setMetas]         = useState<MetaDto[]>([]);
  const [invest, setInvest]       = useState<ResumoInvestimentosDto | null>(null);
  const [consultor, setConsultor] = useState<MeuAssessorDto | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (isAssessor) {
          const clientes = (await assessoriaService.clientes()).filter(c => c.ativo);
          const resumos = await Promise.all(
            clientes.map(c => assessoriaService.resumoCliente(c.clienteId).catch(() => null)),
          );
          const total = resumos.reduce((sum, r) => sum + (r?.totalConsolidadoBRL ?? 0), 0);
          const qtdAtivos = resumos.reduce((sum, r) => sum + (r?.qtdAtivos ?? 0), 0);
          if (vivo) setAssessorResumo({ total, qtdAtivos, qtdClientes: clientes.length });
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
        }
      } catch {
        // silencioso — cada bloco trata o próprio vazio
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [isAssessor]);

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

  // ── Visão do assessor ──
  if (isAssessor) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
        <Text style={s.saudacao}>Bem-vindo 👋</Text>
        <Text style={s.sub}>Painel do assessor</Text>
        <View style={s.destaque}>
          <Text style={s.destaqueLabel}>Patrimônio sob gestão (consolidado em BRL)</Text>
          <Text style={s.destaqueValor}>{fmt(assessorResumo?.total ?? 0)}</Text>
          <Text style={s.destaqueQtd}>{assessorResumo?.qtdClientes ?? 0} cliente(s) · {assessorResumo?.qtdAtivos ?? 0} ativo(s)</Text>
        </View>
        <View style={s.metricas}>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>👥</Text>
            <Text style={s.metricaValor}>{assessorResumo?.qtdClientes ?? 0}</Text>
            <Text style={s.metricaLabel}>Clientes ativos</Text>
          </View>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>🏛️</Text>
            <Text style={s.metricaValor}>{assessorResumo?.qtdAtivos ?? 0}</Text>
            <Text style={s.metricaLabel}>Ativos na carteira</Text>
          </View>
        </View>
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
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
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
