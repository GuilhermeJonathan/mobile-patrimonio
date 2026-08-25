import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, RefreshControl, Alert, Platform,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { planoAcaoService, PlanoAcaoDto, EtapaPlanoInput } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';
import { useAssessoria } from '../contexts/AssessoriaContext';
import PlanoTrilha from '../components/charts/PlanoTrilha';

type Etapa = { titulo: string; descricao: string; prazo: string; alvo: string; status: number };
type Modo = 'lista' | 'ver' | 'gerenciar';

const GOLD = '#C79A4E';
const STATUS_KEY: Record<number, string> = { 1: 'planoAcao.statusAFazer', 2: 'planoAcao.statusEmAndamento', 3: 'planoAcao.statusConcluida' };
const novaEtapa = (): Etapa => ({ titulo: '', descricao: '', prazo: '', alvo: '', status: 1 });
const toEtapa = (e: PlanoAcaoDto['etapas'][number]): Etapa =>
  ({ titulo: e.titulo, descricao: e.descricao ?? '', prazo: e.prazo ?? '', alvo: e.alvo ?? '', status: e.status });

function resumo(p: PlanoAcaoDto) {
  const total = p.etapas.length;
  const concl = p.etapas.filter(e => e.status === 3).length;
  return { total, concl, pct: total > 0 ? Math.round((concl / total) * 100) : 0 };
}

function confirmar(msg: string, onYes: () => void, t: ReturnType<typeof useTranslation>['t']) {
  if (Platform.OS === 'web') { if (typeof window !== 'undefined' && window.confirm(msg)) onYes(); }
  else Alert.alert(t('planoAcao.confirmar'), msg, [{ text: t('common.cancelar'), style: 'cancel' }, { text: t('planoAcao.excluir'), style: 'destructive', onPress: onYes }]);
}

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
  const { t } = useTranslation();
  const { cliente } = useAssessoria();
  const emViewAs = !!cliente?.clienteId; // só o assessor no view-as gerencia
  const s = makeStyles(colors);

  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planos, setPlanos] = useState<PlanoAcaoDto[]>([]);
  const [modo, setModo] = useState<Modo>('lista');
  const [selId, setSelId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [trilhaW, setTrilhaW] = useState(320);

  // buffer da edição/visualização do plano selecionado
  const [objetivo, setObjetivo] = useState('');
  const [prazo, setPrazo] = useState('');
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  const statusColor = (st: number) => (st === 3 ? colors.green : st === 2 ? colors.blue : colors.textTertiary);

  const load = useCallback(async () => {
    try {
      setPlanos(await planoAcaoService.listar());
    } catch { setPlanos([]); }
    finally { setCarregando(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const etapasValidas = etapas.filter(e => e.titulo.trim());
  const concluidas = etapasValidas.filter(e => e.status === 3).length;
  const progresso = etapasValidas.length > 0 ? Math.round((concluidas / etapasValidas.length) * 100) : 0;

  function verPlano(p: PlanoAcaoDto) {
    setSelId(p.id); setObjetivo(p.objetivo); setPrazo(p.prazo ?? ''); setEtapas(p.etapas.map(toEtapa)); setModo('ver');
  }
  function gerenciarPlano(p: PlanoAcaoDto) {
    setSelId(p.id); setObjetivo(p.objetivo); setPrazo(p.prazo ?? ''); setEtapas(p.etapas.map(toEtapa)); setModo('gerenciar');
  }
  function novoPlano() {
    setSelId(null); setObjetivo(''); setPrazo(''); setEtapas([novaEtapa()]); setModo('gerenciar');
  }

  function setEtapa(i: number, patch: Partial<Etapa>) { setEtapas(es => es.map((e, idx) => (idx === i ? { ...e, ...patch } : e))); }
  function mover(i: number, dir: -1 | 1) {
    setEtapas(es => { const j = i + dir; if (j < 0 || j >= es.length) return es; const cp = [...es]; [cp[i], cp[j]] = [cp[j], cp[i]]; return cp; });
  }
  function remover(i: number) { setEtapas(es => es.filter((_, idx) => idx !== i)); }

  function payload(): EtapaPlanoInput[] {
    return etapas.filter(e => e.titulo.trim())
      .map(e => ({ titulo: e.titulo.trim(), descricao: e.descricao, prazo: e.prazo, alvo: e.alvo, status: e.status }));
  }

  async function salvar() {
    if (!objetivo.trim()) { Alert.alert(t('planoAcao.atencao'), t('planoAcao.informeObjetivo')); return; }
    setSalvando(true);
    try {
      if (selId) await planoAcaoService.atualizar(selId, objetivo.trim(), prazo.trim() || null, payload());
      else await planoAcaoService.criar(objetivo.trim(), prazo.trim() || null, payload());
      await load();
      setModo('lista');
    } catch { Alert.alert(t('planoAcao.erro'), t('planoAcao.erroSalvar')); }
    finally { setSalvando(false); }
  }

  function excluirPlano(p: PlanoAcaoDto) {
    confirmar(t('planoAcao.excluirPlanoConfirm', { objetivo: p.objetivo }), async () => {
      try { await planoAcaoService.excluir(p.id); await load(); setModo('lista'); }
      catch { Alert.alert(t('planoAcao.erro'), t('planoAcao.erroExcluir')); }
    }, t);
  }

  // status rápido na visualização (otimista + salva no plano selecionado)
  async function setStatusEtapa(target: Etapa, novo: number) {
    if (!selId) return;
    const novas = etapas.map(e => (e === target ? { ...e, status: novo } : e));
    setEtapas(novas);
    try {
      await planoAcaoService.atualizar(selId, objetivo.trim(), prazo.trim() || null,
        novas.filter(e => e.titulo.trim()).map(e => ({ titulo: e.titulo.trim(), descricao: e.descricao, prazo: e.prazo, alvo: e.alvo, status: e.status })));
      setPlanos(ps => ps.map(p => (p.id === selId ? { ...p, etapas: novas.filter(e => e.titulo.trim()).map((e, i) => ({ ordem: i, titulo: e.titulo, descricao: e.descricao, prazo: e.prazo, alvo: e.alvo, status: e.status })) } : p)));
    } catch { Alert.alert(t('planoAcao.erro'), t('planoAcao.erroStatus')); }
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
            <Text style={s.title}>{selId ? t('planoAcao.gerenciarPlano') : t('planoAcao.novoPlano')}</Text>
            <Text style={s.subtitle}>{t('planoAcao.defina')}</Text>
          </View>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setModo('lista')}>
            <Text style={s.btnGhostTxt}>{t('common.voltar')}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.label}>{t('planoAcao.objetivo')}</Text>
          <TextInput style={s.input} value={objetivo} onChangeText={setObjetivo}
            placeholder={t('planoAcao.objetivoPlaceholder')}
            placeholderTextColor={colors.inputPlaceholder} multiline />
          <Text style={s.label}>{t('planoAcao.prazoObjetivo')}</Text>
          <TextInput style={s.input} value={prazo} onChangeText={setPrazo}
            placeholder={t('planoAcao.prazoObjetivoPlaceholder')} placeholderTextColor={colors.inputPlaceholder} />
        </View>

        {etapas.map((e, i) => (
          <View key={i} style={s.card}>
            <View style={s.etapaHead}>
              <Text style={s.etapaNum}>{t('planoAcao.etapaNum', { n: i + 1 })}</Text>
              <View style={s.etapaActions}>
                <TouchableOpacity onPress={() => mover(i, -1)} disabled={i === 0}><Text style={[s.act, i === 0 && s.actOff]}>↑</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => mover(i, 1)} disabled={i === etapas.length - 1}><Text style={[s.act, i === etapas.length - 1 && s.actOff]}>↓</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => remover(i)}><Text style={[s.act, { color: colors.red }]}>✕</Text></TouchableOpacity>
              </View>
            </View>
            <TextInput style={s.input} value={e.titulo} onChangeText={v => setEtapa(i, { titulo: v })}
              placeholder={t('planoAcao.tituloPlaceholder')} placeholderTextColor={colors.inputPlaceholder} />
            <TextInput style={[s.input, { minHeight: 56 }]} value={e.descricao} onChangeText={v => setEtapa(i, { descricao: v })}
              placeholder={t('planoAcao.descricaoPlaceholder')} placeholderTextColor={colors.inputPlaceholder} multiline />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.labelSm}>{t('planoAcao.prazo')}</Text>
                <TextInput style={s.input} value={e.prazo} onChangeText={v => setEtapa(i, { prazo: v })}
                  placeholder={t('planoAcao.prazoEtapaPlaceholder')} placeholderTextColor={colors.inputPlaceholder} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.labelSm}>{t('planoAcao.alvo')}</Text>
                <TextInput style={s.input} value={e.alvo} onChangeText={v => setEtapa(i, { alvo: v })}
                  placeholder={t('planoAcao.alvoPlaceholder')} placeholderTextColor={colors.inputPlaceholder} />
              </View>
            </View>
            <Text style={s.labelSm}>{t('planoAcao.status')}</Text>
            <View style={s.statusRow}>
              {[1, 2, 3].map(st => (
                <TouchableOpacity key={st} onPress={() => setEtapa(i, { status: st })}
                  style={[s.stChip, e.status === st && { backgroundColor: statusColor(st) + '22', borderColor: statusColor(st) }]}>
                  <Text style={[s.stChipTxt, e.status === st && { color: statusColor(st), fontWeight: '800' }]}>{t(STATUS_KEY[st])}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={s.addBtn} onPress={() => setEtapas(es => [...es, novaEtapa()])}>
          <Text style={s.addBtnTxt}>+ {t('planoAcao.adicionarEtapa')}</Text>
        </TouchableOpacity>

        <View style={s.footer}>
          <TouchableOpacity style={[s.btn, s.btnGhost, { flex: 1 }]} onPress={() => setModo('lista')} disabled={salvando}>
            <Text style={s.btnGhostTxt}>{t('common.cancelar')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnPrimary, { flex: 1 }]} onPress={salvar} disabled={salvando}>
            <Text style={s.btnPrimaryTxt}>{salvando ? t('planoAcao.salvando') : t('planoAcao.salvarPlano')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────── VER (gráfico) ───────────
  if (modo === 'ver') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.headerRow}>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setModo('lista')}>
            <Text style={s.btnGhostTxt}>← {t('planoAcao.planos')}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {emViewAs && (
            <>
              <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => gerenciarPlano(planos.find(p => p.id === selId) ?? { id: selId!, objetivo, prazo, etapas: [] })}>
                <Text style={s.btnGhostTxt}>{t('planoAcao.gerenciar')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={s.graphCard}>
          <View style={s.objRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.objLabel}>{t('planoAcao.objetivoCliente')}</Text>
              <Text style={s.objText}>{objetivo}</Text>
              {!!prazo && <Text style={s.objPrazo}>{t('planoAcao.meta')} · {prazo}</Text>}
              {etapasValidas.length > 0 && (
                <View style={s.chip}>
                  <Text style={s.chipTxt}>{progresso === 100 ? `🏆 ${t('planoAcao.objetivoConcluido')}` : `● ${t('planoAcao.etapasProgresso', { concluidas, total: etapasValidas.length })}`}</Text>
                </View>
              )}
            </View>
            <Anel pct={progresso} sub={t('planoAcao.contagemDe', { a: concluidas, b: etapasValidas.length })} colors={colors} />
          </View>

          <View style={{ marginTop: 8, width: '100%' }} onLayout={e => setTrilhaW(Math.round(e.nativeEvent.layout.width))}>
            {etapasValidas.length > 0 ? (
              <PlanoTrilha
                etapas={etapasValidas.map(e => ({ titulo: e.titulo, descricao: e.descricao, prazo: e.prazo, status: e.status }))}
                objetivo={objetivo} objetivoPrazo={prazo || null} width={trilhaW}
                mutedColor={colors.border} surfaceColor={colors.surface} textColor={colors.text} fadeColor={colors.textTertiary} />
            ) : <Text style={s.emptyTxt}>{t('planoAcao.nenhumaEtapa')}</Text>}
          </View>
        </View>

        {etapasValidas.length > 0 && (
          <View style={[s.cardsWrap, { marginTop: 12 }]}>
            {etapasValidas.map((e, i) => {
              const wide = trilhaW >= 560;
              return (
                <View key={i} style={[s.stepCard, { width: wide ? '48.5%' : '100%' }, e.status === 2 && s.stepCardNow]}>
                  <View style={s.stepTop}>
                    <View style={[s.stepBadge, e.status === 3 ? s.badgeDone : e.status === 2 ? s.badgeNow : s.badgeTodo]}>
                      <Text style={[s.stepBadgeTxt, e.status === 3 && { color: '#241a08' }, e.status === 2 && { color: GOLD }]}>{e.status === 3 ? '✓' : i + 1}</Text>
                    </View>
                    <Text style={s.stepTitulo} numberOfLines={2}>{e.titulo}</Text>
                    {!!e.prazo && <Text style={s.stepPrazo}>{e.prazo}</Text>}
                  </View>
                  {!!e.descricao && <Text style={s.stepDesc}>{e.descricao}</Text>}
                  <View style={s.stepFoot}>
                    <Text style={[s.stepStatus, { color: statusColor(e.status), backgroundColor: statusColor(e.status) + '1e' }]}>{t(STATUS_KEY[e.status])}</Text>
                    {!!e.alvo && <Text style={s.stepAlvo}>{e.alvo}</Text>}
                  </View>
                  {emViewAs && (
                    <View style={s.quickRow}>
                      {e.status === 1 && <>
                        <TouchableOpacity style={s.quickBtn} onPress={() => setStatusEtapa(e, 2)}><Text style={s.quickBtnTxt}>▶ {t('planoAcao.statusEmAndamento')}</Text></TouchableOpacity>
                        <TouchableOpacity style={[s.quickBtn, s.quickBtnDone]} onPress={() => setStatusEtapa(e, 3)}><Text style={[s.quickBtnTxt, s.quickBtnDoneTxt]}>✓ {t('planoAcao.concluir')}</Text></TouchableOpacity>
                      </>}
                      {e.status === 2 && <>
                        <TouchableOpacity style={[s.quickBtn, s.quickBtnDone]} onPress={() => setStatusEtapa(e, 3)}><Text style={[s.quickBtnTxt, s.quickBtnDoneTxt]}>✓ {t('planoAcao.concluir')}</Text></TouchableOpacity>
                        <TouchableOpacity style={s.quickBtn} onPress={() => setStatusEtapa(e, 1)}><Text style={s.quickBtnTxt}>↺ {t('planoAcao.statusAFazer')}</Text></TouchableOpacity>
                      </>}
                      {e.status === 3 && <TouchableOpacity style={s.quickBtn} onPress={() => setStatusEtapa(e, 2)}><Text style={s.quickBtnTxt}>↺ {t('planoAcao.reabrir')}</Text></TouchableOpacity>}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {emViewAs && (
          <TouchableOpacity style={[s.btn, s.btnDanger, { marginTop: 14 }]} onPress={() => { const p = planos.find(x => x.id === selId); if (p) excluirPlano(p); }}>
            <Text style={s.btnDangerTxt}>{t('planoAcao.excluirPlano')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  // ─────────── LISTA de planos ───────────
  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{planos.length > 1 ? t('planoAcao.tituloListaPlural') : t('planoAcao.tituloLista')}</Text>
          <Text style={s.subtitle}>{t('planoAcao.subtituloLista')}</Text>
        </View>
        {emViewAs && (
          <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={novoPlano}>
            <Text style={s.btnPrimaryTxt}>+ {t('planoAcao.novoPlano')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {planos.length === 0 ? (
        <View style={s.card}>
          <Text style={s.emptyTitle}>{emViewAs ? t('planoAcao.nenhumPlano') : t('planoAcao.planoEmPreparacao')}</Text>
          <Text style={s.emptyTxt}>
            {emViewAs
              ? t('planoAcao.emptyAssessor')
              : t('planoAcao.emptyCliente')}
          </Text>
          {emViewAs && (
            <TouchableOpacity style={[s.btn, s.btnPrimary, { marginTop: 14, alignSelf: 'flex-start' }]} onPress={novoPlano}>
              <Text style={s.btnPrimaryTxt}>+ {t('planoAcao.criarPlano')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        planos.map(p => {
          const r = resumo(p);
          return (
            <TouchableOpacity key={p.id} style={s.planoItem} onPress={() => verPlano(p)}>
              <View style={s.planoTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.objLabel}>{t('planoAcao.objetivoLabel')}</Text>
                  <Text style={s.planoObj} numberOfLines={2}>{p.objetivo}</Text>
                  {!!p.prazo && <Text style={s.objPrazo}>{t('planoAcao.meta')} · {p.prazo}</Text>}
                </View>
                {r.pct === 100 ? (
                  <View style={s.trofeu}><Text style={s.trofeuIcon}>🏆</Text><Text style={s.trofeuTxt}>{t('planoAcao.concluido')}</Text></View>
                ) : (
                  <View style={s.planoBadge}><Text style={s.planoBadgeNum}>{r.pct}%</Text><Text style={s.planoBadgeLbl}>{r.concl}/{r.total}</Text></View>
                )}
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${r.pct}%` }, r.pct === 100 && { backgroundColor: GOLD }]} /></View>
              <Text style={s.planoAbrir}>{t('planoAcao.abrir')} →</Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  title:       { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },

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
  btn:         { borderRadius: 11, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  btnPrimary:  { backgroundColor: c.green },
  btnPrimaryTxt:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost:    { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  btnGhostTxt: { color: c.textSecondary, fontWeight: '700', fontSize: 14 },
  btnDanger:   { borderWidth: 1, borderColor: c.red + '66', backgroundColor: c.surface },
  btnDangerTxt:{ color: c.red, fontWeight: '700', fontSize: 14 },

  emptyTitle:  { color: c.text, fontSize: 16, fontWeight: '800' },
  emptyTxt:    { color: c.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },

  graphCard:   { backgroundColor: c.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: c.border },
  objRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  objLabel:    { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  objText:     { fontFamily: FONT_SERIF, color: c.text, fontSize: 18, fontWeight: '800', marginTop: 6, lineHeight: 24 },
  objPrazo:    { color: c.textSecondary, fontSize: 12, marginTop: 4 },
  chip:        { alignSelf: 'flex-start', marginTop: 10, backgroundColor: c.greenDim, borderWidth: 1, borderColor: c.greenBorder, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  chipTxt:     { color: c.green, fontSize: 12, fontWeight: '700' },

  cardsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  stepCard:    { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14 },
  stepCardNow: { borderColor: GOLD + '99' },
  stepTop:     { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepBadge:   { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeDone:   { backgroundColor: GOLD },
  badgeNow:    { borderWidth: 2, borderColor: GOLD },
  badgeTodo:   { borderWidth: 2, borderColor: c.border },
  stepBadgeTxt:{ fontSize: 12, fontWeight: '800', color: c.textTertiary },
  stepTitulo:  { color: c.text, fontSize: 14, fontWeight: '800', flex: 1 },
  stepPrazo:   { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  stepDesc:    { color: c.textSecondary, fontSize: 12.5, marginTop: 8, lineHeight: 17 },
  stepFoot:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  stepStatus:  { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden' },
  stepAlvo:    { color: GOLD, fontSize: 12, fontWeight: '700', textAlign: 'right', flex: 1 },
  quickRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  quickBtn:    { borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 11 },
  quickBtnTxt: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  quickBtnDone:{ borderColor: c.greenBorder, backgroundColor: c.greenDim },
  quickBtnDoneTxt: { color: c.green },

  // lista de planos
  planoItem:   { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: c.border },
  planoTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planoObj:    { color: c.text, fontSize: 16, fontWeight: '800', marginTop: 4, lineHeight: 21 },
  planoBadge:  { alignItems: 'center', minWidth: 52 },
  planoBadgeNum:{ color: c.green, fontSize: 18, fontWeight: '900' },
  planoBadgeLbl:{ color: c.textSecondary, fontSize: 11 },
  track:       { height: 7, backgroundColor: c.border, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  fill:        { height: 7, backgroundColor: c.green, borderRadius: 4 },
  planoAbrir:  { color: c.green, fontSize: 13, fontWeight: '700', marginTop: 10 },
  trofeu:      { alignItems: 'center', minWidth: 62 },
  trofeuIcon:  { fontSize: 22 },
  trofeuTxt:   { color: GOLD, fontSize: 11, fontWeight: '800', marginTop: 1 },
});
