import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { gestaoService, ParceladosVigentesResultDto, ParceladoVigenteDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }
function pct(v: number, total: number) { return total > 0 ? `${((v / total) * 100).toFixed(0)}%` : '0%'; }

export default function DividasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [dados,      setDados]      = useState<ParceladosVigentesResultDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setDados(await gestaoService.dividasVigentes()); }
    catch { } finally { setCarregando(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const itens: ParceladoVigenteDto[] = dados?.itens ?? [];

  // Calcula métricas no frontend (backend só retorna totalDivida + itens)
  const mensalidadeTotal = itens.reduce((s, i) => s + i.valorParcela, 0);
  const totalPago        = itens.reduce((s, i) => s + (i.parcelaMin - 1) * i.valorParcela, 0);
  const totalGeral       = itens.reduce((s, i) => s + i.totalParcelas * i.valorParcela, 0);
  const percentualQuit   = totalGeral > 0 ? (totalPago / totalGeral) * 100 : 0;

  return (
    <View style={s.root}>
      <Text style={s.titulo}>Dividas & Parcelados</Text>

      {dados && (
        <View style={s.resumo}>
          <View style={s.resumoItem}>
            <Text style={s.resumoLbl}>Total divida</Text>
            <Text style={[s.resumoVal, { color: colors.red }]}>{fmt(dados.totalDivida)}</Text>
          </View>
          <View style={s.resumoItem}>
            <Text style={s.resumoLbl}>Mensalidade</Text>
            <Text style={[s.resumoVal, { color: colors.red }]}>{fmt(mensalidadeTotal)}</Text>
          </View>
          <View style={s.resumoItem}>
            <Text style={s.resumoLbl}>% Quitado</Text>
            <Text style={[s.resumoVal, { color: colors.green }]}>{percentualQuit.toFixed(0)}%</Text>
          </View>
        </View>
      )}

      <FlatList
        data={itens}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={[s.vazio, { color: colors.textSecondary }]}>Nenhuma divida ativa. Otimo!</Text>}
        renderItem={({ item }) => {
          const progresso = item.totalParcelas > 0 ? (item.parcelaMin - 1) / item.totalParcelas : 0;
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardDesc}>{item.descricao}</Text>
                <Text style={[s.cardSaldo, { color: colors.red }]}>{fmt(item.saldoRestante)}</Text>
              </View>
              <Text style={s.cardMeta}>
                {item.parcelaMin}/{item.totalParcelas} parcelas  ·  {fmt(item.valorParcela)}/mes
                {item.cartaoNome ? `  ·  ${item.cartaoNome}` : ''}
                {item.categoriaNome ? `  ·  ${item.categoriaNome}` : ''}
              </Text>
              {/* Barra de progresso */}
              <View style={s.barBg}>
                <View style={[s.barFg, { width: `${Math.min(progresso * 100, 100)}%` as any, backgroundColor: colors.green }]} />
              </View>
              <Text style={[s.pctTxt, { color: colors.textSecondary }]}>{pct(item.parcelaMin - 1, item.totalParcelas)} quitado</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:       { flex: 1, backgroundColor: c.background },
  center:     { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  titulo:     { color: c.text, fontSize: 22, fontWeight: '700', padding: 20, paddingBottom: 8 },
  resumo:     { flexDirection: 'row', backgroundColor: c.surface, margin: 16, borderRadius: 14, padding: 16 },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoLbl:  { color: c.textSecondary, fontSize: 11 },
  resumoVal:  { fontSize: 16, fontWeight: '800', marginTop: 2 },
  card:       { backgroundColor: c.surface, borderRadius: 12, padding: 14 },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardDesc:   { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
  cardSaldo:  { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  cardMeta:   { color: c.textSecondary, fontSize: 11, marginBottom: 8 },
  barBg:      { height: 6, backgroundColor: c.border, borderRadius: 3, marginBottom: 4 },
  barFg:      { height: 6, borderRadius: 3 },
  pctTxt:     { fontSize: 10 },
  vazio:      { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
