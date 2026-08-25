import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Platform, useWindowDimensions,
} from 'react-native';
import {
  assessoriaService, relatorioService, tarefasService,
  ClienteAssessoriaDto, ResumoPatrimonialDto,
  SaudeFinanceiraDto, RecomendacaoDto,
} from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { useTranslation } from '../i18n';
import { dataBR } from '../utils/format';

type PatrimonioMap = Record<string, ResumoPatrimonialDto | 'loading' | 'error'>;
type SaudeMap = Record<string, SaudeFinanceiraDto | 'loading' | 'error'>;

const TIPO_LABELS: Record<number, string> = { 1: 'clientes.tipoAjuste', 2: 'clientes.tipoDica', 3: 'clientes.tipoAlerta' };
const TIPO_ICONS: Record<number, string> = { 1: '\u{1F4CB}', 2: '\u{1F4A1}', 3: '\u{1F6A8}' };
const STATUS_LABELS: Record<number, string> = { 1: 'clientes.statusPendente', 2: 'clientes.statusAceita', 3: 'clientes.statusRecusada' };
const STATUS_COLORS: Record<number, string> = { 1: '#f59e0b', 2: '#16a34a', 3: '#ef4444' };

const agora = new Date();
const MES = agora.getMonth() + 1;
const ANO = agora.getFullYear();

function scoreInfo(classificacao: string): { cor: string; label: string; semDados?: boolean } {
  if (classificacao === 'Sem dados') return { cor: '#64748b', label: 'clientes.scoreNovo', semDados: true };
  if (classificacao === 'Excelente' || classificacao === 'Boa') return { cor: '#16a34a', label: 'clientes.scoreSaudavel' };
  if (classificacao === 'Critica') return { cor: '#ef4444', label: 'clientes.scoreCritica' };
  return { cor: '#f59e0b', label: 'clientes.scoreAtencao' };
}

interface Props { userName?: string; avatarUrl?: string | null; }

export default function AssessorClientesScreen({ userName, avatarUrl }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const fmtBRL = (v: number) => formatMoney(v, ocultar);
  const { entrar } = useAssessoria();
  const { navigate } = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientes, setClientes] = useState<ClienteAssessoriaDto[]>([]);
  const [patrimonios, setPatrimonios] = useState<PatrimonioMap>({});
  const [saudes, setSaudes] = useState<SaudeMap>({});
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'atencao' | 'saudaveis' | 'novos'>('todos');
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  const [codigoModal, setCodigoModal] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [gerandoCodigo, setGerandoCodigo] = useState(false);
  const [conviteModal, setConviteModal] = useState(false);
  const [conviteEmail, setConviteEmail] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState<string | null>(null);
  const [conviteErro, setConviteErro] = useState<string | null>(null);

  const [recomModal, setRecomModal] = useState(false);
  const [recomCliente, setRecomCliente] = useState<ClienteAssessoriaDto | null>(null);
  const [recomLista, setRecomLista] = useState<RecomendacaoDto[]>([]);
  const [recomLoading, setRecomLoading] = useState(false);
  const [novoTipo, setNovoTipo] = useState(2);
  const [novoTexto, setNovoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gerandoIa, setGerandoIa] = useState(false);
  const [recomErro, setRecomErro] = useState<string | null>(null);

  const [menuCliente, setMenuCliente] = useState<ClienteAssessoriaDto | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  // Modal "pedir tarefa" (assessor cria uma tarefa genérica pro cliente)
  const [tarefaCliente, setTarefaCliente] = useState<ClienteAssessoriaDto | null>(null);
  const [tTitulo, setTTitulo] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tAtalho, setTAtalho] = useState<string | null>(null);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  async function criarTarefa() {
    if (!tarefaCliente || !tTitulo.trim()) return;
    setCriandoTarefa(true);
    try {
      await tarefasService.criar({ clienteId: tarefaCliente.clienteId, titulo: tTitulo.trim(), descricao: tDesc.trim() || null, atalhoRota: tAtalho });
      setTarefaCliente(null); setTTitulo(''); setTDesc(''); setTAtalho(null);
    } catch { /* silencia */ }
    finally { setCriandoTarefa(false); }
  }
  const ATALHOS: { rota: string | null; label: string }[] = [
    { rota: null, label: t('clientes.semAtalho') },
    { rota: 'documentos', label: t('menu.documentos') },
    { rota: 'ativos', label: t('menu.ativos') },
    { rota: 'contas', label: t('menu.contas') },
    { rota: 'estruturas', label: t('menu.estruturas') },
  ];
  const btnRefs = useRef<Record<string, any>>({});
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [confirmCliente, setConfirmCliente] = useState<ClienteAssessoriaDto | null>(null);
  const [revogando, setRevogando] = useState(false);
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [reenviadoId, setReenviadoId] = useState<string | null>(null);

  // Detalhe / gestão do cliente (perfil + edição de contato/observações)
  const [detalhe, setDetalhe] = useState<ClienteAssessoriaDto | null>(null);
  const [edNome, setEdNome] = useState('');
  const [edTel, setEdTel] = useState('');
  const [edObs, setEdObs] = useState('');
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [contatoSalvo, setContatoSalvo] = useState(false);
  function abrirDetalhe(c: ClienteAssessoriaDto) {
    setDetalhe(c);
    setEdNome(c.nomeCliente ?? '');
    setEdTel(c.telefone ?? '');
    setEdObs(c.observacoes ?? '');
    setContatoSalvo(false);
  }
  async function salvarContato() {
    if (!detalhe) return;
    setSalvandoContato(true); setContatoSalvo(false);
    const nome = edNome.trim(), tel = edTel.trim(), obs = edObs.trim();
    try {
      await assessoriaService.atualizarContato(detalhe.vinculoId, {
        nomeCliente: nome || null, telefone: tel || null, observacoes: obs || null,
      });
      const patch = (c: ClienteAssessoriaDto) => ({ ...c, nomeCliente: nome || c.nomeCliente, telefone: tel || null, observacoes: obs || null });
      setClientes(prev => prev.map(c => c.vinculoId === detalhe.vinculoId ? patch(c) : c));
      setDetalhe(prev => prev ? patch(prev) : prev);
      setContatoSalvo(true);
    } catch { /* silencia */ }
    finally { setSalvandoContato(false); }
  }
  function abrirWhatsapp(tel: string) {
    const digs = tel.replace(/\D/g, '');
    if (Platform.OS === 'web' && digs) { try { window.open(`https://wa.me/${digs}`, '_blank'); } catch { /* noop */ } }
  }

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
      setSaudes(prev => {
        const next = { ...prev };
        ativos.forEach(c => { if (!next[c.clienteId]) next[c.clienteId] = 'loading'; });
        return next;
      });
      ativos.forEach(c => {
        assessoriaService.resumoCliente(c.clienteId)
          .then(r => setPatrimonios(prev => ({ ...prev, [c.clienteId]: r })))
          .catch(() => setPatrimonios(prev => ({ ...prev, [c.clienteId]: 'error' })));
        assessoriaService.saude(c.clienteId, MES, ANO)
          .then(r => setSaudes(prev => ({ ...prev, [c.clienteId]: r })))
          .catch(() => setSaudes(prev => ({ ...prev, [c.clienteId]: 'error' })));
      });
    } catch { /* silencia */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function abrirConvite() {
    setConviteEmail(''); setEmailEnviado(null); setConviteErro(null); setConviteModal(true);
  }

  async function gerarConvite() {
    setGerandoCodigo(true);
    try {
      const { codigo: cod } = await assessoriaService.gerarConvite();
      setConviteModal(false);
      setCodigo(cod); setCodigoModal(true);
      await load();
    } catch { /* silencia */ }
    finally { setGerandoCodigo(false); }
  }

  async function enviarConvitePorEmail() {
    const email = conviteEmail.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setConviteErro(t('clientes.emailInvalido')); return; }
    setEnviandoEmail(true); setConviteErro(null);
    try {
      await assessoriaService.enviarConviteEmail(email);
      setEmailEnviado(email);
      await load();
    } catch (e: any) {
      setConviteErro(e?.response?.data?.error ?? t('clientes.erroEnviarConvite'));
    } finally { setEnviandoEmail(false); }
  }

  function entrarComoCliente(c: ClienteAssessoriaDto) {
    entrar({ clienteId: c.clienteId, nome: c.nomeCliente ?? t('clientes.clienteFallback') });
    navigate('patrimonio');
  }

  function irParaPlano(c: ClienteAssessoriaDto) {
    entrar({ clienteId: c.clienteId, nome: c.nomeCliente ?? t('clientes.clienteFallback') });
    navigate('plano-acao');
  }

  async function confirmarRevogar() {
    if (!confirmCliente) return;
    setRevogando(true);
    try {
      await assessoriaService.revogar(confirmCliente.vinculoId);
      setConfirmCliente(null);
      await load();
    } catch { /* silencia */ }
    finally { setRevogando(false); }
  }

  async function reenviarConvite(c: ClienteAssessoriaDto) {
    setReenviandoId(c.vinculoId); setReenviadoId(null);
    try {
      await assessoriaService.reenviarConvite(c.vinculoId);
      setReenviadoId(c.vinculoId);
      await load();
    } catch { /* silencia */ }
    finally { setReenviandoId(null); }
  }

  async function gerarRelatorio(c: ClienteAssessoriaDto) {
    setGerandoPdf(c.clienteId);
    try {
      const blob = await relatorioService.gerarParaCliente(c.clienteId, {
        clienteNome: c.nomeCliente ?? t('clientes.clienteFallback'),
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
      }
    } catch { /* silencia */ }
    finally { setGerandoPdf(null); }
  }

  async function abrirRecomendacoes(c: ClienteAssessoriaDto) {
    setRecomCliente(c);
    setRecomLista([]); setNovoTexto(''); setNovoTipo(2); setRecomErro(null);
    setRecomModal(true); setRecomLoading(true);
    try { setRecomLista(await assessoriaService.getRecomendacoes(c.clienteId)); }
    catch { /* silencia */ }
    finally { setRecomLoading(false); }
  }

  async function enviarRecomendacao() {
    if (!recomCliente || !novoTexto.trim()) { setRecomErro(t('clientes.preenchaTexto')); return; }
    setEnviando(true); setRecomErro(null);
    try {
      await assessoriaService.criarRecomendacao(recomCliente.clienteId, novoTipo, novoTexto.trim());
      setNovoTexto('');
      setRecomLista(await assessoriaService.getRecomendacoes(recomCliente.clienteId));
    } catch (e: any) {
      setRecomErro(e?.response?.data?.error ?? t('clientes.erroEnviar'));
    } finally { setEnviando(false); }
  }

  async function gerarComIa() {
    if (!recomCliente) return;
    setGerandoIa(true); setRecomErro(null);
    try {
      const hoje = new Date();
      const { rascunho, tipoSugerido } = await assessoriaService.analiseIa(
        recomCliente.clienteId, hoje.getMonth() + 1, hoje.getFullYear());
      setNovoTexto(rascunho.trim());
      if (tipoSugerido) setNovoTipo(tipoSugerido);
    } catch (e: any) {
      setRecomErro(e?.response?.data?.error ?? t('clientes.erroGerarIa'));
    } finally { setGerandoIa(false); }
  }

  async function excluirRecomendacao(id: string) {
    try {
      await assessoriaService.excluirRecomendacao(id);
      if (recomCliente) setRecomLista(await assessoriaService.getRecomendacoes(recomCliente.clienteId));
    } catch { /* silencia */ }
  }

  function clienteSemDados(c: ClienteAssessoriaDto): boolean {
    const sd = saudes[c.clienteId];
    return typeof sd === 'object' && sd.classificacao === 'Sem dados';
  }
  function clienteEmAtencao(c: ClienteAssessoriaDto): boolean {
    const sd = saudes[c.clienteId];
    if (typeof sd !== 'object' || sd.classificacao === 'Sem dados') return false;
    return sd.classificacao !== 'Excelente' && sd.classificacao !== 'Boa';
  }
  function clienteSaudavel(c: ClienteAssessoriaDto): boolean {
    const sd = saudes[c.clienteId];
    if (typeof sd !== 'object') return false;
    return sd.classificacao === 'Excelente' || sd.classificacao === 'Boa';
  }

  const ativos = clientes.filter(c => c.ativo);
  const pendentes = clientes.filter(c => !c.ativo);
  const qtdAtencao = ativos.filter(clienteEmAtencao).length;
  const qtdSaudaveis = ativos.filter(clienteSaudavel).length;
  const qtdNovos = ativos.filter(clienteSemDados).length;

  const filtrados = clientes.filter(c => {
    if (filtro === 'atencao' && (!c.ativo || !clienteEmAtencao(c))) return false;
    if (filtro === 'saudaveis' && (!c.ativo || !clienteSaudavel(c))) return false;
    if (filtro === 'novos' && (!c.ativo || !clienteSemDados(c))) return false;
    const q = busca.trim().toLowerCase();
    return !q || (c.nomeCliente ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q);
  });

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      {!detalhe && (
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.inner}>
        <View style={s.header}>
          <Text style={s.title}>{t('clientes.tituloCarteira')}</Text>
          <TouchableOpacity style={s.btnNovo} onPress={abrirConvite}>
            {gerandoCodigo ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnNovoText}>+ {t('clientes.convite')}</Text>}
          </TouchableOpacity>
        </View>

        <TextInput
          style={s.busca}
          value={busca}
          onChangeText={setBusca}
          placeholder={t('clientes.buscarPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
        />

        <View style={s.filtros}>
          <TouchableOpacity style={[s.filtroChip, filtro === 'todos' && s.filtroChipAtivo]} onPress={() => setFiltro('todos')}>
            <Text style={[s.filtroTxt, filtro === 'todos' && s.filtroTxtAtivo]}>{t('common.todos')} ({ativos.length + pendentes.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filtroChip, filtro === 'atencao' && s.filtroChipAtencao]} onPress={() => setFiltro('atencao')}>
            <Text style={[s.filtroTxt, filtro === 'atencao' && { color: '#f59e0b' }]}>{t('clientes.emAtencao')} ({qtdAtencao})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filtroChip, filtro === 'saudaveis' && s.filtroChipAtivo]} onPress={() => setFiltro('saudaveis')}>
            <Text style={[s.filtroTxt, filtro === 'saudaveis' && s.filtroTxtAtivo]}>{t('clientes.saudaveis')} ({qtdSaudaveis})</Text>
          </TouchableOpacity>
          {qtdNovos > 0 && (
            <TouchableOpacity style={[s.filtroChip, filtro === 'novos' && s.filtroChipAtivo]} onPress={() => setFiltro('novos')}>
              <Text style={[s.filtroTxt, filtro === 'novos' && s.filtroTxtAtivo]}>{t('clientes.novos')} ({qtdNovos})</Text>
            </TouchableOpacity>
          )}
        </View>

        {filtrados.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioText}>{t('clientes.nenhumCliente')}</Text>
            <Text style={s.vazioSub}>{t('clientes.gereConvite')}</Text>
          </View>
        )}

        {filtrados.map(c => {
          const saude = saudes[c.clienteId];
          const saudeObj = typeof saude === 'object' ? saude : null;
          const si = saudeObj ? scoreInfo(saudeObj.classificacao) : null;
          const iniciais = (c.nomeCliente ?? 'C').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

          // Cliente ativo → linha compacta (toque abre o painel de gestão)
          if (c.ativo) {
            const resumo = patrimonios[c.clienteId];
            const resumoObj = typeof resumo === 'object' ? resumo : null;
            return (
              <View key={c.vinculoId} style={s.row}>
                <TouchableOpacity style={s.rowMain} activeOpacity={0.65} onPress={() => abrirDetalhe(c)}>
                  <View style={[s.avatarSm, si ? { borderColor: si.cor, borderWidth: 2 } : {}]}>
                    <Text style={s.avatarSmTxt}>{iniciais}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowNome} numberOfLines={1}>{c.nomeCliente ?? t('clientes.semNome')}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>
                      {resumoObj ? fmtBRL(resumoObj.patrimonioLiquidoBRL) : (c.email ?? t('clientes.desde', { data: dataBR(c.aceitoEm ?? c.criadoEm) }))}
                    </Text>
                  </View>
                </TouchableOpacity>
                {si && (
                  <View style={[s.chipSaude, { borderColor: si.cor, backgroundColor: si.cor + '18' }]}>
                    <Text style={[s.chipSaudeTxt, { color: si.cor }]}>{si.semDados ? '—' : saudeObj!.scoreGeral} · {t(si.label)}</Text>
                  </View>
                )}
                {saude === 'loading' && <ActivityIndicator size="small" color={colors.green} style={{ marginHorizontal: 4 }} />}
                <TouchableOpacity style={s.rowPainel} onPress={() => entrarComoCliente(c)}>
                  <Text style={s.rowPainelTxt}>{t('clientes.painel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  ref={el => { btnRefs.current[c.clienteId] = el; }}
                  style={s.rowKebab}
                  onPress={() => {
                    const node = btnRefs.current[c.clienteId];
                    if (node?.measureInWindow) {
                      node.measureInWindow((x: number, y: number, w: number, h: number) => {
                        setMenuPos({ x, y, w, h }); setMenuCliente(c);
                      });
                    } else { setMenuPos({ x: 0, y: 0, w: 0, h: 0 }); setMenuCliente(c); }
                  }}>
                  <Text style={s.rowKebabTxt}>⋯</Text>
                </TouchableOpacity>
              </View>
            );
          }

          // Convite pendente → card
          return (
            <View key={c.vinculoId} style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.avatar, si ? { borderColor: si.cor, borderWidth: 2 } : {}]}>
                  <Text style={s.avatarText}>{iniciais}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clienteNome}>{c.nomeCliente ?? t('clientes.semNome')}</Text>
                  {c.aceitoEm && c.email && <Text style={s.clienteSub} numberOfLines={1}>{'📧 '}{c.email}</Text>}
                  {c.aceitoEm
                    ? <Text style={s.clienteSub}>{t('clientes.desde', { data: dataBR(c.aceitoEm) })}</Text>
                    : <Text style={s.pendente}>{t('clientes.convitePendente')} · {c.emailConvidado ? t('clientes.porEmail') : t('clientes.porCodigo')}</Text>}
                </View>
                {si && (
                  <View style={[s.scoreBadge, { borderColor: si.cor }]}>
                    <Text style={[s.scoreNum, { color: si.cor }]}>{si.semDados ? '—' : saudeObj!.scoreGeral}</Text>
                    <Text style={[s.scoreLabel, { color: si.cor }]}>{t(si.label)}</Text>
                  </View>
                )}
                {saude === 'loading' && <ActivityIndicator size="small" color={colors.green} />}
              </View>

              {c.ativo && (
                <View style={s.acoes}>
                  <TouchableOpacity style={s.btnPainel} onPress={() => entrarComoCliente(c)}>
                    <Text style={s.btnPainelText}>{t('clientes.painel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    ref={el => { btnRefs.current[c.clienteId] = el; }}
                    style={s.btnOpcoes}
                    onPress={() => {
                      const node = btnRefs.current[c.clienteId];
                      if (node?.measureInWindow) {
                        node.measureInWindow((x: number, y: number, w: number, h: number) => {
                          setMenuPos({ x, y, w, h }); setMenuCliente(c);
                        });
                      } else { setMenuPos({ x: 0, y: 0, w: 0, h: 0 }); setMenuCliente(c); }
                    }}>
                    <Text style={s.btnOpcoesText}>{t('clientes.opcoes')} ▾</Text>
                  </TouchableOpacity>
                </View>
              )}
              {!c.ativo && (
                <View style={s.conviteMeta}>
                  <Text style={s.conviteLinha} numberOfLines={1}>
                    {c.emailConvidado && (<><Text style={s.metaLabel}>{'📧 '}</Text><Text style={s.metaValue}>{c.emailConvidado}</Text><Text style={s.metaSep}>{'   ·   '}</Text></>)}
                    <Text style={s.metaLabel}>{t('clientes.codigo')} </Text>
                    <Text style={[s.metaValue, { color: colors.green, fontWeight: '800', letterSpacing: 1 }]}>{c.codigoConvite}</Text>
                    <Text style={s.metaSep}>{'   ·   '}</Text>
                    <Text style={[s.metaValue, c.expirado && { color: colors.red }]}>
                      {c.expirado ? t('clientes.expirado') : c.expiraEm ? t('clientes.expiraEm', { data: dataBR(c.expiraEm) }) : t('clientes.semExpiracao')}
                    </Text>
                  </Text>
                  <View style={s.conviteBtns}>
                    {c.emailConvidado && (reenviadoId === c.vinculoId
                      ? <Text style={[s.metaValue, { color: colors.green }]}>{'✅'} {t('clientes.reenviado')}</Text>
                      : <TouchableOpacity style={[s.btnConv, { borderColor: colors.greenBorder }]} onPress={() => reenviarConvite(c)} disabled={reenviandoId === c.vinculoId}>
                          {reenviandoId === c.vinculoId
                            ? <ActivityIndicator size="small" color={colors.green} />
                            : <Text style={[s.btnConvTxt, { color: colors.green }]}>{t('clientes.reenviar')}</Text>}
                        </TouchableOpacity>)}
                    <TouchableOpacity style={[s.btnConv, { borderColor: colors.red + '66' }]} onPress={() => setConfirmCliente(c)}>
                      <Text style={[s.btnConvTxt, { color: colors.red }]}>{t('clientes.cancelarConvite')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        </View>
      </ScrollView>
      )}

      <Modal visible={conviteModal} transparent animationType="slide" onRequestClose={() => setConviteModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            {emailEnviado ? (
              <>
                <Text style={s.modalTitulo}>{t('clientes.conviteEnviado')} ✅</Text>
                <Text style={s.modalSub}>{t('clientes.conviteEnviadoMsg', { email: emailEnviado })}</Text>
                <TouchableOpacity style={s.btnFechar} onPress={() => setConviteModal(false)}>
                  <Text style={s.btnFecharText}>{t('clientes.fechar')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.modalTitulo}>{t('clientes.convidarCliente')}</Text>
                <Text style={s.modalSub}>{t('clientes.convidarSub')}</Text>
                <TextInput
                  style={s.conviteInput}
                  value={conviteEmail}
                  onChangeText={setConviteEmail}
                  placeholder={t('clientes.emailPlaceholder')}
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {conviteErro && <Text style={s.erroTxt}>{conviteErro}</Text>}
                <TouchableOpacity style={[s.btnEnviar, { marginTop: 14 }]} onPress={enviarConvitePorEmail} disabled={enviandoEmail}>
                  {enviandoEmail ? <ActivityIndicator color="#fff" /> : <Text style={s.btnEnviarText}>{t('clientes.enviarConviteEmail')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnIa, { marginTop: 10, marginBottom: 0 }]} onPress={gerarConvite} disabled={gerandoCodigo}>
                  {gerandoCodigo ? <ActivityIndicator color={colors.green} size="small" /> : <Text style={s.btnIaText}>{t('clientes.preferoCodigo')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnFechar, { marginTop: 10 }]} onPress={() => setConviteModal(false)}>
                  <Text style={s.btnFecharText}>{t('common.cancelar')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={codigoModal} transparent animationType="slide" onRequestClose={() => setCodigoModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('clientes.conviteGerado')}</Text>
            <Text style={s.modalSub}>{t('clientes.conviteGeradoSub')}</Text>
            <View style={s.codigoBox}>
              <Text style={s.codigoText}>{codigo}</Text>
            </View>
            {Platform.OS === 'web' && codigo && (
              <TouchableOpacity onPress={() => { try { navigator.clipboard.writeText(codigo!); } catch {} }}>
                <Text style={{ color: colors.green, textAlign: 'center', marginBottom: 8, fontWeight: '700' }}>{t('clientes.copiarCodigo')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btnFechar} onPress={() => setCodigoModal(false)}>
              <Text style={s.btnFecharText}>{t('clientes.fechar')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={recomModal} animationType="slide" onRequestClose={() => setRecomModal(false)}>
        <View style={s.recomTela}>
          {/* Header */}
          <View style={s.recomHeader}>
            <TouchableOpacity onPress={() => setRecomModal(false)} style={s.recomBtnVoltar}>
              <Text style={s.recomBtnVoltarTxt}>← {t('common.voltar')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.recomTelaTitulo}>{t('clientes.recomendar')}</Text>
              <Text style={s.recomTelaSubtitulo} numberOfLines={1}>{recomCliente?.nomeCliente}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Nova recomendação */}
            <View style={s.novaRecomBox}>
              <Text style={s.secLabel}>{t('clientes.novaRecomendacao')}</Text>
              <View style={s.tipoRow}>
                {([1, 2, 3] as const).map(tp => (
                  <TouchableOpacity key={tp} style={[s.tipoChip, novoTipo === tp && s.tipoChipAtivo]} onPress={() => setNovoTipo(tp)}>
                    <Text style={[s.tipoTxt, novoTipo === tp && { color: colors.green }]}>
                      {TIPO_ICONS[tp]} {t(TIPO_LABELS[tp])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[s.btnIa, gerandoIa && { opacity: 0.6 }]}
                onPress={gerarComIa}
                disabled={gerandoIa || enviando}
              >
                {gerandoIa
                  ? <><ActivityIndicator color={colors.green} size="small" /><Text style={s.btnIaText}>{t('clientes.gerandoRascunho')}</Text></>
                  : <Text style={s.btnIaText}>✨ {t('clientes.gerarRascunhoIa')}</Text>}
              </TouchableOpacity>
              <TextInput
                style={s.recomInput}
                value={novoTexto}
                onChangeText={setNovoTexto}
                placeholder={t('clientes.descrevaRecomendacao')}
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={4}
              />
              {recomErro && <Text style={s.erroTxt}>{recomErro}</Text>}
              <TouchableOpacity style={s.btnEnviar} onPress={enviarRecomendacao} disabled={enviando}>
                {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnEnviarText}>{t('clientes.enviarRecomendacao')}</Text>}
              </TouchableOpacity>
            </View>

            {/* Histórico */}
            <Text style={[s.secLabel, { marginTop: 28, marginBottom: 12 }]}>{t('clientes.historico')} ({recomLista.length})</Text>
            {recomLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
            {!recomLoading && recomLista.length === 0 && (
              <Text style={[s.modalSub, { textAlign: 'center', marginTop: 12 }]}>{t('clientes.nenhumaRecomendacao')}</Text>
            )}
            {recomLista.map(r => (
              <View key={r.id} style={s.recomCard}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 14 }}>{TIPO_ICONS[r.tipo]}</Text>
                    <Text style={s.recomTipo}>{t(TIPO_LABELS[r.tipo])}</Text>
                    <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[r.status] + '22', borderColor: STATUS_COLORS[r.status] + '55' }]}>
                      <Text style={[s.statusTxt, { color: STATUS_COLORS[r.status] }]}>{t(STATUS_LABELS[r.status])}</Text>
                    </View>
                  </View>
                  <Text style={s.recomTexto}>{r.texto}</Text>
                  {r.respostaCliente && <Text style={s.recomResposta}>{r.respostaCliente}</Text>}
                  <Text style={s.recomData}>{dataBR(r.criadoEm)}</Text>
                </View>
                {r.status === 1 && (
                  <TouchableOpacity onPress={() => excluirRecomendacao(r.id)} style={{ padding: 4 }}>
                    <Text style={{ color: colors.red, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!menuCliente} transparent animationType="fade" onRequestClose={() => setMenuCliente(null)}>
        <TouchableOpacity style={s.popOverlay} activeOpacity={1} onPress={() => setMenuCliente(null)}>
          <View style={[s.popMenu, {
            // Abre abaixo do botão; se não couber (últimos itens da lista), abre PARA CIMA.
            top: (menuPos.y + menuPos.h + 260 <= screenH - 12)
              ? menuPos.y + menuPos.h + 4
              : Math.max(8, menuPos.y - 260),
            left: Math.max(8, Math.min(menuPos.x + menuPos.w - 220, screenW - 228)),
          }]}>
            <TouchableOpacity style={s.popItem} onPress={() => { const c = menuCliente!; setMenuCliente(null); abrirDetalhe(c); }}>
              <Text style={s.popIcon}>👤</Text><Text style={s.popItemTxt}>{t('clientes.verEditar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.popItem, s.popDivider]} onPress={() => { const c = menuCliente!; setMenuCliente(null); abrirRecomendacoes(c); }}>
              <Text style={s.popIcon}>💬</Text><Text style={s.popItemTxt}>{t('clientes.recomendar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.popItem, s.popDivider]} onPress={() => { const c = menuCliente!; setMenuCliente(null); irParaPlano(c); }}>
              <Text style={s.popIcon}>🧭</Text><Text style={s.popItemTxt}>{t('clientes.planoAcao')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.popItem, s.popDivider]} onPress={() => { const c = menuCliente!; setMenuCliente(null); gerarRelatorio(c); }}>
              <Text style={s.popIcon}>📄</Text><Text style={s.popItemTxt}>{t('clientes.relatorioCliente')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.popItem, s.popDivider]} onPress={() => { const c = menuCliente!; setMenuCliente(null); setTarefaCliente(c); }}>
              <Text style={s.popIcon}>📋</Text><Text style={s.popItemTxt}>{t('clientes.pedirTarefa')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Página de gestão do cliente (perfil + edição de contato) — tela cheia, dentro do shell */}
      {detalhe && (
        <View style={s.recomTela}>
          <View style={[s.recomHeader, { paddingTop: 20 }]}>
            <TouchableOpacity onPress={() => setDetalhe(null)} style={s.recomBtnVoltar}>
              <Text style={s.recomBtnVoltarTxt}>← {t('common.voltar')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.recomTelaTitulo} numberOfLines={1}>{detalhe?.nomeCliente ?? t('clientes.semNome')}</Text>
              {!!detalhe?.email && <Text style={s.recomTelaSubtitulo} numberOfLines={1}>{detalhe.email}</Text>}
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            {detalhe && (() => {
              const d = detalhe;
              const rc = patrimonios[d.clienteId];
              const rcObj = typeof rc === 'object' ? rc : null;
              const sc = saudes[d.clienteId];
              const scObj = typeof sc === 'object' ? sc : null;
              const siD = scObj ? scoreInfo(scObj.classificacao) : null;
              return (
                <View style={s.detInner}>
                  {/* Saúde financeira */}
                  <View style={s.detCard}>
                    <Text style={s.detCardTit}>{t('clientes.saudeFinanceira')}</Text>
                    {siD ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <Text style={[s.detScore, { color: siD.cor }]}>{siD.semDados ? '—' : scObj!.scoreGeral}</Text>
                        <View style={[s.chipSaude, { borderColor: siD.cor, backgroundColor: siD.cor + '18' }]}>
                          <Text style={[s.chipSaudeTxt, { color: siD.cor }]}>{t(siD.label)}</Text>
                        </View>
                      </View>
                    ) : sc === 'loading'
                      ? <ActivityIndicator color={colors.green} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
                      : <Text style={s.detMuted}>{t('clientes.semDadosSaude')}</Text>}
                  </View>

                  {/* Resumo patrimonial */}
                  <View style={s.detCard}>
                    <Text style={s.detCardTit}>{t('clientes.resumoPatrimonial')}</Text>
                    {rcObj ? (
                      <View style={s.statGrid}>
                        <View style={s.statBox}><Text style={s.statLabel}>{t('clientes.patrimonioLiquido')}</Text><Text style={[s.statValue, { color: colors.green }]}>{fmtBRL(rcObj.patrimonioLiquidoBRL)}</Text></View>
                        <View style={s.statBox}><Text style={s.statLabel}>{t('clientes.bens')}</Text><Text style={s.statValue}>{fmtBRL(rcObj.totalBensBRL)}</Text></View>
                        <View style={s.statBox}><Text style={s.statLabel}>{t('clientes.dividas')}</Text><Text style={s.statValue}>{fmtBRL(rcObj.totalDividasBRL)}</Text></View>
                        <View style={s.statBox}><Text style={s.statLabel}>{t('clientes.ativosQtd')}</Text><Text style={s.statValue}>{rcObj.qtdAtivos}</Text></View>
                        <View style={s.statBox}><Text style={s.statLabel}>{t('clientes.saldoMensal')}</Text><Text style={s.statValue}>{fmtBRL(rcObj.saldoLiquidoMensalBRL)}</Text></View>
                      </View>
                    ) : rc === 'loading'
                      ? <ActivityIndicator color={colors.green} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
                      : <Text style={s.detMuted}>{t('clientes.semPatrimonioAinda')}</Text>}
                  </View>

                  {/* Contato & observações (editável) */}
                  <View style={s.detCard}>
                    <Text style={s.detCardTit}>{t('clientes.dadosContato')}</Text>
                    <Text style={s.detMutedSm}>{t('clientes.dadosContatoSub')}</Text>
                    <Text style={s.fieldLabel}>{t('clientes.nomeExibicao')}</Text>
                    <TextInput style={s.tInput} value={edNome} onChangeText={setEdNome} placeholder={t('clientes.nomeExibicaoPh')} placeholderTextColor={colors.inputPlaceholder} />
                    <Text style={s.fieldLabel}>{t('clientes.whatsappTel')}</Text>
                    <TextInput style={s.tInput} value={edTel} onChangeText={setEdTel} placeholder={t('clientes.telExibicaoPh')} placeholderTextColor={colors.inputPlaceholder} keyboardType="phone-pad" />
                    {!!edTel.trim() && (
                      <TouchableOpacity onPress={() => abrirWhatsapp(edTel)} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                        <Text style={{ color: colors.green, fontWeight: '700', fontSize: 13 }}>🟢 {t('clientes.abrirWhatsapp')}</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={s.fieldLabel}>{t('clientes.observacoesInternas')}</Text>
                    <TextInput style={[s.tInput, { minHeight: 84, textAlignVertical: 'top' }]} value={edObs} onChangeText={setEdObs} placeholder={t('clientes.obsPlaceholder')} placeholderTextColor={colors.inputPlaceholder} multiline />
                    <TouchableOpacity style={[s.btnEnviar, { marginTop: 14, opacity: salvandoContato ? 0.7 : 1 }]} onPress={salvarContato} disabled={salvandoContato}>
                      {salvandoContato ? <ActivityIndicator color="#fff" /> : <Text style={s.btnEnviarText}>{contatoSalvo ? `✅ ${t('clientes.contatoSalvo')}` : t('clientes.salvarContato')}</Text>}
                    </TouchableOpacity>
                  </View>

                  {/* Ações rápidas */}
                  <View style={s.detCard}>
                    <Text style={s.detCardTit}>{t('clientes.acoesRapidas')}</Text>
                    <View style={s.actGrid}>
                      <TouchableOpacity style={s.actBtn} onPress={() => { setDetalhe(null); entrarComoCliente(d); }}>
                        <Text style={s.actIcon}>🗂️</Text><Text style={s.actTxt}>{t('clientes.painel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => { setDetalhe(null); abrirRecomendacoes(d); }}>
                        <Text style={s.actIcon}>💬</Text><Text style={s.actTxt}>{t('clientes.recomendar')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => { setDetalhe(null); setTarefaCliente(d); }}>
                        <Text style={s.actIcon}>📋</Text><Text style={s.actTxt}>{t('clientes.pedirTarefa')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => { setDetalhe(null); irParaPlano(d); }}>
                        <Text style={s.actIcon}>🧭</Text><Text style={s.actTxt}>{t('clientes.planoAcao')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actBtn} onPress={() => gerarRelatorio(d)} disabled={gerandoPdf === d.clienteId}>
                        {gerandoPdf === d.clienteId ? <ActivityIndicator color={colors.green} size="small" /> : <><Text style={s.actIcon}>📄</Text><Text style={s.actTxt}>{t('clientes.relatorioCliente')}</Text></>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })()}
          </ScrollView>
        </View>
      )}

      {/* Modal: pedir tarefa ao cliente */}
      <Modal visible={!!tarefaCliente} transparent animationType="fade" onRequestClose={() => setTarefaCliente(null)}>
        <View style={[s.overlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={[s.modalCard, { borderRadius: 20 }]}>
            <Text style={s.modalTitulo}>{t('clientes.pedirTarefa')}</Text>
            <Text style={[s.modalSub, { marginTop: 4, marginBottom: 12 }]}>{tarefaCliente?.nomeCliente ?? ''}</Text>
            <TextInput style={s.tInput} value={tTitulo} onChangeText={setTTitulo}
              placeholder={t('docs.tituloTarefaPh')} placeholderTextColor={colors.inputPlaceholder} />
            <TextInput style={[s.tInput, { minHeight: 64, textAlignVertical: 'top', marginTop: 10 }]} value={tDesc} onChangeText={setTDesc}
              placeholder={t('clientes.tarefaDescPh')} placeholderTextColor={colors.inputPlaceholder} multiline />
            <Text style={[s.modalSub, { marginTop: 12, marginBottom: 6 }]}>{t('clientes.tarefaAtalho')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ATALHOS.map(a => (
                <TouchableOpacity key={a.rota ?? 'none'} style={[s.tChip, tAtalho === a.rota && s.tChipOn]} onPress={() => setTAtalho(a.rota)}>
                  <Text style={[s.tChipTxt, tAtalho === a.rota && { color: colors.green }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity style={[s.btnFechar, { flex: 1 }]} onPress={() => setTarefaCliente(null)}>
                <Text style={s.btnFecharText}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnFechar, { flex: 1, backgroundColor: colors.green, opacity: (criandoTarefa || !tTitulo.trim()) ? 0.6 : 1 }]} onPress={criarTarefa} disabled={criandoTarefa || !tTitulo.trim()}>
                {criandoTarefa ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnFecharText, { color: '#fff' }]}>{t('docs.criarTarefa')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmCliente} transparent animationType="fade" onRequestClose={() => setConfirmCliente(null)}>
        <View style={[s.overlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={[s.modalCard, { borderRadius: 20 }]}>
            <Text style={s.modalTitulo}>{t('clientes.confirmarRemocao')}</Text>
            <Text style={[s.modalSub, { marginTop: 8, marginBottom: 24 }]}>
              {t('clientes.confirmRemocaoMsg', { nome: confirmCliente?.nomeCliente ?? t('clientes.clienteMinusculo') })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.btnFechar, { flex: 1 }]} onPress={() => setConfirmCliente(null)} disabled={revogando}>
                <Text style={s.btnFecharText}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnFechar, { flex: 1, backgroundColor: colors.red }]} onPress={confirmarRevogar} disabled={revogando}>
                {revogando ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnFecharText, { color: '#fff' }]}>{t('clientes.revogar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:         { flex: 1, backgroundColor: c.background, padding: 16 },
  inner:             { width: '100%' },
  center:            { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  // Linha compacta (cliente ativo)
  row:               { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: c.border },
  rowMain:           { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  avatarSm:          { width: 40, height: 40, borderRadius: 20, backgroundColor: c.greenDim, justifyContent: 'center', alignItems: 'center' },
  avatarSmTxt:       { color: c.green, fontWeight: '800', fontSize: 14 },
  rowNome:           { color: c.text, fontSize: 15, fontWeight: '700', fontFamily: FONT_SERIF },
  rowSub:            { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  chipSaude:         { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  chipSaudeTxt:      { fontSize: 11, fontWeight: '800' },
  rowPainel:         { backgroundColor: c.green, borderRadius: 9, paddingVertical: 8, paddingHorizontal: 14 },
  rowPainelTxt:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  rowKebab:          { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  rowKebabTxt:       { color: c.text, fontSize: 18, fontWeight: '800', lineHeight: 18 },
  // Detalhe / gestão do cliente
  detInner:          { width: '100%' },
  detCard:           { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  detCardTit:        { color: c.text, fontSize: 14, fontWeight: '800' },
  detMuted:          { color: c.textSecondary, fontSize: 13, marginTop: 8 },
  detMutedSm:        { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 6 },
  detScore:          { fontFamily: FONT_SERIF, fontSize: 34, fontWeight: '900' },
  statGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  statBox:           { backgroundColor: c.background, borderRadius: 10, padding: 12, minWidth: 150, flexGrow: 1, flexBasis: '30%' },
  statLabel:         { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue:         { color: c.text, fontSize: 16, fontWeight: '800', marginTop: 4, fontFamily: FONT_SERIF },
  fieldLabel:        { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 5 },
  actGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  actBtn:            { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.greenBorder, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, minWidth: 150, flexGrow: 1, justifyContent: 'center' },
  actIcon:           { fontSize: 16 },
  actTxt:            { color: c.green, fontSize: 13, fontWeight: '700' },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:             { fontFamily: FONT_SERIF, color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo:           { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoText:       { color: '#fff', fontWeight: '700', fontSize: 14 },
  busca:             { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, marginBottom: 12 },
  filtros:           { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filtroChip:        { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  filtroChipAtivo:   { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  filtroChipAtencao: { backgroundColor: '#f59e0b22', borderColor: '#f59e0b55' },
  filtroTxt:         { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  filtroTxtAtivo:    { color: c.green },
  vazio:             { alignItems: 'center', marginTop: 60 },
  vazioText:         { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:          { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  card:              { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar:            { width: 46, height: 46, borderRadius: 23, backgroundColor: c.greenDim, justifyContent: 'center', alignItems: 'center' },
  avatarText:        { color: c.green, fontWeight: '800', fontSize: 16 },
  clienteNome:       { color: c.text, fontSize: 15, fontWeight: '700' },
  clienteSub:        { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  pendente:          { color: c.orange, fontSize: 12, marginTop: 2 },
  scoreBadge:        { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 64 },
  scoreNum:          { fontSize: 20, fontWeight: '900' },
  scoreLabel:        { fontSize: 11, fontWeight: '700', marginTop: 1 },
  acoes:             { flexDirection: 'row', gap: 8 },
  btnPainel:         { flex: 1.2, backgroundColor: c.green, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnPainelText:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnRecomendar:     { flex: 1.5, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.greenBorder, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnRecomendarText: { color: c.green, fontSize: 13, fontWeight: '700' },
  btnHistorico:      { flex: 1.3, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  btnHistoricoText:  { color: c.text, fontSize: 13, fontWeight: '600' },
  btnOpcoes:         { flex: 1, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  btnOpcoesText:     { color: c.text, fontSize: 13, fontWeight: '700' },
  popOverlay:        { flex: 1, backgroundColor: 'transparent' },
  popMenu:           { position: 'absolute', width: 220, backgroundColor: c.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  popItem:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  popDivider:        { borderTopWidth: 1, borderTopColor: c.border },
  popIcon:           { fontSize: 16, width: 20, textAlign: 'center' },
  popItemTxt:        { color: c.text, fontSize: 14, fontWeight: '600' },
  btnCancelarConvite:{ backgroundColor: c.surfaceElevated, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btnCancelarText:   { color: c.red, fontSize: 14, fontWeight: '700' },
  conviteMeta:       { marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  conviteLinha:      { fontSize: 13, lineHeight: 20, flex: 1 },
  metaLabel:         { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  metaValue:         { color: c.text, fontSize: 13, fontWeight: '600' },
  metaSep:           { color: c.textTertiary ?? c.textSecondary, fontSize: 13 },
  conviteBtns:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  btnConv:           { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, minWidth: 84, alignItems: 'center' },
  btnConvTxt:        { fontSize: 13, fontWeight: '700' },
  overlay:           { flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard:         { backgroundColor: c.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 460 },
  modalTitulo:       { color: c.text, fontSize: 18, fontWeight: '800' },
  modalSub:          { color: c.textSecondary, fontSize: 14 },
  codigoBox:         { backgroundColor: c.greenDim, borderRadius: 14, padding: 20, alignItems: 'center', marginVertical: 16 },
  codigoText:        { color: c.green, fontSize: 36, fontWeight: '800', letterSpacing: 8 },
  btnFechar:         { backgroundColor: c.surfaceElevated, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnFecharText:     { color: c.textSecondary, fontWeight: '700' },
  tInput:            { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14 },
  tChip:             { borderRadius: 18, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  tChipOn:           { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  tChipTxt:          { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  novaRecomBox:      { backgroundColor: c.background, borderRadius: 12, padding: 14 },
  secLabel:          { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tipoRow:           { flexDirection: 'row', gap: 6, marginVertical: 10, flexWrap: 'wrap' },
  tipoChip:          { borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, paddingVertical: 6, paddingHorizontal: 10 },
  tipoChipAtivo:     { borderColor: c.greenBorder, backgroundColor: c.greenDim },
  tipoTxt:           { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  recomTela:         { flex: 1, backgroundColor: c.background },
  recomHeader:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  recomBtnVoltar:    { paddingVertical: 6, paddingHorizontal: 2 },
  recomBtnVoltarTxt: { color: c.green, fontSize: 15, fontWeight: '700' },
  recomTelaTitulo:   { fontFamily: FONT_SERIF, color: c.text, fontSize: 18, fontWeight: '800' },
  recomTelaSubtitulo:{ color: c.textSecondary, fontSize: 13, marginTop: 2 },
  recomInput:        { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 10 },
  conviteInput:      { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, color: c.text, fontSize: 15, marginTop: 14 },
  btnIa:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, borderWidth: 1, borderColor: c.greenBorder, backgroundColor: c.surfaceElevated, paddingVertical: 10, marginBottom: 10 },
  btnIaText:         { color: c.green, fontWeight: '700', fontSize: 13 },
  erroTxt:           { color: c.red, fontSize: 13, marginBottom: 8 },
  btnEnviar:         { backgroundColor: c.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnEnviarText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  recomCard:         { backgroundColor: c.surfaceElevated, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  recomTipo:         { color: c.text, fontSize: 13, fontWeight: '700' },
  statusBadge:       { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  statusTxt:         { fontSize: 11, fontWeight: '700' },
  recomTexto:        { color: c.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 4 },
  recomResposta:     { color: c.text, fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  recomData:         { color: c.textTertiary, fontSize: 11 },
});