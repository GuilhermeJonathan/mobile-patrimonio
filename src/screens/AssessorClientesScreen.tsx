import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Platform,
} from 'react-native';
import {
  assessoriaService, relatorioService,
  ClienteAssessoriaDto, ResumoPatrimonialDto,
  SaudeFinanceiraDto, RecomendacaoDto,
} from '../services/api';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useRouter } from '../navigation/router';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';

type PatrimonioMap = Record<string, ResumoPatrimonialDto | 'loading' | 'error'>;
type SaudeMap = Record<string, SaudeFinanceiraDto | 'loading' | 'error'>;

const TIPO_LABELS: Record<number, string> = { 1: 'Ajuste de orcamento', 2: 'Dica', 3: 'Alerta' };
const TIPO_ICONS: Record<number, string> = { 1: '\u{1F4CB}', 2: '\u{1F4A1}', 3: '\u{1F6A8}' };
const STATUS_LABELS: Record<number, string> = { 1: 'Pendente', 2: 'Aceita', 3: 'Recusada' };
const STATUS_COLORS: Record<number, string> = { 1: '#f59e0b', 2: '#16a34a', 3: '#ef4444' };

const agora = new Date();
const MES = agora.getMonth() + 1;
const ANO = agora.getFullYear();

function scoreInfo(classificacao: string): { cor: string; label: string } {
  if (classificacao === 'Excelente' || classificacao === 'Boa') return { cor: '#16a34a', label: 'Saudavel' };
  if (classificacao === 'Critica') return { cor: '#ef4444', label: 'Critica' };
  return { cor: '#f59e0b', label: 'Atencao' };
}

interface Props { userName?: string; avatarUrl?: string | null; }

export default function AssessorClientesScreen({ userName, avatarUrl }: Props) {
  const { colors } = useTheme();
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
  const [filtro, setFiltro] = useState<'todos' | 'atencao' | 'saudaveis'>('todos');
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);

  const [codigoModal, setCodigoModal] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [gerandoCodigo, setGerandoCodigo] = useState(false);

  const [recomModal, setRecomModal] = useState(false);
  const [recomCliente, setRecomCliente] = useState<ClienteAssessoriaDto | null>(null);
  const [recomLista, setRecomLista] = useState<RecomendacaoDto[]>([]);
  const [recomLoading, setRecomLoading] = useState(false);
  const [novoTipo, setNovoTipo] = useState(2);
  const [novoTexto, setNovoTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recomErro, setRecomErro] = useState<string | null>(null);

  const [confirmCliente, setConfirmCliente] = useState<ClienteAssessoriaDto | null>(null);
  const [revogando, setRevogando] = useState(false);

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

  async function gerarConvite() {
    setGerandoCodigo(true);
    try {
      const { codigo: cod } = await assessoriaService.gerarConvite();
      setCodigo(cod); setCodigoModal(true);
    } catch { /* silencia */ }
    finally { setGerandoCodigo(false); }
  }

  function entrarComoCliente(c: ClienteAssessoriaDto) {
    entrar({ clienteId: c.clienteId, nome: c.nomeCliente ?? 'Cliente' });
    navigate('patrimonio');
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
    if (!recomCliente || !novoTexto.trim()) { setRecomErro('Preencha o texto.'); return; }
    setEnviando(true); setRecomErro(null);
    try {
      await assessoriaService.criarRecomendacao(recomCliente.clienteId, novoTipo, novoTexto.trim());
      setNovoTexto('');
      setRecomLista(await assessoriaService.getRecomendacoes(recomCliente.clienteId));
    } catch (e: any) {
      setRecomErro(e?.response?.data?.error ?? 'Nao foi possivel enviar.');
    } finally { setEnviando(false); }
  }

  async function excluirRecomendacao(id: string) {
    try {
      await assessoriaService.excluirRecomendacao(id);
      if (recomCliente) setRecomLista(await assessoriaService.getRecomendacoes(recomCliente.clienteId));
    } catch { /* silencia */ }
  }

  function clienteEmAtencao(c: ClienteAssessoriaDto): boolean {
    const sd = saudes[c.clienteId];
    if (typeof sd !== 'object') return false;
    return sd.classificacao !== 'Excelente' && sd.classificacao !== 'Boa';
  }

  const ativos = clientes.filter(c => c.ativo);
  const pendentes = clientes.filter(c => !c.ativo);
  const qtdAtencao = ativos.filter(clienteEmAtencao).length;
  const qtdSaudaveis = ativos.filter(c => !clienteEmAtencao(c)).length;

  const filtrados = clientes.filter(c => {
    if (filtro === 'atencao' && (!c.ativo || !clienteEmAtencao(c))) return false;
    if (filtro === 'saudaveis' && (!c.ativo || clienteEmAtencao(c))) return false;
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
          placeholder="Buscar cliente por nome..."
          placeholderTextColor={colors.inputPlaceholder}
        />

        <View style={s.filtros}>
          <TouchableOpacity style={[s.filtroChip, filtro === 'todos' && s.filtroChipAtivo]} onPress={() => setFiltro('todos')}>
            <Text style={[s.filtroTxt, filtro === 'todos' && s.filtroTxtAtivo]}>Todos ({ativos.length + pendentes.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filtroChip, filtro === 'atencao' && s.filtroChipAtencao]} onPress={() => setFiltro('atencao')}>
            <Text style={[s.filtroTxt, filtro === 'atencao' && { color: '#f59e0b' }]}>Em atencao ({qtdAtencao})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.filtroChip, filtro === 'saudaveis' && s.filtroChipAtivo]} onPress={() => setFiltro('saudaveis')}>
            <Text style={[s.filtroTxt, filtro === 'saudaveis' && s.filtroTxtAtivo]}>Saudaveis ({qtdSaudaveis})</Text>
          </TouchableOpacity>
        </View>

        {filtrados.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioText}>Nenhum cliente ainda.</Text>
            <Text style={s.vazioSub}>Gere um convite e envie ao cliente.</Text>
          </View>
        )}

        {filtrados.map(c => {
          const saude = saudes[c.clienteId];
          const saudeObj = typeof saude === 'object' ? saude : null;
          const si = saudeObj ? scoreInfo(saudeObj.classificacao) : null;
          const iniciais = (c.nomeCliente ?? 'C').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

          return (
            <View key={c.vinculoId} style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.avatar, si ? { borderColor: si.cor, borderWidth: 2 } : {}]}>
                  <Text style={s.avatarText}>{iniciais}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clienteNome}>{c.nomeCliente ?? '(sem nome)'}</Text>
                  {c.aceitoEm
                    ? <Text style={s.clienteSub}>Desde {new Date(c.aceitoEm).toLocaleDateString('pt-BR')}</Text>
                    : <Text style={s.pendente}>Convite pendente</Text>}
                </View>
                {si && (
                  <View style={[s.scoreBadge, { borderColor: si.cor }]}>
                    <Text style={[s.scoreNum, { color: si.cor }]}>{saudeObj!.scoreGeral}</Text>
                    <Text style={[s.scoreLabel, { color: si.cor }]}>{si.label}</Text>
                  </View>
                )}
                {saude === 'loading' && <ActivityIndicator size="small" color={colors.green} />}
              </View>

              {c.ativo && (
                <View style={s.acoes}>
                  <TouchableOpacity style={s.btnPainel} onPress={() => entrarComoCliente(c)}>
                    <Text style={s.btnPainelText}>Painel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnRecomendar} onPress={() => abrirRecomendacoes(c)}>
                    <Text style={s.btnRecomendarText}>Recomendar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnHistorico} onPress={() => gerarRelatorio(c)} disabled={gerandoPdf === c.clienteId}>
                    {gerandoPdf === c.clienteId
                      ? <ActivityIndicator size="small" color={colors.green} />
                      : <Text style={s.btnHistoricoText}>Historico</Text>}
                  </TouchableOpacity>
                </View>
              )}
              {!c.ativo && (
                <TouchableOpacity style={s.btnCancelarConvite} onPress={() => setConfirmCliente(c)}>
                  <Text style={s.btnCancelarText}>Cancelar convite</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={codigoModal} transparent animationType="slide" onRequestClose={() => setCodigoModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>Convite gerado</Text>
            <Text style={s.modalSub}>Envie este codigo ao cliente para vincular a conta.</Text>
            <View style={s.codigoBox}>
              <Text style={s.codigoText}>{codigo}</Text>
            </View>
            {Platform.OS === 'web' && codigo && (
              <TouchableOpacity onPress={() => { try { navigator.clipboard.writeText(codigo!); } catch {} }}>
                <Text style={{ color: colors.green, textAlign: 'center', marginBottom: 8, fontWeight: '700' }}>Copiar codigo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btnFechar} onPress={() => setCodigoModal(false)}>
              <Text style={s.btnFecharText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={recomModal} transparent animationType="slide" onRequestClose={() => setRecomModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.modalTitulo}>Recomendar</Text>
              <TouchableOpacity onPress={() => setRecomModal(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 20 }}>X</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { marginBottom: 14 }]}>
              {'Cliente: '}<Text style={{ color: colors.text, fontWeight: '700' }}>{recomCliente?.nomeCliente}</Text>
            </Text>
            <View style={s.novaRecomBox}>
              <Text style={s.secLabel}>Nova recomendacao</Text>
              <View style={s.tipoRow}>
                {([1, 2, 3] as const).map(t => (
                  <TouchableOpacity key={t} style={[s.tipoChip, novoTipo === t && s.tipoChipAtivo]} onPress={() => setNovoTipo(t)}>
                    <Text style={[s.tipoTxt, novoTipo === t && { color: colors.green }]}>
                      {TIPO_ICONS[t]} {TIPO_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={s.recomInput}
                value={novoTexto}
                onChangeText={setNovoTexto}
                placeholder="Descreva a recomendacao..."
                placeholderTextColor={colors.inputPlaceholder}
                multiline
                numberOfLines={3}
              />
              {recomErro && <Text style={s.erroTxt}>{recomErro}</Text>}
              <TouchableOpacity style={s.btnEnviar} onPress={enviarRecomendacao} disabled={enviando}>
                {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnEnviarText}>Enviar recomendacao</Text>}
              </TouchableOpacity>
            </View>
            <Text style={[s.secLabel, { marginTop: 20, marginBottom: 8 }]}>Historico ({recomLista.length})</Text>
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
              {recomLoading && <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />}
              {!recomLoading && recomLista.length === 0 && (
                <Text style={[s.modalSub, { textAlign: 'center', marginTop: 12 }]}>Nenhuma recomendacao enviada ainda.</Text>
              )}
              {recomLista.map(r => (
                <View key={r.id} style={s.recomCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 14 }}>{TIPO_ICONS[r.tipo]}</Text>
                      <Text style={s.recomTipo}>{TIPO_LABELS[r.tipo]}</Text>
                      <View style={[s.statusBadge, { backgroundColor: STATUS_COLORS[r.status] + '22', borderColor: STATUS_COLORS[r.status] + '55' }]}>
                        <Text style={[s.statusTxt, { color: STATUS_COLORS[r.status] }]}>{STATUS_LABELS[r.status]}</Text>
                      </View>
                    </View>
                    <Text style={s.recomTexto}>{r.texto}</Text>
                    {r.respostaCliente && <Text style={s.recomResposta}>{r.respostaCliente}</Text>}
                    <Text style={s.recomData}>{new Date(r.criadoEm).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  {r.status === 1 && (
                    <TouchableOpacity onPress={() => excluirRecomendacao(r.id)} style={{ padding: 4 }}>
                      <Text style={{ color: colors.red, fontSize: 16 }}>X</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmCliente} transparent animationType="fade" onRequestClose={() => setConfirmCliente(null)}>
        <View style={[s.overlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={[s.modalCard, { borderRadius: 20 }]}>
            <Text style={s.modalTitulo}>Confirmar remocao</Text>
            <Text style={[s.modalSub, { marginTop: 8, marginBottom: 24 }]}>
              {`Remover "${confirmCliente?.nomeCliente ?? 'cliente'}" da carteira?`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.btnFechar, { flex: 1 }]} onPress={() => setConfirmCliente(null)} disabled={revogando}>
                <Text style={s.btnFecharText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnFechar, { flex: 1, backgroundColor: colors.red }]} onPress={confirmarRevogar} disabled={revogando}>
                {revogando ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnFecharText, { color: '#fff' }]}>Revogar</Text>}
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
  center:            { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title:             { color: c.text, fontSize: 20, fontWeight: '800' },
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
  btnCancelarConvite:{ backgroundColor: c.surfaceElevated, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  btnCancelarText:   { color: c.red, fontSize: 14, fontWeight: '700' },
  overlay:           { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard:         { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo:       { color: c.text, fontSize: 18, fontWeight: '800' },
  modalSub:          { color: c.textSecondary, fontSize: 14 },
  codigoBox:         { backgroundColor: c.greenDim, borderRadius: 14, padding: 20, alignItems: 'center', marginVertical: 16 },
  codigoText:        { color: c.green, fontSize: 36, fontWeight: '800', letterSpacing: 8 },
  btnFechar:         { backgroundColor: c.surfaceElevated, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnFecharText:     { color: c.textSecondary, fontWeight: '700' },
  novaRecomBox:      { backgroundColor: c.background, borderRadius: 12, padding: 14 },
  secLabel:          { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tipoRow:           { flexDirection: 'row', gap: 6, marginVertical: 10, flexWrap: 'wrap' },
  tipoChip:          { borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, paddingVertical: 6, paddingHorizontal: 10 },
  tipoChipAtivo:     { borderColor: c.greenBorder, backgroundColor: c.greenDim },
  tipoTxt:           { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  recomInput:        { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 14, minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
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