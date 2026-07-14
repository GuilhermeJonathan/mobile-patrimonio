import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { gestaoService, AssinaturaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

function fmt(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

export default function AssinaturasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [itens,      setItens]      = useState<AssinaturaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItens(await gestaoService.assinaturas()); }
    catch { } finally { setCarregando(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalMensal = itens.reduce((s, i) => s + i.valorMensal, 0);
  const totalAnual  = totalMensal * 12;

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  return (
    <View style={s.root}>
      <Text style={s.titulo}>Assinaturas</Text>

      <View style={s.resumo}>
        <View style={s.resumoItem}>
          <Text style={s.resumoLbl}>Mensal</Text>
          <Text style={[s.resumoVal, { color: colors.red }]}>{fmt(totalMensal)}</Text>
        </View>
        <View style={s.resumoItem}>
          <Text style={s.resumoLbl}>Anual</Text>
          <Text style={[s.resumoVal, { color: colors.red }]}>{fmt(totalAnual)}</Text>
        </View>
        <View style={s.resumoItem}>
          <Text style={s.resumoLbl}>Total</Text>
          <Text style={[s.resumoVal, { color: colors.text }]}>{itens.length}</Text>
        </View>
      </View>

      <FlatList
        data={itens}
        keyExtractor={i => i.grupoId}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={[s.vazio, { color: colors.textSecondary }]}>Nenhuma assinatura detectada.</Text>}
        renderItem={({ item }) => {
          const pago = item.lancamentosPagos / Math.max(item.totalLancamentos, 1);
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.cardLeft}>
                  {item.categoriaIcone ? <Text style={{ fontSize: 20 }}>{item.categoriaIcone}</Text> : null}
                  <View>
                    <Text style={s.cardDesc}>{item.descricao}</Text>
                    <Text style={s.cardMeta}>{item.categoriaNome ?? 'Sem categoria'}</Text>
                  </View>
                </View>
                <Text style={[s.cardValor, { color: colors.red }]}>{fmt(item.valorMensal)}/mes</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFg, { width: `${Math.min(pago * 100, 100)}%` as any, backgroundColor: colors.green }]} />
              </View>
              <Text style={s.pctTxt}>{item.lancamentosPagos}/{item.totalLancamentos} pagamentos</Text>
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
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardDesc:   { color: c.text, fontSize: 15, fontWeight: '700' },
  cardMeta:   { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  cardValor:  { fontSize: 14, fontWeight: '800' },
  barBg:      { height: 5, backgroundColor: c.border, borderRadius: 3, marginBottom: 4 },
  barFg:      { height: 5, borderRadius: 3 },
  pctTxt:     { color: c.textSecondary, fontSize: 10 },
  vazio:      { textAlign: 'center', marginTop: 40, fontSize: 14 },
});
