import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { contasService, ContaDto, estruturasService, EstruturaDto } from '../services/api';
import { numBR } from '../utils/format';
import { confirmar } from '../utils/confirm';

const GOLD = '#C79A4E';
const TIPOS = [
  { v: 1, label: 'Corrente' },
  { v: 2, label: 'Investimento / Custódia' },
  { v: 3, label: 'Internacional' },
  { v: 99, label: 'Outro' },
];
const TIPO_LABEL: Record<number, string> = Object.fromEntries(TIPOS.map(t => [t.v, t.label]));
const MOEDAS = ['BRL', 'USD', 'EUR', 'CHF', 'GBP'];

function fmtBRL(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${numBR(v / 1_000_000, 2)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${numBR(v / 1_000, 1)}k`;
  return `R$ ${numBR(v, 0)}`;
}

interface Form {
  id?: string; nome: string; tipo: number; moeda: string; saldo: string;
  instituicao: string; pais: string; identificador: string; estruturaId: string | null;
}

export default function ContasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [contas, setContas] = useState<ContaDto[]>([]);
  const [totalBRL, setTotalBRL] = useState(0);
  const [estruturas, setEstruturas] = useState<EstruturaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [res, grafo] = await Promise.all([contasService.listar(), estruturasService.grafo().catch(() => null)]);
      setContas(res.contas);
      setTotalBRL(res.totalBRL);
      setEstruturas(grafo?.estruturas ?? []);
    } catch { setErro('Não foi possível carregar as contas.'); }
    finally { setCarregando(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function novaConta() {
    setForm({ nome: '', tipo: 1, moeda: 'BRL', saldo: '', instituicao: '', pais: '', identificador: '', estruturaId: null });
  }
  function editar(c: ContaDto) {
    setForm({
      id: c.id, nome: c.nome, tipo: c.tipo, moeda: c.moeda, saldo: String(c.saldo),
      instituicao: c.instituicao ?? '', pais: c.pais ?? '', identificador: c.identificador ?? '', estruturaId: c.estruturaId ?? null,
    });
  }
  async function salvar() {
    if (!form || !form.nome.trim()) { Alert.alert('Atenção', 'Informe o nome da conta.'); return; }
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(), tipo: form.tipo, moeda: form.moeda,
        saldo: parseFloat(form.saldo.replace(/\./g, '').replace(',', '.')) || 0,
        instituicao: form.instituicao.trim() || null, pais: form.pais.trim() || null,
        identificador: form.identificador.trim() || null, estruturaId: form.estruturaId,
      };
      if (form.id) await contasService.atualizar(form.id, payload);
      else await contasService.criar(payload);
      setForm(null); await load();
    } catch { Alert.alert('Erro', 'Não foi possível salvar a conta.'); }
    finally { setSalvando(false); }
  }
  async function remover(c: ContaDto) {
    if (!(await confirmar('Remover conta', `Remover "${c.nome}"? Investimentos vinculados voltam a ficar soltos.`))) return;
    try { await contasService.deletar(c.id); await load(); }
    catch { Alert.alert('Erro', 'Não foi possível remover.'); }
  }

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const custodia = form?.tipo === 2;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Contas</Text>
          <Text style={s.subtitle}>Bancárias, de investimento/custódia e internacionais.</Text>
        </View>
        <TouchableOpacity style={s.btnNovo} onPress={novaConta}><Text style={s.btnNovoTxt}>+ Conta</Text></TouchableOpacity>
      </View>
      {erro && <Text style={s.erro}>{erro}</Text>}

      <View style={s.kpiCard}>
        <Text style={s.kpiLabel}>Total em contas (BRL)</Text>
        <Text style={s.kpiValor}>{fmtBRL(totalBRL)}</Text>
        <Text style={s.kpiSub}>{contas.length} conta(s)</Text>
      </View>

      <View style={s.card}>
        {contas.length === 0 ? (
          <Text style={s.vazioMini}>Nenhuma conta cadastrada. Toque em “+ Conta” para começar.</Text>
        ) : contas.map(c => (
          <View key={c.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>{c.nome}</Text>
              <Text style={s.meta}>
                {TIPO_LABEL[c.tipo] ?? 'Conta'} · {c.moeda}
                {c.instituicao ? ` · ${c.instituicao}` : ''}
                {c.pais ? ` · ${c.pais}` : ''}
                {c.estruturaNome ? ` · ${c.estruturaNome}` : ' · pessoa física'}
              </Text>
              {c.agregaInvestimentos
                ? <Text style={s.metaMini}>{c.qtdInvestimentos} investimento(s) ligados · valor derivado</Text>
                : (c.identificador ? <Text style={s.metaMini}>{c.identificador}</Text> : null)}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.valor}>{fmtBRL(c.valorBRL)}</Text>
              {c.moeda !== 'BRL' && !c.agregaInvestimentos && <Text style={s.valorOrig}>{c.moeda} {numBR(c.saldo, 0)}</Text>}
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <TouchableOpacity onPress={() => editar(c)}><Text style={[s.link, { color: colors.blue }]}>editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remover(c)}><Text style={[s.link, { color: colors.red, marginLeft: 12 }]}>excluir</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Modal conta */}
      <Modal visible={form !== null} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={s.overlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={s.modalTitulo}>{form?.id ? 'Editar conta' : 'Nova conta'}</Text>

            <TextInput style={s.input} value={form?.nome ?? ''} onChangeText={v => setForm(f => f && { ...f, nome: v })} placeholder="Nome (apelido da conta)" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Tipo</Text>
            <View style={s.chipsWrap}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.v} style={[s.chip, form?.tipo === t.v && s.chipOn]} onPress={() => setForm(f => f && { ...f, tipo: t.v })}>
                  <Text style={[s.chipTxt, form?.tipo === t.v && { color: colors.green }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Moeda</Text>
                <View style={s.chipsWrap}>
                  {MOEDAS.map(m => (
                    <TouchableOpacity key={m} style={[s.chip, form?.moeda === m && s.chipOn]} onPress={() => setForm(f => f && { ...f, moeda: m })}>
                      <Text style={[s.chipTxt, form?.moeda === m && { color: colors.green }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {custodia ? (
              <Text style={s.aviso}>💡 Conta de investimento/custódia: o valor é derivado dos investimentos vinculados a ela (defina a conta no cadastro de cada investimento). O saldo abaixo é ignorado.</Text>
            ) : (
              <>
                <Text style={s.label}>Saldo ({form?.moeda})</Text>
                <TextInput style={s.input} value={form?.saldo ?? ''} onChangeText={v => setForm(f => f && { ...f, saldo: v })} keyboardType="decimal-pad" placeholder="Ex: 10000" placeholderTextColor={colors.inputPlaceholder} />
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Instituição</Text>
                <TextInput style={s.input} value={form?.instituicao ?? ''} onChangeText={v => setForm(f => f && { ...f, instituicao: v })} placeholder="Banco / corretora" placeholderTextColor={colors.inputPlaceholder} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>País</Text>
                <TextInput style={s.input} value={form?.pais ?? ''} onChangeText={v => setForm(f => f && { ...f, pais: v })} placeholder="Brasil, Suíça…" placeholderTextColor={colors.inputPlaceholder} />
              </View>
            </View>

            <Text style={s.label}>Identificador (agência/conta ou nº de custódia)</Text>
            <TextInput style={s.input} value={form?.identificador ?? ''} onChangeText={v => setForm(f => f && { ...f, identificador: v })} placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>Pertence a (estrutura)</Text>
            <View style={s.chipsWrap}>
              <TouchableOpacity style={[s.chip, form?.estruturaId === null && s.chipOn]} onPress={() => setForm(f => f && { ...f, estruturaId: null })}>
                <Text style={[s.chipTxt, form?.estruturaId === null && { color: colors.green }]}>Pessoa física</Text>
              </TouchableOpacity>
              {estruturas.map(e => (
                <TouchableOpacity key={e.id} style={[s.chip, form?.estruturaId === e.id && s.chipOn]} onPress={() => setForm(f => f && { ...f, estruturaId: e.id })}>
                  <Text style={[s.chipTxt, form?.estruturaId === e.id && { color: colors.green }]}>{e.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancel]} onPress={() => setForm(null)}><Text style={s.btnCancelTxt}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnOk]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnOkTxt}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  erro:        { color: c.red, fontSize: 13, marginBottom: 8 },
  vazioMini:   { color: c.textSecondary, fontSize: 13, paddingVertical: 8 },
  btnNovo:     { backgroundColor: c.green, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  btnNovoTxt:  { color: '#fff', fontWeight: '700' },
  kpiCard:     { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 },
  kpiLabel:    { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  kpiValor:    { color: c.text, fontSize: 26, fontWeight: '900', marginTop: 2 },
  kpiSub:      { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  nome:        { color: c.text, fontSize: 15, fontWeight: '700' },
  meta:        { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  metaMini:    { color: c.textTertiary, fontSize: 11, marginTop: 1 },
  valor:       { color: c.text, fontSize: 15, fontWeight: '800' },
  valorOrig:   { color: c.textTertiary, fontSize: 11, marginTop: 1 },
  link:        { fontSize: 13, fontWeight: '700' },
  overlay:     { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard:   { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90%' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  aviso:       { color: c.textSecondary, fontSize: 12, backgroundColor: c.surfaceElevated, borderRadius: 10, padding: 12, marginTop: 12, lineHeight: 17 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  chipsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border },
  chipOn:      { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipTxt:     { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  btnModal:    { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancel:   { backgroundColor: c.surfaceElevated },
  btnCancelTxt:{ color: c.textSecondary, fontWeight: '700' },
  btnOk:       { backgroundColor: c.green },
  btnOkTxt:    { color: '#fff', fontWeight: '700' },
});
