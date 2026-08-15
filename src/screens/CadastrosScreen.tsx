import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal, TextInput,
  StyleSheet, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { parametrosService, ParamItemDto, MoedaParamDto } from '../services/api';

type Aba = 'tipoAtivo' | 'tipoInvestimento' | 'moeda';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'tipoAtivo',        label: 'cadastros.abaTipoAtivo' },
  { id: 'tipoInvestimento', label: 'cadastros.abaTipoInvestimento' },
  { id: 'moeda',            label: 'cadastros.abaMoeda' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

function BadgeSystem() {
  const { t } = useTranslation();
  return (
    <View style={styles.badgeSystem}>
      <Text style={styles.badgeSystemTxt}>{t('cadastros.badgeSistema')}</Text>
    </View>
  );
}

function BadgeInativo() {
  const { t } = useTranslation();
  return (
    <View style={styles.badgeInativo}>
      <Text style={styles.badgeInativoTxt}>{t('cadastros.badgeInativo')}</Text>
    </View>
  );
}

// ── tela principal ────────────────────────────────────────────────────────────

export default function CadastrosScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [aba, setAba]               = useState<Aba>('tipoAtivo');
  const [loading, setLoading]       = useState(false);
  const [tiposAtivo, setTiposAtivo] = useState<ParamItemDto[]>([]);
  const [tiposInv,   setTiposInv]   = useState<ParamItemDto[]>([]);
  const [moedas,     setMoedas]     = useState<MoedaParamDto[]>([]);

  // modal
  const [modalAberto, setModalAberto]   = useState(false);
  const [editando,    setEditando]      = useState<ParamItemDto | MoedaParamDto | null>(null);
  const [fNome,       setFNome]         = useState('');
  const [fCodigo,     setFCodigo]       = useState('');
  const [fOrdem,      setFOrdem]        = useState('');
  const [fAtivo,      setFAtivo]        = useState(true);
  const [salvando,    setSalvando]      = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [ta, ti, mo] = await Promise.all([
        parametrosService.tiposAtivo(),
        parametrosService.tiposInvestimento(),
        parametrosService.moedas(),
      ]);
      setTiposAtivo(ta);
      setTiposInv(ti);
      setMoedas(mo);
    } catch {
      Alert.alert(t('cadastros.erro'), t('cadastros.erroCarregar'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setFNome(''); setFCodigo(''); setFOrdem(''); setFAtivo(true);
    setModalAberto(true);
  }

  function abrirEditar(item: ParamItemDto | MoedaParamDto) {
    setEditando(item);
    setFNome(item.nome);
    setFCodigo(aba === 'moeda' ? (item as MoedaParamDto).codigo : '');
    setFOrdem(String(item.ordem));
    setFAtivo(item.ativo);
    setModalAberto(true);
  }

  async function salvar() {
    if (!fNome.trim()) { Alert.alert(t('cadastros.validacao'), t('cadastros.nomeObrigatorio')); return; }
    if (aba === 'moeda' && !fCodigo.trim()) { Alert.alert(t('cadastros.validacao'), t('cadastros.codigoObrigatorio')); return; }
    const ordem = parseInt(fOrdem) || 0;
    setSalvando(true);
    try {
      if (aba === 'tipoAtivo') {
        await parametrosService.salvarTipoAtivo({ id: editando?.id, nome: fNome.trim(), ordem, ativo: fAtivo });
      } else if (aba === 'tipoInvestimento') {
        await parametrosService.salvarTipoInvestimento({ id: editando?.id, nome: fNome.trim(), ordem, ativo: fAtivo });
      } else {
        await parametrosService.salvarMoeda({ id: editando?.id, codigo: fCodigo.trim().toUpperCase(), nome: fNome.trim(), cotacaoBRL: 1, ordem, ativo: fAtivo });
      }
      setModalAberto(false);
      await carregar();
    } catch (e: any) {
      Alert.alert(t('cadastros.erro'), e?.response?.data?.title ?? t('cadastros.erroSalvar'));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item: ParamItemDto | MoedaParamDto) {
    if (item.isSystem) { Alert.alert(t('cadastros.naoPermitido'), t('cadastros.itemSistemaNaoExcluir')); return; }
    Alert.alert(t('cadastros.confirmar'), t('cadastros.confirmarExcluir', { nome: item.nome }), [
      { text: t('common.cancelar'), style: 'cancel' },
      {
        text: t('common.excluir'), style: 'destructive', onPress: async () => {
          try {
            if (aba === 'tipoAtivo')        await parametrosService.deletarTipoAtivo(item.id);
            else if (aba === 'tipoInvestimento') await parametrosService.deletarTipoInvestimento(item.id);
            else                            await parametrosService.deletarMoeda(item.id);
            await carregar();
          } catch (e: any) {
            Alert.alert(t('cadastros.erro'), e?.response?.data?.title ?? t('cadastros.erroExcluir'));
          }
        },
      },
    ]);
  }

  const lista: (ParamItemDto | MoedaParamDto)[] =
    aba === 'tipoAtivo' ? tiposAtivo : aba === 'tipoInvestimento' ? tiposInv : moedas;

  const isMoeda = aba === 'moeda';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: colors.text }]}>{t('cadastros.titulo')}</Text>
        <TouchableOpacity style={[styles.btnNovo, { backgroundColor: colors.green }]} onPress={abrirNovo}>
          <Text style={styles.btnNovoTxt}>{t('cadastros.btnNovo')}</Text>
        </TouchableOpacity>
      </View>

      {/* Abas */}
      <View style={[styles.abas, { borderBottomColor: colors.border }]}>
        {ABAS.map(a => (
          <TouchableOpacity key={a.id} style={[styles.aba, aba === a.id && { borderBottomColor: colors.green, borderBottomWidth: 2 }]} onPress={() => setAba(a.id)}>
            <Text style={[styles.abaTxt, { color: aba === a.id ? colors.green : colors.textSecondary }]}>{t(a.label)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={styles.lista}
          ListEmptyComponent={<Text style={[styles.vazio, { color: colors.textSecondary }]}>{t('cadastros.vazio')}</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardLeft}>
                {isMoeda && (
                  <Text style={[styles.codigo, { color: colors.green }]}>{(item as MoedaParamDto).codigo}</Text>
                )}
                <Text style={[styles.nome, { color: colors.text }]}>{item.nome}</Text>
                <View style={styles.badges}>
                  {item.isSystem && <BadgeSystem />}
                  {!item.ativo && <BadgeInativo />}
                  <Text style={[styles.ordem, { color: colors.textSecondary }]}>{t('cadastros.ordemLabel', { n: item.ordem })}</Text>
                </View>
              </View>
              <View style={styles.cardAcoes}>
                <TouchableOpacity style={[styles.btnEditar, { borderColor: colors.border }]} onPress={() => abrirEditar(item)}>
                  <Text style={{ color: colors.text, fontSize: 13 }}>{t('common.editar')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnExcluir} onPress={() => excluir(item)}>
                  <Text style={{ color: '#ef4444', fontSize: 13 }}>{t('common.excluir')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal novo/editar */}
      <Modal visible={modalAberto} transparent animationType="fade" onRequestClose={() => setModalAberto(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitulo, { color: colors.text }]}>
              {editando ? t('common.editar') : t('cadastros.novo')}{' '}
              {aba === 'tipoAtivo' ? t('cadastros.tipoAtivo') : aba === 'tipoInvestimento' ? t('cadastros.tipoInvestimento') : t('cadastros.moeda')}
            </Text>

            {isMoeda && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('cadastros.labelCodigo')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={fCodigo} onChangeText={v => setFCodigo(v.toUpperCase())}
                  placeholder="BRL" placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters" maxLength={10}
                  editable={!editando?.isSystem}
                />
              </>
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('cadastros.labelNome')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fNome} onChangeText={setFNome}
              placeholder={t('cadastros.placeholderNome')} placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('cadastros.labelOrdem')}</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fOrdem} onChangeText={setFOrdem}
              keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>{t('cadastros.labelAtivo')}</Text>
              <Switch value={fAtivo} onValueChange={setFAtivo} trackColor={{ true: colors.green }} />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.btnCancelar, { borderColor: colors.border }]} onPress={() => setModalAberto(false)}>
                <Text style={{ color: colors.text }}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnSalvar, { backgroundColor: colors.green }]} onPress={salvar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSalvarTxt}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, paddingTop: 16 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  titulo:        { fontSize: 22, fontWeight: '700' },
  btnNovo:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnNovoTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  abas:          { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 16, marginBottom: 8 },
  aba:           { flex: 1, alignItems: 'center', paddingVertical: 10 },
  abaTxt:        { fontSize: 13, fontWeight: '600' },
  lista:         { padding: 16, gap: 10 },
  vazio:         { textAlign: 'center', marginTop: 40, fontSize: 14 },
  card:          { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardLeft:      { flex: 1, gap: 4 },
  codigo:        { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  nome:          { fontSize: 15, fontWeight: '600' },
  badges:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ordem:         { fontSize: 11 },
  badgeSystem:   { backgroundColor: '#6366f120', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeSystemTxt:{ fontSize: 10, color: '#6366f1', fontWeight: '600' },
  badgeInativo:  { backgroundColor: '#ef444420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeInativoTxt:{ fontSize: 10, color: '#ef4444', fontWeight: '600' },
  cardAcoes:     { flexDirection: 'row', gap: 8 },
  btnEditar:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  btnExcluir:    { paddingHorizontal: 10, paddingVertical: 5 },
  overlay:       { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:         { width: '100%', maxWidth: 400, borderRadius: 14, padding: 24, gap: 4 },
  modalTitulo:   { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label:         { fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 10 },
  input:         { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
  switchRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  modalBtns:     { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancelar:   { flex: 1, borderWidth: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  btnSalvar:     { flex: 1, borderRadius: 8, padding: 12, alignItems: 'center' },
  btnSalvarTxt:  { color: '#fff', fontWeight: '700' },
});
