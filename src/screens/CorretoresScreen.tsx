import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Platform,
} from 'react-native';
import { corretoresService, assessoriaService, CorretorDto, DelegacaoDto, ClienteDelegadoDto, ClienteAssessoriaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { decodeToken } from '../utils/tokenUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('pt-BR');
}

type Tab = 'corretores' | 'delegacoes' | 'meus-clientes';

export default function CorretoresScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { entrar } = useAssessoria();
  const { navigate } = useRouter();

  const [isAssessor, setIsAssessor] = useState(false);
  const [tab, setTab] = useState<Tab>('corretores');

  // Dados assessor
  const [corretores, setCorretores]   = useState<CorretorDto[]>([]);
  const [delegacoes, setDelegacoes]   = useState<DelegacaoDto[]>([]);
  const [clientes, setClientes]       = useState<ClienteAssessoriaDto[]>([]);

  // Dados corretor
  const [meusClientes, setMeusClientes] = useState<ClienteDelegadoDto[]>([]);

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  // Modais
  const [modalConvite, setModalConvite]       = useState(false);
  const [codigoGerado, setCodigoGerado]       = useState<string | null>(null);
  const [gerandoCodigo, setGerandoCodigo]     = useState(false);

  const [modalAceitar, setModalAceitar]       = useState(false);
  const [codigoInput, setCodigoInput]         = useState('');
  const [aceitando, setAceitando]             = useState(false);

  const [modalDelegar, setModalDelegar]       = useState(false);
  const [corretorSel, setCorretorSel]         = useState<CorretorDto | null>(null);
  const [clienteSel, setClienteSel]           = useState<string>('');
  const [delegando, setDelegando]             = useState(false);

  const [showHistorico, setShowHistorico]     = useState(false);

  // Modal de confirmação genérico
  const [modalConfirm, setModalConfirm]       = useState(false);
  const [confirmMsg, setConfirmMsg]           = useState('');
  const [confirmando, setConfirmando]         = useState(false);
  const [confirmAction, setConfirmAction]     = useState<(() => Promise<void>) | null>(null);

  function pedirConfirmacao(msg: string, action: () => Promise<void>) {
    setConfirmMsg(msg);
    setConfirmAction(() => action);
    setModalConfirm(true);
  }

  async function executarConfirmado() {
    if (!confirmAction) return;
    setConfirmando(true);
    try {
      await confirmAction();
    } catch {
      setErro('Nao foi possivel concluir a operacao.');
    } finally {
      setConfirmando(false);
      setModalConfirm(false);
      setConfirmAction(null);
    }
  }

  const load = useCallback(async () => {
    try {
      setErro(null);
      const token = await AsyncStorage.getItem('@patrimonio_token');
      const decoded = token ? decodeToken(token) : null;
      const userType = decoded?.userType ?? null;
      const assessor = userType === '3' || userType === '1';
      const corretor = userType === '4';
      setIsAssessor(assessor);

      if (assessor) {
        const [c, d, cl] = await Promise.all([
          corretoresService.listar(),
          corretoresService.listarDelegacoes(),
          assessoriaService.clientes(),
        ]);
        setCorretores(c);
        setDelegacoes(d);
        setClientes(cl.filter(x => x.ativo));
      } else if (corretor) {
        setTab('meus-clientes');
        // clientes delegados carregados na HomeCorretorScreen; aqui só carrega info do vínculo
        setMeusClientes(await corretoresService.meusClientes());
      }
    } catch {
      setErro('Nao foi possivel carregar os dados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function gerarConvite() {
    setGerandoCodigo(true);
    try {
      const { codigo } = await corretoresService.gerarConvite();
      setCodigoGerado(codigo);
    } catch {
      setErro('Nao foi possivel gerar o convite.');
    } finally {
      setGerandoCodigo(false);
    }
  }

  async function aceitarConvite() {
    if (!codigoInput.trim()) return;
    setAceitando(true);
    try {
      await corretoresService.aceitarConvite(codigoInput.trim().toUpperCase());
      setModalAceitar(false);
      setCodigoInput('');
      setErro(null);
      await load();
    } catch (e: any) {
      setErro(e?.response?.data?.error ?? 'Codigo invalido ou ja utilizado.');
    } finally {
      setAceitando(false);
    }
  }

  async function revogarCorretor(v: CorretorDto) {
    pedirConfirmacao(
      `Revogar acesso de ${v.nomeCorretor ?? 'este corretor'}? Todas as delegacoes ativas serao canceladas.`,
      async () => {
        await corretoresService.revogar(v.vinculoId);
        await load();
      },
    );
  }

  async function confirmarDelegacao() {
    if (!corretorSel || !clienteSel) return;
    setDelegando(true);
    try {
      await corretoresService.delegar(corretorSel.corretorId, clienteSel);
      setModalDelegar(false);
      setCorretorSel(null);
      setClienteSel('');
      await load();
    } catch (e: any) {
      setErro(e?.response?.data?.error ?? 'Nao foi possivel delegar.');
    } finally {
      setDelegando(false);
    }
  }

  async function revogarDelegacao(d: DelegacaoDto) {
    pedirConfirmacao(
      `Remover ${d.nomeCliente ?? 'cliente'} da carteira de ${d.nomeCorretor ?? 'corretor'}?`,
      async () => {
        await corretoresService.revogarDelegacao(d.id);
        await load();
      },
    );
  }

  function verComoCliente(clienteId: string, nomeCliente: string) {
    entrar({ clienteId, nome: nomeCliente });
    navigate('patrimonio');
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const delegacoesAtivas    = delegacoes.filter(d => d.ativa);
  const delegacoesHistorico = delegacoes.filter(d => !d.ativa);
  const corretoresAtivos    = corretores.filter(c => c.ativo);
  const corretoresPendentes = corretores.filter(c => !c.ativo && !c.revogadoEm);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={s.topBar}>
        <View>
          <Text style={s.titulo}>{isAssessor ? 'Corretores' : 'Meu Assessor'}</Text>
          <Text style={s.subtitulo}>{isAssessor ? 'Gerencie sua equipe de corretores' : 'Vinculos e convites'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isAssessor && (
            <TouchableOpacity style={s.btnNovo} onPress={() => { setCodigoGerado(null); setModalConvite(true); }}>
              <Text style={s.btnNovoTxt}>+ Convidar</Text>
            </TouchableOpacity>
          )}
          {!isAssessor && (
            <TouchableOpacity style={[s.btnNovo, { backgroundColor: colors.green }]} onPress={() => setModalAceitar(true)}>
              <Text style={s.btnNovoTxt}>Aceitar convite</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs (só assessor) */}
      {isAssessor && (
        <View style={s.tabRow}>
          {(['corretores', 'delegacoes'] as Tab[]).map(t => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabAtivo]} onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtAtivo]}>
                {t === 'corretores' ? `Corretores (${corretoresAtivos.length})` : `Delegacoes (${delegacoesAtivas.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {erro && <Text style={s.erro}>{erro}</Text>}

        {/* ── Aba Corretores ─────────────────────────────────────────── */}
        {tab === 'corretores' && isAssessor && (
          <>
            {corretoresAtivos.length === 0 && corretoresPendentes.length === 0 && (
              <View style={s.vazio}>
                <Text style={s.vazioIco}>{'\uD83E\uDD1D'}</Text>
                <Text style={s.vazioTxt}>Nenhum corretor cadastrado.</Text>
                <Text style={s.vazioSub}>Clique em "+ Convidar" para adicionar corretores a sua equipe.</Text>
              </View>
            )}

            {corretoresAtivos.length > 0 && (
              <>
                <Text style={s.secLabel}>Ativos</Text>
                {corretoresAtivos.map(c => (
                  <View key={c.vinculoId} style={s.card}>
                    <View style={s.cardAvatar}>
                      <Text style={{ fontSize: 20 }}>{'\uD83D\uDC64'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{c.nomeCorretor ?? 'Corretor'}</Text>
                      <Text style={s.cardSub}>{c.qtdClientesDelegados} cliente{c.qtdClientesDelegados !== 1 ? 's' : ''} delegado{c.qtdClientesDelegados !== 1 ? 's' : ''}</Text>
                      <Text style={s.cardSub}>Desde {fmt(c.aceitoEm!)}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={s.btnAcao}
                        onPress={() => { setCorretorSel(c); setClienteSel(''); setModalDelegar(true); }}>
                        <Text style={[s.btnAcaoTxt, { color: colors.blue }]}>Delegar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnAcao} onPress={() => revogarCorretor(c)}>
                        <Text style={[s.btnAcaoTxt, { color: colors.red }]}>Revogar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {corretoresPendentes.length > 0 && (
              <>
                <Text style={s.secLabel}>Aguardando aceite</Text>
                {corretoresPendentes.map(c => (
                  <View key={c.vinculoId} style={[s.card, { opacity: 0.7 }]}>
                    <View style={s.cardAvatar}>
                      <Text style={{ fontSize: 20 }}>{'\u23F3'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>Convite pendente</Text>
                      <Text style={s.cardSub}>Codigo: <Text style={{ fontWeight: '800', color: colors.green }}>{c.codigoConvite}</Text></Text>
                      <Text style={s.cardSub}>Gerado em {fmt(c.criadoEm)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Aba Delegacoes ─────────────────────────────────────────── */}
        {tab === 'delegacoes' && isAssessor && (
          <>
            {delegacoesAtivas.length === 0 && (
              <View style={s.vazio}>
                <Text style={s.vazioIco}>{'\uD83D\uDCC2'}</Text>
                <Text style={s.vazioTxt}>Nenhuma delegacao ativa.</Text>
                <Text style={s.vazioSub}>Selecione um corretor e clique em "Delegar" para atribuir clientes.</Text>
              </View>
            )}

            {delegacoesAtivas.length > 0 && (
              <>
                <Text style={s.secLabel}>Ativas</Text>
                {delegacoesAtivas.map(d => (
                  <View key={d.id} style={s.card}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{d.nomeCliente ?? 'Cliente'}</Text>
                      <Text style={s.cardSub}>{'\uD83D\uDC64'} Corretor: {d.nomeCorretor ?? '-'}</Text>
                      <Text style={s.cardSub}>Desde {fmt(d.delegadoEm)}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={s.btnAcao}
                        onPress={() => verComoCliente(d.clienteId, d.nomeCliente ?? 'Cliente')}>
                        <Text style={[s.btnAcaoTxt, { color: colors.blue }]}>Ver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnAcao} onPress={() => revogarDelegacao(d)}>
                        <Text style={[s.btnAcaoTxt, { color: colors.red }]}>Revogar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {delegacoesHistorico.length > 0 && (
              <>
                <TouchableOpacity style={s.historicoBtn} onPress={() => setShowHistorico(h => !h)}>
                  <Text style={s.historicoBtnTxt}>{showHistorico ? 'Ocultar' : 'Ver'} historico ({delegacoesHistorico.length})</Text>
                </TouchableOpacity>
                {showHistorico && delegacoesHistorico.map(d => (
                  <View key={d.id} style={[s.card, { opacity: 0.55 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{d.nomeCliente ?? 'Cliente'}</Text>
                      <Text style={s.cardSub}>{'\uD83D\uDC64'} {d.nomeCorretor ?? '-'}</Text>
                      <Text style={s.cardSub}>{fmt(d.delegadoEm)} {'\u2192'} {d.revogadoEm ? fmt(d.revogadoEm) : ''}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: colors.red + '22', borderColor: colors.red + '44' }]}>
                      <Text style={[s.badgeTxt, { color: colors.red }]}>Revogada</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Visao Corretor: info do vinculo ────────────────────────── */}
        {tab === 'meus-clientes' && !isAssessor && (
          <>
            {meusClientes.length === 0 ? (
              <View style={s.vazio}>
                <Text style={s.vazioIco}>{'\uD83E\uDD1D'}</Text>
                <Text style={s.vazioTxt}>Voce ainda nao esta vinculado a um assessor.</Text>
                <Text style={s.vazioSub}>Clique em "Aceitar convite" acima e insira o codigo fornecido pelo assessor.</Text>
              </View>
            ) : (
              <>
                <Text style={s.secLabel}>Clientes delegados ({meusClientes.length})</Text>
                <Text style={[s.modalSub, { marginBottom: 12 }]}>
                  Acesse a home para ver o painel completo de cada cliente.
                </Text>
                {meusClientes.map(c => (
                  <View key={c.delegacaoId} style={s.card}>
                    <View style={s.cardAvatar}>
                      <Text style={{ fontSize: 22 }}>{'\uD83D\uDC64'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{c.nomeCliente ?? 'Cliente'}</Text>
                      <Text style={s.cardSub}>Delegado em {fmt(c.delegadoEm)}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.btnAcao, { backgroundColor: colors.greenDim, borderColor: colors.greenBorder, borderWidth: 1 }]}
                      onPress={() => verComoCliente(c.clienteId, c.nomeCliente ?? 'Cliente')}>
                      <Text style={[s.btnAcaoTxt, { color: colors.green }]}>Ver</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: Gerar convite (assessor) */}
      <Modal visible={modalConvite} transparent animationType="fade" onRequestClose={() => setModalConvite(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Convidar corretor</Text>
            {!codigoGerado ? (
              <>
                <Text style={s.modalSub}>Gere um codigo de convite e envie para o corretor. Ele deve aceitar no app.</Text>
                <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.green, marginTop: 16 }]} onPress={gerarConvite} disabled={gerandoCodigo}>
                  {gerandoCodigo ? <ActivityIndicator color="#fff" /> : <Text style={s.btnModalTxt}>Gerar codigo</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.modalSub}>Compartilhe este codigo com o corretor:</Text>
                <View style={s.codigoBox}>
                  <Text style={s.codigoTxt}>{codigoGerado}</Text>
                </View>
                {Platform.OS === 'web' && (
                  <TouchableOpacity onPress={() => navigator.clipboard?.writeText(codigoGerado)}>
                    <Text style={{ color: colors.blue, textAlign: 'center', marginTop: 4 }}>Copiar</Text>
                  </TouchableOpacity>
                )}
                <Text style={[s.modalSub, { marginTop: 12 }]}>O corretor deve acessar "Aceitar convite" no app e inserir este codigo.</Text>
              </>
            )}
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 12 }]} onPress={() => setModalConvite(false)}>
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Aceitar convite (corretor) */}
      <Modal visible={modalAceitar} transparent animationType="slide" onRequestClose={() => setModalAceitar(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Aceitar convite</Text>
            <Text style={s.modalSub}>Insira o codigo de 6 caracteres fornecido pelo assessor.</Text>
            <TextInput
              style={s.input}
              value={codigoInput}
              onChangeText={v => setCodigoInput(v.toUpperCase())}
              placeholder="Ex: AB3X7Y"
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.green }]} onPress={aceitarConvite} disabled={aceitando}>
              {aceitando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnModalTxt}>Confirmar</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]} onPress={() => setModalAceitar(false)}>
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Delegar cliente */}
      <Modal visible={modalDelegar} transparent animationType="slide" onRequestClose={() => setModalDelegar(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Delegar cliente</Text>
            {corretorSel && <Text style={s.modalSub}>Corretor: <Text style={{ fontWeight: '800', color: colors.text }}>{corretorSel.nomeCorretor}</Text></Text>}
            <Text style={[s.label, { marginTop: 12 }]}>Selecione o cliente</Text>
            <ScrollView style={{ maxHeight: 240 }}>
              {clientes.map(c => {
                const jaDelegado = delegacoesAtivas.some(d => d.corretorId === corretorSel?.corretorId && d.clienteId === c.clienteId);
                return (
                  <TouchableOpacity
                    key={c.clienteId}
                    style={[s.clienteRow, clienteSel === c.clienteId && { backgroundColor: colors.greenDim }, jaDelegado && { opacity: 0.4 }]}
                    onPress={() => !jaDelegado && setClienteSel(c.clienteId)}
                    disabled={jaDelegado}>
                    <Text style={[s.clienteNome, clienteSel === c.clienteId && { color: colors.green }]}>{c.nomeCliente ?? 'Cliente'}</Text>
                    {jaDelegado && <Text style={{ color: colors.textSecondary, fontSize: 11 }}>ja delegado</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[s.btnModal, { backgroundColor: colors.green, marginTop: 16, opacity: clienteSel ? 1 : 0.4 }]}
              onPress={confirmarDelegacao} disabled={!clienteSel || delegando}>
              {delegando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnModalTxt}>Confirmar delegacao</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]} onPress={() => setModalDelegar(false)}>
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmação de revogar */}
      <Modal visible={modalConfirm} transparent animationType="fade" onRequestClose={() => setModalConfirm(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Confirmar acao</Text>
            <Text style={[s.modalSub, { marginTop: 8, marginBottom: 24 }]}>{confirmMsg}</Text>
            <TouchableOpacity
              style={[s.btnModal, { backgroundColor: colors.red }]}
              onPress={executarConfirmado}
              disabled={confirmando}
            >
              {confirmando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnModalTxt}>Confirmar</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}
              onPress={() => setModalConfirm(false)}
              disabled={confirmando}
            >
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof import('../theme/ThemeContext').useTheme>['colors']) => StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  titulo:       { color: c.text, fontSize: 20, fontWeight: '800' },
  subtitulo:    { color: c.textSecondary, fontSize: 13 },
  btnNovo:      { backgroundColor: c.green, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  btnNovoTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  tabRow:       { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, marginHorizontal: 16 },
  tab:          { paddingVertical: 10, paddingHorizontal: 16, marginBottom: -1 },
  tabAtivo:     { borderBottomWidth: 2, borderBottomColor: c.green },
  tabTxt:       { color: c.textSecondary, fontSize: 14, fontWeight: '600' },
  tabTxtAtivo:  { color: c.green },
  content:      { padding: 16, paddingBottom: 40 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  erro:         { color: c.red, marginBottom: 12 },
  secLabel:     { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  card:         { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: c.border },
  cardAvatar:   { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  cardNome:     { color: c.text, fontSize: 15, fontWeight: '700' },
  cardSub:      { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  btnAcao:      { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  btnAcaoTxt:   { fontSize: 13, fontWeight: '600' },
  badge:        { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  badgeTxt:     { fontSize: 11, fontWeight: '700' },
  vazio:        { alignItems: 'center', marginTop: 60 },
  vazioIco:     { fontSize: 48, marginBottom: 12 },
  vazioTxt:     { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:     { color: c.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  historicoBtn: { alignItems: 'center', paddingVertical: 10 },
  historicoBtnTxt:{ color: c.blue, fontSize: 13, fontWeight: '600' },
  overlay:      { flex: 1, backgroundColor: '#000a', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard:    { backgroundColor: c.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 480 },
  modalTitulo:  { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  modalSub:     { color: c.textSecondary, fontSize: 14 },
  codigoBox:    { backgroundColor: c.surfaceElevated, borderRadius: 12, padding: 20, alignItems: 'center', marginTop: 16 },
  codigoTxt:    { color: c.green, fontSize: 36, fontWeight: '900', letterSpacing: 8 },
  input:        { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 12, letterSpacing: 6 },
  label:        { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  clienteRow:   { padding: 12, borderRadius: 10, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surfaceElevated },
  clienteNome:  { color: c.text, fontSize: 14, fontWeight: '600' },
  btnModal:     { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnModalTxt:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});
