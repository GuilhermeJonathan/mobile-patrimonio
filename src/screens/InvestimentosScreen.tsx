import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert,
} from 'react-native';
import { investimentosService, InvestimentoDto, ResumoInvestimentosDto, parametrosService, ParamItemDto, MoedaParamDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { numBR, maskMoeda, moedaParaInput, parseMoeda } from '../utils/format';

const MOEDA_SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: 'EUR', CHF: 'CHF', GBP: 'GBP' };

function fmt(v: number, moeda = 'BRL') {
  return `${MOEDA_SIMBOLO[moeda] ?? ''} ${numBR(v, 2)}`;
}

interface FormState {
  nome: string; tipoId: number; moedaCodigo: string; corretora: string;
  ticker: string; valorAplicado: string; valorAtual: string; rentabilidadeAnualPct: string;
}
const VAZIO: FormState = {
  nome: '', tipoId: 0, moedaCodigo: 'BRL', corretora: '',
  ticker: '', valorAplicado: '', valorAtual: '', rentabilidadeAnualPct: '',
};

// Paleta de cores para classes/corretoras
const PALETTE = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6'];
function paletteColor(idx: number) { return PALETTE[idx % PALETTE.length]; }

export default function InvestimentosScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = false; // no view-as, assessor/corretor pode editar patrimônio

  const [dados,      setDados]      = useState<ResumoInvestimentosDto | null>(null);
  const [tipos,      setTipos]      = useState<ParamItemDto[]>([]);
  const [moedas,     setMoedas]     = useState<MoedaParamDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro,       setErro]       = useState<string | null>(null);

  // filtros / agrupamento
  const [filtroTipo,     setFiltroTipo]     = useState<number | null>(null);
  const [agruparPor,     setAgruparPor]     = useState<'corretora' | 'tipo'>('corretora');
  const [gruposAbertos,  setGruposAbertos]  = useState<Record<string, boolean>>({});

  // modal
  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando,     setEditando]     = useState<InvestimentoDto | null>(null);
  const [form,         setForm]         = useState<FormState>(VAZIO);
  const [salvando,     setSalvando]     = useState(false);
  const [erroForm,     setErroForm]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [resumo, tiposData, moedasData] = await Promise.all([
        investimentosService.resumo(),
        parametrosService.tiposInvestimento(),
        parametrosService.moedas(),
      ]);
      setDados(resumo);
      setTipos(tiposData.filter(t => t.ativo));
      setMoedas(moedasData.filter(m => m.ativo));
    } catch {
      setErro('Nao foi possivel carregar os investimentos.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function tipoLabel(tipoId: number): string {
    const t = tipos.find(x => x.id === tipoId);
    return t ? `${t.icone ?? ''} ${t.nome}`.trim() : String(tipoId);
  }

  function toggleGrupo(key: string) {
    setGruposAbertos(g => ({ ...g, [key]: !g[key] }));
  }

  function abrirNovo() {
    setEditando(null);
    setForm({ ...VAZIO, tipoId: tipos[0]?.id ?? 0, moedaCodigo: moedas[0]?.codigo ?? 'BRL' });
    setErroForm(null);
    setModalVisivel(true);
  }

  function abrirEdicao(inv: InvestimentoDto) {
    setEditando(inv);
    setForm({
      nome: inv.nome, tipoId: inv.tipo, moedaCodigo: inv.moeda,
      corretora: inv.corretora ?? '', ticker: inv.ticker ?? '',
      valorAplicado: moedaParaInput(inv.valorAplicado), valorAtual: moedaParaInput(inv.valorAtual),
      rentabilidadeAnualPct: inv.rentabilidadeAnualPct != null ? inv.rentabilidadeAnualPct.toString() : '',
    });
    setErroForm(null);
    setModalVisivel(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErroForm('Informe o nome.'); return; }
    const aplicado = parseMoeda(form.valorAplicado);
    const atual    = parseMoeda(form.valorAtual);
    if (isNaN(aplicado) || aplicado < 0) { setErroForm('Valor aplicado invalido.'); return; }
    if (isNaN(atual)    || atual    < 0) { setErroForm('Valor atual invalido.');    return; }
    const payload = {
      nome: form.nome.trim(), tipo: form.tipoId, moeda: form.moedaCodigo,
      corretora: form.corretora.trim() || null, ticker: form.ticker.trim().toUpperCase() || null,
      valorAplicado: aplicado, valorAtual: atual,
      rentabilidadeAnualPct: form.rentabilidadeAnualPct ? parseFloat(form.rentabilidadeAnualPct.replace(',', '.')) : null,
    };
    setSalvando(true); setErroForm(null);
    try {
      if (editando) await investimentosService.atualizar(editando.id, payload);
      else          await investimentosService.criar(payload);
      setModalVisivel(false);
      await load();
    } catch { setErroForm('Erro ao salvar. Tente novamente.'); }
    finally { setSalvando(false); }
  }

  async function confirmarExclusao(inv: InvestimentoDto) {
    Alert.alert('Remover', `Deseja remover "${inv.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await investimentosService.deletar(inv.id); await load(); }
        catch { Alert.alert('Erro', 'Nao foi possivel remover.'); }
      }},
    ]);
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const lista = dados?.investimentos ?? [];
  const listaFiltrada = filtroTipo != null ? lista.filter(i => i.tipo === filtroTipo) : lista;

  // AlocaÃ§Ã£o por tipo (% do total atual)
  const totalAtual = lista.reduce((a, i) => a + i.valorAtual, 0);
  const alocPorTipo = tipos
    .map(t => {
      const total = lista.filter(i => i.tipo === t.id).reduce((a, i) => a + i.valorAtual, 0);
      return { id: t.id, label: `${t.icone ?? ''} ${t.nome}`.trim(), total, pct: totalAtual > 0 ? total / totalAtual * 100 : 0 };
    })
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);

  // AlocaÃ§Ã£o por corretora
  const corretoras = [...new Set(lista.map(i => i.corretora ?? 'Sem corretora'))];
  const alocPorCorretora = corretoras
    .map(c => {
      const total = lista.filter(i => (i.corretora ?? 'Sem corretora') === c).reduce((a, i) => a + i.valorAtual, 0);
      return { label: c, total, pct: totalAtual > 0 ? total / totalAtual * 100 : 0 };
    })
    .sort((a, b) => b.total - a.total);

  // Agrupamento da lista
  type Grupo = { key: string; label: string; itens: InvestimentoDto[]; total: number };
  const grupos: Grupo[] = agruparPor === 'corretora'
    ? corretoras.map(c => ({
        key: c, label: c,
        itens: listaFiltrada.filter(i => (i.corretora ?? 'Sem corretora') === c),
        total: listaFiltrada.filter(i => (i.corretora ?? 'Sem corretora') === c).reduce((a, i) => a + i.valorAtual, 0),
      })).filter(g => g.itens.length > 0)
    : tipos
        .filter(t => listaFiltrada.some(i => i.tipo === t.id))
        .map(t => ({
          key: String(t.id), label: `${t.icone ?? ''} ${t.nome}`.trim(),
          itens: listaFiltrada.filter(i => i.tipo === t.id),
          total: listaFiltrada.filter(i => i.tipo === t.id).reduce((a, i) => a + i.valorAtual, 0),
        }));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* â”€â”€ Header â”€â”€ */}
        <View style={s.header}>
          <Text style={s.title}>Portfolio</Text>
          {!readOnly && (
            <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
              <Text style={s.btnNovoText}>+ Novo</Text>
            </TouchableOpacity>
          )}
        </View>

        {erro && <Text style={s.erro}>{erro}</Text>}

        {/* â”€â”€ Card principal â”€â”€ */}
        {dados && (
          <View style={s.heroCard}>
            <Text style={s.heroLabel}>PATRIMONIO TOTAL INVESTIDO</Text>
            <Text style={s.heroValor}>{fmt(dados.totalAtualBRL)}</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              <Text style={s.heroMeta}>{lista.length} ativo{lista.length !== 1 ? 's' : ''}</Text>
              <Text style={s.heroMeta}>{alocPorCorretora.length} instituicao{alocPorCorretora.length !== 1 ? 'es' : ''}</Text>
              <Text style={s.heroMeta}>{alocPorTipo.length} classe{alocPorTipo.length !== 1 ? 's' : ''}</Text>
            </View>
            {dados.rentabilidadePct != null && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <Text style={[s.rentBadge, { backgroundColor: (dados.rentabilidadePct >= 0 ? colors.green : colors.red) + '22',
                  color: dados.rentabilidadePct >= 0 ? colors.green : colors.red }]}>
                  {dados.rentabilidadePct >= 0 ? '+' : ''}{dados.rentabilidadePct.toFixed(2)}%
                </Text>
                <Text style={s.heroMeta}>aplicado {fmt(dados.totalAplicadoBRL)}</Text>
              </View>
            )}
          </View>
        )}

        {/* â”€â”€ AlocaÃ§Ã£o por classe + por corretora â”€â”€ */}
        {lista.length > 0 && (
          <View style={s.alocRow}>
            {/* Por classe */}
            <View style={[s.alocCard, { flex: 1 }]}>
              <Text style={s.alocTitulo}>Por classe</Text>
              {alocPorTipo.map((a, i) => (
                <View key={a.id} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={s.alocLabel} numberOfLines={1}>{a.label}</Text>
                    <Text style={[s.alocPct, { color: paletteColor(i) }]}>{a.pct.toFixed(0)}%</Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFg, { width: `${a.pct}%` as any, backgroundColor: paletteColor(i) }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Por corretora */}
            <View style={[s.alocCard, { flex: 1 }]}>
              <Text style={s.alocTitulo}>Por custodiante</Text>
              {alocPorCorretora.map((a, i) => (
                <View key={a.label} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                    <Text style={s.alocLabel} numberOfLines={1}>{a.label}</Text>
                    <Text style={[s.alocPct, { color: paletteColor(i) }]}>{a.pct.toFixed(0)}%</Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFg, { width: `${a.pct}%` as any, backgroundColor: paletteColor(i) }]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* â”€â”€ Controles de lista â”€â”€ */}
        {lista.length > 0 && (
          <View style={s.controlesRow}>
            {/* Agrupamento */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[s.toggleBtn, agruparPor === 'corretora' && s.toggleBtnAtivo]}
                onPress={() => setAgruparPor('corretora')}>
                <Text style={[s.toggleTxt, agruparPor === 'corretora' && { color: colors.green }]}>Por banco</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, agruparPor === 'tipo' && s.toggleBtnAtivo]}
                onPress={() => setAgruparPor('tipo')}>
                <Text style={[s.toggleTxt, agruparPor === 'tipo' && { color: colors.green }]}>Por classe</Text>
              </TouchableOpacity>
            </View>

            {/* Filtro por tipo */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[s.filtroChip, filtroTipo == null && s.filtroChipAtivo]}
                  onPress={() => setFiltroTipo(null)}>
                  <Text style={[s.filtroTxt, filtroTipo == null && { color: colors.green }]}>Todas</Text>
                </TouchableOpacity>
                {alocPorTipo.map((a, i) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[s.filtroChip, filtroTipo === a.id && s.filtroChipAtivo, { borderColor: paletteColor(i) + '60' }]}
                    onPress={() => setFiltroTipo(filtroTipo === a.id ? null : a.id)}>
                    <View style={[s.filtroCircle, { backgroundColor: paletteColor(i) }]} />
                    <Text style={[s.filtroTxt, filtroTipo === a.id && { color: paletteColor(i) }]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* â”€â”€ Lista agrupada â”€â”€ */}
        {lista.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIcon}>ðŸ“ˆ</Text>
            <Text style={s.vazioText}>Nenhum investimento cadastrado.</Text>
            <Text style={s.vazioSub}>{readOnly ? 'Este cliente ainda nao cadastrou investimentos.' : 'Toque em "+ Novo" para adicionar.'}</Text>
          </View>
        )}

        {grupos.map((grupo, gi) => {
          const aberto = gruposAbertos[grupo.key] !== false; // default aberto
          const pctTotal = totalAtual > 0 ? grupo.total / totalAtual * 100 : 0;
          return (
            <View key={grupo.key} style={s.grupoCard}>
              <TouchableOpacity style={s.grupoHeader} onPress={() => toggleGrupo(grupo.key)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.grupoNome}>{grupo.label}</Text>
                  <Text style={s.grupoMeta}>{grupo.itens.length} ativo{grupo.itens.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.grupoTotal}>{fmt(grupo.total)}</Text>
                  <Text style={[s.grupoPct, { color: paletteColor(gi) }]}>{pctTotal.toFixed(1)}% do total</Text>
                </View>
                <Text style={s.chevron}>{aberto ? '\u25be' : '\u25b8'}</Text>
              </TouchableOpacity>

              {aberto && grupo.itens.map(inv => {
                const rendimento = inv.valorAtual - inv.valorAplicado;
                const rendPct    = inv.valorAplicado > 0 ? rendimento / inv.valorAplicado * 100 : 0;
                const pctGrupo   = grupo.total > 0 ? inv.valorAtual / grupo.total * 100 : 0;
                return (
                  <View key={inv.id} style={s.invRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.invNome}>{inv.nome}</Text>
                        {inv.ticker && <Text style={s.invTicker}>{inv.ticker}</Text>}
                      </View>
                      <Text style={s.invMeta}>{tipoLabel(inv.tipo)}</Text>
                      <View style={s.barBg2}>
                        <View style={[s.barFg2, { width: `${pctGrupo}%` as any, backgroundColor: paletteColor(gi) }]} />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 110 }}>
                      <Text style={s.invValor}>{fmt(inv.valorAtual, inv.moeda)}</Text>
                      <Text style={[s.invRend, { color: rendimento >= 0 ? colors.green : colors.red }]}>
                        {rendimento >= 0 ? '+' : ''}{rendPct.toFixed(2)}%
                      </Text>
                      {!readOnly && (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                          <TouchableOpacity onPress={() => abrirEdicao(inv)}>
                            <Text style={[s.lnk, { color: colors.blue }]}>Editar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => confirmarExclusao(inv)}>
                            <Text style={[s.lnk, { color: colors.red }]}>Excluir</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

      </ScrollView>

      {/* â”€â”€ Modal â”€â”€ */}
      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={() => setModalVisivel(false)}>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.modalTitulo}>{editando ? 'Editar investimento' : 'Novo investimento'}</Text>

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={form.nome} onChangeText={v => setForm(f => ({ ...f, nome: v }))}
              placeholder="Ex: ETF S&P500" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Tipo *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {tipos.map(t => (
                  <TouchableOpacity key={t.id}
                    style={[s.chip, form.tipoId === t.id && s.chipAtivo]}
                    onPress={() => setForm(f => ({ ...f, tipoId: t.id }))}>
                    <Text style={[s.chipText, form.tipoId === t.id && s.chipTextAtivo]}>{t.icone ? `${t.icone} ` : ''}{t.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={s.label}>Moeda *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {moedas.map(m => (
                <TouchableOpacity key={m.codigo}
                  style={[s.chip, form.moedaCodigo === m.codigo && s.chipAtivo]}
                  onPress={() => setForm(f => ({ ...f, moedaCodigo: m.codigo }))}>
                  <Text style={[s.chipText, form.moedaCodigo === m.codigo && s.chipTextAtivo]}>{m.codigo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Corretora / Custodiante</Text>
            <TextInput style={s.input} value={form.corretora} onChangeText={v => setForm(f => ({ ...f, corretora: v }))}
              placeholder="Ex: XP, BTG, Rico" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Ticker</Text>
            <TextInput style={s.input} value={form.ticker} onChangeText={v => setForm(f => ({ ...f, ticker: v }))}
              placeholder="Ex: IVVB11, BTC" placeholderTextColor={colors.inputPlaceholder} autoCapitalize="characters" />

            <Text style={s.label}>Valor aplicado *</Text>
            <TextInput style={s.input} value={form.valorAplicado} onChangeText={v => setForm(f => ({ ...f, valorAplicado: maskMoeda(v) }))}
              placeholder="Ex: 50.000,00" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Valor atual *</Text>
            <TextInput style={s.input} value={form.valorAtual} onChangeText={v => setForm(f => ({ ...f, valorAtual: maskMoeda(v) }))}
              placeholder="Ex: 55.000,00" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Rentabilidade anual % (opcional)</Text>
            <TextInput style={s.input} value={form.rentabilidadeAnualPct}
              onChangeText={v => setForm(f => ({ ...f, rentabilidadeAnualPct: v }))}
              placeholder="Ex: 12 ou -3" placeholderTextColor={colors.inputPlaceholder} keyboardType="numbers-and-punctuation" />

            {erroForm && <Text style={s.erro}>{erroForm}</Text>}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setModalVisivel(false)}>
                <Text style={s.btnCancelarText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnSalvar]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSalvarText}>{editando ? 'Salvar' : 'Adicionar'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: c.background, padding: 16 },
  center:         { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:          { color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo:        { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  erro:           { color: c.red, fontSize: 14, marginBottom: 12 },

  // Hero card
  heroCard:       { backgroundColor: c.surface, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  heroLabel:      { color: c.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  heroValor:      { color: c.text, fontSize: 32, fontWeight: '900' },
  heroMeta:       { color: c.textSecondary, fontSize: 12 },
  rentBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontSize: 13, fontWeight: '800' },

  // AlocaÃ§Ã£o
  alocRow:        { flexDirection: 'row', gap: 12, marginBottom: 16 },
  alocCard:       { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.border },
  alocTitulo:     { color: c.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase' },
  alocLabel:      { color: c.text, fontSize: 11, fontWeight: '500', flex: 1 },
  alocPct:        { fontSize: 11, fontWeight: '700' },
  barBg:          { height: 5, backgroundColor: c.border, borderRadius: 3 },
  barFg:          { height: 5, borderRadius: 3 },

  // Controles
  controlesRow:   { gap: 10, marginBottom: 16 },
  toggleBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  toggleBtnAtivo: { borderColor: c.greenBorder, backgroundColor: c.greenDim },
  toggleTxt:      { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  filtroChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  filtroChipAtivo:{ borderColor: c.greenBorder, backgroundColor: c.greenDim },
  filtroTxt:      { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
  filtroCircle:   { width: 8, height: 8, borderRadius: 4 },

  // Grupos
  grupoCard:      { backgroundColor: c.surface, borderRadius: 14, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  grupoHeader:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  grupoNome:      { color: c.text, fontSize: 14, fontWeight: '700' },
  grupoMeta:      { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  grupoTotal:     { color: c.text, fontSize: 15, fontWeight: '800' },
  grupoPct:       { fontSize: 11, fontWeight: '700' },
  chevron:        { color: c.textSecondary, fontSize: 14, marginLeft: 4 },

  // Linha de investimento
  invRow:         { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  invNome:        { color: c.text, fontSize: 13, fontWeight: '600' },
  invTicker:      { color: c.textSecondary, fontSize: 11, backgroundColor: c.surfaceElevated, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  invMeta:        { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  invValor:       { color: c.text, fontSize: 13, fontWeight: '700' },
  invRend:        { fontSize: 12, fontWeight: '700' },
  barBg2:         { height: 3, backgroundColor: c.border, borderRadius: 2, marginTop: 6 },
  barFg2:         { height: 3, borderRadius: 2 },
  lnk:            { fontSize: 11, fontWeight: '600' },

  // Modal
  vazio:          { alignItems: 'center', marginTop: 60 },
  vazioIcon:      { fontSize: 48, marginBottom: 12 },
  vazioText:      { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:       { color: c.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  modalOverlay:   { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard:      { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitulo:    { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:          { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input:          { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 12 },
  chip:           { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  chipAtivo:      { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipText:       { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextAtivo:  { color: c.green },
  btnModal:       { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar:    { backgroundColor: c.surfaceElevated },
  btnCancelarText:{ color: c.textSecondary, fontWeight: '700' },
  btnSalvar:      { backgroundColor: c.green },
  btnSalvarText:  { color: '#fff', fontWeight: '700' },
});

