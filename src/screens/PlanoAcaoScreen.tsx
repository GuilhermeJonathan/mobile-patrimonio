import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { planoAcaoService, EtapaPlanoInput } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';
import PlanoTrilha from '../components/charts/PlanoTrilha';

type Etapa = { titulo: string; descricao: string; prazo: string; alvo: string; status: number };
type Modo = 'ver' | 'gerenciar';

const GOLD = '#C79A4E';
const STATUS: Record<number, string> = { 1: 'A fazer', 2: 'Em andamento', 3: 'Concluída' };
const novaEtapa = (): Etapa => ({ titulo: '', descricao: '', prazo: '', alvo: '', status: 1 });

function Anel({ pct, sub, colors }: { pct: number; sub: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  const r = 36, C = 2 * Math.PI * r;
  return (
    <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={84} height={84} style={{ position: 'absolute' }}>
        <Circle cx={42} cy={42} r={r} stroke={colors.border} strokeWidth={7} fill="none" />
        <Circle cx={42} cy={42} r={r} stroke={GOLD} strokeWidth={7} fill="none" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} rotation={-90} originX={42} originY={42} />
      </Svg>
      <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>{pct}%</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 10 }}>{sub}</Text>
    </View>
  );
}

export default function PlanoAcaoScreen() {
  const { colors } = useTheme();
  const { cliente } = useAssessoria();
  const emViewAs = !!cliente?.clienteId; // só o assessor no view-as gerencia
  const s = makeStyles(colors);

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modo, setModo] = useState<Modo>('ver');
  const [salvando, setSalvando] = useState(false);
  const [temPlano, setTemPlano] = useState(false);
  const [trilhaW, setTrilhaW] = useState(320);

  const [objetivo, setObjetivo] = useState('');
  const [prazo, setPrazo] = useState('');
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  const statusColor = (st: number) => (st === 3 ? colors.green : st === 2 ? colors.blue : colors.textTertiary);

  const load = useCallback(async () => {
    try {
      const p = await planoAcaoService.get();
      if (p) {
        setTemPlano(true);
        setObjetivo(p.objetivo);
        setPrazo(p.prazo ?? '');
        setEtapas(p.etapas.map(e => ({
          titulo: e.titulo, descricao: e.descricao ?? '', prazo: e.prazo ?? '', alvo: e.alvo ?? '', status: e.status,
        })));
        setModo('ver');
      } else {
        setTemPlano(false);
        setObjetivo(''); setPrazo(''); setEtapas([]);
        setModo(emViewAs ? 'gerenciar' : 'ver'); // assessor sem plano → já entra criando
      }
    } catch {
      setTemPlano(false);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [emViewAs]);

  useEffect(() => { load(); }, [load]);

  const etapasValidas = etapas.filter(e => e.titulo.trim());
  const concluidas = etapasValidas.filter(e => e.status === 3).length;
  const progresso = etapasValidas.length > 0 ? Math.round((concluidas / etapasValidas.length) * 100) : 0;

  function setEtapa(i: number, patch: Partial<Etapa>) {
    setEtapas(es => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function mover(i: number, dir: -1 | 1) {
    setEtapas(es => {
      const j = i + dir;
      if (j < 0 || j >= es.length) return es;
      const cp = [...es];
      [cp[i], cp[j]] = [cp[j], cp[i]];
      return cp;
    });
  }
  function remover(i: number) {
    setEtapas(es => es.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    if (!objetivo.trim()) { Alert.alert('Atenção', 'Informe o objetivo do plano.'); return; }
    setSalvando(true);
    try {
      const payload: EtapaPlanoInput[] = etapas
        .filter(e => e.titulo.trim())
        .map(e => ({ titulo: e.titulo.trim(), descricao: e.descricao, prazo: e.prazo, alvo: e.alvo, status: e.status }));
      await planoAcaoService.salvar(objetivo.trim(), prazo.trim() || null, payload);
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o plano.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  // ─────────── GERENCIAR (assessor) ───────────
  if (modo === 'gerenciar') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{temPlano ? 'Gerenciar Plano' : 'Criar Plano de Ação'}</Text>
            <Text style={s.subtitle}>Defina o objetivo e as etapas da jornada do cliente.</Text>
          </View>
          {temPlano && (
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setModo('ver')}>
              <Text style={s.btnGhostTxt}>Visualizar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.label}>Objetivo</Text>
          <TextInput style={s.input} value={objetivo} onChangeText={setObjetivo}
            placeholder="Ex: Blindar e internacionalizar o patrimônio familiar"
            placeholderTextColor={colors.inputPlaceholder} multiline />
          <Text style={s.label}>Prazo do objetivo (opcional)</Text>
          <TextInput style={s.input} value={prazo} onChangeText={setPrazo}
            placeholder="Ex: 2028" placeholderTextColor={colors.inputPlaceholder} />
        </View>

        {etapas.map((e, i) => (
          <View key={i} style={s.card}>
            <View style={s.etapaHead}>
              <Text style={s.etapaNum}>Etapa {i + 1}</Text>
              <View style={s.etapaActions}>
                <TouchableOpacity onPress={() => mover(i, -1)} disabled={i === 0}>
                  <Text style={[s.act, i === 0 && s.actOff]}>↑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => mover(i, 1)} disabled={i === etapas.length - 1}>
                  <Text style={[s.act, i === etapas.length - 1 && s.actOff]}>↓</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remover(i)}>
                  <Text style={[s.act, { color: colors.red }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TextInput style={s.input} value={e.titulo} onChangeText={t => setEtapa(i, { titulo: t })}
              placeholder="Título (ex: Constituir holding patrimonial)" placeholderTextColor={colors.inputPlaceholder} />
            <TextInput style={[s.input, { minHeight: 56 }]} value={e.descricao} onChangeText={t => setEtapa(i, { descricao: t })}
              placeholder="Descrição (opcional)" placeholderTextColor={colors.inputPlaceholder} multiline />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.labelSm}>Prazo</Text>
                <TextInput style={s.input} value={e.prazo} onChangeText={t => setEtapa(i, { prazo: t })}
                  placeholder="Ex: 2027" placeholderTextColor={colors.inputPlaceholder} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.labelSm}>Alvo</Text>
                <TextInput style={s.input} value={e.alvo} onChangeText={t => setEtapa(i, { alvo: t })}
                  placeholder="Ex: holding ativa" placeholderTextColor={colors.inputPlaceholder} />
              </View>
            </View>
            <Text style={s.labelSm}>Status</Text>
            <View style={s.statusRow}>
              {[1, 2, 3].map(st => (
                <TouchableOpacity key={st} onPress={() => setEtapa(i, { status: st })}
                  style={[s.stChip, e.status === st && { backgroundColor: statusColor(st) + '22', borderColor: statusColor(st) }]}>
                  <Text style={[s.stChipTxt, e.status === st && { color: statusColor(st), fontWeight: '800' }]}>
                    {STATUS[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={s.addBtn} onPress={() => setEtapas(es => [...es, novaEtapa()])}>
          <Text style={s.addBtnTxt}>+ Adicionar etapa</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          {temPlano && (
            <TouchableOpacity style={[s.btn, s.btnGhost, { flex: 1 }]} onPress={() => load()} disabled={salvando}>
              <Text style={s.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btn, s.btnPrimary, { flex: 1 }]} onPress={salvar} disabled={salvando}>
            <Text style={s.btnPrimaryTxt}>{salvando ? 'Salvando…' : 'Salvar plano'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────── VISUALIZAR (gráfico) — cliente e assessor ───────────
  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Plano de Ação</Text>
          <Text style={s.subtitle}>A jornada do cliente rumo ao objetivo</Text>
        </View>
        {emViewAs && temPlano && (
          <View style={s.toggle}>
            <View style={[s.toggleSeg, s.toggleSegOn]}><Text style={s.toggleTxtOn}>Visualizar</Text></View>
            <TouchableOpacity style={s.toggleSeg} onPress={() => setModo('gerenciar')}>
              <Text style={s.toggleTxt}>Gerenciar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!temPlano ? (
        <View style={s.card}>
          <Text style={s.emptyTitle}>{emViewAs ? 'Nenhum plano ainda' : 'Plano em preparação'}</Text>
          <Text style={s.emptyTxt}>
            {emViewAs
              ? 'Monte a jornada deste cliente: defina o objetivo e as etapas até alcançá-lo.'
              : 'Seu assessor ainda não montou seu plano de ação. Em breve ele estará aqui.'}
          </Text>
          {emViewAs && (
            <TouchableOpacity style={[s.btn, s.btnPrimary, { marginTop: 14, alignSelf: 'flex-start' }]} onPress={() => setModo('gerenciar')}>
              <Text style={s.btnPrimaryTxt}>+ Criar plano</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={s.graphCard}>
          <View style={s.objRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.objLabel}>OBJETIVO DO CLIENTE</Text>
              <Text style={s.objText}>{objetivo}</Text>
              {!!prazo && <Text style={s.objPrazo}>Meta · {prazo}</Text>}
              {etapasValidas.length > 0 && (
                <View style={s.chip}>
                  <Text style={s.chipTxt}>
                    {progresso === 100 ? '✓ Objetivo concluído' : `● ${concluidas} de ${etapasValidas.length} etapas`}
                  </Text>
                </View>
              )}
            </View>
            <Anel pct={progresso} sub={`${concluidas} de ${etapasValidas.length}`} colors={colors} />
          </View>

          <View style={{ marginTop: 8, width: '100%' }} onLayout={e => setTrilhaW(Math.round(e.nativeEvent.layout.width))}>
            {etapasValidas.length > 0 ? (
              <PlanoTrilha
                etapas={etapasValidas.map(e => ({ titulo: e.titulo, prazo: e.prazo, status: e.status }))}
                objetivo={objetivo}
                objetivoPrazo={prazo || null}
                width={trilhaW}
                mutedColor={colors.border}
                surfaceColor={colors.surface}
                textColor={colors.text}
                fadeColor={colors.textTertiary}
              />
            ) : (
              <Text style={s.emptyTxt}>Nenhuma etapa cadastrada ainda.</Text>
            )}
          </View>
        </View>
      )}

      {temPlano && etapasValidas.length > 0 && (
        <View style={[s.cardsWrap, { marginTop: 12 }]}>
          {etapasValidas.map((e, i) => {
            const wide = trilhaW >= 560;
            const concl = e.status === 3, atual = e.status === 2;
            return (
              <View key={i} style={[s.stepCard, { width: wide ? '48.5%' : '100%' }, atual && s.stepCardNow]}>
                <View style={s.stepTop}>
                  <View style={[s.stepBadge, concl ? s.badgeDone : atual ? s.badgeNow : s.badgeTodo]}>
                    <Text style={[s.stepBadgeTxt, concl && { color: '#241a08' }, atual && { color: GOLD }]}>{concl ? '✓' : i + 1}</Text>
                  </View>
                  <Text style={s.stepTitulo} numberOfLines={2}>{e.titulo}</Text>
                  {!!e.prazo && <Text style={s.stepPrazo}>{e.prazo}</Text>}
                </View>
                {!!e.descricao && <Text style={s.stepDesc}>{e.descricao}</Text>}
                <View style={s.stepFoot}>
                  <Text style={[s.stepStatus, { color: statusColor(e.status), backgroundColor: statusColor(e.status) + '1e' }]}>{STATUS[e.status]}</Text>
                  {!!e.alvo && <Text style={s.stepAlvo}>{e.alvo}</Text>}
                </View>
              </View>
            );
          })}
          {/* Card do objetivo (destaque) */}
          <View style={[s.stepCard, s.goalCard, { width: '100%' }]}>
            <View style={s.stepTop}>
              <View style={[s.stepBadge, s.badgeGoal]}><Text style={[s.stepBadgeTxt, { color: GOLD }]}>★</Text></View>
              <Text style={[s.stepTitulo, { color: '#fff' }]} numberOfLines={2}>{objetivo}</Text>
              {!!prazo && <Text style={[s.stepPrazo, { color: '#cbd5c9' }]}>{prazo}</Text>}
            </View>
            <View style={s.stepFoot}>
              <Text style={[s.stepStatus, { color: GOLD, backgroundColor: GOLD + '22' }]}>Objetivo final</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },

  toggle:      { flexDirection: 'row', borderWidth: 1, borderColor: c.border, borderRadius: 10, overflow: 'hidden' },
  toggleSeg:   { paddingVertical: 8, paddingHorizontal: 14 },
  toggleSegOn: { backgroundColor: c.greenDim },
  toggleTxt:   { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  toggleTxtOn: { color: c.green, fontSize: 13, fontWeight: '800' },

  card:        { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  labelSm:     { color: c.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 5, marginTop: 8 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  row:         { flexDirection: 'row', gap: 12 },

  etapaHead:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  etapaNum:    { color: c.text, fontSize: 14, fontWeight: '800' },
  etapaActions:{ flexDirection: 'row', gap: 14, alignItems: 'center' },
  act:         { color: c.textSecondary, fontSize: 18, fontWeight: '800' },
  actOff:      { opacity: 0.3 },
  statusRow:   { flexDirection: 'row', gap: 8, marginTop: 4 },
  stChip:      { flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  stChipTxt:   { color: c.textSecondary, fontSize: 12, fontWeight: '600' },

  addBtn:      { borderWidth: 1, borderColor: c.greenBorder, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 14, backgroundColor: c.greenDim },
  addBtnTxt:   { color: c.green, fontWeight: '800', fontSize: 14 },

  footer:      { flexDirection: 'row', gap: 12 },
  btn:         { borderRadius: 11, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  btnPrimary:  { backgroundColor: c.green },
  btnPrimaryTxt:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost:    { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  btnGhostTxt: { color: c.textSecondary, fontWeight: '700', fontSize: 14 },

  emptyTitle:  { color: c.text, fontSize: 16, fontWeight: '800' },
  emptyTxt:    { color: c.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },

  // gráfico
  graphCard:   { backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border },
  objRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  objLabel:    { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  objText:     { color: c.text, fontSize: 18, fontWeight: '800', marginTop: 6, lineHeight: 24 },
  objPrazo:    { color: c.textSecondary, fontSize: 12, marginTop: 4 },
  chip:        { alignSelf: 'flex-start', marginTop: 10, backgroundColor: c.greenDim, borderWidth: 1, borderColor: c.greenBorder, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  chipTxt:     { color: c.green, fontSize: 12, fontWeight: '700' },

  // cards de etapa (abaixo do gráfico)
  cardsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  stepCard:    { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14 },
  stepCardNow: { borderColor: GOLD + '99' },
  stepTop:     { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepBadge:   { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeDone:   { backgroundColor: GOLD },
  badgeNow:    { borderWidth: 2, borderColor: GOLD },
  badgeTodo:   { borderWidth: 2, borderColor: c.border },
  badgeGoal:   { borderWidth: 1, borderColor: GOLD, backgroundColor: '#0e2a26' },
  stepBadgeTxt:{ fontSize: 12, fontWeight: '800', color: c.textTertiary },
  stepTitulo:  { color: c.text, fontSize: 14, fontWeight: '800', flex: 1 },
  stepPrazo:   { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  stepDesc:    { color: c.textSecondary, fontSize: 12.5, marginTop: 8, lineHeight: 17 },
  stepFoot:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  stepStatus:  { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden' },
  stepAlvo:    { color: GOLD, fontSize: 12, fontWeight: '700', textAlign: 'right', flex: 1 },
  goalCard:    { backgroundColor: '#0e2a26', borderColor: GOLD + '66' },
});
