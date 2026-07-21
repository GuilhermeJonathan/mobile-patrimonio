import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

// ────────────────────────────────────────────────────────────────────────────
// PROTÓTIPO — cockpit "Family Office / Estruturas". Dados 100% ilustrativos.
// Objetivo: apresentar a visão ao Adriel antes de investir em backend.
// ────────────────────────────────────────────────────────────────────────────

const GOLD = '#C79A4E';

type LensKey = 'trust' | 'offshore' | 'holding';
const LENSES: { key: LensKey; label: string; flag: string }[] = [
  { key: 'trust',    label: 'Trust Internacional', flag: '🇨🇭' },
  { key: 'offshore', label: 'Offshore',            flag: '🌐' },
  { key: 'holding',  label: 'Holding (Imóveis)',   flag: '🇧🇷' },
];

// Nós do grafo de estruturas (posições fixas num viewBox 960x380).
type Tone = 'familia' | 'trust' | 'offshore' | 'holding' | 'ativo';
interface Node { id: string; label: string; sub?: string; x: number; y: number; w: number; h: number; tone: Tone; lens: LensKey[]; }
interface Edge { from: string; to: string; }

const NODES: Node[] = [
  { id: 'familia', label: 'Família (Beneficiários)', sub: 'Cônjuge · 2 filhos · 3 netos', x: 380, y: 8,  w: 200, h: 50, tone: 'familia',  lens: ['trust','offshore','holding'] },
  { id: 'trust',   label: 'Trust Internacional',     sub: 'Zurique · Suíça',            x: 380, y: 96, w: 200, h: 56, tone: 'trust',    lens: ['trust','offshore'] },

  { id: 'holdBR',  label: 'Holding Patrimonial',     sub: 'Brasil · Imóveis',           x: 16,  y: 198, w: 168, h: 56, tone: 'holding',  lens: ['holding'] },
  { id: 'holdSP',  label: 'Holding de Participações',sub: 'Brasil · SP',                x: 205, y: 198, w: 168, h: 56, tone: 'holding',  lens: ['trust','holding'] },
  { id: 'bvi',     label: 'BVI Holding Co.',         sub: 'Ilhas Virgens Britânicas',   x: 394, y: 198, w: 168, h: 56, tone: 'offshore', lens: ['offshore'] },
  { id: 'cayman',  label: 'Cayman Investment Ltd.',  sub: 'Cayman',                     x: 583, y: 198, w: 168, h: 56, tone: 'offshore', lens: ['offshore'] },
  { id: 'bahamas', label: 'Bahamas Asset Mgmt.',     sub: 'Bahamas',                    x: 772, y: 198, w: 172, h: 56, tone: 'offshore', lens: ['offshore'] },

  { id: 'imoveis', label: 'Ativos Imobiliários',     sub: '4 imóveis · R$ 15,5M',       x: 16,  y: 300, w: 168, h: 52, tone: 'ativo',    lens: ['holding'] },
  { id: 'empAB',   label: 'Empresas Op. A/B',        sub: 'Participações',              x: 205, y: 300, w: 168, h: 52, tone: 'ativo',    lens: ['trust','holding'] },
  { id: 'portf',   label: 'Portfólio (Suíça)',       sub: 'Julius Baer · UBS',          x: 452, y: 300, w: 168, h: 52, tone: 'ativo',    lens: ['offshore','trust'] },
  { id: 'ppli',    label: 'PPLI',                    sub: 'Private Placement Life Ins.',x: 700, y: 300, w: 190, h: 52, tone: 'ativo',    lens: ['offshore'] },
];

const EDGES: Edge[] = [
  { from: 'familia', to: 'trust' },
  { from: 'trust', to: 'holdBR' }, { from: 'trust', to: 'holdSP' }, { from: 'trust', to: 'bvi' },
  { from: 'trust', to: 'cayman' }, { from: 'trust', to: 'bahamas' },
  { from: 'holdBR', to: 'imoveis' }, { from: 'holdSP', to: 'empAB' },
  { from: 'cayman', to: 'portf' }, { from: 'bvi', to: 'portf' }, { from: 'bahamas', to: 'ppli' },
];

// Painéis por lente.
const KPIS: Record<LensKey, { label: string; valor: string; hint?: string }[]> = {
  trust: [
    { label: 'AUM sob o Trust', valor: 'US$ 18,4M' },
    { label: 'Governança', valor: '90/100', hint: 'score' },
    { label: 'Beneficiários', valor: '6' },
    { label: 'Conformidade', valor: 'Em dia' },
  ],
  offshore: [
    { label: 'Ativos em Offshore', valor: 'US$ 9,7M' },
    { label: 'Jurisdições ativas', valor: 'BVI · Cayman · Bahamas' },
    { label: 'Substância econômica', valor: '2 pendências', hint: 'atenção' },
    { label: 'Conformidade global', valor: '82/100' },
  ],
  holding: [
    { label: 'Valuation da Holding', valor: 'R$ 15,4M' },
    { label: 'Imóveis', valor: '4' },
    { label: 'Custo anual', valor: 'R$ 150k' },
    { label: 'Otimização', valor: '50/100', hint: 'score' },
  ],
};

const DOCS: Record<LensKey, { nome: string; status: 'ok' | 'pendente' }[]> = {
  trust: [
    { nome: 'Instrumento do Trust', status: 'ok' },
    { nome: 'Carta de Desejos (Letter of Wishes)', status: 'ok' },
    { nome: 'Certificado de Regularidade', status: 'ok' },
    { nome: 'Relatório Anual do Trust 2024', status: 'pendente' },
  ],
  offshore: [
    { nome: 'Certificate of Incumbency (BVI)', status: 'pendente' },
    { nome: 'Atualização de UBO', status: 'pendente' },
    { nome: 'Economic Substance Report', status: 'ok' },
    { nome: 'Register of Members (BVI)', status: 'ok' },
  ],
  holding: [
    { nome: 'Contrato Social / Estatuto', status: 'ok' },
    { nome: 'Registro de Imóveis', status: 'ok' },
    { nome: 'Relatório de Valuation Anual', status: 'pendente' },
    { nome: 'Procurações', status: 'pendente' },
  ],
};

const ACOES: Record<LensKey, string[]> = {
  trust: ['Revisar Carta de Desejos com o cliente', 'Aprovar distribuição anual (25% principal)'],
  offshore: ['Renovar licença nas Bahamas', 'Atualizar UBO na BVI', 'Entregar Economic Substance'],
  holding: ['Reavaliar imóvel ID 2 (Fazenda Boa Vista)', 'Aprovar custos anuais da holding'],
};

// Contas bancárias & custódia por lente (como no print do Trust: Julius Baer, UBS...).
interface Conta { banco: string; tipo: string; saldo: string; }
const CONTAS: Record<LensKey, { itens: Conta[]; total: string; geridoPor: string; classes: string[] }> = {
  trust: {
    itens: [
      { banco: 'Julius Baer', tipo: 'Custódia',    saldo: 'US$ 1,25M' },
      { banco: 'UBS',         tipo: 'Cash',        saldo: 'CHF 750k' },
      { banco: 'Empresa Op. A', tipo: 'Operacional', saldo: 'US$ 9,50M' },
      { banco: 'Empresa Op. B', tipo: 'Operacional', saldo: 'US$ 9,50M' },
    ],
    total: 'US$ 21,1M equiv.', geridoPor: 'Swiss Advisor', classes: ['Bonds', 'Equities', 'Cash'],
  },
  offshore: {
    itens: [
      { banco: 'Butterfield (BVI)',  tipo: 'Custódia', saldo: 'US$ 4,10M' },
      { banco: 'Cayman National',    tipo: 'Cash',     saldo: 'US$ 3,20M' },
      { banco: 'Bahamas First',      tipo: 'Cash',     saldo: 'US$ 2,40M' },
    ],
    total: 'US$ 9,70M', geridoPor: 'Multi-custódia offshore', classes: ['PPLI', 'Bonds', 'Cash'],
  },
  holding: {
    itens: [
      { banco: 'BTG Pactual', tipo: 'Custódia',   saldo: 'R$ 3,20M' },
      { banco: 'Itaú Private', tipo: 'Conta PJ',  saldo: 'R$ 1,80M' },
    ],
    total: 'R$ 5,00M', geridoPor: 'BTG Pactual', classes: ['Renda Fixa', 'FIIs'],
  },
};

// Gauges de indicadores por lente (Estate Planning / Conformidade / Otimização…).
const GAUGES: Record<LensKey, { label: string; val: number }[]> = {
  trust:    [{ label: 'Governança do Trust', val: 90 }, { label: 'Conformidade', val: 95 }, { label: 'Planejamento Sucessório', val: 78 }],
  offshore: [{ label: 'Conformidade Global', val: 82 }, { label: 'Substância Econômica', val: 70 }, { label: 'Estrutura Otimizada', val: 88 }],
  holding:  [{ label: 'Otimização da Holding', val: 50 }, { label: 'Conformidade', val: 78 }, { label: 'Documentação', val: 60 }],
};

// Histórico de distribuições (lente Trust) — valores ilustrativos em US$ mil.
const DISTRIBUICOES = [
  { ano: '2021', v: 350 }, { ano: '2022', v: 500 }, { ano: '2023', v: 820 },
  { ano: '2024', v: 1600 }, { ano: '2025', v: 480 },
];

const BENEFICIARIOS = [
  { nome: 'Cônjuge', papel: 'Cônjuge', pct: '20%', status: 'Distribuindo' },
  { nome: 'Filho 1',  papel: 'Filho',   pct: '20%', status: 'Principal' },
  { nome: 'Filho 2',  papel: 'Filho',   pct: '20%', status: 'Distribuindo' },
  { nome: 'Neto 1',   papel: 'Neto',    pct: '20%', status: 'Aos 25 anos' },
  { nome: 'Neto 2',   papel: 'Neto',    pct: '10%', status: 'Aos 25 anos' },
  { nome: 'Neto 3',   papel: 'Neto',    pct: '10%', status: 'Aos 25 anos' },
];

const ROTEIRO = [
  { ano: '2022', titulo: 'Constituição do Trust', estado: 'done' as const },
  { ano: '2023', titulo: 'Holding patrimonial (imóveis)', estado: 'done' as const },
  { ano: '2024', titulo: 'Estrutura offshore (BVI/Cayman)', estado: 'done' as const },
  { ano: '2025', titulo: 'Revisão de distribuições', estado: 'now' as const },
  { ano: '2026', titulo: 'Transferência de geração', estado: 'future' as const },
  { ano: '2028', titulo: 'Sucessão plena aos netos', estado: 'future' as const },
];

export default function EstruturasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [lens, setLens] = useState<LensKey>('trust');

  const toneColor = (tone: Tone): string => ({
    familia: colors.blue, trust: GOLD, offshore: colors.purple, holding: colors.green, ativo: colors.textSecondary,
  }[tone]);

  const nodeById = (id: string) => NODES.find(n => n.id === id)!;
  const ativoNaLente = (n: Node) => n.lens.includes(lens);

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Banner protótipo */}
      <View style={s.proto}>
        <Text style={s.protoTxt}>🧪 Protótipo · dados ilustrativos — visão “Family Office / Estruturas”</Text>
      </View>

      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Estruturas do Cliente</Text>
          <Text style={s.subtitle}>Trust · Holdings · Offshore · Sucessão</Text>
        </View>
        <View style={s.lensRow}>
          {LENSES.map(l => {
            const on = lens === l.key;
            return (
              <TouchableOpacity key={l.key} onPress={() => setLens(l.key)}
                style={[s.lensBtn, on && { borderColor: GOLD, backgroundColor: GOLD + '18' }]}>
                <Text style={[s.lensTxt, on && { color: GOLD }]}>{l.flag} {l.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* KPIs */}
      <View style={s.kpiRow}>
        {KPIS[lens].map(k => (
          <View key={k.label} style={s.kpiCard}>
            <Text style={s.kpiLabel}>{k.label}</Text>
            <Text style={[s.kpiValor, k.hint === 'atenção' && { color: colors.orange }]}>{k.valor}</Text>
            {k.hint && k.hint !== 'atenção' && <Text style={s.kpiHint}>{k.hint}</Text>}
          </View>
        ))}
      </View>

      {/* Indicadores (gauges) */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Indicadores</Text>
        <View style={s.gaugeRow}>
          {GAUGES[lens].map(g => (
            <Gauge key={g.label} label={g.label} val={g.val}
              track={colors.surfaceElevated} text={colors.text} sub={colors.textSecondary} />
          ))}
        </View>
      </View>

      {/* Grafo de estruturas */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Mapa de Estruturas & Participações</Text>
        <Text style={s.cardSub}>Realce na lente selecionada. Linhas = propriedade / benefício.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
          <Svg width={960} height={370}>
            {EDGES.map((e, i) => {
              const a = nodeById(e.from), b = nodeById(e.to);
              const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
              const ativo = ativoNaLente(a) && ativoNaLente(b);
              const midY = (y1 + y2) / 2;
              return (
                <Path key={i} d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  stroke={ativo ? GOLD : colors.border} strokeWidth={ativo ? 2 : 1} fill="none"
                  strokeOpacity={ativo ? 0.9 : 0.4} />
              );
            })}
            {NODES.map(n => {
              const on = ativoNaLente(n);
              const c = toneColor(n.tone);
              return (
                <React.Fragment key={n.id}>
                  <Rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10}
                    fill={colors.surface} stroke={on ? c : colors.border} strokeWidth={on ? 2 : 1}
                    opacity={on ? 1 : 0.45} />
                  <Rect x={n.x} y={n.y} width={4} height={n.h} rx={2} fill={c} opacity={on ? 1 : 0.35} />
                  <SvgText x={n.x + 14} y={n.y + (n.sub ? 22 : 30)} fontSize={13} fontWeight="700"
                    fill={colors.text} opacity={on ? 1 : 0.5}>{n.label}</SvgText>
                  {n.sub && (
                    <SvgText x={n.x + 14} y={n.y + 40} fontSize={10.5} fill={colors.textSecondary}
                      opacity={on ? 1 : 0.5}>{n.sub}</SvgText>
                  )}
                </React.Fragment>
              );
            })}
          </Svg>
        </ScrollView>
      </View>

      {/* Duas colunas: beneficiários/documentos + ações */}
      <View style={s.grid}>
        {/* Beneficiários (só trust) ou resumo */}
        <View style={[s.card, s.col]}>
          <Text style={s.cardTitulo}>{lens === 'trust' ? 'Beneficiários & Distribuição' : 'Governança'}</Text>
          {lens === 'trust' ? (
            <>
              {BENEFICIARIOS.map(b => (
                <View key={b.nome} style={s.benefRow}>
                  <Text style={[s.benefNome, { color: colors.text }]}>{b.nome}</Text>
                  <Text style={s.benefPapel}>{b.papel}</Text>
                  <Text style={[s.benefPct, { color: GOLD }]}>{b.pct}</Text>
                  <Text style={s.benefStatus}>{b.status}</Text>
                </View>
              ))}
              <Text style={s.termos}>Termos: aos 25 anos, liberação de 20% do principal por neto.</Text>
              <Text style={s.histTitulo}>Histórico de Distribuições (US$ mil)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <MiniBars dados={DISTRIBUICOES} cor={GOLD} track={colors.border} sub={colors.textSecondary} text={colors.text} />
              </ScrollView>
            </>
          ) : (
            <Text style={s.placeholder}>
              {lens === 'offshore'
                ? 'Jurisdições ativas: BVI, Cayman, Bahamas. Substância econômica e UBO monitorados por entidade.'
                : 'Holding patrimonial com 4 imóveis. Score de otimização e custos anuais acompanhados aqui.'}
            </Text>
          )}
        </View>

        {/* Documentos */}
        <View style={[s.card, s.col]}>
          <Text style={s.cardTitulo}>Documentos</Text>
          {DOCS[lens].map(d => (
            <View key={d.nome} style={s.docRow}>
              <Text style={s.docIcon}>📄</Text>
              <Text style={[s.docNome, { color: colors.text }]} numberOfLines={1}>{d.nome}</Text>
              <View style={[s.docBadge, { backgroundColor: (d.status === 'ok' ? colors.green : colors.orange) + '22' }]}>
                <Text style={[s.docBadgeTxt, { color: d.status === 'ok' ? colors.green : colors.orange }]}>
                  {d.status === 'ok' ? 'enviado' : 'pendente'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Contas bancárias & custódia */}
      <View style={s.card}>
        <View style={s.contaHead}>
          <Text style={s.cardTitulo}>Contas Bancárias & Custódia</Text>
          <View style={s.pills}>
            {CONTAS[lens].classes.map(cl => (
              <View key={cl} style={s.pill}><Text style={s.pillTxt}>{cl}</Text></View>
            ))}
          </View>
        </View>
        <View style={[s.contaRow, { borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 6 }]}>
          <Text style={[s.contaBanco, s.contaColHead]}>Banco / Entidade</Text>
          <Text style={[s.contaTipo, s.contaColHead]}>Tipo</Text>
          <Text style={[s.contaSaldo, s.contaColHead]}>Saldo</Text>
        </View>
        {CONTAS[lens].itens.map((c, i) => (
          <View key={i} style={[s.contaRow, { borderBottomColor: colors.border }]}>
            <Text style={[s.contaBanco, { color: colors.text }]}>{c.banco}</Text>
            <Text style={s.contaTipo}>{c.tipo}</Text>
            <Text style={[s.contaSaldo, { color: colors.text }]}>{c.saldo}</Text>
          </View>
        ))}
        <View style={s.contaFooter}>
          <Text style={s.geridoTxt}>Gerido por <Text style={{ color: GOLD, fontWeight: '700' }}>{CONTAS[lens].geridoPor}</Text></Text>
          <Text style={[s.contaTotal, { color: colors.text }]}>Total: {CONTAS[lens].total}</Text>
        </View>
      </View>

      {/* Ações necessárias */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Ações Necessárias</Text>
        {ACOES[lens].map((a, i) => (
          <View key={i} style={s.acaoRow}>
            <View style={[s.acaoDot, { backgroundColor: GOLD }]} />
            <Text style={[s.acaoTxt, { color: colors.text }]}>{a}</Text>
          </View>
        ))}
      </View>

      {/* Roteiro sucessório */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Roteiro Sucessório Plurianual</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <Svg width={Math.max(720, ROTEIRO.length * 150)} height={120}>
            <Line x1={20} y1={40} x2={ROTEIRO.length * 150 - 30} y2={40} stroke={colors.border} strokeWidth={2} />
            {ROTEIRO.map((m, i) => {
              const x = 60 + i * 150;
              const cor = m.estado === 'done' ? colors.green : m.estado === 'now' ? GOLD : colors.textSecondary;
              return (
                <React.Fragment key={i}>
                  <Circle cx={x} cy={40} r={m.estado === 'now' ? 9 : 6} fill={cor}
                    stroke={m.estado === 'now' ? GOLD : 'none'} strokeWidth={m.estado === 'now' ? 3 : 0} strokeOpacity={0.3} />
                  <SvgText x={x} y={22} fontSize={12} fontWeight="700" fill={cor} textAnchor="middle">{m.ano}</SvgText>
                  <SvgText x={x} y={66} fontSize={10.5} fill={colors.textSecondary} textAnchor="middle">
                    {m.titulo.length > 20 ? m.titulo.slice(0, 19) + '…' : m.titulo}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </ScrollView>
        <View style={s.legenda}>
          <Legenda cor={colors.green} txt="Concluído" />
          <Legenda cor={GOLD} txt="Em andamento" />
          <Legenda cor={colors.textSecondary} txt="Futuro" />
        </View>
      </View>
    </ScrollView>
  );
}

function Legenda({ cor, txt }: { cor: string; txt: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cor }} />
      <Text style={{ fontSize: 11, color: '#8b949e' }}>{txt}</Text>
    </View>
  );
}

// Gauge semicircular (0–100) com a cor variando pelo score.
function Gauge({ label, val, track, text, sub }: { label: string; val: number; track: string; text: string; sub: string }) {
  const r = 46, cx = 60, cy = 54, W = 120, H = 74;
  const cor = val >= 80 ? '#3fb950' : val >= 50 ? GOLD : '#f85149';
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };
  const fim = pt(180 - (Math.max(0, Math.min(100, val)) / 100) * 180);
  const ini = pt(180);
  const dir = pt(0);
  return (
    <View style={{ alignItems: 'center', width: W }}>
      <Svg width={W} height={H}>
        <Path d={`M ${ini.x} ${ini.y} A ${r} ${r} 0 0 1 ${dir.x} ${dir.y}`} stroke={track} strokeWidth={9} fill="none" strokeLinecap="round" />
        <Path d={`M ${ini.x} ${ini.y} A ${r} ${r} 0 0 1 ${fim.x} ${fim.y}`} stroke={cor} strokeWidth={9} fill="none" strokeLinecap="round" />
        <SvgText x={cx} y={cy - 12} fontSize={20} fontWeight="800" fill={text} textAnchor="middle">{val}</SvgText>
        <SvgText x={cx} y={cy - 1} fontSize={9} fill={sub} textAnchor="middle">/ 100</SvgText>
      </Svg>
      <Text style={{ fontSize: 11, color: sub, textAlign: 'center', marginTop: 2 }} numberOfLines={2}>{label}</Text>
    </View>
  );
}

// Gráfico de barras (histórico de distribuições).
function MiniBars({ dados, cor, track, sub, text }: { dados: { ano: string; v: number }[]; cor: string; track: string; sub: string; text: string }) {
  const W = 460, H = 200, padB = 30, padT = 30, padX = 14;
  const max = Math.max(...dados.map(d => d.v), 1);
  const bw = (W - padX * 2) / dados.length;
  const baseY = H - padB;
  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : String(v);
  return (
    <Svg width={W} height={H}>
      {/* linhas de grade */}
      {[0, 0.5, 1].map((t, i) => {
        const y = padT + (baseY - padT) * (1 - t);
        return (
          <React.Fragment key={i}>
            <Line x1={padX} y1={y} x2={W - padX} y2={y} stroke={track} strokeWidth={1} strokeDasharray="3,4" opacity={0.5} />
            <SvgText x={padX - 2} y={y + 3} fontSize={9} fill={sub} textAnchor="end">{fmt(max * t)}</SvgText>
          </React.Fragment>
        );
      })}
      {dados.map((d, i) => {
        const h = (baseY - padT) * d.v / max;
        const x = padX + i * bw;
        const y = baseY - h;
        const cxBar = x + bw / 2;
        return (
          <React.Fragment key={i}>
            <Rect x={x + 8} y={y} width={bw - 16} height={h} rx={5} fill={cor} />
            <SvgText x={cxBar} y={y - 8} fontSize={11} fontWeight="700" fill={text} textAnchor="middle">{fmt(d.v)}</SvgText>
            <SvgText x={cxBar} y={H - 10} fontSize={11} fill={sub} textAnchor="middle">{d.ano}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  proto:       { backgroundColor: GOLD + '18', borderColor: GOLD + '55', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 14, alignSelf: 'flex-start' },
  protoTxt:    { color: GOLD, fontSize: 12, fontWeight: '700' },
  headerRow:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  lensRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lensBtn:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  lensTxt:     { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  kpiRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard:     { flexGrow: 1, minWidth: 150, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  kpiLabel:    { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValor:    { color: c.text, fontSize: 22, fontWeight: '900', marginTop: 6 },
  kpiHint:     { color: c.textTertiary, fontSize: 10, marginTop: 2 },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '800' },
  cardSub:     { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  gaugeRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-around', marginTop: 12 },
  histTitulo:  { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 14, marginBottom: 6 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  col:         { flexGrow: 1, flexBasis: 320, minWidth: 280 },
  benefRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
  benefNome:   { flex: 1.4, fontSize: 13, fontWeight: '600' },
  benefPapel:  { flex: 1, fontSize: 12, color: c.textSecondary },
  benefPct:    { width: 44, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  benefStatus: { flex: 1.2, fontSize: 11, color: c.textSecondary, textAlign: 'right' },
  termos:      { color: c.textSecondary, fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  placeholder: { color: c.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 20 },
  docRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border },
  docIcon:     { fontSize: 15 },
  docNome:     { flex: 1, fontSize: 13 },
  docBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  docBadgeTxt: { fontSize: 10, fontWeight: '800' },
  contaHead:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 },
  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:        { backgroundColor: GOLD + '18', borderColor: GOLD + '55', borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  pillTxt:     { color: GOLD, fontSize: 11, fontWeight: '700' },
  contaRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, gap: 8 },
  contaColHead:{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, color: c.textSecondary },
  contaBanco:  { flex: 1.6, fontSize: 13, fontWeight: '600' },
  contaTipo:   { flex: 1, fontSize: 12, color: c.textSecondary },
  contaSaldo:  { flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  contaFooter: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 },
  geridoTxt:   { color: c.textSecondary, fontSize: 12 },
  contaTotal:  { fontSize: 15, fontWeight: '800' },
  acaoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  acaoDot:     { width: 8, height: 8, borderRadius: 4 },
  acaoTxt:     { fontSize: 13, flex: 1 },
  legenda:     { flexDirection: 'row', gap: 16, marginTop: 10 },
});
