import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { gestaoService, CategoriaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';

const TIPOS = [{ v: 1, l: 'Receita' }, { v: 2, l: 'Despesa' }];

const ICONES_DESPESA = [
  '🍽️','🛒','🚗','🏠','📱','👕','💊','📚',
  '🎨','🎵','🎸','🎮','🧔','🏋️','⚽','🐶',
  '🛠️','💻','💡','✈️','🏨','🚌','🍺','🚨',
  '📈','🧙','💰','🎁','🤝','📦',
];
const ICONES_RECEITA = [
  '💰','💵','💳','🏦','💹','💼','🏆','⭐',
  '📈','🤝','👨‍💻','🏢','🌟','💪','🎉','🚀',
  '🌿','🌻','🌈','❤️',
];

export default function CategoriasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;

  const [itens,      setItens]      = useState<CategoriaDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editando,   setEditando]   = useState<CategoriaDto | null>(null);
  const [fNome,      setFNome]      = useState('');
  const [fTipo,      setFTipo]      = useState(2);
  const [fLimite,    setFLimite]    = useState('');
  const [fIcone,     setFIcone]     = useState('');
  const [fCor,       setFCor]       = useState('');
  const [salvando,   setSalvando]   = useState(false);

  const load = useCallback(async () => {
    try { setItens((await gestaoService.categorias()).items); }
    catch { Alert.alert('Erro', 'Nao foi possivel carregar.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function abrir(item?: CategoriaDto) {
    setEditando(item ?? null);
    setFNome(item?.nome ?? ''); setFTipo(item?.tipo ?? 2);
    setFLimite(item?.limiteMensal?.toString() ?? '');
    setFIcone(item?.icone ?? ''); setFCor(item?.cor ?? '');
    setModalOpen(true);
  }

  async function salvar() {
    if (!fNome.trim()) { Alert.alert('Validacao', 'Nome obrigatorio.'); return; }
    setSalvando(true);
    const payload = { nome: fNome.trim(), tipo: fTipo, limiteMensal: fLimite ? parseFloat(fLimite) : null, icone: fIcone || null, cor: fCor || null };
    try {
      if (editando) await gestaoService.atualizarCategoria(editando.id, payload);
      else          await gestaoService.criarCategoria(payload);
      setModalOpen(false); await load();
    } catch { Alert.alert('Erro', 'Nao foi possivel salvar.'); }
    finally { setSalvando(false); }
  }

  async function excluir(item: CategoriaDto) {
    Alert.alert('Remover', `Remover "${item.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try { await gestaoService.deletarCategoria(item.id); await load(); }
        catch { Alert.alert('Erro', 'Nao foi possivel remover.'); }
      }},
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.green} /></View>;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.titulo}>Categorias</Text>
        {!readOnly && (
          <TouchableOpacity style={s.btnNovo} onPress={() => abrir()}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Nova</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={itens}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.cardLeft}>
              {item.icone ? <Text style={{ fontSize: 20 }}>{item.icone}</Text> : null}
              <View>
                <Text style={s.cardNome}>{item.nome}</Text>
                <Text style={s.cardMeta}>{item.tipo === 1 ? 'Receita' : 'Despesa'}{item.limiteMensal ? `  ·  limite R$ ${item.limiteMensal.toFixed(0)}` : ''}</Text>
              </View>
            </View>
            {!readOnly && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => abrir(item)}><Text style={{ color: colors.blue, fontSize: 13 }}>Editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => excluir(item)}><Text style={{ color: colors.red, fontSize: 13 }}>Excluir</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>{editando ? 'Editar' : 'Nova'} categoria</Text>
            <Text style={s.lbl}>Nome *</Text>
            <TextInput style={s.inp} value={fNome} onChangeText={setFNome} placeholderTextColor={colors.textSecondary} placeholder="Ex: Mercado" />
            <Text style={s.lbl}>Tipo *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t.v} style={[s.chip, fTipo === t.v && { backgroundColor: colors.greenDim, borderColor: colors.green }]} onPress={() => setFTipo(t.v)}>
                  <Text style={{ color: fTipo === t.v ? colors.green : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>Limite mensal (opcional)</Text>
            <TextInput style={s.inp} value={fLimite} onChangeText={setFLimite} keyboardType="decimal-pad" placeholder="Ex: 500" placeholderTextColor={colors.textSecondary} />
            <Text style={s.lbl}>Icone</Text>
            <View style={s.iconeGrid}>
              {(fTipo === 1 ? ICONES_RECEITA : ICONES_DESPESA).map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[s.iconeBtn, fIcone === ic && { borderColor: colors.green, backgroundColor: colors.greenDim }]}
                  onPress={() => setFIcone(prev => prev === ic ? '' : ic)}
                >
                  <Text style={{ fontSize: 22 }}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.surfaceElevated }]} onPress={() => setModalOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.green }]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 0 },
  titulo: { color: c.text, fontSize: 22, fontWeight: '700' },
  btnNovo: { backgroundColor: c.green, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  card: { backgroundColor: c.surface, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardNome: { color: c.text, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  lbl: { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  inp: { borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 15, color: c.text, backgroundColor: c.background, marginBottom: 2 },
  chip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  iconeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  iconeBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },
});
