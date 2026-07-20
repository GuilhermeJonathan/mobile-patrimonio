import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { parametrosService, CotacaoHistoricoDto, CotacaoHistoricoPaginadoDto } from '../services/api';
import { numBR } from '../utils/format';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = Math.min(SCREEN_W - 32, 600);
const CHART_H = 220;
const PAD_LEFT = 64;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;
const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM;

interface Props {
  moedaCodigo: string;
  moedaNome: string;
  onVoltar: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function CotacaoHistoricoScreen({ moedaCodigo, moedaNome, onVoltar }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<CotacaoHistoricoDto[]>([]);
  const [meta, setMeta] = useState<Omit<CotacaoHistoricoPaginadoDto, 'items'> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: CotacaoHistoricoDto } | null>(null);

  const PAGE_SIZE = 10;

  const carregar = useCallback(async (pag: number, acumular: boolean) => {
    pag === 1 ? setLoading(true) : setLoadingMore(true);
    setErro(null);
    try {
      const res = await parametrosService.historicoCotacao(moedaCodigo, pag, PAGE_SIZE);
      setMeta({ pagina: res.pagina, tamanhoPagina: res.tamanhoPagina, total: res.total, totalPaginas: res.totalPaginas });
      setDados(prev => acumular ? [...prev, ...res.items] : res.items);
    } catch {
      setErro('Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [moedaCodigo]);

  useEffect(() => { carregar(1, false); }, [carregar]);

  function carregarMais() {
    if (!meta || pagina >= meta.totalPaginas || loadingMore) return;
    const prox = pagina + 1;
    setPagina(prox);
    carregar(prox, true);
  }

  // ── Cálculos do gráfico (usa apenas os itens carregados, em ordem cronológica) ─
  const dadosGrafico = [...dados].reverse(); // API retorna mais recente primeiro
  const valores = dadosGrafico.map(d => d.cotacaoBRL);
  const minV = valores.length ? Math.min(...valores) * 0.995 : 0;
  const maxV = valores.length ? Math.max(...valores) * 1.005 : 1;
  const range = maxV - minV || 1;

  function toX(i: number): number {
    if (dadosGrafico.length <= 1) return PAD_LEFT + PLOT_W / 2;
    return PAD_LEFT + (i / (dadosGrafico.length - 1)) * PLOT_W;
  }

  function toY(v: number): number {
    return PAD_TOP + PLOT_H - ((v - minV) / range) * PLOT_H;
  }

  const pontos = dadosGrafico.map((d, i) => `${toX(i)},${toY(d.cotacaoBRL)}`).join(' ');

  // Marcadores de eixo X (até 6)
  const xTicks: number[] = [];
  if (dadosGrafico.length > 0) {
    const step = Math.max(1, Math.floor((dadosGrafico.length - 1) / 5));
    for (let i = 0; i < dadosGrafico.length; i += step) xTicks.push(i);
    if (xTicks[xTicks.length - 1] !== dadosGrafico.length - 1) xTicks.push(dadosGrafico.length - 1);
  }

  const variacaoPct = dadosGrafico.length >= 2
    ? ((dadosGrafico[dadosGrafico.length - 1].cotacaoBRL - dadosGrafico[0].cotacaoBRL) / dadosGrafico[0].cotacaoBRL) * 100
    : null;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => minV + t * range);

  const s = makeStyles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header estilo plano-acao */}
      <View style={s.header}>
        <TouchableOpacity onPress={onVoltar} style={s.btnVoltar}>
          <Text style={[s.btnVoltarTxt, { color: colors.green }]}>← Moedas</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerInfo}>
        <Text style={[s.titulo, { color: colors.text }]}>{moedaCodigo}</Text>
        <Text style={[s.subtitulo, { color: colors.textSecondary }]}>{moedaNome}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 60 }} />
      ) : erro ? (
        <View style={s.erroBox}>
          <Text style={s.erroTxt}>{erro}</Text>
          <TouchableOpacity onPress={() => carregar(1, false)}><Text style={{ color: colors.green, marginTop: 12 }}>Tentar novamente</Text></TouchableOpacity>
        </View>
      ) : dados.length === 0 ? (
        <View style={s.erroBox}>
          <Text style={[s.erroTxt, { color: colors.textSecondary }]}>Nenhum histórico disponível ainda.{'\n'}O job diário irá gerar os primeiros registros.</Text>
        </View>
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(_, i) => String(i)}
          onEndReached={carregarMais}
          onEndReachedThreshold={0.2}
          ListHeaderComponent={
            <View>
              {/* Resumo */}
              <View style={[s.resumoRow, { borderBottomColor: colors.border }]}>
                <View style={s.resumoItem}>
                  <Text style={[s.resumoLabel, { color: colors.textSecondary }]}>Cotação atual</Text>
                  <Text style={[s.resumoValor, { color: colors.text }]}>R$ {numBR(dados[0].cotacaoBRL, 4)}</Text>
                </View>
                <View style={s.resumoItem}>
                  <Text style={[s.resumoLabel, { color: colors.textSecondary }]}>{meta?.total ?? dados.length} registros</Text>
                  {variacaoPct !== null && (
                    <Text style={[s.resumoValor, { color: variacaoPct >= 0 ? colors.green : '#ef4444' }]}>
                      {variacaoPct >= 0 ? '+' : ''}{numBR(variacaoPct, 2)}%
                    </Text>
                  )}
                </View>
              </View>

              {/* Gráfico */}
              <View style={s.graficoBox}>
                <Text style={[s.graficoTitulo, { color: colors.textSecondary }]}>Evolução da cotação (BRL) — página {pagina}</Text>
                <Svg width={CHART_W} height={CHART_H} style={{ alignSelf: 'center' }}>
                  {yTicks.map((v, i) => (
                    <React.Fragment key={i}>
                      <Line x1={PAD_LEFT} y1={toY(v)} x2={CHART_W - PAD_RIGHT} y2={toY(v)}
                        stroke={colors.border} strokeWidth={1} strokeDasharray="3,3" />
                      <SvgText x={PAD_LEFT - 4} y={toY(v) + 4} fontSize={9} fill={colors.textSecondary} textAnchor="end">
                        {numBR(v, 2)}
                      </SvgText>
                    </React.Fragment>
                  ))}
                  {xTicks.map(i => (
                    <SvgText key={i} x={toX(i)} y={CHART_H - 4} fontSize={9} fill={colors.textSecondary} textAnchor="middle">
                      {formatDate(dadosGrafico[i].dataHora)}
                    </SvgText>
                  ))}
                  {dadosGrafico.length > 1 && (
                    <Polyline points={pontos} fill="none" stroke={colors.green}
                      strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  )}
                  {dadosGrafico.map((d, i) => (
                    <Circle key={i} cx={toX(i)} cy={toY(d.cotacaoBRL)}
                      r={dadosGrafico.length <= 20 ? 4 : 2} fill={colors.green}
                      onPress={() => setTooltip(prev => prev?.item === d ? null : { x: toX(i), y: toY(d.cotacaoBRL), item: d })}
                    />
                  ))}
                  {tooltip && (() => {
                    const bx = Math.min(Math.max(tooltip.x - 60, PAD_LEFT), CHART_W - PAD_RIGHT - 120);
                    const by = tooltip.y < PAD_TOP + 60 ? tooltip.y + 10 : tooltip.y - 52;
                    return (
                      <>
                        <Rect x={bx} y={by} width={120} height={42} rx={6} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
                        <SvgText x={bx + 60} y={by + 15} fontSize={10} fill={colors.textSecondary} textAnchor="middle">
                          {formatDate(tooltip.item.dataHora)}
                        </SvgText>
                        <SvgText x={bx + 60} y={by + 32} fontSize={13} fontWeight="bold" fill={colors.green} textAnchor="middle">
                          R$ {numBR(tooltip.item.cotacaoBRL, 4)}
                        </SvgText>
                      </>
                    );
                  })()}
                </Svg>
              </View>

              <Text style={[s.listaHeader, { color: colors.textSecondary, borderBottomColor: colors.border }]}>
                Histórico de alterações
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const anterior = dados[index + 1];
            const diff = anterior
              ? ((item.cotacaoBRL - anterior.cotacaoBRL) / anterior.cotacaoBRL) * 100
              : null;
            return (
              <View style={[s.itemRow, { borderBottomColor: colors.border }]}>
                <View style={s.itemLeft}>
                  <Text style={[s.itemData, { color: colors.textSecondary }]}>{formatDateLong(item.dataHora)}</Text>
                  <Text style={[s.itemFonte, { color: colors.textSecondary }]}>{item.fonte}</Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={[s.itemValor, { color: colors.text }]}>R$ {numBR(item.cotacaoBRL, 4)}</Text>
                  {diff !== null && (
                    <Text style={[s.itemDiff, { color: diff >= 0 ? colors.green : '#ef4444' }]}>
                      {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(2)}%
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={colors.green} style={{ padding: 16 }} />
              : meta && pagina >= meta.totalPaginas
                ? <Text style={[s.rodape, { color: colors.textSecondary }]}>— fim do histórico —</Text>
                : null
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root:         { flex: 1, paddingTop: 16 },
    header:       { paddingHorizontal: 16, marginBottom: 4 },
    btnVoltar:    {},
    btnVoltarTxt: { fontSize: 15, fontWeight: '600' },
    headerInfo:   { paddingHorizontal: 20, marginBottom: 12 },
    titulo:       { fontSize: 26, fontWeight: '800' },
    subtitulo:    { fontSize: 13, marginTop: 2 },
    erroBox:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    erroTxt:      { color: '#ef4444', fontSize: 14, textAlign: 'center' },
    resumoRow:    { flexDirection: 'row', padding: 16, borderBottomWidth: 1 },
    resumoItem:   { flex: 1, alignItems: 'center' },
    resumoLabel:  { fontSize: 11, marginBottom: 4 },
    resumoValor:  { fontSize: 20, fontWeight: '700' },
    graficoBox:   { padding: 16, paddingBottom: 8 },
    graficoTitulo:{ fontSize: 12, marginBottom: 12, textAlign: 'center' },
    listaHeader:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', padding: 16, paddingBottom: 8, borderBottomWidth: 1 },
    itemRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    itemLeft:     { flex: 1, gap: 2 },
    itemData:     { fontSize: 13 },
    itemFonte:    { fontSize: 11 },
    itemRight:    { alignItems: 'flex-end', gap: 2 },
    itemValor:    { fontSize: 16, fontWeight: '700' },
    itemDiff:     { fontSize: 12, fontWeight: '600' },
    rodape:       { textAlign: 'center', padding: 20, fontSize: 12 },
  });
}
