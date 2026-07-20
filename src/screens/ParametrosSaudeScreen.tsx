import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { parametrosSaudeService, ParametrosSaudeDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

const PADRAO: ParametrosSaudeDto = {
  scoreExcelenteMin: 80, scoreBoaMin: 60, scoreAtencaoMin: 40,
  comprometimentoSaudavelMax: 50, comprometimentoRazoavelMax: 70, comprometimentoApertadoMax: 85,
  reservaExcelenteMinDias: 90, reservaBoaMinDias: 30, reservaCurtaMinDias: 15,
};

export default function ParametrosSaudeScreen() {
  const { colors } = useTheme();
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
      Alert.alert('Pronto', 'Parâmetros do termômetro salvos.');
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
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
      <Text style={s.title}>Termômetro de saúde</Text>
      <Text style={s.subtitle}>Defina os limites do score (0–100) que classificam seus clientes. Vale para toda a sua carteira.</Text>

      <View style={s.card}>
        <Text style={s.secTitulo}>Faixas de classificação (score)</Text>
        <View style={s.linha}><Text style={s.lbl}>🟢 Excelente a partir de</Text>{campo('scoreExcelenteMin', 'pts')}</View>
        <View style={s.linha}><Text style={s.lbl}>🟢 Boa (saudável) a partir de</Text>{campo('scoreBoaMin', 'pts')}</View>
        <View style={s.linha}><Text style={s.lbl}>🟡 Atenção a partir de</Text>{campo('scoreAtencaoMin', 'pts')}</View>
        <Text style={s.nota}>Abaixo de {p.scoreAtencaoMin} pontos = 🔴 Crítica.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.secTitulo}>Comprometimento de renda</Text>
        <Text style={s.secSub}>% da renda consumida pelas despesas — quanto menor, melhor.</Text>
        <View style={s.linha}><Text style={s.lbl}>Saudável até</Text>{campo('comprometimentoSaudavelMax', '%')}</View>
        <View style={s.linha}><Text style={s.lbl}>Razoável até</Text>{campo('comprometimentoRazoavelMax', '%')}</View>
        <View style={s.linha}><Text style={s.lbl}>Margem apertada até</Text>{campo('comprometimentoApertadoMax', '%')}</View>
        <Text style={s.nota}>Acima disso pontua pouco; acima de 100% (déficit) = 0.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.secTitulo}>Reserva de emergência</Text>
        <Text style={s.secSub}>Dias de gasto que a reserva cobre — quanto maior, melhor.</Text>
        <View style={s.linha}><Text style={s.lbl}>Excelente a partir de</Text>{campo('reservaExcelenteMinDias', 'dias')}</View>
        <View style={s.linha}><Text style={s.lbl}>Boa a partir de</Text>{campo('reservaBoaMinDias', 'dias')}</View>
        <View style={s.linha}><Text style={s.lbl}>Curta a partir de</Text>{campo('reservaCurtaMinDias', 'dias')}</View>
      </View>

      <View style={s.footer}>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setP(PADRAO)} disabled={salvando}>
          <Text style={s.btnGhostTxt}>Restaurar padrão</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={salvar} disabled={salvando}>
          <Text style={s.btnPrimaryTxt}>{salvando ? 'Salvando…' : 'Salvar'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:   { flex: 1, backgroundColor: c.background, padding: 16 },
  center:      { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:       { color: c.text, fontSize: 22, fontWeight: '900' },
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
