import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { assessoriaService, relatorioService, ClienteAssessoriaDto, ResumoPatrimonialDto } from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { Platform } from 'react-native';

type PatrimonioMap = Record<string, ResumoPatrimonialDto | 'loading' | 'error'>;

interface Props { userName?: string; avatarUrl?: string | null; }

export default function AssessorClientesScreen({ userName, avatarUrl }: Props) {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const fmtBRL = (v: number) => formatMoney(v, ocultar);
  const { entrar } = useAssessoria();
  const { navigate } = useRouter();

  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  async function gerarRelatorio(c: ClienteAssessoriaDto) {
    setGerandoPdf(c.clienteId);
    try {
      const blob = await relatorioService.gerarParaCliente(c.clienteId, {
        clienteNome: c.nomeCliente ?? 'Cliente',
        nomeConsultoria: userName ?? null,
        logoBase64: avatarUrl ?? null,
        corMarca: '#16a34a',
      });
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-${(c.nomeCliente ?? 'cliente').replace(/\s+/g, '-').toLowerCase()}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert('Relatório', 'O download do PDF está disponível na versão web por enquanto.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o relatório.');
    } finally {
      setGerandoPdf(null);
    }
  }

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientes, setClientes]     = useState<ClienteAssessoriaDto[]>([]);
  const [patrimonios, setPatrimonios] = useState<PatrimonioMap>({});
  const [busca, setBusca]           = useState('');
  const [filtro, setFiltro]         = useState<'todos' | 'ativos' | 'pendentes'>('todos');

  // modal gerar convite
  const [codigoModal, setCodigoModal] = useState(false);
  const [codigo, setCodigo]           = useState<string | null>(null);
  const [gerandoCodigo, setGerandoCodigo] = useState(false);

  const load = useCallback(async () => {
    try {
      const lista = await assessoriaService.clientes();
      setClientes(lista);

      const ativos = lista.filter(c => c.ativo);
      setPatrimonios(prev => {
        const next = { ...prev };
        ativos.forEach(c => { if (!next[c.clienteId]) next[c.clienteId] = 'loading'; });
        return next;
      });
      ativos.forEach(c => {
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

  async function gerarConvite() {
    setGerandoCodigo(true);
    try {
      const { codigo: cod } = await assessoriaService.gerarConvite();
      setCodigo(cod);
      setCodigoModal(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o convite.');
    } finally {
      setGerandoCodigo(false);
    }
  }

  function entrarComoCliente(cliente: ClienteAssessoriaDto) {
    // O contexto liga o header X-Assessoria-Cliente; a partir daqui a API
    // responde com os dados do cliente até o assessor sair do modo view-as.
    entrar({ clienteId: cliente.clienteId, nome: cliente.nomeCliente ?? 'Cliente' });
    navigate('patrimonio');
  }

  async function revogar(c: ClienteAssessoriaDto) {
    Alert.alert('Revogar acesso', `Remover "${c.nomeCliente ?? 'cliente'}" da carteira?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar', style: 'destructive',
        onPress: async () => {
          try {
            await assessoriaService.revogar(c.vinculoId);
            await load();
          } catch {
            Alert.alert('Erro', 'Não foi possível revogar o acesso.');
          }
        },
      },
    ]);
  }

  const qtdAtivos = clientes.filter(c => c.ativo).length;
  const qtdPendentes = clientes.filter(c => !c.ativo).length;

  const filtrados = clientes.filter(c => {
    if (filtro === 'ativos' && !c.ativo) return false;
    if (filtro === 'pendentes' && c.ativo) return false;
    return !busca.trim() || (c.nomeCliente ?? '').toLowerCase().includes(busca.trim().toLowerCase());
  });

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Carteira de clientes</Text>
          <TouchableOpacity style={s.btnNovo} onPress={gerarConvite} disabled={gerandoCodigo}>
            {gerandoCodigo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnNovoText}>+ Convite</Text>}
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar cliente..."
          placeholderTextColor={colors.inputPlaceholder}
        />

        <View style={s.filtros}>
          {([
            { k: 'todos',     l: `Todos (${clientes.length})` },
            { k: 'ativos',    l: `Ativos (${qtdAtivos})` },
            { k: 'pendentes', l: `Pendentes (${qtdPendentes})` },
          ] as const).map(f => (
            <TouchableOpacity
              key={f.k}
              style={[s.filtroChip, filtro === f.k && s.filtroChipAtivo]}
              onPress={() => setFiltro(f.k)}
            >
              <Text style={[s.filtroTxt, filtro === f.k && s.filtroTxtAtivo]}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtrados.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vaziоIcon}>👥</Text>
            <Text style={s.vazioText}>Nenhum cliente ainda.</Text>
            <Text style={s.vazioSub}>Gere um convite e envie ao cliente.</Text>
          </View>
        )}

        {filtrados.map(c => {
          const pat = patrimonios[c.clienteId];
          const resumo = typeof pat === 'object' ? pat : null;

          const iniciais = (c.nomeCliente ?? 'C').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

          return (
            <View key={c.vinculoId} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.clienteAvatar}>
                  <Text style={s.clienteAvatarText}>{iniciais}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clienteNome}>{c.nomeCliente ?? '(sem nome)'}</Text>
                  {!c.ativo && !c.aceito && (
                    <Text style={s.pendente}>⏳ Convite pendente — código: {c.codigoConvite}</Text>
                  )}
                  {c.ativo && resumo && (
                    <Text style={s.clientePatrimonio}>{resumo.qtdAtivos} bem(ns) · {resumo.passivos.length} dívida(s)</Text>
                  )}
                  {pat === 'loading' && <ActivityIndicator size="small" color={colors.green} style={{ alignSelf: 'flex-start', marginTop: 4 }} />}
                  {pat === 'error' && <Text style={s.pendente}>Não foi possível carregar o resumo.</Text>}
                </View>
              </View>

              {c.ativo && resumo && (
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

              <View style={s.cardActions}>
                {c.ativo && (
                  <TouchableOpacity style={s.btnVer} onPress={() => entrarComoCliente(c)}>
                    <Text style={s.btnVerText}>👁  Ver painel</Text>
                  </TouchableOpacity>
                )}
                {c.ativo && (
                  <TouchableOpacity style={s.btnRelatorio} onPress={() => gerarRelatorio(c)} disabled={gerandoPdf === c.clienteId}>
                    {gerandoPdf === c.clienteId
                      ? <ActivityIndicator size="small" color={colors.green} />
                      : <Text style={s.btnRelatorioText}>📄  Relatório</Text>}
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.btnRevogar, !c.ativo && { flex: 1 }]} onPress={() => revogar(c)}>
                  <Text style={s.btnRevogarText}>{c.ativo ? 'Revogar' : 'Cancelar convite'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Modal código de convite */}
      <Modal visible={codigoModal} transparent animationType="slide" onRequestClose={() => setCodigoModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Convite gerado</Text>
            <Text style={[s.clienteNome, { color: colors.textSecondary, marginBottom: 16 }]}>
              Envie este código ao cliente. Ele vai usar no app para vincular sua conta.
            </Text>
            <View style={s.codigoBox}>
              <Text style={s.codigoText}>{codigo}</Text>
            </View>
            <TouchableOpacity style={s.btnFechar} onPress={() => setCodigoModal(false)}>
              <Text style={s.btnFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 16 },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo: { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  busca: {
    backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
    borderRadius: 10, padding: 12, color: c.text, fontSize: 14, marginBottom: 12,
  },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filtroChip: { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  filtroChipAtivo: { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  filtroTxt: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  filtroTxtAtivo: { color: c.green },
  vazio: { alignItems: 'center', marginTop: 60 },
  vaziоIcon: { fontSize: 48, marginBottom: 12 },
  vazioText: { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  clienteAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.greenDim, justifyContent: 'center', alignItems: 'center' },
  clienteAvatarText: { color: c.green, fontWeight: '800', fontSize: 16 },
  clienteNome: { color: c.text, fontSize: 15, fontWeight: '700' },
  clientePatrimonio: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  pendente: { color: c.orange, fontSize: 12, marginTop: 2 },
  resumoBox: { backgroundColor: c.background, borderRadius: 12, padding: 12, marginBottom: 14 },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  plLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  plValor: { fontSize: 18, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statLabel: { color: c.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  statValor: { color: c.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 10 },
  btnVer: { flex: 1.4, backgroundColor: c.green, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnVerText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnRelatorio: { flex: 1.1, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.greenBorder, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  btnRelatorioText: { color: c.green, fontSize: 13, fontWeight: '700' },
  btnRevogar: { flex: 1, backgroundColor: c.surfaceElevated, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnRevogarText: { color: c.red, fontSize: 14, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  codigoBox: { backgroundColor: c.greenDim, borderRadius: 14, padding: 20, alignItems: 'center', marginVertical: 16 },
  codigoText: { color: c.green, fontSize: 36, fontWeight: '800', letterSpacing: 8 },
  btnFechar: { backgroundColor: c.surfaceElevated, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnFecharText: { color: c.textSecondary, fontWeight: '700' },
});
