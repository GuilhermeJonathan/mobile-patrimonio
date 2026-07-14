import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { gestaoService, DashboardDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useRouter } from '../navigation/router';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmt(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Var({ v, prefix = '' }: { v: number | null | undefined; prefix?: string }) {
  if (v == null) return null;
  const cor = v >= 0 ? '#22c55e' : '#ef4444';
  const sinal = v >= 0 ? '+' : '';
  return <Text style={{ color: cor, fontSize: 11, fontWeight: '700' }}>{prefix}{sinal}{v.toFixed(1)}%</Text>;
}

export default function DashboardGPScreen() {
  const { colors } = useTheme();
  const { navigate } = useRouter();
  const s = makeStyles(colors);

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const [dados,      setDados]      = useState<DashboardDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      setDados(await gestaoService.dashboard(mes, ano));
    } catch {
      setErro('Erro ao carregar o dashboard.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [mes, ano]);

  useEffect(() => { load(); }, [load]);

  function navMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1;  a++; }
    setMes(m); setAno(a);
    setCarregando(true);
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const d = dados;

  return (
    <ScrollView
      style={s.root}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {/* Navegador de mês */}
      <View style={s.mesNav}>
        <TouchableOpacity style={s.mesBtn} onPress={() => navMes(-1)}>
          <Text style={s.mesBtnTxt}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.mesTitulo}>{MESES[mes - 1]} {ano}</Text>
        <TouchableOpacity style={s.mesBtn} onPress={() => navMes(1)}>
          <Text style={s.mesBtnTxt}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {d && (
        <>
          {/* Cards principais */}
          <View style={s.cardsRow}>
            <View style={[s.card, { borderColor: colors.green + '60' }]}>
              <Text style={s.cardLabel}>Receitas</Text>
              <Text style={[s.cardValor, { color: colors.green }]}>{fmt(d.totalCreditos)}</Text>
              <Var v={d.variacaoCreditos} />
            </View>
            <View style={[s.card, { borderColor: colors.red + '60' }]}>
              <Text style={s.cardLabel}>Despesas</Text>
              <Text style={[s.cardValor, { color: colors.red }]}>{fmt(d.totalDebitos)}</Text>
              <Var v={d.variacaoDebitos} />
            </View>
          </View>

          {/* Saldo */}
          <View style={[s.saldoCard, { borderColor: d.saldo >= 0 ? colors.green + '40' : colors.red + '40' }]}>
            <Text style={s.saldoLabel}>Saldo do mes</Text>
            <Text style={[s.saldoValor, { color: d.saldo >= 0 ? colors.green : colors.red }]}>{fmt(d.saldo)}</Text>
            <Var v={d.variacaoSaldo} prefix="vs mes anterior  " />
          </View>

          {/* Saude financeira */}
          <View style={s.saudeRow}>
            {d.diasReserva != null && (
              <View style={s.saudeCard}>
                <Text style={s.saudeNum}>{d.diasReserva}d</Text>
                <Text style={s.saudeLbl}>dias de reserva</Text>
              </View>
            )}
            {d.comprometimentoRenda != null && (
              <View style={s.saudeCard}>
                <Text style={[s.saudeNum, {
                  color: d.comprometimentoRenda > 90 ? colors.red
                       : d.comprometimentoRenda > 70 ? '#f59e0b'
                       : colors.green,
                }]}>{d.comprometimentoRenda.toFixed(0)}%</Text>
                <Text style={s.saudeLbl}>renda comprometida</Text>
              </View>
            )}
          </View>

          {/* Resumo por categoria */}
          {d.resumoDebitos.length > 0 && (
            <View style={s.secao}>
              <Text style={s.secaoTitulo}>Despesas por categoria</Text>
              {d.resumoDebitos.slice(0, 8).map((r, i) => (
                <View key={i} style={s.catRow}>
                  <View style={s.catLeft}>
                    {r.icone ? <Text style={s.catIcone}>{r.icone}</Text> : null}
                    <Text style={s.catNome}>{r.categoria}</Text>
                  </View>
                  <Text style={s.catValor}>{fmt(r.total)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Atalhos */}
          <View style={s.atalhos}>
            <TouchableOpacity style={s.atalho} onPress={() => navigate('gp-lancamentos')}>
              <Text style={s.atalhoIco}>💸</Text>
              <Text style={s.atalhoLbl}>Lancamentos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.atalho} onPress={() => navigate('gp-dividas')}>
              <Text style={s.atalhoIco}>🧾</Text>
              <Text style={s.atalhoLbl}>Parcelados</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.atalho} onPress={() => navigate('gp-metas')}>
              <Text style={s.atalhoIco}>🎯</Text>
              <Text style={s.atalhoLbl}>Metas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.atalho} onPress={() => navigate('gp-assinaturas')}>
              <Text style={s.atalhoIco}>🔄</Text>
              <Text style={s.atalhoLbl}>Assinaturas</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:       { flex: 1, backgroundColor: c.background, padding: 16 },
  center:     { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  erro:       { color: c.red, textAlign: 'center', marginTop: 20 },
  mesNav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 20 },
  mesBtn:     { backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  mesBtnTxt:  { color: c.text, fontSize: 16, fontWeight: '700' },
  mesTitulo:  { color: c.text, fontSize: 18, fontWeight: '800', minWidth: 120, textAlign: 'center' },
  cardsRow:   { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card:       { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, gap: 4 },
  cardLabel:  { color: c.textSecondary, fontSize: 12 },
  cardValor:  { fontSize: 20, fontWeight: '800' },
  saldoCard:  { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 16, gap: 4 },
  saldoLabel: { color: c.textSecondary, fontSize: 12 },
  saldoValor: { fontSize: 26, fontWeight: '900' },
  saudeRow:   { flexDirection: 'row', gap: 12, marginBottom: 20 },
  saudeCard:  { flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, alignItems: 'center' },
  saudeNum:   { fontSize: 22, fontWeight: '800', color: c.green },
  saudeLbl:   { color: c.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'center' },
  secao:      { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  secaoTitulo:{ color: c.text, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  catRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  catLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catIcone:   { fontSize: 18 },
  catNome:    { color: c.text, fontSize: 14, fontWeight: '500' },
  catValor:   { color: c.text, fontSize: 14, fontWeight: '700' },
  atalhos:    { flexDirection: 'row', gap: 10, marginBottom: 24 },
  atalho:     { flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 },
  atalhoIco:  { fontSize: 22 },
  atalhoLbl:  { color: c.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
