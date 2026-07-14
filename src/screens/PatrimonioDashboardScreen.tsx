import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { patrimonioService, ResumoPatrimonialDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

const TIPO_LABEL: Record<number, string> = {
  1: '🏠 Imóvel', 2: '🚗 Veículo', 3: '⛵ Embarcação', 4: '✈️ Aeronave',
  5: '🏢 Participação', 6: '📈 Investimento', 99: '◆ Outro',
};
const MOEDA_SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: '€', CHF: 'CHF', GBP: '£' };

function fmt(valor: number, moeda = 'BRL'): string {
  const s = MOEDA_SIMBOLO[moeda] ?? '';
  return `${s} ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PatrimonioDashboardScreen({ onLogout }: { onLogout: () => void }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [dados, setDados] = useState<ResumoPatrimonialDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      setDados(await patrimonioService.resumo());
    } catch (e: any) {
      if (e?.response?.status === 401) {
        // token expirou/invalidou — volta pro login (o interceptor já limpou o token)
        onLogout();
        return;
      }
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

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={s.header}>
        <Text style={s.title}>Patrimônio consolidado</Text>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {dados && (
        <>
          {/* Total consolidado */}
          <View style={s.totalCard}>
            <Text style={s.totalLabel}>Patrimônio total (consolidado em BRL)</Text>
            <Text style={s.totalValor}>{fmt(dados.totalConsolidadoBRL)}</Text>
            {dados.cambioEstimado && (
              <Text style={s.cambioNota}>* câmbio estimado — cotação em tempo real virá em versão futura</Text>
            )}
            <Text style={s.qtd}>{dados.qtdAtivos} ativo(s)</Text>
          </View>

          {/* Totais por moeda */}
          {dados.totaisPorMoeda.length > 0 && (
            <>
              <Text style={s.secao}>Por moeda</Text>
              <View style={s.moedaRow}>
                {dados.totaisPorMoeda.map(m => (
                  <View key={m.moeda} style={s.moedaCard}>
                    <Text style={s.moedaNome}>{m.moeda}</Text>
                    <Text style={s.moedaTotal}>{fmt(m.total, m.moeda)}</Text>
                    <Text style={s.moedaQtd}>{m.quantidade} ativo(s)</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Lista de ativos */}
          <Text style={s.secao}>Ativos</Text>
          {dados.ativos.length === 0 && <Text style={s.vazio}>Nenhum ativo cadastrado ainda.</Text>}
          {dados.ativos.map(a => (
            <View key={a.id} style={s.ativoCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.ativoNome}>{a.nome}</Text>
                <Text style={s.ativoTipo}>{TIPO_LABEL[a.tipo] ?? 'Ativo'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.ativoValor}>{fmt(a.valorAtual, a.moeda)}</Text>
                {a.valorizacaoAnualPct != null && (
                  <Text style={[s.ativoVar, { color: a.valorizacaoAnualPct >= 0 ? colors.green : colors.red }]}>
                    {a.valorizacaoAnualPct >= 0 ? '▲' : '▼'} {Math.abs(a.valorizacaoAnualPct).toFixed(1)}% a.a.
                  </Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 16 },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: c.text, fontSize: 20, fontWeight: '800' },
  sair: { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  erro: { color: c.red, fontSize: 14, marginBottom: 12 },
  totalCard: { backgroundColor: c.surface, borderRadius: 16, padding: 22, marginBottom: 20, borderWidth: 1, borderColor: c.greenBorder },
  totalLabel: { color: c.textSecondary, fontSize: 13 },
  totalValor: { color: c.green, fontSize: 34, fontWeight: '800', marginTop: 6 },
  cambioNota: { color: c.textTertiary, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  qtd: { color: c.textSecondary, fontSize: 12, marginTop: 8 },
  secao: { color: c.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  moedaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  moedaCard: { backgroundColor: c.surface, borderRadius: 12, padding: 14, minWidth: 150, flexGrow: 1 },
  moedaNome: { color: c.blue, fontSize: 13, fontWeight: '700' },
  moedaTotal: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  moedaQtd: { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  vazio: { color: c.textTertiary, fontSize: 14 },
  ativoCard: {
    backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  ativoNome: { color: c.text, fontSize: 15, fontWeight: '700' },
  ativoTipo: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  ativoValor: { color: c.text, fontSize: 15, fontWeight: '700' },
  ativoVar: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
