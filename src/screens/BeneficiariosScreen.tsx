import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { estruturasService, SucessaoDto, BeneficiarioGrafoDto, DistribuicaoSucessaoDto, EstruturaDto } from '../services/api';
import { numBR } from '../utils/format';
import { confirmar } from '../utils/confirm';
import { FONT_SERIF } from '../theme/fonts';

const GOLD = '#C79A4E';
const PAPEIS = [{ v: 1, key: 'papelConjuge' }, { v: 2, key: 'papelFilho' }, { v: 3, key: 'papelNeto' }, { v: 99, key: 'papelOutro' }];
const PAPEL_KEY: Record<number, string> = Object.fromEntries(PAPEIS.map(p => [p.v, p.key]));
const MOEDAS = ['BRL', 'USD', 'EUR', 'CHF', 'GBP'];

function fmtData(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

interface BForm { id?: string; nome: string; papel: number; pct: string; cond: string; }
interface DForm { id?: string; data: string; valor: string; moeda: string; estruturaId: string | null; beneficiarioId: string | null; desc: string; }

export default function BeneficiariosScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const [dados, setDados] = useState<SucessaoDto | null>(null);
  const [estruturas, setEstruturas] = useState<EstruturaDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [bForm, setBForm] = useState<BForm | null>(null);
  const [dForm, setDForm] = useState<DForm | null>(null);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    try {
      setErro(null);
      const [suc, grafo] = await Promise.all([estruturasService.sucessao(), estruturasService.grafo().catch(() => null)]);
      setDados(suc);
      setEstruturas(grafo?.estruturas ?? []);
    } catch { setErro(t('beneficiarios.erroCarregar')); }
    finally { setCarregando(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function salvarBeneficiario() {
    if (!bForm || !bForm.nome.trim()) return;
    setSalvando(true);
    try {
      await estruturasService.salvarBeneficiario({
        id: bForm.id, nome: bForm.nome.trim(), papel: bForm.papel,
        percentualDistribuicao: parseFloat(bForm.pct.replace(',', '.')) || 0, condicaoLiberacao: bForm.cond.trim() || null,
      });
      setBForm(null); await load();
    } catch { Alert.alert(t('beneficiarios.erro'), t('beneficiarios.erroSalvar')); }
    finally { setSalvando(false); }
  }
  async function removerBeneficiario(b: BeneficiarioGrafoDto) {
    if (!(await confirmar(t('beneficiarios.removerBeneficiarioTitulo'), t('beneficiarios.removerBeneficiarioMsg', { nome: b.nome })))) return;
    try { await estruturasService.deletarBeneficiario(b.id); await load(); }
    catch { Alert.alert(t('beneficiarios.erro'), t('beneficiarios.erroRemover')); }
  }
  function editarDistribuicao(d: DistribuicaoSucessaoDto) {
    setDForm({
      id: d.id, data: d.data.slice(0, 10), valor: String(d.valor), moeda: d.moeda,
      estruturaId: d.estruturaId ?? null, beneficiarioId: d.beneficiarioId ?? null, desc: d.descricao ?? '',
    });
  }
  async function salvarDistribuicao() {
    if (!dForm) return;
    const valor = parseFloat(dForm.valor.replace(/\./g, '').replace(',', '.')) || 0;
    if (valor <= 0) { Alert.alert(t('beneficiarios.atencao'), t('beneficiarios.valorInvalido')); return; }
    setSalvando(true);
    try {
      await estruturasService.salvarDistribuicao({
        id: dForm.id, data: new Date(dForm.data).toISOString(), valor, moeda: dForm.moeda,
        estruturaId: dForm.estruturaId, beneficiarioId: dForm.beneficiarioId, descricao: dForm.desc.trim() || null,
      });
      setDForm(null); await load();
    } catch { Alert.alert(t('beneficiarios.erro'), t('beneficiarios.erroSalvarDistribuicao')); }
    finally { setSalvando(false); }
  }
  async function removerDistribuicao(id: string) {
    if (!(await confirmar(t('beneficiarios.removerDistribuicaoTitulo'), t('beneficiarios.removerDistribuicaoMsg')))) return;
    try { await estruturasService.deletarDistribuicao(id); await load(); }
    catch { Alert.alert(t('beneficiarios.erro'), t('beneficiarios.erroRemover')); }
  }

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  const beneficiarios = dados?.beneficiarios ?? [];
  const distribuicoes = dados?.distribuicoes ?? [];
  const somaPct = beneficiarios.reduce((a, b) => a + b.percentualDistribuicao, 0);
  const totalDist = distribuicoes.reduce((a, d) => a + d.valor, 0); // face value (soma simples)

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

      <Text style={s.title}>{t('beneficiarios.titulo')}</Text>
      <Text style={s.subtitle}>{t('beneficiarios.subtitulo')}</Text>
      {erro && <Text style={s.erro}>{erro}</Text>}

      {/* Beneficiários */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitulo}>{t('beneficiarios.beneficiariosFamilia')}</Text>
            {beneficiarios.length > 0 && (
              <Text style={[s.somaPct, somaPct > 100 && { color: colors.red }]}>{t('beneficiarios.resumoDistribuido', { n: beneficiarios.length, pct: numBR(somaPct, 0) })}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setBForm({ nome: '', papel: 1, pct: '', cond: '' })}><Text style={s.link}>{t('beneficiarios.addBeneficiario')}</Text></TouchableOpacity>
        </View>
        {beneficiarios.length === 0 ? (
          <Text style={s.vazioMini}>{t('beneficiarios.vazioBeneficiarios')}</Text>
        ) : beneficiarios.map(b => (
          <View key={b.id} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.nome}>{b.nome}</Text>
              <Text style={s.meta}>{t('beneficiarios.' + (PAPEL_KEY[b.papel] ?? 'papelOutro'))}{b.condicaoLiberacao ? ` · ${b.condicaoLiberacao}` : ''}</Text>
            </View>
            <Text style={[s.pct, { color: GOLD }]}>{numBR(b.percentualDistribuicao, 0)}%</Text>
            <TouchableOpacity onPress={() => setBForm({ id: b.id, nome: b.nome, papel: b.papel, pct: String(b.percentualDistribuicao), cond: b.condicaoLiberacao ?? '' })}>
              <Text style={[s.link, { color: colors.blue, marginLeft: 12 }]}>{t('common.editar')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removerBeneficiario(b)}><Text style={[s.link, { color: colors.red, marginLeft: 8 }]}>×</Text></TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Distribuições */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitulo}>{t('beneficiarios.historicoDistribuicoes')}</Text>
            {distribuicoes.length > 0 && <Text style={s.somaPct}>{t('beneficiarios.legendaShare')}</Text>}
          </View>
          <TouchableOpacity onPress={() => setDForm({ data: new Date().toISOString().slice(0, 10), valor: '', moeda: 'BRL', estruturaId: null, beneficiarioId: null, desc: '' })}><Text style={s.link}>{t('beneficiarios.addDistribuicao')}</Text></TouchableOpacity>
        </View>
        {distribuicoes.length === 0 ? (
          <Text style={s.vazioMini}>{t('beneficiarios.vazioDistribuicoes')}</Text>
        ) : distribuicoes.map(d => {
          const share = totalDist > 0 ? (d.valor / totalDist) * 100 : 0;
          return (
          <View key={d.id} style={s.distRow}>
            <View style={{ flex: 1 }}>
              <View style={s.distTopo}>
                <Text style={s.nome}>{d.moeda} {numBR(d.valor, 0)}{d.beneficiarioNome ? ` · ${d.beneficiarioNome}` : ''}</Text>
                <Text style={[s.pct, { color: GOLD }]}>{numBR(share, 0)}%</Text>
              </View>
              <View style={s.barBg}><View style={[s.barFill, { width: `${share}%` }]} /></View>
              <Text style={s.meta}>{fmtData(d.data)}{d.estruturaNome ? ` · ${d.estruturaNome}` : ''}{d.descricao ? ` · ${d.descricao}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => editarDistribuicao(d)}><Text style={[s.link, { color: colors.blue, marginLeft: 12 }]}>{t('common.editar')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => removerDistribuicao(d.id)}><Text style={[s.link, { color: colors.red, marginLeft: 8 }]}>×</Text></TouchableOpacity>
          </View>
          );
        })}
      </View>

      {/* Modal beneficiário */}
      <Modal visible={bForm !== null} animationType="slide" transparent onRequestClose={() => setBForm(null)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{bForm?.id ? t('beneficiarios.editarBeneficiario') : t('beneficiarios.novoBeneficiario')}</Text>
            <TextInput style={s.input} value={bForm?.nome ?? ''} onChangeText={v => setBForm(f => f && { ...f, nome: v })} placeholder={t('beneficiarios.nome')} placeholderTextColor={colors.inputPlaceholder} />
            <Text style={s.label}>{t('beneficiarios.papel')}</Text>
            <View style={s.chipsWrap}>
              {PAPEIS.map(p => (
                <TouchableOpacity key={p.v} style={[s.chip, bForm?.papel === p.v && s.chipOn]} onPress={() => setBForm(f => f && { ...f, papel: p.v })}>
                  <Text style={[s.chipTxt, bForm?.papel === p.v && { color: colors.green }]}>{t('beneficiarios.' + p.key)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>{t('beneficiarios.pctDistribuicao')}</Text>
            <TextInput style={s.input} value={bForm?.pct ?? ''} onChangeText={v => setBForm(f => f && { ...f, pct: v })} keyboardType="decimal-pad" placeholder={t('beneficiarios.exemploPct')} placeholderTextColor={colors.inputPlaceholder} />
            <Text style={s.label}>{t('beneficiarios.condicaoLiberacao')}</Text>
            <TextInput style={s.input} value={bForm?.cond ?? ''} onChangeText={v => setBForm(f => f && { ...f, cond: v })} placeholder={t('beneficiarios.exemploCondicao')} placeholderTextColor={colors.inputPlaceholder} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancel]} onPress={() => setBForm(null)}><Text style={s.btnCancelTxt}>{t('common.cancelar')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnOk]} onPress={salvarBeneficiario} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnOkTxt}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal distribuição */}
      <Modal visible={dForm !== null} animationType="slide" transparent onRequestClose={() => setDForm(null)}>
        <View style={s.overlay}>
          <ScrollView style={s.modalCard} contentContainerStyle={{ paddingBottom: 8 }}>
            <Text style={s.modalTitulo}>{dForm?.id ? t('beneficiarios.editarDistribuicao') : t('beneficiarios.novaDistribuicao')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[s.input, { flex: 1 }]} value={dForm?.data ?? ''} onChangeText={v => setDForm(f => f && { ...f, data: v })} placeholder={t('beneficiarios.formatoData')} placeholderTextColor={colors.inputPlaceholder} />
              <TextInput style={[s.input, { flex: 1 }]} value={dForm?.valor ?? ''} onChangeText={v => setDForm(f => f && { ...f, valor: v })} keyboardType="decimal-pad" placeholder={t('beneficiarios.valor')} placeholderTextColor={colors.inputPlaceholder} />
            </View>
            <Text style={s.label}>{t('beneficiarios.moeda')}</Text>
            <View style={s.chipsWrap}>
              {MOEDAS.map(m => (
                <TouchableOpacity key={m} style={[s.chip, dForm?.moeda === m && s.chipOn]} onPress={() => setDForm(f => f && { ...f, moeda: m })}>
                  <Text style={[s.chipTxt, dForm?.moeda === m && { color: colors.green }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {estruturas.length > 0 && (
              <>
                <Text style={s.label}>{t('beneficiarios.estruturaOrigem')}</Text>
                <View style={s.chipsWrap}>
                  <TouchableOpacity style={[s.chip, dForm?.estruturaId === null && s.chipOn]} onPress={() => setDForm(f => f && { ...f, estruturaId: null })}>
                    <Text style={[s.chipTxt, dForm?.estruturaId === null && { color: colors.green }]}>—</Text>
                  </TouchableOpacity>
                  {estruturas.map(e => (
                    <TouchableOpacity key={e.id} style={[s.chip, dForm?.estruturaId === e.id && s.chipOn]} onPress={() => setDForm(f => f && { ...f, estruturaId: e.id })}>
                      <Text style={[s.chipTxt, dForm?.estruturaId === e.id && { color: colors.green }]}>{e.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {beneficiarios.length > 0 && (
              <>
                <Text style={s.label}>{t('beneficiarios.beneficiarioOpcional')}</Text>
                <View style={s.chipsWrap}>
                  <TouchableOpacity style={[s.chip, dForm?.beneficiarioId === null && s.chipOn]} onPress={() => setDForm(f => f && { ...f, beneficiarioId: null })}>
                    <Text style={[s.chipTxt, dForm?.beneficiarioId === null && { color: colors.green }]}>—</Text>
                  </TouchableOpacity>
                  {beneficiarios.map(b => (
                    <TouchableOpacity key={b.id} style={[s.chip, dForm?.beneficiarioId === b.id && s.chipOn]} onPress={() => setDForm(f => f && { ...f, beneficiarioId: b.id })}>
                      <Text style={[s.chipTxt, dForm?.beneficiarioId === b.id && { color: colors.green }]}>{b.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <Text style={s.label}>{t('beneficiarios.descricaoOpcional')}</Text>
            <TextInput style={s.input} value={dForm?.desc ?? ''} onChangeText={v => setDForm(f => f && { ...f, desc: v })} placeholderTextColor={colors.inputPlaceholder} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancel]} onPress={() => setDForm(null)}><Text style={s.btnCancelTxt}>{t('common.cancelar')}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnOk]} onPress={salvarDistribuicao} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnOkTxt}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:       { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 16 },
  erro:        { color: c.red, fontSize: 13, marginBottom: 8 },
  vazioMini:   { color: c.textSecondary, fontSize: 13, paddingVertical: 8 },
  card:        { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12 },
  cardHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitulo:  { color: c.text, fontSize: 15, fontWeight: '800' },
  somaPct:     { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  link:        { color: c.green, fontSize: 13, fontWeight: '700' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 4 },
  distRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border, gap: 8 },
  distTopo:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nome:        { color: c.text, fontSize: 14, fontWeight: '600' },
  meta:        { color: c.textSecondary, fontSize: 11, marginTop: 2 },
  pct:         { fontSize: 14, fontWeight: '800' },
  barBg:       { height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 5, marginBottom: 4, overflow: 'hidden' },
  barFill:     { height: 6, borderRadius: 3, backgroundColor: GOLD },
  overlay:     { flex: 1, backgroundColor: '#0009', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard:   { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90%' },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  label:       { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  chipsWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border },
  chipOn:      { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipTxt:     { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  btnModal:    { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancel:   { backgroundColor: c.surfaceElevated },
  btnCancelTxt:{ color: c.textSecondary, fontWeight: '700' },
  btnOk:       { backgroundColor: c.green },
  btnOkTxt:    { color: '#fff', fontWeight: '700' },
});
