import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert,
} from 'react-native';
import { gestaoService, MetaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';

const STATUS_MAP: Record<number, { label: string; cor: string }> = {
  1: { label: 'Ativa',     cor: '#3b82f6' },
  2: { label: 'Concluida', cor: '#22c55e' },
  3: { label: 'Cancelada', cor: '#ef4444' },
};

function fmt(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface FormState {
  titulo: string; valorMeta: string; valorAtual: string; prazo: string;
}
const VAZIO: FormState = { titulo: '', valorMeta: '', valorAtual: '0', prazo: '' };

export default function MetasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;

  const [lista,      setLista]      = useState<MetaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [editando,     setEditando]     = useState<MetaDto | null>(null);
  const [form,         setForm]         = useState<FormState>(VAZIO);
  const [salvando,     setSalvando]     = useState(false);
  const [erroForm,     setErroForm]     = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErro(null);
      setLista(await gestaoService.metas());
    } catch {
      setErro('Nao foi possivel carregar as metas.');
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function abrirNovo() {
    setEditando(null);
    setForm(VAZIO);
    setErroForm(null);
    setModalVisivel(true);
  }

  function abrirEdicao(m: MetaDto) {
    setEditando(m);
    setForm({
      titulo:     m.titulo,
      valorMeta:  m.valorMeta.toString(),
      valorAtual: m.valorAtual.toString(),
      prazo:      m.prazo ? m.prazo.split('T')[0] : '',
    });
    setErroForm(null);
    setModalVisivel(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErroForm('Informe o titulo.'); return; }
    const meta   = parseFloat(form.valorMeta.replace(',', '.'));
    const atual  = parseFloat(form.valorAtual.replace(',', '.'));
    if (isNaN(meta)  || meta  < 0) { setErroForm('Valor da meta invalido.');  return; }
    if (isNaN(atual) || atual < 0) { setErroForm('Valor atual invalido.'); return; }

    const payload = {
      titulo:     form.titulo.trim(),
      valorMeta:  meta,
      valorAtual: atual,
      prazo:      form.prazo || null,
    };

    setSalvando(true);
    setErroForm(null);
    try {
      if (editando) {
        await gestaoService.atualizarMeta(editando.id, payload);
      } else {
        await gestaoService.criarMeta(payload);
      }
      setModalVisivel(false);
      await load();
    } catch {
      setErroForm('Erro ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao(m: MetaDto) {
    Alert.alert('Remover', `Deseja remover "${m.titulo}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => {
          try {
            await gestaoService.deletarMeta(m.id);
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

  const ativas    = lista.filter(m => m.status === 1);
  const concluidas = lista.filter(m => m.status === 2);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.root}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.header}>
          <Text style={s.titulo}>Metas</Text>
          {!readOnly && (
            <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
              <Text style={s.btnNovoTxt}>+ Nova</Text>
            </TouchableOpacity>
          )}
        </View>

        {erro && <Text style={s.erro}>{erro}</Text>}

        {lista.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIco}>🎯</Text>
            <Text style={s.vazioTxt}>Nenhuma meta cadastrada.</Text>
            <Text style={s.vazioSub}>{readOnly ? 'Este cliente ainda nao cadastrou metas.' : 'Toque em "+ Nova" para adicionar.'}</Text>
          </View>
        )}

        {ativas.length > 0 && (
          <>
            <Text style={s.secaoLabel}>Ativas</Text>
            {ativas.map(m => <MetaCard key={m.id} m={m} s={s} colors={colors} onEdit={abrirEdicao} onDelete={confirmarExclusao} readOnly={readOnly} />)}
          </>
        )}

        {concluidas.length > 0 && (
          <>
            <Text style={s.secaoLabel}>Concluidas</Text>
            {concluidas.map(m => <MetaCard key={m.id} m={m} s={s} colors={colors} onEdit={abrirEdicao} onDelete={confirmarExclusao} readOnly={readOnly} />)}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={() => setModalVisivel(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.modalTitulo}>{editando ? 'Editar meta' : 'Nova meta'}</Text>

            <Text style={s.label}>Titulo *</Text>
            <TextInput style={s.input} value={form.titulo} onChangeText={v => setForm(f => ({ ...f, titulo: v }))}
              placeholder="Ex: Reserva de emergencia" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Valor da meta *</Text>
            <TextInput style={s.input} value={form.valorMeta} onChangeText={v => setForm(f => ({ ...f, valorMeta: v }))}
              placeholder="Ex: 30000" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Valor atual</Text>
            <TextInput style={s.input} value={form.valorAtual} onChangeText={v => setForm(f => ({ ...f, valorAtual: v }))}
              placeholder="Ex: 5000" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>Prazo (AAAA-MM-DD)</Text>
            <TextInput style={s.input} value={form.prazo} onChangeText={v => setForm(f => ({ ...f, prazo: v }))}
              placeholder="Ex: 2025-12-31" placeholderTextColor={colors.inputPlaceholder} />

            {erroForm && <Text style={s.erro}>{erroForm}</Text>}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setModalVisivel(false)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnSalvar]} onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarTxt}>{editando ? 'Salvar' : 'Adicionar'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MetaCard({ m, s, colors, onEdit, onDelete, readOnly }: {
  m: MetaDto;
  s: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
  onEdit: (m: MetaDto) => void;
  onDelete: (m: MetaDto) => void;
  readOnly: boolean;
}) {
  const pct     = m.valorMeta > 0 ? Math.min(m.valorAtual / m.valorMeta, 1) : 0;
  const statusInfo = STATUS_MAP[m.status] ?? STATUS_MAP[1];
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={s.cardTitulo}>{m.titulo}</Text>
        <View style={[s.badge, { backgroundColor: statusInfo.cor + '22', borderColor: statusInfo.cor + '55' }]}>
          <Text style={[s.badgeTxt, { color: statusInfo.cor }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${(pct * 100).toFixed(0)}%` as any, backgroundColor: pct >= 1 ? colors.green : colors.blue }]} />
      </View>
      <Text style={s.barPct}>{(pct * 100).toFixed(0)}%  {fmt(m.valorAtual)} de {fmt(m.valorMeta)}</Text>

      {m.prazo && (
        <Text style={s.prazoTxt}>Prazo: {new Date(m.prazo).toLocaleDateString('pt-BR')}</Text>
      )}

      {!readOnly && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity style={s.btnEditar} onPress={() => onEdit(m)}>
            <Text style={s.btnEditarTxt}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnExcluir} onPress={() => onDelete(m)}>
            <Text style={s.btnExcluirTxt}>Excluir</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:        { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo:      { color: c.text, fontSize: 20, fontWeight: '800' },
  btnNovo:     { backgroundColor: c.green, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
  btnNovoTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  erro:        { color: c.red, fontSize: 14, marginBottom: 12 },
  vazio:       { alignItems: 'center', marginTop: 60 },
  vazioIco:    { fontSize: 48, marginBottom: 12 },
  vazioTxt:    { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:    { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  secaoLabel:  { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
  card:        { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  badge:       { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1 },
  badgeTxt:    { fontSize: 11, fontWeight: '700' },
  barBg:       { backgroundColor: c.border, borderRadius: 4, height: 8, marginBottom: 6 },
  barFill:     { height: 8, borderRadius: 4 },
  barPct:      { color: c.textSecondary, fontSize: 12, marginBottom: 4 },
  prazoTxt:    { color: c.textTertiary, fontSize: 11 },
  btnEditar:   { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnEditarTxt:{ color: c.blue, fontSize: 13, fontWeight: '600' },
  btnExcluir:  { backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 12 },
  btnExcluirTxt:{ color: c.red, fontSize: 13, fontWeight: '600' },
  overlay:     { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard:   { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 12 },
  btnModal:    { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar: { backgroundColor: c.surfaceElevated },
  btnCancelarTxt:{ color: c.textSecondary, fontWeight: '700' },
  btnSalvar:   { backgroundColor: c.green },
  btnSalvarTxt:{ color: '#fff', fontWeight: '700' },
});
