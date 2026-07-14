import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { consultoriaService } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

const CORES = ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#f59e0b', '#0f766e', '#111827'];

export default function ConsultoriaScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [nome, setNome]         = useState('');
  const [logo, setLogo]         = useState<string | null>(null);
  const [cor, setCor]           = useState('#16a34a');
  const [whats, setWhats]       = useState('');
  const [rodape, setRodape]     = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk]             = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const c = await consultoriaService.get();
        setNome(c.nomeConsultoria ?? '');
        setLogo(c.logoBase64 ?? null);
        setCor(c.corMarca ?? '#16a34a');
        setWhats(c.whatsApp ?? '');
        setRodape(c.mensagemRodape ?? '');
      } catch { /* vazio → form em branco */ }
      finally { setCarregando(false); }
    })();
  }, []);

  async function escolherLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true, quality: 0.6, allowsEditing: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setLogo(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  }

  async function salvar() {
    if (!nome.trim()) { Alert.alert('Validação', 'Informe o nome da consultoria.'); return; }
    setSalvando(true);
    setOk(false);
    try {
      await consultoriaService.salvar({
        nomeConsultoria: nome.trim(),
        logoBase64: logo,
        corMarca: cor,
        whatsApp: whats.trim() || null,
        mensagemRodape: rodape.trim() || null,
      });
      setOk(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 20, maxWidth: 620 }}>
      <Text style={s.title}>Minha Consultoria</Text>
      <Text style={s.sub}>Marca usada no relatório PDF e no contato exibido ao cliente.</Text>

      <View style={s.card}>
        <Text style={s.label}>Logo</Text>
        <View style={s.logoRow}>
          <View style={[s.logoBox, { backgroundColor: cor + '18', borderColor: cor + '55' }]}>
            {logo
              ? <Image source={{ uri: logo }} style={{ width: 72, height: 72, borderRadius: 8 }} resizeMode="contain" />
              : <Text style={{ fontSize: 28 }}>💎</Text>}
          </View>
          <View style={{ gap: 8 }}>
            <TouchableOpacity style={s.btnSec} onPress={escolherLogo}><Text style={s.btnSecTxt}>Escolher logo</Text></TouchableOpacity>
            {logo && <TouchableOpacity onPress={() => setLogo(null)}><Text style={s.remover}>Remover</Text></TouchableOpacity>}
          </View>
        </View>

        <Text style={s.label}>Nome da consultoria *</Text>
        <TextInput style={s.input} value={nome} onChangeText={setNome}
          placeholder="Ex: Matrin Wealth Advisory" placeholderTextColor={colors.inputPlaceholder} />

        <Text style={s.label}>Cor da marca</Text>
        <View style={s.cores}>
          {CORES.map(hex => (
            <TouchableOpacity key={hex} onPress={() => setCor(hex)}
              style={[s.corItem, { backgroundColor: hex }, cor === hex && s.corSel]} />
          ))}
        </View>

        <Text style={s.label}>WhatsApp de contato</Text>
        <TextInput style={s.input} value={whats} onChangeText={setWhats}
          placeholder="Ex: 11999998888" placeholderTextColor={colors.inputPlaceholder} keyboardType="phone-pad" />

        <Text style={s.label}>Mensagem de rodapé (relatório)</Text>
        <TextInput style={[s.input, { height: 70 }]} value={rodape} onChangeText={setRodape} multiline
          placeholder="Ex: Documento confidencial — não constitui recomendação formal de investimento."
          placeholderTextColor={colors.inputPlaceholder} />

        <TouchableOpacity style={[s.btn, salvando && { opacity: 0.7 }]} onPress={salvar} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Salvar</Text>}
        </TouchableOpacity>
        {ok && <Text style={s.ok}>✓ Salvo! A marca já vale nos próximos relatórios.</Text>}
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: c.background },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  title:  { color: c.text, fontSize: 22, fontWeight: '900' },
  sub:    { color: c.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 18 },
  card:   { backgroundColor: c.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border },
  label:  { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 14 },
  input:  { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  logoRow:{ flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoBox:{ width: 84, height: 84, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  btnSec: { backgroundColor: c.surfaceElevated, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  btnSecTxt: { color: c.text, fontWeight: '700', fontSize: 13 },
  remover:{ color: c.red, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cores:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  corItem:{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: c.text },
  btn:    { backgroundColor: c.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ok:     { color: c.green, fontSize: 13, marginTop: 12, textAlign: 'center' },
});
