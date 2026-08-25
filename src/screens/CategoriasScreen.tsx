import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { gestaoService, CategoriaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { numBR, maskMoeda, moedaParaInput, parseMoeda } from '../utils/format';

const TIPOS = [{ v: 1, key: 'tipoReceita' }, { v: 2, key: 'tipoDespesa' }];

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
  const { t } = useTranslation();
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
    catch { Alert.alert(t('gpCategorias.erroTitulo'), t('gpCategorias.erroCarregar')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function abrir(item?: CategoriaDto) {
    setEditando(item ?? null);
    setFNome(item?.nome ?? ''); setFTipo(item?.tipo ?? 2);
    setFLimite(item?.limiteMensal != null ? moedaParaInput(item.limiteMensal) : '');
    setFIcone(item?.icone ?? ''); setFCor(item?.cor ?? '');
    setModalOpen(true);
  }

  async function salvar() {
    if (!fNome.trim()) { Alert.alert(t('gpCategorias.validacaoTitulo'), t('gpCategorias.nomeObrigatorio')); return; }
    setSalvando(true);
    const payload = { nome: fNome.trim(), tipo: fTipo, limiteMensal: fLimite ? parseMoeda(fLimite) : null, icone: fIcone || null, cor: fCor || null };
    try {
      if (editando) await gestaoService.atualizarCategoria(editando.id, payload);
      else          await gestaoService.criarCategoria(payload);
      setModalOpen(false); await load();
    } catch { Alert.alert(t('gpCategorias.erroTitulo'), t('gpCategorias.erroSalvar')); }
    finally { setSalvando(false); }
  }

  async function excluir(item: CategoriaDto) {
    Alert.alert(t('common.remover'), t('gpCategorias.confirmRemover', { nome: item.nome }), [
      { text: t('common.cancelar'), style: 'cancel' },
      { text: t('common.remover'), style: 'destructive', onPress: async () => {
        try { await gestaoService.deletarCategoria(item.id); await load(); }
        catch { Alert.alert(t('gpCategorias.erroTitulo'), t('gpCategorias.erroRemover')); }
      }},
    ]);
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.green} /></View>;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.titulo}>{t('gpCategorias.titulo')}</Text>
        {!readOnly && (
          <TouchableOpacity style={s.btnNovo} onPress={() => abrir()}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('gpCategorias.btnNova')}</Text>
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
                <Text style={s.cardMeta}>{item.tipo === 1 ? t('gpCategorias.tipoReceita') : t('gpCategorias.tipoDespesa')}{item.limiteMensal ? t('gpCategorias.cardLimite', { valor: numBR(item.limiteMensal, 2) }) : ''}</Text>
              </View>
            </View>
            {!readOnly && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => abrir(item)}><Text style={{ color: colors.blue, fontSize: 13 }}>{t('common.editar')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => excluir(item)}><Text style={{ color: colors.red, fontSize: 13 }}>{t('common.excluir')}</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>{editando ? t('gpCategorias.modalTituloEditar') : t('gpCategorias.modalTituloNova')}</Text>
            <Text style={s.lbl}>{t('gpCategorias.labelNome')}</Text>
            <TextInput style={s.inp} value={fNome} onChangeText={setFNome} placeholderTextColor={colors.textSecondary} placeholder={t('gpCategorias.phNome')} />
            <Text style={s.lbl}>{t('gpCategorias.labelTipo')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {TIPOS.map(tp => (
                <TouchableOpacity key={tp.v} style={[s.chip, fTipo === tp.v && { backgroundColor: colors.greenDim, borderColor: colors.green }]} onPress={() => setFTipo(tp.v)}>
                  <Text style={{ color: fTipo === tp.v ? colors.green : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{t(`gpCategorias.${tp.key}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.lbl}>{t('gpCategorias.labelLimite')}</Text>
            <TextInput style={s.inp} value={fLimite} onChangeText={v => setFLimite(maskMoeda(v))} keyboardType="decimal-pad" placeholder={t('gpCategorias.phLimite')} placeholderTextColor={colors.textSecondary} />
            <Text style={s.lbl}>{t('gpCategorias.labelIcone')}</Text>
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
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.green }]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.salvar')}</Text>}
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
  titulo: { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '700' },
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
