import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { parametrosSaudeService, ParametrosSaudeDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { FONT_SERIF } from '../theme/fonts';

const PADRAO: ParametrosSaudeDto = {
  scoreExcelenteMin: 80, scoreBoaMin: 60, scoreAtencaoMin: 40,
  comprometimentoSaudavelMax: 50, comprometimentoRazoavelMax: 70, comprometimentoApertadoMax: 85,
  reservaExcelenteMinDias: 90, reservaBoaMinDias: 30, reservaCurtaMinDias: 15,
};

export default function ParametrosSaudeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const [p, setP] = useState<ParametrosSaudeDto>(PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    parametrosSaudeService.get()
      .then(d => setP(d))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  const set = (k: keyof ParametrosSaudeDto, v: string) =>
    setP(prev => ({ ...prev, [k]: parseInt(v.replace(/\D/g, ''), 10) || 0 }));

  async function salvar() {
    setSalvando(true);
    try {
      await parametrosSaudeService.salvar(p);
      Alert.alert(t('paramSaude.alertOkTitulo'), t('paramSaude.alertOkMsg'));
    } catch {
      Alert.alert(t('paramSaude.alertErroTitulo'), t('paramSaude.alertErroMsg'));
    } finally { setSalvando(false); }
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const campo = (k: keyof ParametrosSaudeDto, sufixo: string) => (
    <View style={s.campo}>
      <TextInput style={s.input} value={String(p[k])} onChangeText={v => set(k, v)} keyboardType="number-pad" />
      <Text style={s.sufixo}>{sufixo}</Text>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>{t('paramSaude.title')}</Text>
      <Text style={s.subtitle}>{t('paramSaude.subtitle')}</Text>

      <View style={s.card}>
        <Text style={s.secTitulo}>{t('paramSaude.faixasTitulo')}</Text>
        <View style={s.linha}><Text style={s.lbl}>🟢 {t('paramSaude.faixaExcelente')}</Text>{campo('scoreExcelenteMin', t('paramSaude.pts'))}</View>
        <View style={s.linha}><Text style={s.lbl}>🟢 {t('paramSaude.faixaBoa')}</Text>{campo('scoreBoaMin', t('paramSaude.pts'))}</View>
        <View style={s.linha}><Text style={s.lbl}>🟡 {t('paramSaude.faixaAtencao')}</Text>{campo('scoreAtencaoMin', t('paramSaude.pts'))}</View>
        <Text style={s.nota}>{t('paramSaude.notaAbaixo', { pts: p.scoreAtencaoMin })} 🔴 {t('paramSaude.critica')}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.secTitulo}>{t('paramSaude.comprometimentoTitulo')}</Text>
        <Text style={s.secSub}>{t('paramSaude.comprometimentoSub')}</Text>
        <View style={s.linha}><Text style={s.lbl}>{t('paramSaude.saudavelAte')}</Text>{campo('comprometimentoSaudavelMax', '%')}</View>
        <View style={s.linha}><Text style={s.lbl}>{t('paramSaude.razoavelAte')}</Text>{campo('comprometimentoRazoavelMax', '%')}</View>
        <View style={s.linha}><Text style={s.lbl}>{t('paramSaude.margemApertadaAte')}</Text>{campo('comprometimentoApertadoMax', '%')}</View>
        <Text style={s.nota}>{t('paramSaude.comprometimentoNota')}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.secTitulo}>{t('paramSaude.reservaTitulo')}</Text>
        <Text style={s.secSub}>{t('paramSaude.reservaSub')}</Text>
        <View style={s.linha}><Text style={s.lbl}>{t('paramSaude.reservaExcelente')}</Text>{campo('reservaExcelenteMinDias', t('paramSaude.dias'))}</View>
        <View style={s.linha}><Text style={s.lbl}>{t('paramSaude.reservaBoa')}</Text>{campo('reservaBoaMinDias', t('paramSaude.dias'))}</View>
        <View style={s.linha}><Text style={s.lbl}>{t('paramSaude.reservaCurta')}</Text>{campo('reservaCurtaMinDias', t('paramSaude.dias'))}</View>
      </View>

      <View style={s.footer}>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setP(PADRAO)} disabled={salvando}>
          <Text style={s.btnGhostTxt}>{t('paramSaude.restaurarPadrao')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={salvar} disabled={salvando}>
          <Text style={s.btnPrimaryTxt}>{salvando ? t('paramSaude.salvando') : t('common.salvar')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:       { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '900' },
  subtitle:    { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 14 },
  card:        { backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  secTitulo:   { color: c.text, fontSize: 15, fontWeight: '800' },
  secSub:      { color: c.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 4 },
  linha:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  lbl:         { color: c.text, fontSize: 14, flex: 1 },
  campo:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input:       { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, color: c.text, fontSize: 15, width: 72, textAlign: 'right' },
  sufixo:      { color: c.textSecondary, fontSize: 12, width: 34 },
  nota:        { color: c.textTertiary, fontSize: 11, marginTop: 10, fontStyle: 'italic' },
  footer:      { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn:         { borderRadius: 11, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  btnPrimary:  { backgroundColor: c.green, flex: 1 },
  btnPrimaryTxt:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost:    { borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flex: 1 },
  btnGhostTxt: { color: c.textSecondary, fontWeight: '700', fontSize: 14 },
});
