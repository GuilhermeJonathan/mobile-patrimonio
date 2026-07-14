import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { corretoresService, assessoriaService, ClienteDelegadoDto, ResumoPatrimonialDto } from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';

type PatrimonioMap = Record<string, ResumoPatrimonialDto | 'loading' | 'error'>;

export default function HomeCorretorScreen() {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const fmtBRL = (v: number) => formatMoney(v, ocultar);
  const { entrar } = useAssessoria();
  const { navigate } = useRouter();

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [clientes, setClientes]       = useState<ClienteDelegadoDto[]>([]);
  const [patrimonios, setPatrimonios] = useState<PatrimonioMap>({});
  const [busca, setBusca]             = useState('');

  const load = useCallback(async () => {
    try {
      const lista = await corretoresService.meusClientes();
      setClientes(lista);

      setPatrimonios(prev => {
        const next = { ...prev };
        lista.forEach(c => { if (!next[c.clienteId]) next[c.clienteId] = 'loading'; });
        return next;
      });
      lista.forEach(c => {
        assessoriaService.resumoCliente(c.clienteId)
          .then(r => setPatrimonios(prev => ({ ...prev, [c.clienteId]: r })))
          .catch(() => setPatrimonios(prev => ({ ...prev, [c.clienteId]: 'error' })));
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function entrarComoCliente(c: ClienteDelegadoDto) {
    entrar({ clienteId: c.clienteId, nome: c.nomeCliente ?? 'Cliente' });
    navigate('patrimonio');
  }

  const filtrados = clientes.filter(c =>
    !busca.trim() || (c.nomeCliente ?? '').toLowerCase().includes(busca.trim().toLowerCase())
  );

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={s.header}>
        <Text style={s.title}>Meus clientes</Text>
        <TouchableOpacity style={s.btnVinculos} onPress={() => navigate('corretores')}>
          <Text style={s.btnVinculosText}>🤝 Vínculos</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={s.busca}
        value={busca}
        onChangeText={setBusca}
        placeholder="Buscar cliente..."
        placeholderTextColor={colors.inputPlaceholder}
      />

      {filtrados.length === 0 && (
        <View style={s.vazio}>
          <Text style={s.vazioIcon}>👥</Text>
          <Text style={s.vazioText}>Nenhum cliente delegado.</Text>
          <Text style={s.vazioSub}>Peça ao seu assessor para delegar clientes.</Text>
        </View>
      )}

      {filtrados.map(c => {
        const pat = patrimonios[c.clienteId];
        const resumo = typeof pat === 'object' ? pat : null;
        const iniciais = (c.nomeCliente ?? 'C').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

        return (
          <View key={c.delegacaoId} style={s.card}>
            <View style={s.cardTop}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{iniciais}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.clienteNome}>{c.nomeCliente ?? '(sem nome)'}</Text>
                {resumo && (
                  <Text style={s.clienteSub}>{resumo.qtdAtivos} bem(ns) · {resumo.passivos.length} dívida(s)</Text>
                )}
                {pat === 'loading' && <ActivityIndicator size="small" color={colors.green} style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
              </View>
            </View>

            {resumo && (
              <View style={s.resumoBox}>
                <View style={s.plRow}>
                  <Text style={s.plLabel}>Patrimônio líquido</Text>
                  <Text style={[s.plValor, { color: resumo.patrimonioLiquidoBRL >= 0 ? colors.green : colors.red }]}>
                    {fmtBRL(resumo.patrimonioLiquidoBRL)}
                  </Text>
                </View>
                <View style={s.statsRow}>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>Bens</Text>
                    <Text style={s.statValor}>{fmtBRL(resumo.totalBensBRL)}</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>Dívidas</Text>
                    <Text style={[s.statValor, { color: colors.red }]}>{fmtBRL(resumo.totalDividasBRL)}</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>Alavancagem</Text>
                    <Text style={s.statValor}>{resumo.alavancagemPct.toFixed(1)}%</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>ROI a.a.</Text>
                    <Text style={s.statValor}>{resumo.roiAnualPct != null ? `${resumo.roiAnualPct.toFixed(1)}%` : '—'}</Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity style={s.btnVer} onPress={() => entrarComoCliente(c)}>
              <Text style={s.btnVerText}>👁  Ver painel</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 16 },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { color: c.text, fontSize: 20, fontWeight: '800' },
  btnVinculos: { backgroundColor: c.surfaceElevated, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: c.greenBorder },
  btnVinculosText: { color: c.green, fontWeight: '700', fontSize: 13 },
  busca: {
    backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
    borderRadius: 10, padding: 12, color: c.text, fontSize: 14, marginBottom: 16,
  },
  vazio: { alignItems: 'center', marginTop: 60 },
  vazioIcon: { fontSize: 48, marginBottom: 12 },
  vazioText: { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.greenDim, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: c.green, fontWeight: '800', fontSize: 16 },
  clienteNome: { color: c.text, fontSize: 15, fontWeight: '700' },
  clienteSub: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  resumoBox: { backgroundColor: c.background, borderRadius: 12, padding: 12, marginBottom: 14 },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  plLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  plValor: { fontSize: 18, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statLabel: { color: c.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValor: { color: c.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  btnVer: { backgroundColor: c.green, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnVerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
