import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert, useWindowDimensions,
} from 'react-native';
import { patrimonioService, AtivoResumoDto, CategoriaComposicaoDto, parametrosService, ParamItemDto, MoedaParamDto, DicaFinanceiraDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { useAssessoria } from '../contexts/AssessoriaContext';

const MOEDA_SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: 'EUR', CHF: 'CHF', GBP: 'GBP' };

function fmt(valor: number, moeda = 'BRL'): string {
  const sym = MOEDA_SIMBOLO[moeda] ?? '';
  return `${sym} ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface FormState {
  nome: string;
  tipoId: number;
  moedaCodigo: string;
  valorAtual: string;
  valorizacaoAnualPct: string;
  receitaMensal: string;
  despesaMensal: string;
}

const FORM_VAZIO: FormState = {
  nome: '', tipoId: 0, moedaCodigo: 'BRL', valorAtual: '', valorizacaoAnualPct: '',
  receitaMensal: '', despesaMensal: '',
};

export default function AtivosScreen() {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const fmtP = (v: number, moeda = 'BRL') => formatMoney(v, ocultar, moeda);

  const [ativos,     setAtivos]     = useState<AtivoResumoDto[]>([]);
  const [composicao, setComposicao] = useState<CategoriaComposicaoDto[]>([]);
  const [tipos,      setTipos]      = useState<ParamItemDto[]>([]);
  const [moedas,     setMoedas]     = useState<MoedaParamDto[]>([]);
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
      const [resumo, tiposData, moedasData] = await Promise.all([
        patrimonioService.resumo(),
        parametrosService.tiposAtivo(),
        parametrosService.moedas(),
      ]);
      setAtivos([...resumo.ativos]);
      setComposicao([...resumo.composicao]);
      setTipos(tiposData.filter(t => t.ativo));
      setMoedas(moedasData.filter(m => m.ativo));
    } catch {
      setErro('Nao foi possivel carregar os ativos.');
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
    const t = tipos.find(x => x.id === tipoId);
    return t ? `${t.icone ?? ''} ${t.nome}`.trim() : String(tipoId);
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
      valorAtual:         a.valorAtual.toString(),
      valorizacaoAnualPct: a.valorizacaoAnualPct != null ? a.valorizacaoAnualPct.toString() : '',
      receitaMensal:      a.receitaMensal ? a.receitaMensal.toString() : '',
      despesaMensal:      a.despesaMensal ? a.despesaMensal.toString() : '',
    });
    setErroForm(null);
    setModalVisivel(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErroForm('Informe o nome.'); return; }
    const valor = parseFloat(form.valorAtual.replace(',', '.'));
    if (isNaN(valor) || valor < 0) { setErroForm('Valor atual invalido.'); return; }

    const payload = {
      nome:               form.nome.trim(),
      tipo:               form.tipoId,
      moeda:              form.moedaCodigo,
      valorAtual:         valor,
      valorizacaoAnualPct: form.valorizacaoAnualPct
        ? parseFloat(form.valorizacaoAnualPct.replace(',', '.'))
        : null,
      receitaMensal: form.receitaMensal ? parseFloat(form.receitaMensal.replace(',', '.')) : 0,
      despesaMensal: form.despesaMensal ? parseFloat(form.despesaMensal.replace(',', '.')) : 0,
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
      setErroForm('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(a: AtivoResumoDto) {
    Alert.alert('Remover', `Deseja remover "${a.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try {
            await patrimonioService.deletarAtivo(a.id);
            await load();
          } catch {
            Alert.alert('Erro', 'Nao foi possivel remover.');
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
    const label = v > 0 ? '▲ Positivo' : v < 0 ? '▼ Negativo' : 'Estável';
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
        <Text style={s.roiTxt}>{pct.toFixed(2)}% a.a.</Text>
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
        <Text style={s.cardTitulo}>ROI por categoria</Text>
        <View style={s.contador}><Text style={s.contadorTxt}>{roiCategorias.length}</Text></View>
      </View>
      <Text style={s.cardSub}>Categorias com fluxo de caixa</Text>
      {roiCategorias.map(c => (
        <View key={c.categoria} style={{ marginTop: 12 }}>
          <View style={s.roiCatRow}>
            <Text style={s.roiCatNome}>{c.categoria}</Text>
            <Text style={s.roiCatPct}>{c.roiAnualPct!.toFixed(2)}% a.a.</Text>
          </View>
          <View style={s.roiBarBg}>
            <View style={[s.roiBarFill, { width: `${Math.min(100, Math.max(0, c.roiAnualPct!) / maxRoiCat * 100)}%` }]} />
          </View>
        </View>
      ))}
      {semFluxo > 0 && <Text style={s.semFluxo}>Outras {semFluxo} categoria(s) sem dados de fluxo</Text>}
    </View>
  ) : null;

  // ── Tabela de bens (desktop) ──
  const bensTabela = (
    <View style={s.cardBloco}>
      <View style={s.roiCatHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.cardTitulo}>Bens</Text>
          <View style={s.contador}><Text style={s.contadorTxt}>{ativosFiltrados.length}</Text></View>
        </View>
        {!readOnly && (
          <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
            <Text style={s.btnNovoText}>+ Novo</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.thead}>
        <Text style={[s.th, { flex: 2.4 }]}>BENS</Text>
        <Text style={[s.th, s.right, { flex: 1.4 }]}>VALOR DE MERCADO</Text>
        <Text style={[s.th, s.right, { flex: 1.2 }]}>RECEITA MENSAL</Text>
        <Text style={[s.th, s.right, { flex: 1.2 }]}>DESPESA MENSAL</Text>
        <Text style={[s.th, s.thCenter, { flex: 1.1 }]}>FLUXO LÍQUIDO</Text>
        <Text style={[s.th, s.right, { flex: 1.3 }]}>ROI ANUAL</Text>
        {!readOnly && <Text style={[s.th, s.right, { flex: 1.1 }]}> </Text>}
      </View>

      {ativosFiltrados.map(a => (
        <View key={a.id} style={s.trow}>
          <View style={{ flex: 2.4 }}>
            <Text style={s.cardNome}>{a.nome}</Text>
            <Text style={s.cardTipo}>{tipoLabel(a.tipo)}</Text>
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
              <TouchableOpacity onPress={() => abrirEdicao(a)}><Text style={s.btnEditarText}>Editar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmarExclusao(a)}><Text style={s.btnExcluirText}>Excluir</Text></TouchableOpacity>
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
            <Text style={s.cardTipo}>{tipoLabel(a.tipo)} · {a.moeda}</Text>
            {a.fluxoLiquidoMensal !== 0 && (
              <Text style={[s.cardFluxo, { color: a.fluxoLiquidoMensal >= 0 ? colors.green : colors.red }]}>
                fluxo {a.fluxoLiquidoMensal >= 0 ? '+' : ''}{fmtP(a.fluxoLiquidoMensal, a.moeda)}/mês
              </Text>
            )}
            {a.roiAnualPct != null && (
              <Text style={[s.cardVar, { color: a.roiAnualPct >= 0 ? colors.green : colors.red }]}>
                ROI {a.roiAnualPct >= 0 ? '+' : ''}{a.roiAnualPct.toFixed(1)}% a.a.
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Text style={s.cardValor}>{fmtP(a.valorAtual, a.moeda)}</Text>
            {!readOnly && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={s.btnEditar} onPress={() => abrirEdicao(a)}>
                  <Text style={s.btnEditarText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnExcluir} onPress={() => confirmarExclusao(a)}>
                  <Text style={s.btnExcluirText}>Excluir</Text>
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
            <Text style={s.title}>Ativos patrimoniais</Text>
            {!readOnly && (
              <TouchableOpacity
                style={[s.btnNovo, { backgroundColor: dicasPainel ? colors.green : colors.surfaceElevated, borderWidth: 1, borderColor: colors.greenBorder }]}
                onPress={() => {
                  setDicasPainel(p => !p);
                  if (!dicasPainel && dicas.length === 0) carregarDicas();
                }}>
                <Text style={{ color: dicasPainel ? '#fff' : colors.green, fontWeight: '700', fontSize: 13 }}>✨ Dicas IA</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!isDesktop && (
          <View style={s.header}>
            <Text style={s.title}>Ativos patrimoniais</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {!readOnly && (
                <TouchableOpacity
                  style={[s.btnNovo, { backgroundColor: dicasPainel ? colors.green : colors.surfaceElevated, borderWidth: 1, borderColor: colors.greenBorder }]}
                  onPress={() => {
                    setDicasPainel(p => !p);
                    if (!dicasPainel && dicas.length === 0) carregarDicas();
                  }}>
                  <Text style={{ color: dicasPainel ? '#fff' : colors.green, fontWeight: '700', fontSize: 13 }}>✨ Dicas</Text>
                </TouchableOpacity>
              )}
              {!readOnly && (
                <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
                  <Text style={s.btnNovoText}>+ Novo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Painel de Dicas IA ── */}
        {dicasPainel && (
          <View style={s.dicasPainel}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.dicasTitulo}>✨ Análise do seu patrimônio</Text>
              <TouchableOpacity onPress={() => setDicasPainel(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {dicasLoading && <ActivityIndicator color={colors.green} style={{ marginVertical: 20 }} />}
            {!dicasLoading && dicas.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Cadastre bens e dívidas para receber análise personalizada.</Text>
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
                <Text style={s.btnNovoText}>Atualizar análise</Text>
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
                  <Text style={[s.filtroTxt, filtroTipoId == null && filtroMoeda == null && { color: colors.green }]}>Todos ({ativos.length})</Text>
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
            <Text style={s.vazioText}>Nenhum ativo cadastrado.</Text>
            <Text style={s.vazioSub}>
              {readOnly ? 'Este cliente ainda nao cadastrou ativos.' : 'Toque em "+ Novo" para adicionar o primeiro.'}
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
            <Text style={s.modalTitulo}>{editando ? 'Editar ativo' : 'Novo ativo'}</Text>

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={form.nome} onChangeText={v => setForm(f => ({ ...f, nome: v }))}
              placeholder="Ex: Apartamento SP" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Tipo *</Text>
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

            <Text style={s.label}>Moeda *</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {moedas.map(m => (
                <TouchableOpacity key={m.id} style={[s.chip, form.moedaCodigo === m.codigo && s.chipAtivo]}
                  onPress={() => setForm(f => ({ ...f, moedaCodigo: m.codigo }))}>
                  <Text style={[s.chipText, form.moedaCodigo === m.codigo && s.chipTextAtivo]}>{m.codigo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Valor atual *</Text>
            <TextInput style={s.input} value={form.valorAtual} onChangeText={v => setForm(f => ({ ...f, valorAtual: v }))}
              placeholder="Ex: 1500000" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Valorizacao anual % (opcional)</Text>
            <TextInput style={s.input} value={form.valorizacaoAnualPct}
              onChangeText={v => setForm(f => ({ ...f, valorizacaoAnualPct: v }))}
              placeholder="Ex: 8 ou -5" placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numbers-and-punctuation" />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Receita mensal (opcional)</Text>
                <TextInput style={s.input} value={form.receitaMensal}
                  onChangeText={v => setForm(f => ({ ...f, receitaMensal: v }))}
                  placeholder="Ex: aluguel" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Despesa mensal (opcional)</Text>
                <TextInput style={s.input} value={form.despesaMensal}
                  onChangeText={v => setForm(f => ({ ...f, despesaMensal: v }))}
                  placeholder="Ex: condomínio" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />
              </View>
            </View>

            {erroForm && <Text style={s.erro}>{erroForm}</Text>}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setModalVisivel(false)}>
                <Text style={s.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnSalvar]} onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarText}>{editando ? 'Salvar' : 'Adicionar'}</Text>}
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
