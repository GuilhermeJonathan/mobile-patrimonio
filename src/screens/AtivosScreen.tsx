import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert,
} from 'react-native';
import { patrimonioService, AtivoResumoDto, parametrosService, ParamItemDto, MoedaParamDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
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
}

const FORM_VAZIO: FormState = { nome: '', tipoId: 0, moedaCodigo: 'BRL', valorAtual: '', valorizacaoAnualPct: '' };

export default function AtivosScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;

  const [ativos,     setAtivos]     = useState<AtivoResumoDto[]>([]);
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

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [resumo, tiposData, moedasData] = await Promise.all([
        patrimonioService.resumo(),
        parametrosService.tiposAtivo(),
        parametrosService.moedas(),
      ]);
      setAtivos([...resumo.ativos]);
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Ativos patrimoniais</Text>
          {!readOnly && (
            <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
              <Text style={s.btnNovoText}>+ Novo</Text>
            </TouchableOpacity>
          )}
        </View>

        {erro && <Text style={s.erro}>{erro}</Text>}

        {ativos.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIcon}>🏛️</Text>
            <Text style={s.vazioText}>Nenhum ativo cadastrado.</Text>
            <Text style={s.vazioSub}>
              {readOnly ? 'Este cliente ainda nao cadastrou ativos.' : 'Toque em "+ Novo" para adicionar o primeiro.'}
            </Text>
          </View>
        )}

        {ativos.map(a => (
          <View key={a.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardNome}>{a.nome}</Text>
              <Text style={s.cardTipo}>{tipoLabel(a.tipo)} · {a.moeda}</Text>
              {a.valorizacaoAnualPct != null && (
                <Text style={[s.cardVar, { color: a.valorizacaoAnualPct >= 0 ? colors.green : colors.red }]}>
                  {a.valorizacaoAnualPct >= 0 ? '+' : ''}{a.valorizacaoAnualPct.toFixed(1)}% a.a.
                </Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text style={s.cardValor}>{fmt(a.valorAtual, a.moeda)}</Text>
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
  card:            { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  cardNome:        { color: c.text, fontSize: 15, fontWeight: '700' },
  cardTipo:        { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  cardVar:         { fontSize: 12, fontWeight: '700', marginTop: 2 },
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
