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
import { useTranslation } from '../i18n';
import { useAssessoria } from '../contexts/AssessoriaContext';
import { calcularProjecao } from '../utils/projecao';
import { maskMoeda, moedaParaInput, parseMoeda } from '../utils/format';
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
  const { t } = useTranslation();
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
  const [patrimonioManual, setPatrimonioManual] = useState(moedaParaInput(0));
  const [aporte, setAporte]         = useState(moedaParaInput(2000));
  const [taxa, setTaxa]             = useState('4');
  const [retirada, setRetirada]     = useState(moedaParaInput(10000));
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

  const patrimonioInicial = modoAuto ? patrimonioAuto : parseMoeda(patrimonioManual);

  const resultado = useMemo(() => calcularProjecao({
    idadeAtual: int(idadeAtual),
    idadeAlvo: int(idadeAlvo),
    patrimonioInicial,
    aporteMensal: parseMoeda(aporte),
    taxaRetornoRealAnualPct: num(taxa),
    retiradaMensal: parseMoeda(retirada),
    cenarios: cenarios.map(c => ({ tipo: c.tipo, valor: c.valor, idadeInicio: c.idadeInicio, idadeFim: c.idadeFim })),
  }), [idadeAtual, idadeAlvo, patrimonioInicial, aporte, taxa, retirada, cenarios]);

  const serieValores = resultado.pontos.map(p => serie === 'total' ? p.total : p.principal);

  function carregarSimulacao(sim: SimulacaoDto) {
    setEditandoId(sim.id);
    setIdadeAtual(String(sim.idadeAtual));
    setIdadeAlvo(String(sim.idadeAlvo));
    setModoAuto(sim.modoAutomatico);
    setPatrimonioManual(moedaParaInput(sim.patrimonioInicial));
    setAporte(moedaParaInput(sim.aporteMensal));
    setTaxa(String(sim.taxaRetornoRealAnualPct));
    setRetirada(moedaParaInput(sim.retiradaMensal));
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
      nome: nomeSalvar.trim() || t('projecao.nomePadrao'),
      favorita: favSalvar,
      idadeAtual: int(idadeAtual),
      idadeAlvo: int(idadeAlvo),
      patrimonioInicial: modoAuto ? 0 : parseMoeda(patrimonioManual),
      modoAutomatico: modoAuto,
      aporteMensal: parseMoeda(aporte),
      taxaRetornoRealAnualPct: num(taxa),
      retiradaMensal: parseMoeda(retirada),
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
      Alert.alert(t('projecao.erroTitulo'), t('projecao.erroSalvar'));
    }
  }

  async function excluirSimulacao(sim: SimulacaoDto) {
    Alert.alert(t('common.remover'), t('projecao.confirmarRemover', { nome: sim.nome }), [
      { text: t('common.cancelar'), style: 'cancel' },
      { text: t('common.remover'), style: 'destructive', onPress: async () => {
        try {
          await simulacaoService.deletar(sim.id);
          if (editandoId === sim.id) novaSimulacao();
          await load();
        } catch { Alert.alert(t('projecao.erroTitulo'), t('projecao.erroRemover')); }
      } },
    ]);
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const formCard = (
    <View style={s.card}>
      <Text style={s.cardTitulo}>{t('projecao.dadosTitulo')}</Text>
      <Text style={s.cardSub}>{t('projecao.dadosSub')}</Text>

      <View style={s.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{t('projecao.idadeAtual')}</Text>
          <TextInput style={s.input} value={idadeAtual} onChangeText={setIdadeAtual} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{t('projecao.idadeAlvo')}</Text>
          <TextInput style={s.input} value={idadeAlvo} onChangeText={setIdadeAlvo} keyboardType="number-pad" />
        </View>
      </View>

      <Text style={s.label}>{t('projecao.patrimonioAtual')}</Text>
      <View style={s.toggleRow}>
        <TouchableOpacity style={[s.toggle, modoAuto && s.toggleOn]} onPress={() => setModoAuto(true)}>
          <Text style={[s.toggleTxt, modoAuto && s.toggleTxtOn]}>{t('projecao.automatico')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggle, !modoAuto && s.toggleOn]} onPress={() => setModoAuto(false)}>
          <Text style={[s.toggleTxt, !modoAuto && s.toggleTxtOn]}>{t('projecao.manual')}</Text>
        </TouchableOpacity>
      </View>
      {modoAuto ? (
        <View style={s.autoBox}>
          <Text style={s.autoLbl}>{t('projecao.patrimonioConsolidado')}</Text>
          <Text style={s.autoVal}>{fmt(patrimonioAuto)}</Text>
        </View>
      ) : (
        <TextInput style={s.input} value={patrimonioManual} onChangeText={v => setPatrimonioManual(maskMoeda(v))}
          keyboardType="decimal-pad" placeholder={t('projecao.phPatrimonio')} placeholderTextColor={colors.inputPlaceholder} />
      )}

      <View style={s.formRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{t('projecao.aporteMensal')}</Text>
          <TextInput style={s.input} value={aporte} onChangeText={v => setAporte(maskMoeda(v))} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{t('projecao.retornoReal')}</Text>
          <TextInput style={s.input} value={taxa} onChangeText={setTaxa} keyboardType="decimal-pad" />
        </View>
      </View>

      <Text style={s.label}>{t('projecao.retiradaMensal')}</Text>
      <TextInput style={s.input} value={retirada} onChangeText={v => setRetirada(maskMoeda(v))} keyboardType="decimal-pad" />
    </View>
  );

  const resultados = (
    <View style={s.metricRow}>
      <View style={s.metric}>
        <Text style={s.metricLbl}>{t('projecao.metricaPatrimonioAlvo')}</Text>
        <Text style={[s.metricVal, { color: colors.green }]}>{fmt(resultado.patrimonioNaIdadeAlvo)}</Text>
        <Text style={s.metricSub}>{t('projecao.projetadoAos', { idade: int(idadeAlvo) })}</Text>
      </View>
      <View style={s.metric}>
        <Text style={s.metricLbl}>{t('projecao.metricaExtincao')}</Text>
        {resultado.sustentavel ? (
          <>
            <Text style={[s.metricVal, { color: colors.green }]}>{t('projecao.nunca')}</Text>
            <Text style={s.metricSub}>{t('projecao.recursosSustentaveis')}</Text>
          </>
        ) : (
          <>
            <Text style={[s.metricVal, { color: colors.red }]}>{t('projecao.anos', { n: resultado.idadeExtincao ?? '-' })}</Text>
            <Text style={s.metricSub}>{t('projecao.saldoZera')}</Text>
          </>
        )}
      </View>
    </View>
  );

  const graficoCard = (
    <View style={s.card}>
      <View style={s.chartHeader}>
        <Text style={s.cardTitulo}>{t('projecao.evolucaoTitulo')}</Text>
        <View style={s.serieToggle}>
          <TouchableOpacity onPress={() => setSerie('total')}>
            <Text style={[s.serieTxt, serie === 'total' && { color: colors.green }]}>● {t('projecao.totalProjetado')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSerie('principal')}>
            <Text style={[s.serieTxt, serie === 'principal' && { color: colors.blue }]}>● {t('projecao.principalInvestido')}</Text>
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
          xStart={t('projecao.anos', { n: int(idadeAtual) })}
          xEnd={t('projecao.anos', { n: resultado.pontos[resultado.pontos.length - 1]?.idade ?? int(idadeAlvo) })}
          formatY={(v) => ocultar ? '•••' : `R$ ${resumido(v)}`}
        />
      </View>
    </View>
  );

  const cenariosCard = (
    <View style={s.card}>
      <View style={s.chartHeader}>
        <Text style={s.cardTitulo}>{t('projecao.cenariosTitulo')}</Text>
        <TouchableOpacity onPress={() => setCenarioModal(true)}>
          <Text style={s.linkVerde}>+ {t('common.adicionar')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.cardSub}>{t('projecao.cenariosSub')}</Text>
      {cenarios.length === 0 && <Text style={s.vazio}>{t('projecao.cenariosVazio')}</Text>}
      {cenarios.map((c, i) => (
        <View key={i} style={s.cenRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cenNome}>{c.nome}</Text>
            <Text style={s.cenMeta}>
              {c.tipo === 1 ? t('projecao.aporteExtra') : t('projecao.resgateExtra')} · {c.idadeFim == null ? t('projecao.aosIdade', { idade: c.idadeInicio }) : t('projecao.deAte', { inicio: c.idadeInicio, fim: c.idadeFim })}
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
        <Text style={s.cardTitulo}>{t('projecao.salvasTitulo')}</Text>
        {editandoId && <TouchableOpacity onPress={novaSimulacao}><Text style={s.linkVerde}>{t('projecao.nova')}</Text></TouchableOpacity>}
      </View>
      {salvas.length === 0 && <Text style={s.vazio}>{t('projecao.salvasVazio')}</Text>}
      {salvas.map(sim => (
        <TouchableOpacity key={sim.id} style={[s.simRow, editandoId === sim.id && s.simRowAtiva]} onPress={() => carregarSimulacao(sim)}>
          <Text style={s.simFav}>{sim.favorita ? '★' : '☆'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.simNome}>{sim.nome}</Text>
            <Text style={s.simMeta}>{t('projecao.simMeta', { atual: sim.idadeAtual, alvo: sim.idadeAlvo, n: sim.cenarios.length })}</Text>
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
          <Text style={s.title}>{t('projecao.titulo')}</Text>
          <Text style={s.subtitle}>{t('projecao.subtitulo')}</Text>
        </View>
        {!readOnly && (
          <TouchableOpacity style={s.btnSalvar} onPress={() => setSalvarModal(true)}>
            <Text style={s.btnSalvarTxt}>💾 {t('common.salvar')}</Text>
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
            <Text style={s.modalTitulo}>{editandoId ? t('projecao.atualizarSimulacao') : t('projecao.salvarSimulacao')}</Text>
            <Text style={s.label}>{t('projecao.nome')}</Text>
            <TextInput style={s.input} value={nomeSalvar} onChangeText={setNomeSalvar}
              placeholder={t('projecao.phNomeSimulacao')} placeholderTextColor={colors.inputPlaceholder} />
            <TouchableOpacity style={s.favRow} onPress={() => setFavSalvar(f => !f)}>
              <Text style={s.favStar}>{favSalvar ? '★' : '☆'}</Text>
              <Text style={s.favTxt}>{t('projecao.marcarFavorita')}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setSalvarModal(false)}>
                <Text style={s.btnCancelarTxt}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnConfirmar]} onPress={salvar}>
                <Text style={s.btnConfirmarTxt}>{editandoId ? t('projecao.atualizar') : t('common.salvar')}</Text>
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
  const { t } = useTranslation();
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
      nome: nome.trim(), tipo, valor: parseMoeda(valor),
      idadeInicio: int(ini), idadeFim: unico ? null : (fim ? int(fim) : null),
    });
    setNome(''); setValor(''); setIni(''); setFim(''); setTipo(2); setUnico(true);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView style={s.modalCardBottom} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={s.modalTitulo}>{t('projecao.novoCenario')}</Text>

          <Text style={s.label}>{t('projecao.nome')}</Text>
          <TextInput style={s.input} value={nome} onChangeText={setNome}
            placeholder={t('projecao.phNomeCenario')} placeholderTextColor={colors.inputPlaceholder} />

          <Text style={s.label}>{t('projecao.tipo')}</Text>
          <View style={s.toggleRow}>
            <TouchableOpacity style={[s.toggle, tipo === 1 && s.toggleOn]} onPress={() => setTipo(1)}>
              <Text style={[s.toggleTxt, tipo === 1 && s.toggleTxtOn]}>{t('projecao.aporteExtra')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.toggle, tipo === 2 && s.toggleOn]} onPress={() => setTipo(2)}>
              <Text style={[s.toggleTxt, tipo === 2 && s.toggleTxtOn]}>{t('projecao.resgateExtra')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.label}>{t('projecao.valor')}</Text>
          <TextInput style={s.input} value={valor} onChangeText={v => setValor(maskMoeda(v))} keyboardType="decimal-pad"
            placeholder={t('projecao.phValor')} placeholderTextColor={colors.inputPlaceholder} />

          <TouchableOpacity style={s.favRow} onPress={() => setUnico(u => !u)}>
            <Text style={s.favStar}>{unico ? '☑' : '☐'}</Text>
            <Text style={s.favTxt}>{t('projecao.eventoUnico')}</Text>
          </TouchableOpacity>

          <View style={s.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{unico ? t('projecao.idade') : t('projecao.idadeInicio')}</Text>
              <TextInput style={s.input} value={ini} onChangeText={setIni} keyboardType="number-pad" placeholder={t('projecao.phIdade')} placeholderTextColor={colors.inputPlaceholder} />
            </View>
            {!unico && (
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('projecao.idadeFim')}</Text>
                <TextInput style={s.input} value={fim} onChangeText={setFim} keyboardType="number-pad" placeholder={t('projecao.phIdadeFim')} placeholderTextColor={colors.inputPlaceholder} />
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={onClose}>
              <Text style={s.btnCancelarTxt}>{t('common.cancelar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnModal, s.btnConfirmar]} onPress={add}>
              <Text style={s.btnConfirmarTxt}>{t('common.adicionar')}</Text>
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
