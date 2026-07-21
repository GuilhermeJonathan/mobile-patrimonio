import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { adminService, AdminOverviewDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useRouter } from '../navigation/router';
import { numBR } from '../utils/format';

const GOLD = '#C79A4E';

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${numBR(v / 1_000_000, 2)}M`;
  if (v >= 1_000) return `R$ ${numBR(v / 1_000, 1)}k`;
  return `R$ ${numBR(v, 2)}`;
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { navigate } = useRouter();

  const [dados, setDados] = useState<AdminOverviewDto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      setDados(await adminService.overview());
    } catch (e: any) {
      setErro(e?.response?.status === 403
        ? 'Acesso restrito ao admin da plataforma.'
        : 'Não foi possível carregar o painel.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const kpis = dados ? [
    { label: 'Assessorias', valor: String(dados.qtdAssessorias) },
    { label: 'Clientes', valor: String(dados.qtdClientes) },
    { label: 'Corretores', valor: String(dados.qtdCorretores) },
    { label: 'AUM total', valor: fmtBRL(dados.aumTotalBRL) },
    { label: 'Parâmetros globais', valor: String(dados.qtdParametrosGlobais) },
  ] : [];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <View style={s.header}>
        <View>
          <Text style={s.title}>Painel Admin</Text>
          <Text style={s.subtitle}>Visão consolidada da plataforma</Text>
        </View>
        <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>ADMIN</Text></View>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {/* KPIs */}
      <View style={s.kpiRow}>
        {kpis.map(k => (
          <View key={k.label} style={s.kpiCard}>
            <Text style={s.kpiLabel}>{k.label}</Text>
            <Text style={s.kpiValor}>{k.valor}</Text>
          </View>
        ))}
      </View>

      {/* Atalhos do catálogo global */}
      <View style={s.atalhoRow}>
        <TouchableOpacity style={s.atalho} onPress={() => navigate('cadastros-moedas')}>
          <Text style={s.atalhoIcon}>💱</Text>
          <Text style={s.atalhoTxt}>Moedas (global)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.atalho} onPress={() => navigate('cadastros-tipos-ativo')}>
          <Text style={s.atalhoIcon}>🏷️</Text>
          <Text style={s.atalhoTxt}>Tipos de Ativo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.atalho} onPress={() => navigate('cadastros-tipos-investimento')}>
          <Text style={s.atalhoIcon}>📈</Text>
          <Text style={s.atalhoTxt}>Tipos de Investimento</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de assessorias */}
      <View style={s.card}>
        <Text style={s.cardTitulo}>Assessorias</Text>
        <View style={[s.row, s.rowHead, { borderBottomColor: colors.border }]}>
          <Text style={[s.cNome, s.hCell]}>Assessoria</Text>
          <Text style={[s.cNum, s.hCell]}>Clientes</Text>
          <Text style={[s.cNum, s.hCell]}>Corretores</Text>
          <Text style={[s.cAum, s.hCell]}>AUM</Text>
        </View>
        {(dados?.assessorias ?? []).length === 0 ? (
          <Text style={s.vazio}>Nenhuma assessoria cadastrada ainda.</Text>
        ) : (
          dados!.assessorias.map(a => (
            <View key={a.assessorId} style={[s.row, { borderBottomColor: colors.border }]}>
              <Text style={[s.cNome, { color: colors.text }]} numberOfLines={1}>{a.nome}</Text>
              <Text style={s.cNum}>{a.qtdClientes}</Text>
              <Text style={s.cNum}>{a.qtdCorretores}</Text>
              <Text style={[s.cAum, { color: colors.text }]}>{fmtBRL(a.aumBRL)}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={s.rodape}>
        Gestão de contas e planos das assessorias é feita na plataforma de Login (fora deste painel).
      </Text>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  adminBadge:  { backgroundColor: GOLD + '22', borderColor: GOLD + '66', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  adminBadgeTxt: { color: GOLD, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  erro:        { color: c.red, fontSize: 14, marginBottom: 12 },
  kpiRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard:     { flexGrow: 1, minWidth: 140, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  kpiLabel:    { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValor:    { color: c.text, fontSize: 22, fontWeight: '900', marginTop: 6 },
  atalhoRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  atalho:      { flexGrow: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.greenBorder, padding: 14 },
  atalhoIcon:  { fontSize: 20 },
  atalhoTxt:   { color: c.green, fontSize: 14, fontWeight: '700' },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, gap: 8 },
  rowHead:     { paddingBottom: 6 },
  hCell:       { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  cNome:       { flex: 2, fontSize: 13, fontWeight: '600' },
  cNum:        { flex: 1, fontSize: 13, color: c.textSecondary, textAlign: 'center' },
  cAum:        { flex: 1.3, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  vazio:       { color: c.textSecondary, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  rodape:      { color: c.textTertiary, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
});
