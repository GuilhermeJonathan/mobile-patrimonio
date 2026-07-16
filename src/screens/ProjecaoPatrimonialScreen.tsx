import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, RefreshControl, Alert, useWindowDimensions,
} from 'react-native';
import {
  patrimonioService, simulacaoService, SimulacaoDto, CenarioDto,
} from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { usePrivacy, formatMoney } from '../theme/PrivacyContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { calcularProjecao } from '../utils/projecao';
import LineChart from '../components/charts/LineChart';

function resumido(v: number): string {
  const s = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (a >= 1_000) return `${s}${(a / 1_000).toFixed(0)}k`;
  return `${s}${a.toFixed(0)}`;
}

const num = (s: string) => parseFloat((s || '').replace(',', '.')) || 0;
const int = (s: string) => parseInt(s || '0', 10) || 0;

export default function ProjecaoPatrimonialScreen() {
  const { colors } = useTheme();
  const { ocultar } = usePrivacy();
  const { cliente } = useAssessoria();
  const readOnly = false; // no view-as, assessor/corretor pode editar/salvar projeção
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const chartWidth = isDesktop ? 600 : 300;
  const s = makeStyles(colors);
  const fmt = (v: number) => formatMoney(v, ocultar);

  // parâmetros
  const [idadeAtual, setIdadeAtual] = useState('25');
  const [idadeAlvo, setIdadeAlvo]   = useState('65');
  const [modoAuto, setModoAuto]     = useState(true);
  const [patrimonioManual, setPatrimonioManual] = useState('0');
  const [aporte, setAporte]         = useState('2000');
  const [taxa, setTaxa]             = useState('4');
  const [retirada, setRetirada]     = useState('10000');
  const [cenarios, setCenarios]     = useState<CenarioDto[]>([]);
  const [serie, setSerie]           = useState<'total' | 'principal'>('total');

  // dados externos
  const [patrimonioAuto, setPatrimonioAuto] = useState(0);
  const [salvas, setSalvas]         = useState<SimulacaoDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // modais
  const [cenarioModal, setCenarioModal] = useState(false);
  const [salvarModal, setSalvarModal]   = useState(false);
  const [nomeSalvar, setNomeSalvar]     = useState('');
  const [favSalvar, setFavSalvar]       = useState(false);

  const load = useCallback(async () => {
    try {
      const [resumo, lista] = await Promise.all([
        patrimonioService.resumo().catch(() => null),
        simulacaoService.listar().catch(() => []),
      ]);
      if (resumo) setPatrimonioAuto(resumo.patrimonioLiquidoBRL);
      setSalvas(lista);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patrimonioInicial = modoAuto ? patrimonioAuto : num(patrimonioManual);

  const resultado = useMemo(() => calcularProjecao({
    idadeAtual: int(idadeAtual),
    idadeAlvo: int(idadeAlvo),
    patrimonioInicial,
    aporteMensal: num(aporte),
    taxaRetornoRealAnualPct: num(taxa),
    retiradaMensal: num(retirada),
    cenarios: cenarios.map(c => ({ tipo: c.tipo, valor: c.valor, idadeInicio: c.idadeInicio, idadeFim: c.idadeFim })),
  }), [idadeAtual, idadeAlvo, patrimonioInicial, aporte, taxa, retirada, cenarios]);

  const serieValores = resultado.pontos.map(p => serie === 'total' ? p.total : p.principal);

  function carregarSimulacao(sim: SimulacaoDto) {
    setEditandoId(sim.id);
    setIdadeAtual(String(sim.idadeAtual));
    setIdadeAlvo(String(sim.idadeAlvo));
    setModoAuto(sim.modoAutomatico);
    setPatrimonioManual(String(sim.patrimonioInicial));
    setAporte(String(sim.aporteMensal));
    setTaxa(String(sim.taxaRetornoRealAnualPct));
    setRetirada(String(sim.retiradaMensal));
    setCenarios(sim.cenarios);
    setNomeSalvar(sim.nome);
    setFavSalvar(sim.favorita);
  }

  function novaSimulacao() {
    setEditandoId(null);
    setNomeSalvar('');
    setFavSalvar(false);
    setCenarios([]);
  }

  function payload() {
    return {
      nome: nomeSalvar.trim() || 'Simulação',
      favorita: favSalvar,
      idadeAtual: int(idadeAtual),
      idadeAlvo: int(idadeAlvo),
      patrimonioInicial: modoAuto ? 0 : num(patrimonioManual),
      modoAutomatico: modoAuto,
      aporteMensal: num(aporte),
      taxaRetornoRealAnualPct: num(taxa),
      retiradaMensal: num(retirada),
      cenarios,
    };
  }

  async function salvar() {
    try {
      if (editandoId) await simulacaoService.atualizar(editandoId, payload());
      else            { const { id } = await simulacaoService.criar(payload()); setEditandoId(id); }
      setSalvarModal(false);
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a simulação.');
    }
  }

  async function excluirSimulacao(sim: SimulacaoDto) {
    Alert.alert('Remover', `Remover a simulação "${sim.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
        try {
          await simulacaoService.deletar(sim.id);
          if (editandoId === sim.id) novaSimulacao();
          await load();
        } catch { Alert.alert('Erro', 'Não foi possível remover.'); }
      } },
    ]);
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const formCard = (
    <View style={s.card}>
      <Text style={s.cardTitulo}>Dados da projeção</Text>
      <Text style={s.cardSub}>Ajuste os valores para a sua realidade — o resultado recalcula automaticamente.</Text>

      <View style={s.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Idade atual</Text>
          <TextInput style={s.input} value={idadeAtual} onChangeText={setIdadeAtual} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Idade-alvo</Text>
          <TextInput style={s.input} value={idadeAlvo} onChangeText={setIdadeAlvo} keyboardType="number-pad" />
        </View>
      </View>

      <Text style={s.label}>Patrimônio atual</Text>
      <View style={s.toggleRow}>
        <TouchableOpacity style={[s.toggle, modoAuto && s.toggleOn]} onPress={() => setModoAuto(true)}>
          <Text style={[s.toggleTxt, modoAuto && s.toggleTxtOn]}>Automático</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggle, !modoAuto && s.toggleOn]} onPress={() => setModoAuto(false)}>
          <Text style={[s.toggleTxt, !modoAuto && s.toggleTxtOn]}>Manual</Text>
        </TouchableOpacity>
      </View>
      {modoAuto ? (
        <View style={s.autoBox}>
          <Text style={s.autoLbl}>Patrimônio líquido consolidado</Text>
          <Text style={s.autoVal}>{fmt(patrimonioAuto)}</Text>
        </View>
      ) : (
        <TextInput style={s.input} value={patrimonioManual} onChangeText={setPatrimonioManual}
          keyboardType="decimal-pad" placeholder="Ex: 500000" placeholderTextColor={colors.inputPlaceholder} />
      )}

      <View style={s.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Aporte mensal</Text>
          <TextInput style={s.input} value={aporte} onChangeText={setAporte} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Retorno real % a.a.</Text>
          <TextInput style={s.input} value={taxa} onChangeText={setTaxa} keyboardType="decimal-pad" />
        </View>
      </View>

      <Text style={s.label}>Retirada mensal após a idade-alvo</Text>
      <TextInput style={s.input} value={retirada} onChangeText={setRetirada} keyboardType="decimal-pad" />
    </View>
  );

  const resultados = (
    <View style={s.metricRow}>
      <View style={s.metric}>
        <Text style={s.metricLbl}>Patrimônio na idade-alvo</Text>
        <Text style={[s.metricVal, { color: colors.green }]}>{fmt(resultado.patrimonioNaIdadeAlvo)}</Text>
        <Text style={s.metricSub}>projetado aos {int(idadeAlvo)}</Text>
      </View>
      <View style={s.metric}>
        <Text style={s.metricLbl}>Ano de extinção dos recursos</Text>
        {resultado.sustentavel ? (
          <>
            <Text style={[s.metricVal, { color: colors.green }]}>Nunca</Text>
            <Text style={s.metricSub}>recursos sustentáveis</Text>
          </>
        ) : (
          <>
            <Text style={[s.metricVal, { color: colors.red }]}>{resultado.idadeExtincao} anos</Text>
            <Text style={s.metricSub}>saldo zera nessa idade</Text>
          </>
        )}
      </View>
    </View>
  );

  const graficoCard = (
    <View style={s.card}>
      <View style={s.chartHeader}>
        <Text style={s.cardTitulo}>Evolução do patrimônio</Text>
        <View style={s.serieToggle}>
          <TouchableOpacity onPress={() => setSerie('total')}>
            <Text style={[s.serieTxt, serie === 'total' && { color: colors.green }]}>● Total projetado</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSerie('principal')}>
            <Text style={[s.serieTxt, serie === 'principal' && { color: colors.blue }]}>● Principal investido</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ marginTop: 12, alignItems: 'center' }}>
        <LineChart
          values={serieValores}
          width={chartWidth}
          height={200}
          color={serie === 'total' ? colors.green : colors.blue}
          gridColor={colors.border}
          labelColor={colors.textSecondary}
          xStart={`${int(idadeAtual)} anos`}
          xEnd={`${resultado.pontos[resultado.pontos.length - 1]?.idade ?? int(idadeAlvo)} anos`}
          formatY={(v) => ocultar ? '•••' : `R$ ${resumido(v)}`}
        />
      </View>
    </View>
  );

  const cenariosCard = (
    <View style={s.card}>
      <View style={s.chartHeader}>
        <Text style={s.cardTitulo}>Cenários</Text>
        <TouchableOpacity onPress={() => setCenarioModal(true)}>
          <Text style={s.linkVerde}>+ Adicionar</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.cardSub}>Aportes ou resgates extraordinários testados na projeção</Text>
      {cenarios.length === 0 && <Text style={s.vazio}>Nenhum cenário. A projeção usa só os parâmetros acima.</Text>}
      {cenarios.map((c, i) => (
        <View key={i} style={s.cenRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cenNome}>{c.nome}</Text>
            <Text style={s.cenMeta}>
              {c.tipo === 1 ? 'Aporte extra' : 'Resgate extra'} · {c.idadeFim == null ? `aos ${c.idadeInicio}` : `de ${c.idadeInicio} a ${c.idadeFim}`}
            </Text>
          </View>
          <Text style={[s.cenValor, { color: c.tipo === 1 ? colors.green : colors.red }]}>
            {c.tipo === 1 ? '+' : '-'}{fmt(c.valor)}
          </Text>
          <TouchableOpacity onPress={() => setCenarios(cs => cs.filter((_, idx) => idx !== i))}>
            <Text style={s.remover}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const salvasCard = (
    <View style={s.card}>
      <View style={s.chartHeader}>
        <Text style={s.cardTitulo}>Simulações salvas</Text>
        {editandoId && <TouchableOpacity onPress={novaSimulacao}><Text style={s.linkVerde}>Nova</Text></TouchableOpacity>}
      </View>
      {salvas.length === 0 && <Text style={s.vazio}>Nenhuma simulação salva ainda.</Text>}
      {salvas.map(sim => (
        <TouchableOpacity key={sim.id} style={[s.simRow, editandoId === sim.id && s.simRowAtiva]} onPress={() => carregarSimulacao(sim)}>
          <Text style={s.simFav}>{sim.favorita ? '★' : '☆'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.simNome}>{sim.nome}</Text>
            <Text style={s.simMeta}>{sim.idadeAtual}→{sim.idadeAlvo} anos · {sim.cenarios.length} cenário(s)</Text>
          </View>
          {!readOnly && (
            <TouchableOpacity onPress={() => excluirSimulacao(sim)}><Text style={s.remover}>🗑️</Text></TouchableOpacity>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Projeção Patrimonial</Text>
          <Text style={s.subtitle}>Simule seu futuro financeiro e planeje objetivos de longo prazo</Text>
        </View>
        {!readOnly && (
          <TouchableOpacity style={s.btnSalvar} onPress={() => setSalvarModal(true)}>
            <Text style={s.btnSalvarTxt}>💾 Salvar</Text>
          </TouchableOpacity>
        )}
      </View>

      {isDesktop ? (
        <View style={s.cols}>
          <View style={s.colEsq}>{formCard}</View>
          <View style={s.colDir}>
            {resultados}
            {graficoCard}
            {cenariosCard}
            {salvasCard}
          </View>
        </View>
      ) : (
        <>
          {formCard}
          {resultados}
          {graficoCard}
          {cenariosCard}
          {salvasCard}
        </>
      )}

      <View style={{ height: 24 }} />

      <CenarioModal
        visible={cenarioModal}
        colors={colors}
        onClose={() => setCenarioModal(false)}
        onAdd={(c) => { setCenarios(cs => [...cs, c]); setCenarioModal(false); }}
      />

      {/* Modal salvar */}
      <Modal visible={salvarModal} transparent animationType="fade" onRequestClose={() => setSalvarModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{editandoId ? 'Atualizar simulação' : 'Salvar simulação'}</Text>
            <Text style={s.label}>Nome</Text>
            <TextInput style={s.input} value={nomeSalvar} onChangeText={setNomeSalvar}
              placeholder="Ex: Aposentadoria aos 55" placeholderTextColor={colors.inputPlaceholder} />
            <TouchableOpacity style={s.favRow} onPress={() => setFavSalvar(f => !f)}>
              <Text style={s.favStar}>{favSalvar ? '★' : '☆'}</Text>
              <Text style={s.favTxt}>Marcar como favorita</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setSalvarModal(false)}>
                <Text style={s.btnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnConfirmar]} onPress={salvar}>
                <Text style={s.btnConfirmarTxt}>{editandoId ? 'Atualizar' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Modal de novo cenário ──
function CenarioModal({ visible, colors, onClose, onAdd }: {
  visible: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  onClose: () => void;
  onAdd: (c: CenarioDto) => void;
}) {
  const s = makeStyles(colors);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(2);
  const [valor, setValor] = useState('');
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [unico, setUnico] = useState(true);

  function add() {
    if (!nome.trim() || !valor || !ini) return;
    onAdd({
      nome: nome.trim(), tipo, valor: num(valor),
      idadeInicio: int(ini), idadeFim: unico ? null : (fim ? int(fim) : null),
    });
    setNome(''); setValor(''); setIni(''); setFim(''); setTipo(2); setUnico(true);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={s.modalCardBottom} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={s.modalTitulo}>Novo cenário</Text>

          <Text style={s.label}>Nome</Text>
          <TextInput style={s.input} value={nome} onChangeText={setNome}
            placeholder="Ex: Venda de imóvel" placeholderTextColor={colors.inputPlaceholder} />

          <Text style={s.label}>Tipo</Text>
          <View style={s.toggleRow}>
            <TouchableOpacity style={[s.toggle, tipo === 1 && s.toggleOn]} onPress={() => setTipo(1)}>
              <Text style={[s.toggleTxt, tipo === 1 && s.toggleTxtOn]}>Aporte extra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.toggle, tipo === 2 && s.toggleOn]} onPress={() => setTipo(2)}>
              <Text style={[s.toggleTxt, tipo === 2 && s.toggleTxtOn]}>Resgate extra</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Valor</Text>
          <TextInput style={s.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad"
            placeholder="Ex: 50000" placeholderTextColor={colors.inputPlaceholder} />

          <TouchableOpacity style={s.favRow} onPress={() => setUnico(u => !u)}>
            <Text style={s.favStar}>{unico ? '☑' : '☐'}</Text>
            <Text style={s.favTxt}>Evento único (numa idade). Desmarque para faixa recorrente.</Text>
          </TouchableOpacity>

          <View style={s.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{unico ? 'Idade' : 'Idade início'}</Text>
              <TextInput style={s.input} value={ini} onChangeText={setIni} keyboardType="number-pad" placeholder="Ex: 40" placeholderTextColor={colors.inputPlaceholder} />
            </View>
            {!unico && (
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Idade fim</Text>
                <TextInput style={s.input} value={fim} onChangeText={setFim} keyboardType="number-pad" placeholder="Ex: 50" placeholderTextColor={colors.inputPlaceholder} />
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={onClose}>
              <Text style={s.btnCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnModal, s.btnConfirmar]} onPress={add}>
              <Text style={s.btnConfirmarTxt}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  cols:        { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  colEsq:      { width: 360 },
  colDir:      { flex: 1 },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  btnSalvar:   { backgroundColor: c.green, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
  btnSalvarTxt:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  card:        { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  cardTitulo:  { color: c.text, fontSize: 16, fontWeight: '800' },
  cardSub:     { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 8 },
  formRow:     { flexDirection: 'row', gap: 12 },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  toggleRow:   { flexDirection: 'row', gap: 8, marginBottom: 4 },
  toggle:      { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  toggleOn:    { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  toggleTxt:   { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  toggleTxtOn: { color: c.green },
  autoBox:     { backgroundColor: c.greenDim, borderRadius: 10, padding: 12, marginTop: 4 },
  autoLbl:     { color: c.textSecondary, fontSize: 11 },
  autoVal:     { color: c.green, fontSize: 18, fontWeight: '800', marginTop: 2 },
  metricRow:   { flexDirection: 'row', gap: 12, marginBottom: 14 },
  metric:      { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: c.border },
  metricLbl:   { color: c.textSecondary, fontSize: 12 },
  metricVal:   { fontSize: 20, fontWeight: '900', marginTop: 4 },
  metricSub:   { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serieToggle: { flexDirection: 'row', gap: 12 },
  serieTxt:    { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  linkVerde:   { color: c.green, fontSize: 13, fontWeight: '700' },
  vazio:       { color: c.textTertiary, fontSize: 13, paddingVertical: 6 },
  cenRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.border },
  cenNome:     { color: c.text, fontSize: 14, fontWeight: '600' },
  cenMeta:     { color: c.textSecondary, fontSize: 11, marginTop: 1 },
  cenValor:    { fontSize: 14, fontWeight: '700' },
  remover:     { color: c.textSecondary, fontSize: 14, paddingHorizontal: 4 },
  simRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
  simRowAtiva: { backgroundColor: c.greenDim },
  simFav:      { color: '#f59e0b', fontSize: 18 },
  simNome:     { color: c.text, fontSize: 14, fontWeight: '700' },
  simMeta:     { color: c.textSecondary, fontSize: 11, marginTop: 1 },
  overlay:     { flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 20 },
  modalCard:   { backgroundColor: c.surface, borderRadius: 16, padding: 22 },
  modalCardBottom: { backgroundColor: c.surface, borderRadius: 16, padding: 22, maxHeight: '92%', alignSelf: 'stretch' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  favRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  favStar:     { color: '#f59e0b', fontSize: 20 },
  favTxt:      { color: c.textSecondary, fontSize: 13, flex: 1 },
  btnModal:    { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar: { backgroundColor: c.surfaceElevated },
  btnCancelarTxt: { color: c.textSecondary, fontWeight: '700' },
  btnConfirmar:{ backgroundColor: c.green },
  btnConfirmarTxt: { color: '#fff', fontWeight: '700' },
});
