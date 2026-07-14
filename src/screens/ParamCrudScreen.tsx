import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Modal, TextInput,
  StyleSheet, ActivityIndicator, Switch, ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { parametrosService, ParamItemDto, MoedaParamDto } from '../services/api';

const ICONES_ATIVO = [
  '🏠','🏢','🚗','⛵','✈️','💰','🏗️','🌿',
  '💎','🖥️','📱','📈','🏭','🚜','🛢️','🛤️',
  '⚽','🌻','🎁','◆',
];

const ICONES_INVESTIMENTO = [
  '📊','🏢','🌍','💰','📦','🔗','🌐','💵',
  '📉','📈','🏳️','💳','⭐','🏆','💡','🔒',
  '⚽','🌈','🚀','◆',
];

// ── Tipos de configuracao ─────────────────────────────────────────────────────

type ParamKind = 'tipoAtivo' | 'tipoInvestimento' | 'moeda';

interface ParamCrudConfig {
  kind: ParamKind;
  titulo: string;
}

export const PARAM_CONFIGS: Record<ParamKind, ParamCrudConfig> = {
  tipoAtivo:        { kind: 'tipoAtivo',        titulo: 'Tipos de Ativo' },
  tipoInvestimento: { kind: 'tipoInvestimento', titulo: 'Tipos de Investimento' },
  moeda:            { kind: 'moeda',            titulo: 'Moedas' },
};

// ── Tela ──────────────────────────────────────────────────────────────────────

interface Props { kind: ParamKind; }

type AnyItem = ParamItemDto | MoedaParamDto;

function isMoedaItem(item: AnyItem): item is MoedaParamDto {
  return 'codigo' in item;
}

export default function ParamCrudScreen({ kind }: Props) {
  const { colors } = useTheme();
  const config = PARAM_CONFIGS[kind];
  const isMoeda = kind === 'moeda';

  const [loading,  setLoading]  = useState(false);
  const [items,    setItems]    = useState<AnyItem[]>([]);

  // modal
  const [modalAberto, setModalAberto] = useState(false);
  const [editando,    setEditando]    = useState<AnyItem | null>(null);
  const [fNome,       setFNome]       = useState('');
  const [fCodigo,     setFCodigo]     = useState('');
  const [fOrdem,      setFOrdem]      = useState('');
  const [fAtivo,      setFAtivo]      = useState(true);
  const [fIcone,      setFIcone]      = useState('');
  const [fCotacao,    setFCotacao]    = useState('');
  const [salvando,    setSalvando]    = useState(false);
  const [erroGeral,   setErroGeral]   = useState<string | null>(null);
  const [erroModal,   setErroModal]   = useState<string | null>(null);
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  // Modal de confirmacao de exclusao
  const [confirmItem,   setConfirmItem]   = useState<AnyItem | null>(null);
  const [excluindo,     setExcluindo]     = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      if (kind === 'tipoAtivo')        setItems(await parametrosService.tiposAtivo());
      else if (kind === 'tipoInvestimento') setItems(await parametrosService.tiposInvestimento());
      else                             setItems(await parametrosService.moedas());
    } catch {
      setErroGeral('Nao foi possivel carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() {
    setEditando(null);
    setFNome(''); setFCodigo(''); setFOrdem(''); setFAtivo(true); setFIcone(''); setFCotacao('');
    setErroModal(null); setErroValidacao(null);
    setModalAberto(true);
  }

  function abrirEditar(item: AnyItem) {
    setEditando(item);
    setFNome(item.nome);
    setFCodigo(isMoedaItem(item) ? item.codigo : '');
    setFOrdem(String(item.ordem));
    setFAtivo(item.ativo);
    setFIcone(!isMoedaItem(item) ? (item.icone ?? '') : '');
    setFCotacao(isMoedaItem(item) ? String(item.cotacaoBRL) : '');
    setErroModal(null); setErroValidacao(null);
    setModalAberto(true);
  }

  async function salvar() {
    setErroValidacao(null);
    if (!fNome.trim()) { setErroValidacao('Nome e obrigatorio.'); return; }
    if (isMoeda && !fCodigo.trim()) { setErroValidacao('Codigo e obrigatorio.'); return; }
    const ordem = parseInt(fOrdem) || 0;
    setSalvando(true);
    try {
      if (kind === 'tipoAtivo')
        await parametrosService.salvarTipoAtivo({ id: editando?.id, nome: fNome.trim(), ordem, ativo: fAtivo, icone: fIcone || null });
      else if (kind === 'tipoInvestimento')
        await parametrosService.salvarTipoInvestimento({ id: editando?.id, nome: fNome.trim(), ordem, ativo: fAtivo, icone: fIcone || null });
      else {
        const codigo = fCodigo.trim().toUpperCase();
        const cotacaoBRL = codigo === 'BRL' ? 1 : (parseFloat(fCotacao.replace(',', '.')) || 1);
        await parametrosService.salvarMoeda({ id: editando?.id, codigo, nome: fNome.trim(), cotacaoBRL, ordem, ativo: fAtivo });
      }

      setModalAberto(false);
      await carregar();
    } catch (e: any) {
      setErroModal(e?.response?.data?.title ?? 'Nao foi possivel salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item: AnyItem) {
    if (item.isSystem) {
      setErroGeral('Itens do sistema nao podem ser excluidos. Voce pode desativa-los usando "Ativo".');
      return;
    }
    setConfirmItem(item);
  }

  async function confirmarExclusao() {
    if (!confirmItem) return;
    setExcluindo(true);
    try {
      if (kind === 'tipoAtivo')             await parametrosService.deletarTipoAtivo(confirmItem.id);
      else if (kind === 'tipoInvestimento') await parametrosService.deletarTipoInvestimento(confirmItem.id);
      else                                  await parametrosService.deletarMoeda(confirmItem.id);
      setConfirmItem(null);
      await carregar();
    } catch (e: any) {
      setErroGeral(e?.response?.data?.title ?? 'Nao foi possivel excluir.');
      setConfirmItem(null);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.titulo, { color: colors.text }]}>{config.titulo}</Text>
        <TouchableOpacity style={[s.btnNovo, { backgroundColor: colors.green }]} onPress={abrirNovo}>
          <Text style={s.btnNovoTxt}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {erroGeral && (
        <View style={[s.erroBar, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}>
          <Text style={{ color: '#ef4444', fontSize: 13 }}>{erroGeral}</Text>
          <TouchableOpacity onPress={() => setErroGeral(null)}>
            <Text style={{ color: '#ef4444', fontWeight: '700', marginLeft: 12 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.lista}
          ListEmptyComponent={
            <Text style={[s.vazio, { color: colors.textSecondary }]}>Nenhum item cadastrado.</Text>
          }
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.cardLeft}>
                {!isMoeda && !isMoedaItem(item) && item.icone && (
                  <Text style={{ fontSize: 20 }}>{item.icone}</Text>
                )}
                {isMoeda && isMoedaItem(item) && (
                  <Text style={[s.codigo, { color: colors.green }]}>{item.codigo}</Text>
                )}
                <View style={s.nomeRow}>
                  <Text style={[s.nome, { color: colors.text }]}>{item.nome}</Text>
                  {item.isSystem && (
                    <View style={s.badgeSystem}><Text style={s.badgeSystemTxt}>sistema</Text></View>
                  )}
                  {!item.ativo && (
                    <View style={s.badgeInativo}><Text style={s.badgeInativoTxt}>inativo</Text></View>
                  )}
                </View>
                <Text style={[s.ordem, { color: colors.textSecondary }]}>
                  ordem {item.ordem}
                  {isMoeda && isMoedaItem(item) && item.codigo !== 'BRL' && `  ·  1 ${item.codigo} = R$ ${item.cotacaoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </Text>
              </View>

              <View style={s.cardAcoes}>
                <TouchableOpacity
                  style={[s.btnAcao, { borderColor: colors.border }]}
                  onPress={() => abrirEditar(item)}
                >
                  <Text style={{ color: colors.text, fontSize: 13 }}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.btnAcao}
                  onPress={() => excluir(item)}
                >
                  <Text style={{ color: '#ef4444', fontSize: 13 }}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal criar / editar */}
      <Modal
        visible={modalAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAberto(false)}
      >
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>
              {editando ? 'Editar' : 'Novo'} {
                kind === 'tipoAtivo' ? 'Tipo de Ativo' :
                kind === 'tipoInvestimento' ? 'Tipo de Investimento' :
                'Moeda'
              }
            </Text>

            {isMoeda && (
              <>
                <Text style={[s.label, { color: colors.textSecondary }]}>Codigo (ex: BRL)</Text>
                <TextInput
                  style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={fCodigo}
                  onChangeText={t => setFCodigo(t.toUpperCase())}
                  placeholder="BRL"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  maxLength={10}
                  editable={!editando?.isSystem}
                />
              </>
            )}

            <Text style={[s.label, { color: colors.textSecondary }]}>Nome</Text>
            <TextInput
              style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fNome}
              onChangeText={setFNome}
              placeholder="Nome de exibicao"
              placeholderTextColor={colors.textSecondary}
            />

            {isMoeda && fCodigo.trim().toUpperCase() !== 'BRL' && (
              <>
                <Text style={[s.label, { color: colors.textSecondary }]}>Cotacao em R$ (quanto vale 1 {fCodigo.trim().toUpperCase() || 'unidade'})</Text>
                <TextInput
                  style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  value={fCotacao}
                  onChangeText={setFCotacao}
                  keyboardType="decimal-pad"
                  placeholder="Ex: 5.40"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}

            {!isMoeda && (
              <>
                <Text style={[s.label, { color: colors.textSecondary }]}>Icone</Text>
                <View style={s.iconeGrid}>
                  {(kind === 'tipoAtivo' ? ICONES_ATIVO : ICONES_INVESTIMENTO).map(ic => (
                    <TouchableOpacity
                      key={ic}
                      style={[s.iconeBtn, fIcone === ic && { borderColor: colors.green, backgroundColor: colors.greenDim }]}
                      onPress={() => setFIcone(prev => prev === ic ? '' : ic)}
                    >
                      <Text style={{ fontSize: 22 }}>{ic}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={[s.label, { color: colors.textSecondary }]}>Ordem</Text>
            <TextInput
              style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={fOrdem}
              onChangeText={setFOrdem}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.textSecondary}
            />

            <View style={s.switchRow}>
              <Text style={[s.label, { color: colors.textSecondary, marginBottom: 0 }]}>Ativo</Text>
              <Switch
                value={fAtivo}
                onValueChange={setFAtivo}
                trackColor={{ true: colors.green }}
              />
            </View>

            {erroValidacao && (
              <Text style={s.erroInline}>{erroValidacao}</Text>
            )}

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.btnCancelar, { borderColor: colors.border }]}
                onPress={() => { setModalAberto(false); setErroModal(null); setErroValidacao(null); }}
              >
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSalvar, { backgroundColor: colors.green }]}
                onPress={salvar}
                disabled={salvando}
              >
                {salvando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarTxt}>Salvar</Text>
                }
              </TouchableOpacity>
            </View>
            {erroModal && (
              <Text style={[s.erroInline, { marginTop: 10, textAlign: 'center' }]}>{erroModal}</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: confirmar exclusao */}
      <Modal visible={!!confirmItem} transparent animationType="fade" onRequestClose={() => setConfirmItem(null)}>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitulo, { color: colors.text }]}>Confirmar exclusao</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 24 }}>
              Deseja excluir "{confirmItem?.nome}"? Esta acao nao pode ser desfeita.
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.btnCancelar, { borderColor: colors.border }]}
                onPress={() => setConfirmItem(null)}
                disabled={excluindo}
              >
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSalvar, { backgroundColor: '#ef4444' }]}
                onPress={confirmarExclusao}
                disabled={excluindo}
              >
                {excluindo
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSalvarTxt}>Excluir</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, paddingTop: 16 },
  erroBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  erroInline:  { color: '#ef4444', fontSize: 13, marginTop: 6 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  titulo:      { fontSize: 22, fontWeight: '700' },
  btnNovo:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnNovoTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  lista:       { padding: 16, gap: 10 },
  vazio:       { textAlign: 'center', marginTop: 40, fontSize: 14 },
  card:        { borderRadius: 12, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center' },
  cardLeft:    { flex: 1, gap: 4 },
  codigo:      { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  nomeRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nome:        { fontSize: 16, fontWeight: '600' },
  ordem:       { fontSize: 12, marginTop: 2 },
  badgeSystem: { backgroundColor: '#6366f120', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  badgeSystemTxt: { fontSize: 10, color: '#6366f1', fontWeight: '700' },
  badgeInativo:   { backgroundColor: '#ef444420', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  badgeInativoTxt:{ fontSize: 10, color: '#ef4444', fontWeight: '700' },
  cardAcoes:   { flexDirection: 'column', gap: 6, alignItems: 'flex-end' },
  btnAcao:     { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 5, borderColor: 'transparent' },
  overlay:     { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal:       { width: '100%', maxWidth: 420, borderRadius: 16, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:       { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input:       { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  switchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  modalBtns:   { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnCancelar: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  btnSalvar:   { flex: 1, borderRadius: 8, padding: 13, alignItems: 'center' },
  btnSalvarTxt:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  iconeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  iconeBtn:    { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#33333360', justifyContent: 'center', alignItems: 'center' },
});
