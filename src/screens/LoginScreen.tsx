import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { authService } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setCarregando(true);
    setErro(null);
    try {
      const ok = await authService.login(email.trim(), senha);
      if (ok) onLogin();
      else setErro('E-mail ou senha inválidos.');
    } catch {
      setErro('E-mail ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.logo}>◆ Patrimônio</Text>
        <Text style={s.sub}>Gestão patrimonial para assessores</Text>

        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          value={senha}
          onChangeText={setSenha}
          placeholder="Senha"
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry
        />
        {erro && <Text style={s.erro}>{erro}</Text>}
        <TouchableOpacity style={s.btn} onPress={entrar} disabled={carregando}>
          {carregando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 },
  logo: { color: c.green, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: { color: c.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  input: {
    backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 13, color: c.text, fontSize: 15, marginBottom: 12,
  },
  erro: { color: c.red, fontSize: 13, marginBottom: 12, textAlign: 'center' },
  btn: { backgroundColor: c.green, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
