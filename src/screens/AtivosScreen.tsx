import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert, useWindowDimensions,
} from 'react-native';
import { patrimonioService, AtivoResumoDto, CategoriaComposicaoDto, parametrosService, ParamItemDto, MoedaParamDto, DicaFinanceiraDto, estruturasService, EstruturaDto, BeneficiarioGrafoDto, AlvoDocumento } from '../services/api';
import DocumentosPanel from '../components/DocumentosPanel';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { useTranslation } from '../i18n';
import { numBR, maskMoeda, moedaParaInput, parseMoeda } from '../utils/format';

const MOEDA_SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: 'EUR', CHF: 'CHF', GBP: 'GBP' };

function fmt(valor: number, moeda = 'BRL'): string {
  const sym = MOEDA_SIMBOLO[moeda] ?? '';
  return `${sym} ${numBR(valor, 2)}`;
}

interface FormState {
  nome: string;
  tipoId: number;
  moedaCodigo: string;
  valorAtual: string;
  valorizacaoAnualPct: string;
  receitaMensal: string;
  despesaMensal: string;
  estruturaId: string | null;
  beneficiarioId: string | null;
}

const FORM_VAZIO: FormState = {
  nome: '', tipoId: 0, moedaCodigo: 'BRL', valorAtual: '', valorizacaoAnualPct: '',
  receitaMensal: '', despesaMensal: '', estruturaId: null, beneficiarioId: null,
};

export default function AtivosScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = false; // no view-as, assessor/corretor pode editar patrimônio
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const fmtP = (v: number, moeda = 'BRL') => formatMoney(v, ocultar, moeda);

  const [ativos,     setAtivos]     = useState<AtivoResumoDto[]>([]);
  const [composicao, setComposicao] = useState<CategoriaComposicaoDto[]>([]);
  const [tipos,      setTipos]      = useState<ParamItemDto[]>([]);
  const [moedas,     setMoedas]     = useState<MoedaParamDto[]>([]);
  const [estruturas, setEstruturas] = useState<EstruturaDto[]>([]);
  const [membros,    setMembros]    = useState<BeneficiarioGrafoDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro,       setErro]       = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando,     setEditando]     = useState<AtivoResumoDto | null>(null);
  const [form,         setForm]         = useState<FormState>(FORM_VAZIO);
  const [salvando,     setSalvando]     = useState(false);
  const [erroForm,     setErroForm]     = useState<string | null>(null);

  // filtros
  const [filtroTipoId,  setFiltroTipoId]  = useState<number | null>(null);
  const [filtroMoeda,   setFiltroMoeda]   = useState<string | null>(null);

  // dicas IA
  const [dicas,          setDicas]          = useState<DicaFinanceiraDto[]>([]);
  const [dicasLoading,   setDicasLoading]   = useState(false);
  const [dicasPainel,    setDicasPainel]    = useState(false);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [resumo, tiposData, moedasData, grafo] = await Promise.all([
        patrimonioService.resumo(),
        parametrosService.tiposAtivo(),
        parametrosService.moedas(),
        estruturasService.grafo().catch(() => null),
      ]);
      setAtivos([...resumo.ativos]);
      setComposicao([...resumo.composicao]);
      setTipos(tiposData.filter(t => t.ativo && !t.oculto));
      setMoedas(moedasData.filter(m => m.ativo));
      setEstruturas(grafo?.estruturas ?? []);
      setMembros(grafo?.beneficiarios ?? []);
    } catch {
      setErro(t('ativos.erroCarregar'));
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function carregarDicas() {
    if (readOnly) return;
    setDicasLoading(true);
    try { setDicas(await patrimonioService.dicas()); }
    catch { /* silencia */ }
    finally { setDicasLoading(false); }
  }

  function tipoLabel(tipoId: number): string {
    const tp = tipos.find(x => x.id === tipoId);
    return tp ? `${tp.icone ?? ''} ${tp.nome}`.trim() : String(tipoId);
  }

  // A quem o bem pertence: estrutura, membro da família ou pessoa física.
  function donoLabel(a: { estruturaId?: string | null; beneficiarioId?: string | null }): string {
    if (a.estruturaId) return `🏛️ ${estruturas.find(e => e.id === a.estruturaId)?.nome ?? t('ativos.pessoaFisica')}`;
    if (a.beneficiarioId) { const m = membros.find(x => x.id === a.beneficiarioId); if (m) return `👤 ${m.nome}`; }
    return t('ativos.pessoaFisica');
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ ...FORM_VAZIO, tipoId: tipos[0]?.id ?? 0, moedaCodigo: moedas[0]?.codigo ?? 'BRL' });
    setErroForm(null);
    setModalVisivel(true);
  }

  function abrirEdicao(a: AtivoResumoDto) {
    setEditando(a);
    setForm({
      nome:               a.nome,
      tipoId:             a.tipo,
      moedaCodigo:        a.moeda,
      valorAtual:         moedaParaInput(a.valorAtual),
      valorizacaoAnualPct: a.valorizacaoAnualPct != null ? a.valorizacaoAnualPct.toString() : '',
      receitaMensal:      a.receitaMensal ? moedaParaInput(a.receitaMensal) : '',
      despesaMensal:      a.despesaMensal ? moedaParaInput(a.despesaMensal) : '',
      estruturaId:        a.estruturaId ?? null,
      beneficiarioId:     a.beneficiarioId ?? null,
    });
    setErroForm(null);
    setModalVisivel(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErroForm(t('ativos.erroNome')); return; }
    const valor = parseMoeda(form.valorAtual);
    if (isNaN(valor) || valor < 0) { setErroForm(t('ativos.erroValor')); return; }

    const payload = {
      nome:               form.nome.trim(),
      tipo:               form.tipoId,
      moeda:              form.moedaCodigo,
      valorAtual:         valor,
      valorizacaoAnualPct: form.valorizacaoAnualPct
        ? parseFloat(form.valorizacaoAnualPct.replace(',', '.'))
        : null,
      receitaMensal: form.receitaMensal ? parseMoeda(form.receitaMensal) : 0,
      despesaMensal: form.despesaMensal ? parseMoeda(form.despesaMensal) : 0,
      estruturaId:   form.estruturaId,
      beneficiarioId: form.beneficiarioId,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        await patrimonioService.atualizarAtivo(editando.id, payload);
      } else {
        await patrimonioService.criarAtivo(payload);
      }
      setModalVisivel(false);
      await load();
    } catch {
      setErroForm(t('ativos.erroSalvar'));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(a: AtivoResumoDto) {
    Alert.alert(t('common.remover'), t('ativos.removerConfirma', { nome: a.nome }), [
      { text: t('common.cancelar'), style: 'cancel' },
      {
        text: t('common.remover'), style: 'destructive',
        onPress: async () => {
          try {
            await patrimonioService.deletarAtivo(a.id);
            await load();
          } catch {
            Alert.alert(t('ativos.erroTitulo'), t('ativos.erroRemover'));
          }
        },
      },
    ]);
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const maxRoi = Math.max(1, ...ativos.map(a => a.roiAnualPct ?? 0));
  const roiCategorias = composicao.filter(c => c.roiAnualPct != null);
  const semFluxo = composicao.length - roiCategorias.length;
  const maxRoiCat = Math.max(1, ...roiCategorias.map(c => c.roiAnualPct ?? 0));

  function fluxoBadge(v: number) {
    const cor = v > 0 ? colors.green : v < 0 ? colors.red : colors.textSecondary;
    const label = v > 0 ? `▲ ${t('ativos.fluxoPositivo')}` : v < 0 ? `▼ ${t('ativos.fluxoNegativo')}` : t('ativos.fluxoEstavel');
    return (
      <View style={[s.fluxoBadge, { borderColor: cor + '55', backgroundColor: cor + '18' }]}>
        <Text style={{ color: cor, fontSize: 11, fontWeight: '700' }}>{label}</Text>
      </View>
    );
  }

  function roiBar(pct: number | null, base: number) {
    if (pct == null) return <Text style={s.dash}>—</Text>;
    return (
      <View style={{ alignItems: 'flex-end', width: '100%' }}>
        <Text style={s.roiTxt}>{t('ativos.pctAoAno', { pct: pct.toFixed(2) })}</Text>
        <View style={s.roiBarBg}>
          <View style={[s.roiBarFill, { width: `${Math.min(100, Math.max(0, pct) / base * 100)}%` }]} />
        </View>
      </View>
    );
  }

  // ── Filtros computados ──
  const ativosFiltrados = ativos.filter(a =>
    (filtroTipoId == null || a.tipo === filtroTipoId) &&
    (filtroMoeda  == null || a.moeda === filtroMoeda)
  );
  const DICA_COR: Record<string, string> = { critico: '#ef4444', atencao: '#f59e0b', positivo: '#16a34a' };
  const DICA_ICONE: Record<string, string> = { critico: '🚨', atencao: '⚠️', positivo: '💡' };

  // ── Card lateral: ROI por categoria ──
  const roiCatCard = roiCategorias.length > 0 ? (
    <View style={s.cardBloco}>
      <View style={s.roiCatHeader}>
        <Text style={s.cardTitulo}>{t('ativos.retornoPorCategoria')}</Text>
        <View style={s.contador}><Text style={s.contadorTxt}>{roiCategorias.length}</Text></View>
      </View>
      <Text style={s.cardSub}>{t('ativos.categoriasComFluxo')}</Text>
      {roiCategorias.map(c => (
        <View key={c.categoria} style={{ marginTop: 12 }}>
          <View style={s.roiCatRow}>
            <Text style={s.roiCatNome}>{c.categoria}</Text>
            <Text style={s.roiCatPct}>{t('ativos.pctAoAno', { pct: c.roiAnualPct!.toFixed(2) })}</Text>
          </View>
          <View style={s.roiBarBg}>
            <View style={[s.roiBarFill, { width: `${Math.min(100, Math.max(0, c.roiAnualPct!) / maxRoiCat * 100)}%` }]} />
          </View>
        </View>
      ))}
      {semFluxo > 0 && <Text style={s.semFluxo}>{t('ativos.outrasCategoriasSemFluxo', { n: semFluxo })}</Text>}
    </View>
  ) : null;

  // ── Tabela de bens (desktop) ──
  const bensTabela = (
    <View style={s.cardBloco}>
      <View style={s.roiCatHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.cardTitulo}>{t('ativos.bens')}</Text>
          <View style={s.contador}><Text style={s.contadorTxt}>{ativosFiltrados.length}</Text></View>
        </View>
        {!readOnly && (
          <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
            <Text style={s.btnNovoText}>{t('ativos.novo')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.thead}>
        <Text style={[s.th, { flex: 2.4 }]}>{t('ativos.thBens')}</Text>
        <Text style={[s.th, s.right, { flex: 1.4 }]}>{t('ativos.thValorMercado')}</Text>
        <Text style={[s.th, s.right, { flex: 1.2 }]}>{t('ativos.thReceitaMensal')}</Text>
        <Text style={[s.th, s.right, { flex: 1.2 }]}>{t('ativos.thDespesaMensal')}</Text>
        <Text style={[s.th, s.thCenter, { flex: 1.1 }]}>{t('ativos.thFluxoLiquido')}</Text>
        <Text style={[s.th, s.right, { flex: 1.3 }]}>{t('ativos.thRetornoTotal')}</Text>
        {!readOnly && <Text style={[s.th, s.right, { flex: 1.1 }]}> </Text>}
      </View>

      {ativosFiltrados.map(a => (
        <View key={a.id} style={s.trow}>
          <View style={{ flex: 2.4 }}>
            <Text style={s.cardNome}>{a.nome}</Text>
            <Text style={s.cardTipo}>{tipoLabel(a.tipo)} · {donoLabel(a)}</Text>
          </View>
          <Text style={[s.td, s.right, { flex: 1.4 }]}>{fmtP(a.valorAtual, a.moeda)}</Text>
          <Text style={[s.td, s.right, { flex: 1.2, color: a.receitaMensal > 0 ? colors.green : colors.textTertiary }]}>
            {a.receitaMensal > 0 ? `+ ${fmtP(a.receitaMensal, a.moeda)}` : '—'}
          </Text>
          <Text style={[s.td, s.right, { flex: 1.2, color: a.despesaMensal > 0 ? colors.red : colors.textTertiary }]}>
            {a.despesaMensal > 0 ? `- ${fmtP(a.despesaMensal, a.moeda)}` : '—'}
          </Text>
          <View style={{ flex: 1.1, alignItems: 'center' }}>{fluxoBadge(a.fluxoLiquidoMensal)}</View>
          <View style={{ flex: 1.3 }}>{roiBar(a.roiAnualPct, maxRoi)}</View>
          {!readOnly && (
            <View style={{ flex: 1.1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
              <TouchableOpacity onPress={() => abrirEdicao(a)}><Text style={s.btnEditarText}>{t('common.editar')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmarExclusao(a)}><Text style={s.btnExcluirText}>{t('common.excluir')}</Text></TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  // ── Cards de bens (mobile) ──
  const bensCards = (
    <>
      {ativosFiltrados.map(a => (
        <View key={a.id} style={s.card}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardNome}>{a.nome}</Text>
            <Text style={s.cardTipo}>{tipoLabel(a.tipo)} · {a.moeda} · {donoLabel(a)}</Text>
            {a.fluxoLiquidoMensal !== 0 && (
              <Text style={[s.cardFluxo, { color: a.fluxoLiquidoMensal >= 0 ? colors.green : colors.red }]}>
                {t('ativos.fluxoMes', { valor: `${a.fluxoLiquidoMensal >= 0 ? '+' : ''}${fmtP(a.fluxoLiquidoMensal, a.moeda)}` })}
              </Text>
            )}
            {a.roiAnualPct != null && (
              <Text style={[s.cardVar, { color: a.roiAnualPct >= 0 ? colors.green : colors.red }]}>
                {t('ativos.retornoTotalPct', { pct: `${a.roiAnualPct >= 0 ? '+' : ''}${a.roiAnualPct.toFixed(1)}` })}
              </Text>
            )}
            {(a.yieldAnualPct != null || a.valorizacaoAnualPct != null) && (
              <Text style={s.cardBreakdown}>
                {a.yieldAnualPct != null ? t('ativos.rende', { pct: a.yieldAnualPct.toFixed(1) }) : ''}
                {a.yieldAnualPct != null && a.valorizacaoAnualPct != null ? ' + ' : ''}
                {a.valorizacaoAnualPct != null ? t('ativos.valoriza', { pct: a.valorizacaoAnualPct.toFixed(1) }) : ''}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Text style={s.cardValor}>{fmtP(a.valorAtual, a.moeda)}</Text>
            {!readOnly && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={s.btnEditar} onPress={() => abrirEdicao(a)}>
                  <Text style={s.btnEditarText}>{t('common.editar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnExcluir} onPress={() => confirmarExclusao(a)}>
                  <Text style={s.btnExcluirText}>{t('common.excluir')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {isDesktop && (
          <View style={s.header}>
            <Text style={s.title}>{t('ativos.titulo')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!readOnly && (
                <TouchableOpacity
                  style={[s.btnNovo, { backgroundColor: dicasPainel ? colors.green : colors.surfaceElevated, borderWidth: 1, borderColor: colors.greenBorder }]}
                  onPress={() => {
                    setDicasPainel(p => !p);
                    if (!dicasPainel && dicas.length === 0) carregarDicas();
                  }}>
                  <Text style={{ color: dicasPainel ? '#fff' : colors.green, fontWeight: '700', fontSize: 13 }}>✨ {t('ativos.dicasIA')}</Text>
                </TouchableOpacity>
              )}
              {!readOnly && (
                <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
                  <Text style={s.btnNovoText}>{t('ativos.novo')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        {!isDesktop && (
          <View style={s.header}>
            <Text style={s.title}>{t('ativos.titulo')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!readOnly && (
                <TouchableOpacity
                  style={[s.btnNovo, { backgroundColor: dicasPainel ? colors.green : colors.surfaceElevated, borderWidth: 1, borderColor: colors.greenBorder }]}
                  onPress={() => {
                    setDicasPainel(p => !p);
                    if (!dicasPainel && dicas.length === 0) carregarDicas();
                  }}>
                  <Text style={{ color: dicasPainel ? '#fff' : colors.green, fontWeight: '700', fontSize: 13 }}>✨ {t('ativos.dicas')}</Text>
                </TouchableOpacity>
              )}
              {!readOnly && (
                <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
                  <Text style={s.btnNovoText}>{t('ativos.novo')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Painel de Dicas IA ── */}
        {dicasPainel && (
          <View style={s.dicasPainel}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.dicasTitulo}>✨ {t('ativos.analiseSeuPatrimonio')}</Text>
              <TouchableOpacity onPress={() => setDicasPainel(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {dicasLoading && <ActivityIndicator color={colors.green} style={{ marginVertical: 20 }} />}
            {!dicasLoading && dicas.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{t('ativos.dicasVazio')}</Text>
              </View>
            )}
            {dicas.map((d, i) => {
              const cor = DICA_COR[d.tipo] ?? colors.green;
              return (
                <View key={i} style={[s.dicaCard, { borderLeftColor: cor }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 16 }}>{DICA_ICONE[d.tipo]}</Text>
                    <Text style={[s.dicaTitulo, { color: cor }]}>{d.titulo}</Text>
                  </View>
                  <Text style={s.dicaDesc}>{d.descricao}</Text>
                  {d.dicaEducativa && (
                    <View style={s.dicaEduBox}>
                      <Text style={s.dicaEduTxt}>📚 {d.dicaEducativa}</Text>
                    </View>
                  )}
                </View>
              );
            })}
            {!dicasLoading && dicas.length > 0 && (
              <TouchableOpacity style={[s.btnNovo, { alignSelf: 'flex-end', marginTop: 8 }]} onPress={carregarDicas}>
                <Text style={s.btnNovoText}>{t('ativos.atualizarAnalise')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Filtros ── */}
        {ativos.length > 0 && (
          <View style={s.filtrosBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[s.filtroChip, filtroTipoId == null && filtroMoeda == null && s.filtroChipAtivo]}
                  onPress={() => { setFiltroTipoId(null); setFiltroMoeda(null); }}>
                  <Text style={[s.filtroTxt, filtroTipoId == null && filtroMoeda == null && { color: colors.green }]}>{t('common.todos')} ({ativos.length})</Text>
                </TouchableOpacity>
                {tipos.filter(t => ativos.some(a => a.tipo === t.id)).map(t => (
                  <TouchableOpacity key={t.id}
                    style={[s.filtroChip, filtroTipoId === t.id && s.filtroChipAtivo]}
                    onPress={() => setFiltroTipoId(filtroTipoId === t.id ? null : t.id)}>
                    <Text style={[s.filtroTxt, filtroTipoId === t.id && { color: colors.green }]}>
                      {t.icone ? `${t.icone} ` : ''}{t.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
                {[...new Set(ativos.map(a => a.moeda))].filter(m => m !== 'BRL').map(m => (
                  <TouchableOpacity key={m}
                    style={[s.filtroChip, filtroMoeda === m && s.filtroChipAtivo]}
                    onPress={() => setFiltroMoeda(filtroMoeda === m ? null : m)}>
                    <Text style={[s.filtroTxt, filtroMoeda === m && { color: colors.green }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {erro && <Text style={s.erro}>{erro}</Text>}

        {ativos.length === 0 ? (
          <View style={s.vazio}>
            <Text style={s.vazioIcon}>🏛️</Text>
            <Text style={s.vazioText}>{t('ativos.vazioTitulo')}</Text>
            <Text style={s.vazioSub}>
              {readOnly ? t('ativos.vazioReadOnly') : t('ativos.vazioSub')}
            </Text>
          </View>
        ) : isDesktop ? (
          <View style={s.cols}>
            <View style={{ flex: 1 }}>{bensTabela}</View>
            <View style={{ width: 320 }}>{roiCatCard}</View>
          </View>
        ) : (
          <>
            {bensCards}
            {roiCatCard}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={() => setModalVisivel(false)}>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.modalTitulo}>{editando ? t('ativos.editarAtivo') : t('ativos.novoAtivo')}</Text>

            <Text style={s.label}>{t('ativos.labelNome')}</Text>
            <TextInput style={s.input} value={form.nome} onChangeText={v => setForm(f => ({ ...f, nome: v }))}
              placeholder={t('ativos.phNome')} placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>{t('ativos.labelTipo')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {tipos.map(t => (
                  <TouchableOpacity key={t.id} style={[s.chip, form.tipoId === t.id && s.chipAtivo]}
                    onPress={() => setForm(f => ({ ...f, tipoId: t.id }))}>
                    <Text style={[s.chipText, form.tipoId === t.id && s.chipTextAtivo]}>
                      {t.icone ? `${t.icone} ` : ''}{t.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.label}>{t('ativos.labelMoeda')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {moedas.map(m => (
                <TouchableOpacity key={m.id} style={[s.chip, form.moedaCodigo === m.codigo && s.chipAtivo]}
                  onPress={() => setForm(f => ({ ...f, moedaCodigo: m.codigo }))}>
                  <Text style={[s.chipText, form.moedaCodigo === m.codigo && s.chipTextAtivo]}>{m.codigo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {(estruturas.length > 0 || membros.length > 0) && (
              <>
                <Text style={s.label}>{t('ativos.labelPertenceA')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <TouchableOpacity style={[s.chip, form.estruturaId === null && form.beneficiarioId === null && s.chipAtivo]}
                    onPress={() => setForm(f => ({ ...f, estruturaId: null, beneficiarioId: null }))}>
                    <Text style={[s.chipText, form.estruturaId === null && form.beneficiarioId === null && s.chipTextAtivo]}>{t('ativos.pessoaFisica')}</Text>
                  </TouchableOpacity>
                  {membros.map(b => (
                    <TouchableOpacity key={b.id} style={[s.chip, form.beneficiarioId === b.id && s.chipAtivo]}
                      onPress={() => setForm(f => ({ ...f, beneficiarioId: b.id, estruturaId: null }))}>
                      <Text style={[s.chipText, form.beneficiarioId === b.id && s.chipTextAtivo]}>👤 {b.nome}</Text>
                    </TouchableOpacity>
                  ))}
                  {estruturas.map(e => (
                    <TouchableOpacity key={e.id} style={[s.chip, form.estruturaId === e.id && s.chipAtivo]}
                      onPress={() => setForm(f => ({ ...f, estruturaId: e.id, beneficiarioId: null }))}>
                      <Text style={[s.chipText, form.estruturaId === e.id && s.chipTextAtivo]}>{e.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={s.label}>{t('ativos.labelValorAtual')}</Text>
            <TextInput style={s.input} value={form.valorAtual} onChangeText={v => setForm(f => ({ ...f, valorAtual: maskMoeda(v) }))}
              placeholder={t('ativos.phValorAtual')} placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>{t('ativos.labelValorizacao')}</Text>
            <TextInput style={s.input} value={form.valorizacaoAnualPct}
              onChangeText={v => setForm(f => ({ ...f, valorizacaoAnualPct: v }))}
              placeholder={t('ativos.phValorizacao')} placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numbers-and-punctuation" />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('ativos.labelReceita')}</Text>
                <TextInput style={s.input} value={form.receitaMensal}
                  onChangeText={v => setForm(f => ({ ...f, receitaMensal: maskMoeda(v) }))}
                  placeholder={t('ativos.phReceita')} placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('ativos.labelDespesa')}</Text>
                <TextInput style={s.input} value={form.despesaMensal}
                  onChangeText={v => setForm(f => ({ ...f, despesaMensal: maskMoeda(v) }))}
                  placeholder={t('ativos.phDespesa')} placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />
              </View>
            </View>

            {erroForm && <Text style={s.erro}>{erroForm}</Text>}

            {editando && (
              <DocumentosPanel alvo={AlvoDocumento.Ativo} alvoId={editando.id} />
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setModalVisivel(false)}>
                <Text style={s.btnCancelarText}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnSalvar]} onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarText}>{editando ? t('common.salvar') : t('common.adicionar')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: c.background, padding: 16 },
  center:          { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:           { color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo:         { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  erro:            { color: c.red, fontSize: 14, marginBottom: 12 },
  vazio:           { alignItems: 'center', marginTop: 60 },
  vazioIcon:       { fontSize: 48, marginBottom: 12 },
  vazioText:       { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:        { color: c.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  // filtros
  filtrosBar:      { marginBottom: 14 },
  filtroChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  filtroChipAtivo: { borderColor: c.greenBorder, backgroundColor: c.greenDim },
  filtroTxt:       { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  // dicas
  dicasPainel:     { backgroundColor: c.surface, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  dicasTitulo:     { color: c.text, fontSize: 16, fontWeight: '800' },
  dicaCard:        { borderLeftWidth: 4, borderRadius: 8, backgroundColor: c.surfaceElevated, padding: 14, marginBottom: 10 },
  dicaTitulo:      { fontSize: 14, fontWeight: '800', flex: 1 },
  dicaDesc:        { color: c.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 6 },
  dicaEduBox:      { backgroundColor: c.background, borderRadius: 8, padding: 10, marginTop: 4 },
  dicaEduTxt:      { color: c.textSecondary, fontSize: 12, fontStyle: 'italic', lineHeight: 17 },
  card:            { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  cardBloco:       { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  cardTitulo:      { color: c.text, fontSize: 16, fontWeight: '800' },
  cardSub:         { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  cols:            { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  roiCatHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contador:        { backgroundColor: c.surfaceElevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  contadorTxt:     { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
  roiCatRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  roiCatNome:      { color: c.text, fontSize: 13, fontWeight: '600' },
  roiCatPct:       { color: '#f97316', fontSize: 13, fontWeight: '800' },
  semFluxo:        { color: c.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 14 },
  thead:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border, marginTop: 12 },
  th:              { color: c.textTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  right:           { textAlign: 'right' },
  thCenter:        { textAlign: 'center' },
  trow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, gap: 6 },
  td:              { color: c.text, fontSize: 13 },
  dash:            { color: c.textTertiary, fontSize: 13, textAlign: 'right' },
  roiTxt:          { color: '#f97316', fontSize: 12, fontWeight: '800' },
  roiBarBg:        { height: 4, borderRadius: 2, backgroundColor: c.border, width: '100%', marginTop: 4, overflow: 'hidden' },
  roiBarFill:      { height: 4, borderRadius: 2, backgroundColor: '#f97316' },
  fluxoBadge:      { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  cardNome:        { color: c.text, fontSize: 15, fontWeight: '700' },
  cardTipo:        { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  cardVar:         { fontSize: 12, fontWeight: '700', marginTop: 2 },
  cardBreakdown:   { fontSize: 11, color: c.textTertiary, marginTop: 1 },
  cardFluxo:       { fontSize: 12, fontWeight: '600', marginTop: 2 },
  cardValor:       { color: c.text, fontSize: 15, fontWeight: '700' },
  btnEditar:       { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnEditarText:   { color: c.blue, fontSize: 13, fontWeight: '600' },
  btnExcluir:      { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnExcluirText:  { color: c.red, fontSize: 13, fontWeight: '600' },
  modalOverlay:    { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitulo:     { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:           { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input:           { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 12 },
  chip:            { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  chipAtivo:       { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipText:        { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextAtivo:   { color: c.green },
  btnModal:        { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar:     { backgroundColor: c.surfaceElevated },
  btnCancelarText: { color: c.textSecondary, fontWeight: '700' },
  btnSalvar:       { backgroundColor: c.green },
  btnSalvarText:   { color: '#fff', fontWeight: '700' },
});
