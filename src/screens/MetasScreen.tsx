import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert, Image,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { gestaoService, MetaDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { brl, dataBR } from '../utils/format';

const STATUS_MAP: Record<number, { label: string; cor: string }> = {
  1: { label: 'Em andamento', cor: '#f59e0b' },
  2: { label: 'Concluída',    cor: '#22c55e' },
  3: { label: 'Cancelada',    cor: '#ef4444' },
};

function fmt(v: number) {
  return brl(v);
}
function fmtMes(d: string | null | undefined) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}
function mesesDecorridos(criadoEm: string) {
  const ini = new Date(criadoEm);
  const now = new Date();
  return (now.getFullYear() - ini.getFullYear()) * 12 + (now.getMonth() - ini.getMonth());
}

// SVG Donut
function Donut({ pct, size = 80, stroke = 9, color }: { pct: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct, 1) * circ;
  const cx = size / 2;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={cx} cy={cx} r={r} stroke="#ffffff18" strokeWidth={stroke} fill="none" />
      <Circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
    </Svg>
  );
}

const ICONES_META = ['🎯','🏠','🚗','✈️','🎓','💍','👶','🏋️','💻','📱','🏖️','🛳️','🏔️','🎸','📚','💊','🌍','🏗️','🐾','🎨','⚽','🎭','🍕','🛒','💰','🏆','🎪','🌱','🔑','🎁'];
const CORES_META = ['#1e293b','#22c55e','#a855f7','#ef4444','#3b82f6','#ca8a04','#7c3aed','#e11d48','#0d9488','#f97316','#84cc16','#06b6d4'];

interface FormState {
  titulo: string; descricao: string; valorMeta: string; valorAtual: string;
  prazo: string; contribuicaoMensalValor: string; contribuicaoDia: string;
  icone: string; corFundo: string;
}
const VAZIO: FormState = { titulo: '', descricao: '', valorMeta: '', valorAtual: '0', prazo: '', contribuicaoMensalValor: '', contribuicaoDia: '', icone: '🎯', corFundo: '#1e293b' };

export default function MetasScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();
  const readOnly = !!cliente?.clienteId;
  const { width } = useWindowDimensions();
  const numCols = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  const [lista,      setLista]      = useState<MetaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [detalhe,    setDetalhe]    = useState<MetaDto | null>(null);

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
      descricao:  m.descricao ?? '',
      valorMeta:  m.valorMeta.toString(),
      valorAtual: m.valorAtual.toString(),
      prazo:      m.dataMeta ? m.dataMeta.split('T')[0] : '',
      contribuicaoMensalValor: m.contribuicaoMensalValor?.toString() ?? '',
      contribuicaoDia: m.contribuicaoDia?.toString() ?? '',
      icone:    m.capa ?? '🎯',
      corFundo: m.corFundo ?? '#1e293b',
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
      descricao:  form.descricao.trim() || null,
      valorMeta:  meta,
      valorAtual: atual,
      dataMeta:   form.prazo || null,
      contribuicaoMensalValor: form.contribuicaoMensalValor ? parseFloat(form.contribuicaoMensalValor.replace(',', '.')) : null,
      contribuicaoDia: form.contribuicaoDia ? parseInt(form.contribuicaoDia) : null,
      capa:     form.icone || null,
      corFundo: form.corFundo || null,
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

  const listaFiltrada = lista;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={s.topBar}>
        <View>
          <Text style={s.titulo}>Metas</Text>
          <Text style={s.subtitulo}>Suas metas financeiras</Text>
        </View>
        {!readOnly && (
          <TouchableOpacity style={s.btnNovo} onPress={abrirNovo}>
            <Text style={s.btnNovoTxt}>+ Nova Meta</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {erro && <Text style={s.erro}>{erro}</Text>}

        {listaFiltrada.length === 0 && (
          <View style={s.vazio}>
            <Text style={s.vazioIco}>🎯</Text>
            <Text style={s.vazioTxt}>Nenhuma meta cadastrada.</Text>
            <Text style={s.vazioSub}>{readOnly ? 'Este cliente ainda não cadastrou metas.' : 'Toque em "+ Nova Meta" para adicionar.'}</Text>
          </View>
        )}

        {/* Card grid */}
        {listaFiltrada.length > 0 && (
          <View style={[s.grid, { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }]}>
            {listaFiltrada.map(m => (
              <MetaCard
                key={m.id}
                m={m}
                colors={colors}
                numCols={numCols}
                onPress={() => setDetalhe(m)}
                onEdit={!readOnly ? abrirEdicao : undefined}
                onDelete={!readOnly ? confirmarExclusao : undefined}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detalhe} animationType="fade" transparent onRequestClose={() => setDetalhe(null)}>
        <View style={s.overlay}>
          <View style={s.detalheCard}>
            {detalhe && <DetalhePanel m={detalhe} colors={colors} onClose={() => setDetalhe(null)}
              onEdit={!readOnly ? (m) => { setDetalhe(null); abrirEdicao(m); } : undefined}
              onDelete={!readOnly ? (m) => { setDetalhe(null); confirmarExclusao(m); } : undefined} />}
          </View>
        </View>
      </Modal>

      {/* CRUD Modal */}
      <Modal visible={modalVisivel} animationType="slide" transparent onRequestClose={() => setModalVisivel(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={s.modalTitulo}>{editando ? 'Editar meta' : 'Nova meta'}</Text>

            <Text style={s.label}>TÍTULO *</Text>
            <TextInput style={s.input} value={form.titulo} onChangeText={v => setForm(f => ({ ...f, titulo: v }))}
              placeholder="Ex: Casa própria" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>DESCRIÇÃO</Text>
            <TextInput style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              value={form.descricao} onChangeText={v => setForm(f => ({ ...f, descricao: v }))}
              placeholder="Descreva sua meta..." placeholderTextColor={colors.inputPlaceholder} multiline />

            <Text style={s.label}>VALOR DA META (R$) *</Text>
            <TextInput style={s.input} value={form.valorMeta} onChangeText={v => setForm(f => ({ ...f, valorMeta: v }))}
              placeholder="Ex: 1000000" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>DATA LIMITE</Text>
            <TextInput style={s.input} value={form.prazo} onChangeText={v => setForm(f => ({ ...f, prazo: v }))}
              placeholder="Ex: 2030-12-31" placeholderTextColor={colors.inputPlaceholder} />

            <Text style={s.label}>ÍCONE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {ICONES_META.map(ico => (
                <TouchableOpacity key={ico}
                  style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                    borderWidth: 2, borderColor: form.icone === ico ? colors.green : colors.border,
                    backgroundColor: form.icone === ico ? colors.greenDim : colors.surfaceElevated }]}
                  onPress={() => setForm(f => ({ ...f, icone: ico }))}>
                  <Text style={{ fontSize: 22 }}>{ico}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>COR DO CARD</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {CORES_META.map(cor => (
                <TouchableOpacity key={cor}
                  style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: cor,
                    borderWidth: form.corFundo === cor ? 3 : 1,
                    borderColor: form.corFundo === cor ? '#fff' : 'transparent' }}
                  onPress={() => setForm(f => ({ ...f, corFundo: cor }))} />
              ))}
            </View>

            <Text style={[s.label, { marginTop: 4 }]}>CONTRIBUIÇÃO AUTOMÁTICA (OPCIONAL)</Text>
            <Text style={[s.label, { fontWeight: '400', marginTop: 0 }]}>VALOR MENSAL (R$)</Text>
            <TextInput style={s.input} value={form.contribuicaoMensalValor} onChangeText={v => setForm(f => ({ ...f, contribuicaoMensalValor: v }))}
              placeholder="Ex: 300,00" placeholderTextColor={colors.inputPlaceholder} keyboardType="decimal-pad" />

            <Text style={s.label}>DIA DO MÊS (1-28)</Text>
            <TextInput style={s.input} value={form.contribuicaoDia} onChangeText={v => setForm(f => ({ ...f, contribuicaoDia: v }))}
              placeholder="Ex: 5" placeholderTextColor={colors.inputPlaceholder} keyboardType="number-pad" />

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

// ─── MetaCard ────────────────────────────────────────────────────────────────

function MetaCard({ m, colors, numCols, onPress, onEdit, onDelete }: {
  m: MetaDto;
  colors: ReturnType<typeof useTheme>['colors'];
  numCols: number;
  onPress: () => void;
  onEdit?: (m: MetaDto) => void;
  onDelete?: (m: MetaDto) => void;
}) {
  const pct = m.valorMeta > 0 ? Math.min(m.valorAtual / m.valorMeta, 1) : 0;
  const pctPct = (pct * 100).toFixed(1);
  const statusInfo = STATUS_MAP[m.status] ?? STATUS_MAP[1];
  const donutColor = pct >= 1 ? '#22c55e' : statusInfo.cor;
  const cardWidth = `${(100 / numCols) - 1}%` as any;

  return (
    <TouchableOpacity
      style={[{ width: cardWidth, minWidth: 260 }, {
        backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden',
      }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Banner: cor de fundo + ícone + nome */}
      <View style={{ width: '100%', minHeight: 80, backgroundColor: m.corFundo ?? colors.surfaceElevated,
        paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 28 }}>{m.capa ?? '🎯'}</Text>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 }} numberOfLines={2}>{m.titulo}</Text>
        </View>
      </View>

      {/* Status badge overlay */}
      <View style={{ position: 'absolute', top: 10, right: 10,
        backgroundColor: statusInfo.cor, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{statusInfo.label}</Text>
      </View>

      {/* Content */}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* Donut */}
          <View style={{ position: 'relative', width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
            <Donut pct={pct} size={72} stroke={8} color={donutColor} />
            <View style={{ position: 'absolute' }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{pctPct}%</Text>
            </View>
          </View>

          {/* Info */}
          <View style={{ flex: 1, gap: 6 }}>
            {m.contribuicaoMensalValor != null && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Planejado Mensal</Text>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
                  {fmt(m.contribuicaoMensalValor)} / mês
                </Text>
                {m.dataMeta && (
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>até {fmtMes(m.dataMeta)}</Text>
                )}
              </View>
            )}
            {m.contribuicaoMensalValor == null && m.dataMeta && (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>até {fmtMes(m.dataMeta)}</Text>
            )}

            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                • Acumulado ({pctPct}%){'  '}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{fmt(m.valorAtual)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                • Meta{'  '}
              </Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11 }}>{fmt(m.valorMeta)}</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── DetalhePanel ────────────────────────────────────────────────────────────

function DetalhePanel({ m, colors, onClose, onEdit, onDelete }: {
  m: MetaDto;
  colors: ReturnType<typeof useTheme>['colors'];
  onClose: () => void;
  onEdit?: (m: MetaDto) => void;
  onDelete?: (m: MetaDto) => void;
}) {
  const pct = m.valorMeta > 0 ? Math.min(m.valorAtual / m.valorMeta, 1) : 0;
  const statusInfo = STATUS_MAP[m.status] ?? STATUS_MAP[1];
  const donutColor = pct >= 1 ? '#22c55e' : statusInfo.cor;
  const falta = Math.max(m.valorMeta - m.valorAtual, 0);
  const meses = mesesDecorridos(m.criadoEm);
  const atrasada = m.status === 1 && pct < 0.5 && meses > 3;

  const Metric = ({ label, value }: { label: string; value: string }) => (
    <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, flex: 1, minWidth: 130 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{value}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>Detalhes da meta</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onEdit && (
            <TouchableOpacity onPress={() => onEdit(m)} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18 }}>✏️</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={() => onDelete(m)} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 20 }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Capa */}
      {m.capa ? (
        <Image source={{ uri: m.capa }} style={{ width: '100%', height: 160, borderRadius: 12, marginBottom: 16 }} resizeMode="cover" />
      ) : null}

      {/* Status badge */}
      <View style={{ alignSelf: 'flex-end', marginBottom: 8 }}>
        <View style={{ backgroundColor: statusInfo.cor, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{statusInfo.label}</Text>
        </View>
      </View>

      {/* Title + atraso */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{m.titulo}</Text>
        {atrasada && <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Atenção: sua meta está atrasada</Text>}
      </View>

      {/* Donut + aporte */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <View style={{ position: 'relative', width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
          <Donut pct={pct} size={90} stroke={10} color={donutColor} />
          <View style={{ position: 'absolute' }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' }}>
              {(pct * 100).toFixed(1)}%
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {m.contribuicaoMensalValor != null && (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Planejado Mensal</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                {fmt(m.contribuicaoMensalValor)} / mês
              </Text>
              {m.dataMeta && (
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>até {fmtMes(m.dataMeta)}</Text>
              )}
            </>
          )}
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>
            • Acumulado ({(pct * 100).toFixed(1)}%)
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            • Desde o início: {meses} mês(es)
          </Text>
        </View>
      </View>

      {/* Metrics grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <Metric label="Valor da meta"         value={fmt(m.valorMeta)} />
        <Metric label="Valor acumulado"        value={fmt(m.valorAtual)} />
        <Metric label="Falta alcançar"         value={fmt(falta)} />
        {m.dataMeta && <Metric label="Prazo final"  value={dataBR(m.dataMeta)} />}
        {m.contribuicaoMensalValor != null && <Metric label="Aporte mensal" value={fmt(m.contribuicaoMensalValor)} />}
        <Metric label="Meses desde o início"   value={`${meses} mês(es)`} />
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  topBar:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 12 },
  titulo:      { color: c.text, fontSize: 20, fontWeight: '800' },
  subtitulo:   { color: c.textSecondary, fontSize: 13 },
  btnNovo:     { backgroundColor: c.green, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 18 },
  btnNovoTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  scrollContent:{ padding: 16, paddingTop: 0, paddingBottom: 40 },
  grid:        { },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  erro:        { color: c.red, fontSize: 14, marginBottom: 12 },
  vazio:       { alignItems: 'center', marginTop: 60 },
  vazioIco:    { fontSize: 48, marginBottom: 12 },
  vazioTxt:    { color: c.text, fontSize: 16, fontWeight: '700' },
  vazioSub:    { color: c.textSecondary, fontSize: 13, marginTop: 4 },
  overlay:     { flex: 1, backgroundColor: '#000a', justifyContent: 'center', alignItems: 'center', padding: 16 },
  detalheCard: { backgroundColor: c.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 600, maxHeight: '90%' },
  modalCard:   { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%', width: '100%' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 12 },
  btnModal:    { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar: { backgroundColor: c.surfaceElevated },
  btnCancelarTxt:{ color: c.textSecondary, fontWeight: '700' },
  btnSalvar:   { backgroundColor: c.green },
  btnSalvarTxt:{ color: '#fff', fontWeight: '700' },
});
