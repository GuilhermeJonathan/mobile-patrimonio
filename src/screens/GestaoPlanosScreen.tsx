import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { assessoriaService, planoAcaoService, ClienteAssessoriaDto } from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { useTheme } from '../theme/ThemeContext';

type Status = { tem: boolean; objetivo: string; progresso: number; total: number } | 'loading' | 'error';

export default function GestaoPlanosScreen() {
  const { colors } = useTheme();
  const { entrar } = useAssessoria();
  const { navigate } = useRouter();
  const s = makeStyles(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientes, setClientes] = useState<ClienteAssessoriaDto[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [busca, setBusca] = useState('');

  const load = useCallback(async () => {
    try {
      const lista = (await assessoriaService.clientes()).filter(c => c.ativo);
      setClientes(lista);
      setStatus(prev => {
        const next = { ...prev };
        lista.forEach(c => { next[c.clienteId] = 'loading'; });
        return next;
      });
      lista.forEach(c => {
        planoAcaoService.get(c.clienteId)
          .then(p => setStatus(prev => ({
            ...prev,
            [c.clienteId]: p
              ? { tem: true, objetivo: p.objetivo, total: p.etapas.length, progresso: p.etapas.filter(e => e.status === 3).length }
              : { tem: false, objetivo: '', total: 0, progresso: 0 },
          })))
          .catch(() => setStatus(prev => ({ ...prev, [c.clienteId]: 'error' })));
      });
    } catch { /* silencia */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function gerenciar(c: ClienteAssessoriaDto) {
    entrar({ clienteId: c.clienteId, nome: c.nomeCliente ?? 'Cliente' });
    navigate('plano-acao');
  }

  const filtrados = clientes.filter(c => {
    const q = busca.trim().toLowerCase();
    return !q || (c.nomeCliente ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={s.title}>Planos de Ação</Text>
      <Text style={s.subtitle}>Selecione um cliente para cadastrar, alterar ou acompanhar o plano.</Text>

      <TextInput
        style={s.busca}
        value={busca}
        onChangeText={setBusca}
        placeholder="Buscar cliente por nome ou e-mail..."
        placeholderTextColor={colors.inputPlaceholder}
      />

      {filtrados.length === 0 && (
        <View style={s.vazio}>
          <Text style={s.vazioText}>Nenhum cliente ativo.</Text>
          <Text style={s.vazioSub}>Convide clientes na Carteira de clientes.</Text>
        </View>
      )}

      {filtrados.map(c => {
        const st = status[c.clienteId];
        const iniciais = (c.nomeCliente ?? 'C').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
        const temPlano = typeof st === 'object' && st.tem;
        const pct = temPlano && st.total > 0 ? Math.round((st.progresso / st.total) * 100) : 0;
        return (
          <View key={c.clienteId} style={s.card}>
            <View style={s.top}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{iniciais}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nome} numberOfLines={1}>{c.nomeCliente ?? '(sem nome)'}</Text>
                {!!c.email && <Text style={s.email} numberOfLines={1}>{c.email}</Text>}
                {st === 'loading'
                  ? <Text style={s.subInfo}>Carregando plano…</Text>
                  : temPlano
                    ? <Text style={s.objetivo} numberOfLines={1}>🎯 {st.objetivo}</Text>
                    : <Text style={s.semPlano}>Sem plano ainda</Text>}
              </View>
              {temPlano && (
                <View style={s.badge}>
                  <Text style={s.badgeNum}>{pct}%</Text>
                  <Text style={s.badgeLbl}>{st.progresso}/{st.total}</Text>
                </View>
              )}
            </View>

            {temPlano && (
              <View style={s.track}><View style={[s.fill, { width: `${pct}%` }]} /></View>
            )}

            <TouchableOpacity style={[s.btn, temPlano ? s.btnGhost : s.btnPrimary]} onPress={() => gerenciar(c)}>
              <Text style={temPlano ? s.btnGhostTxt : s.btnPrimaryTxt}>
                {temPlano ? 'Gerenciar plano' : '+ Criar plano'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 14 },
  busca:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, marginBottom: 14 },
  vazio:       { alignItems: 'center', marginTop: 50 },
  vazioText:   { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:    { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  card:        { backgroundColor: c.surface, borderRadius: 14, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  top:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: c.greenDim, justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { color: c.green, fontWeight: '800', fontSize: 15 },
  nome:        { color: c.text, fontSize: 15, fontWeight: '700' },
  email:       { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  subInfo:     { color: c.textTertiary, fontSize: 12, marginTop: 3 },
  objetivo:    { color: c.text, fontSize: 12, marginTop: 3 },
  semPlano:    { color: c.textTertiary, fontSize: 12, marginTop: 3, fontStyle: 'italic' },
  badge:       { alignItems: 'center', minWidth: 52 },
  badgeNum:    { color: c.green, fontSize: 18, fontWeight: '900' },
  badgeLbl:    { color: c.textSecondary, fontSize: 11 },
  track:       { height: 6, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  fill:        { height: 6, backgroundColor: c.green, borderRadius: 4 },
  btn:         { borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  btnPrimary:  { backgroundColor: c.green },
  btnPrimaryTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  btnGhost:    { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.greenBorder },
  btnGhostTxt: { color: c.green, fontWeight: '700', fontSize: 13 },
});
