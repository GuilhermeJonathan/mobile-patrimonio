import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert,
} from 'react-native';
import { investimentosService, InvestimentoDto, ResumoInvestimentosDto, parametrosService, ParamItemDto, MoedaParamDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';

const MOEDA_SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: 'EUR', CHF: 'CHF', GBP: 'GBP' };

function fmt(v: number, moeda = 'BRL') {
  return `${MOEDA_SIMBOLO[moeda] ?? ''} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface FormState {
  nome: string; tipoId: number; moedaCodigo: string; corretora: string;
  ticker: string; valorAplicado: string; valorAtual: string; rentabilidadeAnualPct: string;
}
const VAZIO: FormState = {
  nome: '', tipoId: 0, moedaCodigo: 'BRL', corretora: '',
  ticker: '', valorAplicado: '', valorAtual: '', rentabilidadeAnualPct: '',
};

export default function InvestimentosScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;

  const [dados,      setDados]      = useState<ResumoInvestimentosDto | null>(null);
  const [tipos,      setTipos]      = useState<ParamItemDto[]>([]);
  const [moedas,     setMoedas]     = useState<MoedaParamDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando, setEditando]         = useState<InvestimentoDto | null>(null);
  const [form, setForm]                 = useState<FormState>(VAZIO);
  const [salvando, setSalvando]         = useState(false);
  const [erroForm, setErroForm]         = useState<string | null>(null);

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

  function abrirNovo() {
    setEditando(null);
    setForm({ ...VAZIO, tipoId: tipos[0]?.id ?? 0, moedaCodigo: moedas[0]?.codigo ?? 'BRL' });
    setErroForm(null);
    setModalVisivel(true);
  }

  function abrirEdicao(inv: InvestimentoDto) {
    setEditando(inv);
    setForm({
      nome: inv.nome,
      tipoId: inv.tipo,
      moedaCodigo: inv.moeda,
      corretora: inv.corretora ?? '',
      ticker: inv.ticker ?? '',
      valorAplicado: inv.valorAplicado.toString(),
      valorAtual: inv.valorAtual.toString(),
      rentabilidadeAnualPct: inv.rentabilidadeAnualPct != null ? inv.rentabilidadeAnualPct.toString() : '',
    });
    setErroForm(null);
    setModalVisivel(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErroForm('Informe o nome.'); return; }
    const aplicado = parseFloat(form.valorAplicado.replace(',', '.'));
    const atual    = parseFloat(form.valorAtual.replace(',', '.'));
    if (isNaN(aplicado) || aplicado < 0) { setErroForm('Valor aplicado invalido.'); return; }
    if (isNaN(atual)    || atual    < 0) { setErroForm('Valor atual invalido.');    return; }

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipoId,
      moeda: form.moedaCodigo,
      corretora: form.corretora.trim() || null,
      ticker: form.ticker.trim().toUpperCase() || null,
      valorAplicado: aplicado,
      valorAtual: atual,
      rentabilidadeAnualPct: form.rentabilidadeAnualPct
        ? parseFloat(form.rentabilidadeAnualPct.replace(',', '.'))
        : null,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        await investimentosService.atualizar(editando.id, payload);
      } else {
        await investimentosService.criar(payload);
      }
      setModalVisivel(false);
      await load();
    } catch {
      setErroForm('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(inv: InvestimentoDto) {
    Alert.alert('Remover', `Deseja remover "${inv.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try {
            await investimentosService.deletar(inv.id);
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

  const lista = dados?.investimentos ?? [];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Investimentos</Text>
          {!readOnly && (
            <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
              <Text style={s.btnNovoText}>+ Novo</Text>
            </TouchableOpacity>
          )}
        </View>

        {erro && <Text style={s.erro}>{erro}</Text>}

        {/* Cards de resumo */}
        {dados && (
          <View style={s.resumoRow}>
            <View style={[s.resumoCard, { borderColor: colors.greenBorder }]}>
              <Text style={s.resumoLabel}>Aplicado (BRL)</Text>
              <Text style={s.resumoValor}>{fmt(dados.totalAplicadoBRL)}</Text>
            </View>
            <View style={[s.resumoCard, { borderColor: colors.blue + '50' }]}>
              <Text style={s.resumoLabel}>Atual (BRL)</Text>
              <Text style={[s.resumoValor, { color: colors.blue }]}>{fmt(dados.totalAtualBRL)}</Text>
              {dados.rentabilidadePct != null && (
                <Text style={[s.resumoSub, { color: dados.rentabilidadePct >= 0 ? colors.green : colors.red }]}>
                  {dados.rentabilidadePct >= 0 ? '+' : ''}{dados.rentabilidadePct.toFixed(2)}%
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Lista */}
        {lista.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIcon}>📈</Text>
            <Text style={s.vazioText}>Nenhum investimento cadastrado.</Text>
            <Text style={s.vazioSub}>{readOnly ? 'Este cliente ainda nao cadastrou investimentos.' : 'Toque em "+ Novo" para adicionar.'}</Text>
          </View>
        )}

        {lista.map(inv => {
          const rendimento = inv.valorAtual - inv.valorAplicado;
          const rendPct    = inv.valorAplicado > 0 ? (rendimento / inv.valorAplicado) * 100 : 0;
          return (
            <View key={inv.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardNome}>{inv.nome}</Text>
                <Text style={s.cardTipo}>
                  {tipoLabel(inv.tipo)} {inv.ticker ? `· ${inv.ticker}` : ''} {inv.corretora ? `· ${inv.corretora}` : ''}
                </Text>
                <Text style={[s.cardRend, { color: rendimento >= 0 ? colors.green : colors.red }]}>
                  {rendimento >= 0 ? '+' : ''}{rendPct.toFixed(2)}%  {fmt(rendimento, inv.moeda)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={s.cardValor}>{fmt(inv.valorAtual, inv.moeda)}</Text>
                <Text style={s.cardAplicado}>aplic. {fmt(inv.valorAplicado, inv.moeda)}</Text>
                {!readOnly && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={s.btnEditar} onPress={() => abrirEdicao(inv)}>
                      <Text style={s.btnEditarText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnExcluir} onPress={() => confirmarExclusao(inv)}>
                      <Text style={s.btnExcluirText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Modal */}
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

            <Text style={s.label}>Corretora</Text>
            <TextInput style={s.input} value={form.corretora} onChangeText={v => setForm(f => ({ ...f, corretora: v }))}
              placeholder="Ex: XP, BTG, Rico" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Ticker</Text>
            <TextInput style={s.input} value={form.ticker} onChangeText={v => setForm(f => ({ ...f, ticker: v }))}
              placeholder="Ex: IVVB11, BTC" placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="characters" />

            <Text style={s.label}>Valor aplicado *</Text>
            <TextInput style={s.input} value={form.valorAplicado} onChangeText={v => setForm(f => ({ ...f, valorAplicado: v }))}
              placeholder="Ex: 50000" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Valor atual *</Text>
            <TextInput style={s.input} value={form.valorAtual} onChangeText={v => setForm(f => ({ ...f, valorAtual: v }))}
              placeholder="Ex: 55000" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Rentabilidade anual % (opcional)</Text>
            <TextInput style={s.input} value={form.rentabilidadeAnualPct}
              onChangeText={v => setForm(f => ({ ...f, rentabilidadeAnualPct: v }))}
              placeholder="Ex: 12 ou -3" placeholderTextColor={colors.inputPlaceholder}
              keyboardType="numbers-and-punctuation" />

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
  container: { flex: 1, backgroundColor: c.background, padding: 16 },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo: { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  erro: { color: c.red, fontSize: 14, marginBottom: 12 },
  resumoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  resumoCard: { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1 },
  resumoLabel: { color: c.textSecondary, fontSize: 12 },
  resumoValor: { color: c.green, fontSize: 22, fontWeight: '800', marginTop: 4 },
  resumoSub: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  vazio: { alignItems: 'center', marginTop: 60 },
  vazioIcon: { fontSize: 48, marginBottom: 12 },
  vazioText: { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start' },
  cardNome: { color: c.text, fontSize: 15, fontWeight: '700' },
  cardTipo: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  cardRend: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  cardValor: { color: c.text, fontSize: 15, fontWeight: '700' },
  cardAplicado: { color: c.textTertiary, fontSize: 11 },
  btnEditar: { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnEditarText: { color: c.blue, fontSize: 13, fontWeight: '600' },
  btnExcluir: { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnExcluirText: { color: c.red, fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label: { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 12 },
  chip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  chipAtivo: { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextAtivo: { color: c.green },
  btnModal: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar: { backgroundColor: c.surfaceElevated },
  btnCancelarText: { color: c.textSecondary, fontWeight: '700' },
  btnSalvar: { backgroundColor: c.green },
  btnSalvarText: { color: '#fff', fontWeight: '700' },
});
