import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert,
} from 'react-native';
import { patrimonioService, PassivoResumoDto, parametrosService, MoedaParamDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { maskMoeda, moedaParaInput, parseMoeda } from '../utils/format';

const PRAZOS = [{ v: 1, l: 'Curto prazo' }, { v: 2, l: 'Longo prazo' }];

interface FormState {
  nome: string; moedaCodigo: string; valor: string;
  prazo: number; taxaJurosAnualPct: string; prazoMeses: string;
}
const FORM_VAZIO: FormState = { nome: '', moedaCodigo: 'BRL', valor: '', prazo: 2, taxaJurosAnualPct: '', prazoMeses: '' };

export default function PassivosScreen() {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = false; // no view-as, assessor/corretor pode editar patrimônio
  const fmt = (v: number, moeda = 'BRL') => formatMoney(v, ocultar, moeda);

  const [passivos,   setPassivos]   = useState<PassivoResumoDto[]>([]);
  const [totalBRL,   setTotalBRL]   = useState(0);
  const [moedas,     setMoedas]     = useState<MoedaParamDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro,       setErro]       = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando,     setEditando]     = useState<PassivoResumoDto | null>(null);
  const [form,         setForm]         = useState<FormState>(FORM_VAZIO);
  const [salvando,     setSalvando]     = useState(false);
  const [erroForm,     setErroForm]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [resumo, moedasData] = await Promise.all([
        patrimonioService.resumo(),
        parametrosService.moedas(),
      ]);
      setPassivos([...resumo.passivos]);
      setTotalBRL(resumo.totalDividasBRL);
      setMoedas(moedasData.filter(m => m.ativo));
    } catch {
      setErro('Nao foi possivel carregar as dividas.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function abrirNovo() {
    setEditando(null);
    setForm({ ...FORM_VAZIO, moedaCodigo: moedas[0]?.codigo ?? 'BRL' });
    setErroForm(null);
    setModalVisivel(true);
  }

  function abrirEdicao(p: PassivoResumoDto) {
    setEditando(p);
    setForm({
      nome: p.nome, moedaCodigo: p.moeda, valor: moedaParaInput(p.valor), prazo: p.prazo,
      taxaJurosAnualPct: '', prazoMeses: '',
    });
    setErroForm(null);
    setModalVisivel(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErroForm('Informe o nome.'); return; }
    const valor = parseMoeda(form.valor);
    if (isNaN(valor) || valor < 0) { setErroForm('Valor invalido.'); return; }

    const payload = {
      nome: form.nome.trim(),
      moeda: form.moedaCodigo,
      valor,
      prazo: form.prazo,
      taxaJurosAnualPct: form.taxaJurosAnualPct ? parseFloat(form.taxaJurosAnualPct.replace(',', '.')) : null,
      prazoMeses: form.prazoMeses ? parseInt(form.prazoMeses, 10) : null,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) await patrimonioService.atualizarPassivo(editando.id, payload);
      else          await patrimonioService.criarPassivo(payload);
      setModalVisivel(false);
      await load();
    } catch {
      setErroForm('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(p: PassivoResumoDto) {
    Alert.alert('Remover', `Deseja remover "${p.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try { await patrimonioService.deletarPassivo(p.id); await load(); }
          catch { Alert.alert('Erro', 'Nao foi possivel remover.'); }
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
          <Text style={s.title}>Dívidas</Text>
          {!readOnly && (
            <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
              <Text style={s.btnNovoText}>+ Nova</Text>
            </TouchableOpacity>
          )}
        </View>

        {erro && <Text style={s.erro}>{erro}</Text>}

        <View style={s.totalCard}>
          <Text style={s.totalLbl}>Total de dívidas (consolidado em BRL)</Text>
          <Text style={s.totalVal}>{fmt(totalBRL)}</Text>
        </View>

        {passivos.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIcon}>📋</Text>
            <Text style={s.vazioText}>Nenhuma dívida cadastrada.</Text>
            <Text style={s.vazioSub}>
              {readOnly ? 'Este cliente ainda nao cadastrou dividas.' : 'Toque em "+ Nova" para adicionar.'}
            </Text>
          </View>
        )}

        {passivos.map(p => (
          <View key={p.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardNome}>{p.nome}</Text>
              <Text style={s.cardTipo}>
                {p.prazo === 1 ? 'Curto prazo' : 'Longo prazo'} · {p.moeda}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text style={s.cardValor}>{fmt(p.valor, p.moeda)}</Text>
              {p.moeda !== 'BRL' && <Text style={s.cardBRL}>{fmt(p.valorBRL)}</Text>}
              {!readOnly && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={s.btnEditar} onPress={() => abrirEdicao(p)}>
                    <Text style={s.btnEditarText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnExcluir} onPress={() => confirmarExclusao(p)}>
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
            <Text style={s.modalTitulo}>{editando ? 'Editar dívida' : 'Nova dívida'}</Text>

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={form.nome} onChangeText={v => setForm(f => ({ ...f, nome: v }))}
              placeholder="Ex: Financiamento imóvel" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Prazo *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {PRAZOS.map(p => (
                <TouchableOpacity key={p.v} style={[s.chip, form.prazo === p.v && s.chipAtivo]}
                  onPress={() => setForm(f => ({ ...f, prazo: p.v }))}>
                  <Text style={[s.chipText, form.prazo === p.v && s.chipTextAtivo]}>{p.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Moeda *</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {moedas.map(m => (
                <TouchableOpacity key={m.id} style={[s.chip, form.moedaCodigo === m.codigo && s.chipAtivo]}
                  onPress={() => setForm(f => ({ ...f, moedaCodigo: m.codigo }))}>
                  <Text style={[s.chipText, form.moedaCodigo === m.codigo && s.chipTextAtivo]}>{m.codigo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Saldo devedor *</Text>
            <TextInput style={s.input} value={form.valor} onChangeText={v => setForm(f => ({ ...f, valor: maskMoeda(v) }))}
              placeholder="Ex: 200.000,00" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Juros % a.a. (opcional)</Text>
                <TextInput style={s.input} value={form.taxaJurosAnualPct}
                  onChangeText={v => setForm(f => ({ ...f, taxaJurosAnualPct: v }))}
                  placeholder="Ex: 9,5" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Prazo em meses (opcional)</Text>
                <TextInput style={s.input} value={form.prazoMeses}
                  onChangeText={v => setForm(f => ({ ...f, prazoMeses: v }))}
                  placeholder="Ex: 120" placeholderTextColor={colors.inputPlaceholder} keyboardType="number-pad" />
              </View>
            </View>
            <Text style={s.hint}>Juros e prazo alimentam a projeção de quitação no painel.</Text>

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
  container:       { flex: 1, backgroundColor: c.background, padding: 16 },
  center:          { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title:           { color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo:         { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoText:     { color: '#fff', fontWeight: '700', fontSize: 14 },
  erro:            { color: c.red, fontSize: 14, marginBottom: 12 },
  totalCard:       { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: c.red + '40' },
  totalLbl:        { color: c.textSecondary, fontSize: 12 },
  totalVal:        { color: c.red, fontSize: 24, fontWeight: '900', marginTop: 4 },
  vazio:           { alignItems: 'center', marginTop: 50 },
  vazioIcon:       { fontSize: 48, marginBottom: 12 },
  vazioText:       { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:        { color: c.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  card:            { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  cardNome:        { color: c.text, fontSize: 15, fontWeight: '700' },
  cardTipo:        { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  cardValor:       { color: c.text, fontSize: 15, fontWeight: '700' },
  cardBRL:         { color: c.textTertiary, fontSize: 11 },
  btnEditar:       { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnEditarText:   { color: c.blue, fontSize: 13, fontWeight: '600' },
  btnExcluir:      { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnExcluirText:  { color: c.red, fontSize: 13, fontWeight: '600' },
  modalOverlay:    { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard:       { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitulo:     { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:           { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input:           { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 12 },
  hint:            { color: c.textTertiary, fontSize: 11, fontStyle: 'italic', marginBottom: 8 },
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
