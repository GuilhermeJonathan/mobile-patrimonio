import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Platform,
} from 'react-native';
import { corretoresService, assessoriaService, CorretorDto, DelegacaoDto, ClienteDelegadoDto, ClienteAssessoriaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { decodeToken } from '../utils/tokenUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dataBR } from '../utils/format';

function fmt(d: string) {
  return dataBR(d);
}

type Tab = 'corretores' | 'delegacoes' | 'meus-clientes';

export default function CorretoresScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
  const [emailCorretor, setEmailCorretor]     = useState('');
  const [enviandoEmail, setEnviandoEmail]     = useState(false);
  const [emailEnviado, setEmailEnviado]       = useState<string | null>(null);
  const [conviteErro, setConviteErro]         = useState<string | null>(null);
  const [reenviandoId, setReenviandoId]       = useState<string | null>(null);
  const [reenviadoId, setReenviadoId]         = useState<string | null>(null);
  const [corretorFiltro, setCorretorFiltro]   = useState<'ativos' | 'pendentes' | 'encerrados'>('ativos');

  const [modalAceitar, setModalAceitar]       = useState(false);
  const [codigoInput, setCodigoInput]         = useState('');
  const [aceitando, setAceitando]             = useState(false);

  const [modalDelegar, setModalDelegar]       = useState(false);
  const [corretorSel, setCorretorSel]         = useState<CorretorDto | null>(null);
  const [clientesSel, setClientesSel]         = useState<string[]>([]);
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
      setErro(t('corretores.erroConcluirOperacao'));
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
      setErro(t('corretores.erroCarregar'));
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
      await load();
    } catch {
      setErro(t('corretores.erroGerarConvite'));
    } finally {
      setGerandoCodigo(false);
    }
  }

  function cancelarConvite(c: CorretorDto) {
    const alvo = c.emailConvidado
      ? t('corretores.cancelarConviteAlvoEmail', { email: c.emailConvidado })
      : t('corretores.cancelarConviteAlvoCodigo', { codigo: c.codigoConvite });
    pedirConfirmacao(
      t('corretores.cancelarConviteMsg', { alvo }),
      async () => { await corretoresService.revogar(c.vinculoId); await load(); });
  }

  async function reenviarConvite(vinculoId: string) {
    setReenviandoId(vinculoId); setReenviadoId(null);
    try {
      await corretoresService.reenviarConvite(vinculoId);
      setReenviadoId(vinculoId);
      await load();
    } catch {
      setErro(t('corretores.erroReenviar'));
    } finally { setReenviandoId(null); }
  }

  async function enviarConvitePorEmail() {
    const email = emailCorretor.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setConviteErro(t('corretores.emailInvalido')); return; }
    setEnviandoEmail(true); setConviteErro(null);
    try {
      await corretoresService.enviarConviteEmail(email);
      setEmailEnviado(email);
      await load();
    } catch (e: any) {
      setConviteErro(e?.response?.data?.error ?? t('corretores.erroEnviarConvite'));
    } finally { setEnviandoEmail(false); }
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
      setErro(e?.response?.data?.error ?? t('corretores.codigoInvalido'));
    } finally {
      setAceitando(false);
    }
  }

  async function revogarCorretor(v: CorretorDto) {
    pedirConfirmacao(
      t('corretores.revogarCorretorMsg', { nome: v.nomeCorretor ?? t('corretores.esteCorretor') }),
      async () => {
        await corretoresService.revogar(v.vinculoId);
        await load();
      },
    );
  }

  async function confirmarDelegacao() {
    if (!corretorSel || clientesSel.length === 0) return;
    setDelegando(true);
    try {
      for (const clienteId of clientesSel)
        await corretoresService.delegar(corretorSel.corretorId, clienteId);
      setModalDelegar(false);
      setCorretorSel(null);
      setClientesSel([]);
      await load();
    } catch (e: any) {
      setErro(e?.response?.data?.error ?? t('corretores.erroDelegar'));
    } finally {
      setDelegando(false);
    }
  }

  async function revogarDelegacao(d: DelegacaoDto) {
    pedirConfirmacao(
      t('corretores.removerDelegacaoMsg', {
        cliente: d.nomeCliente ?? t('corretores.clienteMinusculo'),
        corretor: d.nomeCorretor ?? t('corretores.corretorMinusculo'),
      }),
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
  const corretoresPendentes = corretores.filter(c => !c.ativo && !c.revogadoEm && !c.expirado);
  const corretoresEncerrados = corretores.filter(c => c.expirado || (!!c.revogadoEm && !c.aceitoEm));

  const renderConvite = (c: CorretorDto) => {
    const porEmail = !!c.emailConvidado;
    const cancelado = !!c.revogadoEm && !c.aceitoEm;
    const statusTxt = cancelado ? t('corretores.statusCancelado') : c.expirado ? t('corretores.statusExpirado')
      : c.expiraEm ? t('corretores.expiraEm', { data: fmt(c.expiraEm) }) : t('corretores.semExpiracao');
    const statusVermelho = cancelado || c.expirado;
    const podeAgir = !cancelado; // pendente ou expirado permitem reenviar/cancelar
    const titulo = cancelado ? t('corretores.conviteCancelado') : c.expirado ? t('corretores.conviteExpirado') : t('corretores.convitePendente');
    return (
      <View key={c.vinculoId} style={[s.pendCard, statusVermelho && { opacity: 0.7 }]}>
        <View style={s.pendTop}>
          <View style={s.cardAvatar}><Text style={{ fontSize: 20 }}>{'⏳'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardNome}>{titulo}</Text>
            <Text style={s.pendMuted}>{porEmail ? t('corretores.enviadoPorEmail') : t('corretores.compartilhadoPorCodigo')}</Text>
          </View>
          <View style={[s.badge, { borderColor: colors.green + '55', backgroundColor: colors.green + '18' }]}>
            <Text style={[s.badgeTxt, { color: colors.green }]}>{porEmail ? t('corretores.badgePorEmail') : t('corretores.badgePorCodigo')}</Text>
          </View>
        </View>

        <View style={s.pendRow}>
          <Text style={[s.pendLinha, { flex: 1 }]} numberOfLines={1}>
            {porEmail && (<><Text style={s.metaLabel}>{'📧 '}</Text><Text style={s.metaValue}>{c.emailConvidado}</Text><Text style={s.metaSep}>{'   ·   '}</Text></>)}
            <Text style={s.metaLabel}>{t('corretores.codigoLabel')}</Text>
            <Text style={[s.metaValue, { color: colors.green, fontWeight: '800', letterSpacing: 1 }]}>{c.codigoConvite}</Text>
            <Text style={s.metaSep}>{'   ·   '}</Text>
            <Text style={[s.metaValue, statusVermelho && { color: colors.red }]}>{statusTxt}</Text>
          </Text>
          {podeAgir && (
            <View style={s.pendBtns}>
              {porEmail && (reenviadoId === c.vinculoId
                ? <Text style={[s.metaValue, { color: colors.green }]}>{'✅'} {t('corretores.reenviado')}</Text>
                : <TouchableOpacity style={[s.btnPend, { borderColor: colors.green + '66' }]} onPress={() => reenviarConvite(c.vinculoId)} disabled={reenviandoId === c.vinculoId}>
                    {reenviandoId === c.vinculoId
                      ? <ActivityIndicator size="small" color={colors.green} />
                      : <Text style={[s.btnPendTxt, { color: colors.green }]}>{t('corretores.reenviar')}</Text>}
                  </TouchableOpacity>)}
              <TouchableOpacity style={[s.btnPend, { borderColor: colors.red + '66' }]} onPress={() => cancelarConvite(c)}>
                <Text style={[s.btnPendTxt, { color: colors.red }]}>{t('corretores.cancelarConvite')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={s.topBar}>
        <View>
          <Text style={s.titulo}>{isAssessor ? t('corretores.tituloCorretores') : t('corretores.tituloMeuAssessor')}</Text>
          <Text style={s.subtitulo}>{isAssessor ? t('corretores.subtituloAssessor') : t('corretores.subtituloCorretor')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isAssessor && (
            <TouchableOpacity style={s.btnNovo} onPress={() => { setCodigoGerado(null); setEmailCorretor(''); setEmailEnviado(null); setConviteErro(null); setModalConvite(true); }}>
              <Text style={s.btnNovoTxt}>{t('corretores.convidar')}</Text>
            </TouchableOpacity>
          )}
          {!isAssessor && (
            <TouchableOpacity style={[s.btnNovo, { backgroundColor: colors.green }]} onPress={() => setModalAceitar(true)}>
              <Text style={s.btnNovoTxt}>{t('corretores.aceitarConvite')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs (só assessor) */}
      {isAssessor && (
        <View style={s.tabRow}>
          {(['corretores', 'delegacoes'] as Tab[]).map(tb => (
            <TouchableOpacity key={tb} style={[s.tab, tab === tb && s.tabAtivo]} onPress={() => setTab(tb)}>
              <Text style={[s.tabTxt, tab === tb && s.tabTxtAtivo]}>
                {tb === 'corretores' ? t('corretores.tabCorretores', { n: corretoresAtivos.length }) : t('corretores.tabDelegacoes', { n: delegacoesAtivas.length })}
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
            {corretores.length === 0 && (
              <View style={s.vazio}>
                <Text style={s.vazioIco}>{'\uD83E\uDD1D'}</Text>
                <Text style={s.vazioTxt}>{t('corretores.vazioCorretores')}</Text>
                <Text style={s.vazioSub}>{t('corretores.vazioCorretoresSub')}</Text>
              </View>
            )}

            {corretores.length > 0 && (
              <View style={s.chips}>
                {([
                  { k: 'ativos' as const,     l: t('corretores.chipAtivos', { n: corretoresAtivos.length }) },
                  { k: 'pendentes' as const,  l: t('corretores.chipPendentes', { n: corretoresPendentes.length }) },
                  { k: 'encerrados' as const, l: t('corretores.chipEncerrados', { n: corretoresEncerrados.length }) },
                ]).map(f => (
                  <TouchableOpacity key={f.k} style={[s.chip, corretorFiltro === f.k && s.chipAtivo]} onPress={() => setCorretorFiltro(f.k)}>
                    <Text style={[s.chipTxt, corretorFiltro === f.k && s.chipTxtAtivo]}>{f.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {corretorFiltro === 'ativos' && corretores.length > 0 && (
              corretoresAtivos.length === 0
                ? <Text style={s.vazioLista}>{t('corretores.nenhumAtivo')}</Text>
                : <>
                <Text style={s.secLabel}>{t('corretores.secAtivos')}</Text>
                {corretoresAtivos.map(c => (
                  <View key={c.vinculoId} style={s.card}>
                    <View style={s.cardAvatar}>
                      <Text style={{ fontSize: 20 }}>{'\uD83D\uDC64'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{c.nomeCorretor ?? t('corretores.corretorNome')}</Text>
                      <Text style={s.cardSub}>{c.qtdClientesDelegados === 1 ? t('corretores.clientesDelegadosSingular', { n: c.qtdClientesDelegados }) : t('corretores.clientesDelegadosPlural', { n: c.qtdClientesDelegados })}</Text>
                      <Text style={s.cardSub}>{t('corretores.desde', { data: fmt(c.aceitoEm!) })}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={s.btnAcao}
                        onPress={() => { setCorretorSel(c); setClientesSel([]); setModalDelegar(true); }}>
                        <Text style={[s.btnAcaoTxt, { color: colors.blue }]}>{t('corretores.delegar')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnAcao} onPress={() => revogarCorretor(c)}>
                        <Text style={[s.btnAcaoTxt, { color: colors.red }]}>{t('corretores.revogar')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {corretorFiltro === 'pendentes' && corretores.length > 0 && corretoresPendentes.length === 0 && (
              <Text style={s.vazioLista}>{t('corretores.nenhumPendente')}</Text>
            )}

            {corretorFiltro === 'pendentes' && corretoresPendentes.length > 0 && (
              <>
                <Text style={s.secLabel}>{t('corretores.secAguardandoAceite')}</Text>
                {corretoresPendentes.map(renderConvite)}
              </>
            )}

            {corretorFiltro === 'encerrados' && corretores.length > 0 && (
              corretoresEncerrados.length === 0
                ? <Text style={s.vazioLista}>{t('corretores.nenhumEncerrado')}</Text>
                : <>{corretoresEncerrados.map(renderConvite)}</>
            )}
          </>
        )}

        {/* ── Aba Delegacoes ─────────────────────────────────────────── */}
        {tab === 'delegacoes' && isAssessor && (
          <>
            {delegacoesAtivas.length === 0 && (
              <View style={s.vazio}>
                <Text style={s.vazioIco}>{'\uD83D\uDCC2'}</Text>
                <Text style={s.vazioTxt}>{t('corretores.vazioDelegacoes')}</Text>
                <Text style={s.vazioSub}>{t('corretores.vazioDelegacoesSub')}</Text>
              </View>
            )}

            {delegacoesAtivas.length > 0 && (
              <>
                <Text style={s.secLabel}>{t('corretores.secAtivas')}</Text>
                {delegacoesAtivas.map(d => (
                  <View key={d.id} style={s.card}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{d.nomeCliente ?? t('corretores.clienteNome')}</Text>
                      <Text style={s.cardSub}>{'\uD83D\uDC64'} {t('corretores.corretorLabel')}{d.nomeCorretor ?? '-'}</Text>
                      <Text style={s.cardSub}>{t('corretores.desde', { data: fmt(d.delegadoEm) })}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        style={s.btnAcao}
                        onPress={() => verComoCliente(d.clienteId, d.nomeCliente ?? t('corretores.clienteNome'))}>
                        <Text style={[s.btnAcaoTxt, { color: colors.blue }]}>{t('corretores.ver')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.btnAcao} onPress={() => revogarDelegacao(d)}>
                        <Text style={[s.btnAcaoTxt, { color: colors.red }]}>{t('corretores.revogar')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {delegacoesHistorico.length > 0 && (
              <>
                <TouchableOpacity style={s.historicoBtn} onPress={() => setShowHistorico(h => !h)}>
                  <Text style={s.historicoBtnTxt}>{showHistorico ? t('corretores.ocultarHistorico', { n: delegacoesHistorico.length }) : t('corretores.verHistorico', { n: delegacoesHistorico.length })}</Text>
                </TouchableOpacity>
                {showHistorico && delegacoesHistorico.map(d => (
                  <View key={d.id} style={[s.card, { opacity: 0.55 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{d.nomeCliente ?? t('corretores.clienteNome')}</Text>
                      <Text style={s.cardSub}>{'\uD83D\uDC64'} {d.nomeCorretor ?? '-'}</Text>
                      <Text style={s.cardSub}>{fmt(d.delegadoEm)} {'\u2192'} {d.revogadoEm ? fmt(d.revogadoEm) : ''}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: colors.red + '22', borderColor: colors.red + '44' }]}>
                      <Text style={[s.badgeTxt, { color: colors.red }]}>{t('corretores.revogada')}</Text>
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
                <Text style={s.vazioTxt}>{t('corretores.vazioVinculo')}</Text>
                <Text style={s.vazioSub}>{t('corretores.vazioVinculoSub')}</Text>
              </View>
            ) : (
              <>
                <Text style={s.secLabel}>{t('corretores.secClientesDelegados', { n: meusClientes.length })}</Text>
                <Text style={[s.modalSub, { marginBottom: 12 }]}>
                  {t('corretores.acesseHome')}
                </Text>
                {meusClientes.map(c => (
                  <View key={c.delegacaoId} style={s.card}>
                    <View style={s.cardAvatar}>
                      <Text style={{ fontSize: 22 }}>{'\uD83D\uDC64'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardNome}>{c.nomeCliente ?? t('corretores.clienteNome')}</Text>
                      <Text style={s.cardSub}>{t('corretores.delegadoEm', { data: fmt(c.delegadoEm) })}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.btnAcao, { backgroundColor: colors.greenDim, borderColor: colors.greenBorder, borderWidth: 1 }]}
                      onPress={() => verComoCliente(c.clienteId, c.nomeCliente ?? t('corretores.clienteNome'))}>
                      <Text style={[s.btnAcaoTxt, { color: colors.green }]}>{t('corretores.ver')}</Text>
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
            <Text style={s.modalTitulo}>{t('corretores.modalConvidarTitulo')}</Text>
            {emailEnviado ? (
              <>
                <Text style={s.modalSub}>{t('corretores.conviteEnviadoPara', { email: emailEnviado })} ✅. {t('corretores.recebeLinkConta')}</Text>
              </>
            ) : !codigoGerado ? (
              <>
                <Text style={s.modalSub}>{t('corretores.envieConviteEmail')}</Text>
                <TextInput
                  style={[s.input, { fontSize: 15, fontWeight: '400', letterSpacing: 0, textAlign: 'left' }]}
                  value={emailCorretor}
                  onChangeText={setEmailCorretor}
                  placeholder={t('corretores.phEmailCorretor')}
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {conviteErro && <Text style={[s.erro, { marginTop: 8 }]}>{conviteErro}</Text>}
                <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.green, marginTop: 12 }]} onPress={enviarConvitePorEmail} disabled={enviandoEmail}>
                  {enviandoEmail ? <ActivityIndicator color="#fff" /> : <Text style={s.btnModalTxt}>{t('corretores.btnEnviarConviteEmail')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]} onPress={gerarConvite} disabled={gerandoCodigo}>
                  {gerandoCodigo ? <ActivityIndicator color={colors.green} /> : <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>{t('corretores.preferirGerarCodigo')}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.modalSub}>{t('corretores.compartilheCodigo')}</Text>
                <View style={s.codigoBox}>
                  <Text style={s.codigoTxt}>{codigoGerado}</Text>
                </View>
                {Platform.OS === 'web' && (
                  <TouchableOpacity onPress={() => navigator.clipboard?.writeText(codigoGerado)}>
                    <Text style={{ color: colors.blue, textAlign: 'center', marginTop: 4 }}>{t('corretores.copiar')}</Text>
                  </TouchableOpacity>
                )}
                <Text style={[s.modalSub, { marginTop: 12 }]}>{t('corretores.corretorDeveAcessar')}</Text>
              </>
            )}
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 12 }]} onPress={() => setModalConvite(false)}>
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>{t('corretores.fechar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Aceitar convite (corretor) */}
      <Modal visible={modalAceitar} transparent animationType="slide" onRequestClose={() => setModalAceitar(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('corretores.aceitarConvite')}</Text>
            <Text style={s.modalSub}>{t('corretores.insiraCodigo')}</Text>
            <TextInput
              style={s.input}
              value={codigoInput}
              onChangeText={v => setCodigoInput(v.toUpperCase())}
              placeholder={t('corretores.phCodigo')}
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.green }]} onPress={aceitarConvite} disabled={aceitando}>
              {aceitando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnModalTxt}>{t('corretores.confirmar')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]} onPress={() => setModalAceitar(false)}>
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>{t('common.cancelar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Delegar cliente */}
      <Modal visible={modalDelegar} transparent animationType="slide" onRequestClose={() => setModalDelegar(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('corretores.modalDelegarTitulo')}</Text>
            {corretorSel && <Text style={s.modalSub}>{t('corretores.corretorLabel')}<Text style={{ fontWeight: '800', color: colors.text }}>{corretorSel.nomeCorretor}</Text></Text>}
            <Text style={[s.label, { marginTop: 12 }]}>{t('corretores.selecioneClientes')}</Text>
            <ScrollView style={{ maxHeight: 240 }}>
              {clientes.map(c => {
                const jaDelegado = delegacoesAtivas.some(d => d.corretorId === corretorSel?.corretorId && d.clienteId === c.clienteId);
                const marcado = clientesSel.includes(c.clienteId);
                return (
                  <TouchableOpacity
                    key={c.clienteId}
                    style={[s.clienteRow, marcado && { backgroundColor: colors.greenDim }, jaDelegado && { opacity: 0.4 }]}
                    onPress={() => !jaDelegado && setClientesSel(prev => prev.includes(c.clienteId) ? prev.filter(x => x !== c.clienteId) : [...prev, c.clienteId])}
                    disabled={jaDelegado}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Text style={{ fontSize: 16, color: marcado ? colors.green : colors.textSecondary }}>{marcado ? '☑' : '☐'}</Text>
                      <Text style={[s.clienteNome, marcado && { color: colors.green }]}>{c.nomeCliente ?? t('corretores.clienteNome')}</Text>
                    </View>
                    {jaDelegado && <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{t('corretores.jaDelegado')}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[s.btnModal, { backgroundColor: colors.green, marginTop: 16, opacity: clientesSel.length > 0 ? 1 : 0.4 }]}
              onPress={confirmarDelegacao} disabled={clientesSel.length === 0 || delegando}>
              {delegando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnModalTxt}>{clientesSel.length > 1 ? t('corretores.confirmarDelegacaoN', { n: clientesSel.length }) : t('corretores.confirmarDelegacao')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]} onPress={() => setModalDelegar(false)}>
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>{t('common.cancelar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmação de revogar */}
      <Modal visible={modalConfirm} transparent animationType="fade" onRequestClose={() => setModalConfirm(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('corretores.confirmarAcao')}</Text>
            <Text style={[s.modalSub, { marginTop: 8, marginBottom: 24 }]}>{confirmMsg}</Text>
            <TouchableOpacity
              style={[s.btnModal, { backgroundColor: colors.red }]}
              onPress={executarConfirmado}
              disabled={confirmando}
            >
              {confirmando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnModalTxt}>{t('corretores.confirmar')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnModal, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}
              onPress={() => setModalConfirm(false)}
              disabled={confirmando}
            >
              <Text style={[s.btnModalTxt, { color: colors.textSecondary }]}>{t('common.cancelar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof import('../theme/ThemeContext').useTheme>['colors']) => StyleSheet.create({
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  titulo:       { fontFamily: FONT_SERIF, color: c.text, fontSize: 20, fontWeight: '800' },
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
  pendCard:     { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  pendTop:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pendMuted:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  pendMeta:     { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 6 },
  pendLinha:    { fontSize: 13, lineHeight: 20 },
  metaSep:      { color: c.textTertiary ?? c.textSecondary, fontSize: 13 },
  metaLabel:    { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  metaValue:    { color: c.text, fontSize: 13, fontWeight: '600' },
  pendAcoes:    { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12 },
  pendRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, flexWrap: 'wrap' },
  pendBtns:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  btnPend:      { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, minWidth: 88, alignItems: 'center' },
  btnPendTxt:   { fontSize: 13, fontWeight: '700' },
  chips:        { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip:         { borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, paddingVertical: 7, paddingHorizontal: 14 },
  chipAtivo:    { borderColor: c.greenBorder, backgroundColor: c.greenDim },
  chipTxt:      { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTxtAtivo: { color: c.green },
  vazioLista:   { color: c.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
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
