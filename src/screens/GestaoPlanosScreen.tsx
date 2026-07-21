import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput,
} from 'react-native';
import { assessoriaService, planoAcaoService, ClienteAssessoriaDto } from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { useTheme } from '../theme/ThemeContext';

const GOLD = '#C79A4E';

type Status = { qtd: number; etapasTotal: number; etapasConcluidas: number; objetivo: string } | 'loading' | 'error';

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
  const [filtro, setFiltro] = useState<'todos' | 'andamento' | 'concluidos' | 'sem'>('todos');

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
        planoAcaoService.listar(c.clienteId)
          .then(ps => setStatus(prev => ({
            ...prev,
            [c.clienteId]: {
              qtd: ps.length,
              etapasTotal: ps.reduce((s, p) => s + p.etapas.length, 0),
              etapasConcluidas: ps.reduce((s, p) => s + p.etapas.filter(e => e.status === 3).length, 0),
              objetivo: ps[0]?.objetivo ?? '',
            },
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

  // 'load' enquanto carrega; 'sem' sem plano; 'concluido' 100%; 'andamento' caso contrário.
  const situacao = (c: ClienteAssessoriaDto): 'load' | 'sem' | 'andamento' | 'concluido' => {
    const st = status[c.clienteId];
    if (typeof st !== 'object') return 'load';
    if (st.qtd === 0) return 'sem';
    return st.etapasTotal > 0 && st.etapasConcluidas === st.etapasTotal ? 'concluido' : 'andamento';
  };
  const cnt = {
    andamento: clientes.filter(c => situacao(c) === 'andamento').length,
    concluidos: clientes.filter(c => situacao(c) === 'concluido').length,
    sem: clientes.filter(c => situacao(c) === 'sem').length,
  };

  const filtrados = clientes.filter(c => {
    if (filtro === 'andamento' && situacao(c) !== 'andamento') return false;
    if (filtro === 'concluidos' && situacao(c) !== 'concluido') return false;
    if (filtro === 'sem' && situacao(c) !== 'sem') return false;
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

      <View style={s.controls}>
        <TextInput
          style={s.buscaInline}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar cliente por nome ou e-mail..."
          placeholderTextColor={colors.inputPlaceholder}
        />
        <TouchableOpacity style={[s.chip, filtro === 'todos' && s.chipOn]} onPress={() => setFiltro('todos')}>
          <Text style={[s.chipTxt, filtro === 'todos' && s.chipTxtOn]}>Todos ({clientes.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chip, filtro === 'andamento' && s.chipOn]} onPress={() => setFiltro('andamento')}>
          <Text style={[s.chipTxt, filtro === 'andamento' && s.chipTxtOn]}>Em andamento ({cnt.andamento})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.chip, filtro === 'concluidos' && s.chipOnGold]} onPress={() => setFiltro('concluidos')}>
          <Text style={[s.chipTxt, filtro === 'concluidos' && s.chipTxtGold]}>🏆 Concluídos ({cnt.concluidos})</Text>
        </TouchableOpacity>
        {cnt.sem > 0 && (
          <TouchableOpacity style={[s.chip, filtro === 'sem' && s.chipOn]} onPress={() => setFiltro('sem')}>
            <Text style={[s.chipTxt, filtro === 'sem' && s.chipTxtOn]}>Sem plano ({cnt.sem})</Text>
          </TouchableOpacity>
        )}
      </View>

      {filtrados.length === 0 && (
        <View style={s.vazio}>
          <Text style={s.vazioText}>Nenhum cliente ativo.</Text>
          <Text style={s.vazioSub}>Convide clientes na Carteira de clientes.</Text>
        </View>
      )}

      {filtrados.map(c => {
        const st = status[c.clienteId];
        const iniciais = (c.nomeCliente ?? 'C').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
        const obj = typeof st === 'object' ? st : null;
        const qtd = obj?.qtd ?? 0;
        const etapasTotal = obj?.etapasTotal ?? 0;
        const etapasConcluidas = obj?.etapasConcluidas ?? 0;
        const tudoConcluido = etapasTotal > 0 && etapasConcluidas === etapasTotal;
        const pct = etapasTotal > 0 ? Math.round((etapasConcluidas / etapasTotal) * 100) : 0;
        const subtitulo = qtd === 0 ? '' : qtd === 1 ? `🎯 ${obj!.objetivo}` : `🎯 ${qtd} planos`;
        return (
          <View key={c.clienteId} style={s.card}>
            <View style={s.top}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{iniciais}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.nome} numberOfLines={1}>{c.nomeCliente ?? '(sem nome)'}</Text>
                {!!c.email && <Text style={s.email} numberOfLines={1}>{c.email}</Text>}
                {st === 'loading'
                  ? <Text style={s.subInfo}>Carregando planos…</Text>
                  : qtd > 0
                    ? <Text style={s.objetivo} numberOfLines={1}>{subtitulo}</Text>
                    : <Text style={s.semPlano}>Sem plano ainda</Text>}
              </View>
              {qtd > 0 && (tudoConcluido ? (
                <View style={s.trofeu}>
                  <Text style={s.trofeuIcon}>🏆</Text>
                  <Text style={s.trofeuTxt}>Concluído</Text>
                </View>
              ) : (
                <View style={s.badge}>
                  <Text style={s.badgeNum}>{pct}%</Text>
                  <Text style={s.badgeLbl}>{qtd} plano{qtd !== 1 ? 's' : ''}</Text>
                </View>
              ))}
            </View>

            {qtd > 0 && (
              <View style={s.track}><View style={[s.fill, { width: `${pct}%` }, tudoConcluido && { backgroundColor: GOLD }]} /></View>
            )}

            <TouchableOpacity style={[s.btn, qtd > 0 ? s.btnGhost : s.btnPrimary]} onPress={() => gerenciar(c)}>
              <Text style={qtd > 0 ? s.btnGhostTxt : s.btnPrimaryTxt}>
                {qtd > 0 ? 'Ver planos' : '+ Criar plano'}
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
  busca:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, marginBottom: 12 },
  controls:    { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 },
  buscaInline: { flex: 1, minWidth: 220, backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14 },
  chip:        { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipOn:      { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipOnGold:  { backgroundColor: GOLD + '22', borderColor: GOLD },
  chipTxt:     { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTxtOn:   { color: c.green },
  chipTxtGold: { color: GOLD },
  trofeu:      { alignItems: 'center', minWidth: 62 },
  trofeuIcon:  { fontSize: 22 },
  trofeuTxt:   { color: GOLD, fontSize: 11, fontWeight: '800', marginTop: 1 },
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
