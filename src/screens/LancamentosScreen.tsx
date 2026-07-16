import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { gestaoService, LancamentoDto, CategoriaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { numBR } from '../utils/format';

const ICONES_RAPIDOS = [
  '🍽️','🛒','🚗','🏠','📱','👕','💊','📚',
  '🎨','🎵','🎮','💰','📈','🤝','💡','✈️',
  '🏋️','⚽','🐶','🎁','🏦','💳','🌿','🌟',
];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const TIPOS  = [{ v: 1, l: 'Receita' }, { v: 2, l: 'Despesa' }, { v: 3, l: 'Pix' }];
const SITUACOES = [{ v: 1, l: 'Pago' }, { v: 2, l: 'Pendente' }];

function fmt(v: number) {
  return numBR(v, 2);
}

function dataFmt(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

export default function LancamentosScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const [itens,      setItens]      = useState<LancamentoDto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [editando,    setEditando]    = useState<LancamentoDto | null>(null);
  const [fDescricao,  setFDescricao]  = useState('');
  const [fValor,      setFValor]      = useState('');
  const [fTipo,       setFTipo]       = useState(2);
  const [fSituacao,   setFSituacao]   = useState(2);
  const [fCatId,      setFCatId]      = useState<string | null>(null);
  const [fData,       setFData]       = useState('');
  const [salvando,    setSalvando]    = useState(false);

  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [fCatNome,       setFCatNome]       = useState('');
  const [fCatIcone,      setFCatIcone]      = useState('');
  const [salvandoCat,    setSalvandoCat]    = useState(false);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [paged, cats] = await Promise.all([
        gestaoService.lancamentos(mes, ano),
        gestaoService.categorias(),
      ]);
      setItens(paged.items);
      setCategorias(cats.items);
    } catch {
      setErro('Erro ao carregar lancamentos.');
    } finally { setCarregando(false); setRefreshing(false); }
  }, [mes, ano]);

  useEffect(() => { load(); }, [load]);

  function navMes(d: number) {
    let m = mes + d; let a = ano;
    if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; }
    setMes(m); setAno(a); setCarregando(true);
  }

  function abrirNovo() {
    setEditando(null);
    const hoje = new Date();
    setFDescricao(''); setFValor(''); setFTipo(2); setFSituacao(2); setFCatId(null);
    setFData(`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`);
    setModalAberto(true);
  }

  function abrirEditar(item: LancamentoDto) {
    setEditando(item);
    setFDescricao(item.descricao); setFValor(item.valor.toString());
    setFTipo(item.tipo); setFSituacao(item.situacao);
    setFCatId(item.categoriaId);
    setFData(item.data.substring(0, 10));
    setModalAberto(true);
  }

  async function salvar() {
    if (!fDescricao.trim()) { Alert.alert('Validacao', 'Descricao obrigatoria.'); return; }
    const valor = parseFloat(fValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) { Alert.alert('Validacao', 'Valor invalido.'); return; }
    setSalvando(true);
    const d = new Date(fData + 'T12:00:00');
    const payload = {
      descricao: fDescricao.trim(), data: d.toISOString(), valor,
      tipo: fTipo, situacao: fSituacao, mes: d.getMonth() + 1, ano: d.getFullYear(),
      categoriaId: fCatId,
    };
    try {
      if (editando) await gestaoService.atualizarLancamento(editando.id, payload);
      else          await gestaoService.criarLancamento(payload as any);
      setModalAberto(false);
      setCarregando(true);
      await load();
    } catch { Alert.alert('Erro', 'Nao foi possivel salvar.'); }
    finally { setSalvando(false); }
  }

  async function salvarCategoria() {
    if (!fCatNome.trim()) return;
    setSalvandoCat(true);
    try {
      const nova = await gestaoService.criarCategoria({ nome: fCatNome.trim(), icone: fCatIcone.trim() || null, tipo: fTipo === 1 ? 1 : 2 });
      const cats = await gestaoService.categorias();
      setCategorias(cats.items);
      setFCatId(nova.id);
      setModalCatAberto(false);
      setFCatNome('');
      setFCatIcone('');
    } catch { Alert.alert('Erro', 'Nao foi possivel criar a categoria.'); }
    finally { setSalvandoCat(false); }
  }

  async function excluir(item: LancamentoDto) {
    Alert.alert('Remover', `Remover "${item.descricao}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await gestaoService.deletarLancamento(item.id); await load(); }
        catch { Alert.alert('Erro', 'Nao foi possivel remover.'); }
      }},
    ]);
  }

  const receitas  = itens.filter(i => i.tipo === 1).reduce((s, i) => s + i.valor, 0);
  const despesas  = itens.filter(i => i.tipo !== 1).reduce((s, i) => s + i.valor, 0);

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.root} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {/* Navegacao mes */}
        <View style={s.mesNav}>
          <TouchableOpacity style={s.mesBtn} onPress={() => navMes(-1)}><Text style={s.mesBtnTxt}>{'<'}</Text></TouchableOpacity>
          <Text style={s.mesTitulo}>{MESES[mes - 1]} {ano}</Text>
          <TouchableOpacity style={s.mesBtn} onPress={() => navMes(1)}><Text style={s.mesBtnTxt}>{'>'}</Text></TouchableOpacity>
        </View>

        {/* Resumo */}
        <View style={s.resumo}>
          <Text style={[s.resumoVal, { color: colors.green }]}>+{fmt(receitas)}</Text>
          <Text style={[s.resumoVal, { color: colors.red }]}>-{fmt(despesas)}</Text>
          <Text style={[s.resumoVal, { color: receitas - despesas >= 0 ? colors.green : colors.red }]}>
            ={fmt(receitas - despesas)}
          </Text>
        </View>

        {/* Botao Novo */}
        {!readOnly && (
          <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
            <Text style={s.btnNovoTxt}>+ Novo lancamento</Text>
          </TouchableOpacity>
        )}

        {erro && <Text style={s.erro}>{erro}</Text>}

        {itens.map(item => (
          <View key={item.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {item.categoriaIcone ? <Text style={{ fontSize: 16 }}>{item.categoriaIcone}</Text> : null}
                <Text style={s.cardDesc} numberOfLines={1}>{item.descricao}</Text>
              </View>
              <Text style={[s.cardValor, { color: item.tipo === 1 ? colors.green : colors.red }]}>
                {item.tipo === 1 ? '+' : '-'}{fmt(item.valor)}
              </Text>
            </View>
            <View style={s.cardBot}>
              <Text style={s.cardMeta}>{dataFmt(item.data)} · {item.categoriaNome ?? 'Sem categoria'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <View style={[s.badge, { backgroundColor: item.situacao === 1 ? colors.green + '25' : '#f59e0b25' }]}>
                  <Text style={{ fontSize: 10, color: item.situacao === 1 ? colors.green : '#f59e0b', fontWeight: '700' }}>
                    {item.situacao === 1 ? 'Pago' : 'Pendente'}
                  </Text>
                </View>
                {!readOnly && (
                  <>
                    <TouchableOpacity onPress={() => abrirEditar(item)}><Text style={s.lnk}>Editar</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => excluir(item)}><Text style={[s.lnk, { color: colors.red }]}>Excluir</Text></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalAberto} transparent animationType="slide" onRequestClose={() => setModalAberto(false)}>
        <View style={s.overlay}>
          <ScrollView style={[s.modal, { backgroundColor: colors.surface }]} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>{editando ? 'Editar' : 'Novo'} lancamento</Text>

            <Text style={s.lbl}>Descricao *</Text>
            <TextInput style={[s.inp, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fDescricao} onChangeText={setFDescricao} placeholder="Ex: Mercado" placeholderTextColor={colors.textSecondary} />

            <Text style={s.lbl}>Valor *</Text>
            <TextInput style={[s.inp, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fValor} onChangeText={setFValor} keyboardType="decimal-pad" placeholder="0,00" placeholderTextColor={colors.textSecondary} />

            <Text style={s.lbl}>Data *</Text>
            <TextInput style={[s.inp, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fData} onChangeText={setFData} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSecondary} />

            <Text style={s.lbl}>Tipo *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.v} style={[s.chip, fTipo === t.v && { backgroundColor: colors.greenDim, borderColor: colors.green }]} onPress={() => setFTipo(t.v)}>
                  <Text style={[s.chipTxt, { color: fTipo === t.v ? colors.green : colors.textSecondary }]}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.lbl}>Situacao *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {SITUACOES.map(t => (
                <TouchableOpacity key={t.v} style={[s.chip, fSituacao === t.v && { backgroundColor: colors.greenDim, borderColor: colors.green }]} onPress={() => setFSituacao(t.v)}>
                  <Text style={[s.chipTxt, { color: fSituacao === t.v ? colors.green : colors.textSecondary }]}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.lbl}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: modalCatAberto ? 8 : 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[s.chip, fCatId == null && { backgroundColor: colors.greenDim, borderColor: colors.green }]} onPress={() => setFCatId(null)}>
                  <Text style={[s.chipTxt, { color: fCatId == null ? colors.green : colors.textSecondary }]}>Nenhuma</Text>
                </TouchableOpacity>
                {categorias.map(c => (
                  <TouchableOpacity key={c.id} style={[s.chip, fCatId === c.id && { backgroundColor: colors.greenDim, borderColor: colors.green }]} onPress={() => setFCatId(c.id)}>
                    <Text style={[s.chipTxt, { color: fCatId === c.id ? colors.green : colors.textSecondary }]}>{c.icone ? `${c.icone} ` : ''}{c.nome}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.chip, { backgroundColor: colors.surfaceElevated, borderColor: colors.blue + '80', borderStyle: 'dashed' }]}
                  onPress={() => { setFCatNome(''); setFCatIcone(''); setModalCatAberto(v => !v); }}>
                  <Text style={{ color: colors.blue, fontSize: 16, fontWeight: '700', lineHeight: 18 }}>+</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {modalCatAberto && (
              <View style={{ backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                <Text style={[s.lbl, { marginBottom: 8 }]}>Nova categoria rapida</Text>
                <TextInput
                  style={[s.inp, { marginBottom: 8, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  value={fCatNome} onChangeText={setFCatNome}
                  placeholder="Nome" placeholderTextColor={colors.textSecondary} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {ICONES_RAPIDOS.map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={{ width: 38, height: 38, borderRadius: 8, borderWidth: 1.5,
                        borderColor: fCatIcone === ic ? colors.green : colors.border,
                        backgroundColor: fCatIcone === ic ? colors.greenDim : colors.surface,
                        justifyContent: 'center', alignItems: 'center' }}
                      onPress={() => setFCatIcone(prev => prev === ic ? '' : ic)}>
                      <Text style={{ fontSize: 20 }}>{ic}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.btn, { backgroundColor: colors.blue }]}
                  onPress={salvarCategoria} disabled={salvandoCat || !fCatNome.trim()}>
                  {salvandoCat
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>Criar e selecionar</Text>}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.surfaceElevated }]} onPress={() => setModalAberto(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.green }]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background, padding: 16 },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  erro: { color: c.red, marginBottom: 8 },
  mesNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 20 },
  mesBtn: { backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  mesBtnTxt: { color: c.text, fontSize: 16, fontWeight: '700' },
  mesTitulo: { color: c.text, fontSize: 17, fontWeight: '800', minWidth: 110, textAlign: 'center' },
  resumo: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 12 },
  resumoVal: { fontSize: 13, fontWeight: '700' },
  btnNovo: { backgroundColor: c.green, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  btnNovoTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardDesc: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
  cardValor: { fontSize: 14, fontWeight: '800', marginLeft: 8 },
  cardBot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMeta: { color: c.textSecondary, fontSize: 11 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  lnk: { color: c.blue, fontSize: 12, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' },
  modal: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitulo: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  lbl: { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  inp: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 4 },
  chip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
