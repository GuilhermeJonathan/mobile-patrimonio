import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions, Platform } from 'react-native';
import { authService, consultoriaService, ConsultoriaBrandingDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';

/** Lê o assessor da URL (?a={assessorId}) para o login whitelabel. Só web tem URL. */
function assessorIdDaUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const a = new URLSearchParams(window.location.search).get('a');
  return a && /^[0-9a-fA-F-]{36}$/.test(a) ? a : null;
}

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { colors, setBrandColor } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [assessorId] = useState<string | null>(assessorIdDaUrl());
  const [branding, setBranding] = useState<ConsultoriaBrandingDto | null>(null);

  // Whitelabel: busca a marca do assessor da URL e aplica a cor no accent do login.
  useEffect(() => {
    if (!assessorId) return;
    consultoriaService.branding(assessorId)
      .then(b => { setBranding(b); if (b?.corMarca) setBrandColor(b.corMarca); })
      .catch(() => {});
  }, [assessorId]);

  const s = makeStyles(colors);
  const marca = branding?.nomeConsultoria?.trim() || 'Patrimônio';
  const temLogo = !!(assessorId && branding?.temLogo);

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

  const marcaPanel = (
    <View style={[s.brandPanel, !isWide && s.brandPanelNarrow]}>
      {temLogo ? (
        <Image source={{ uri: consultoriaService.logoUrl(assessorId!) }} style={s.brandLogo} resizeMode="contain" />
      ) : (
        <Text style={s.brandLogoTxt}>◆</Text>
      )}
      <Text style={s.brandNome}>{marca}</Text>
      <Text style={s.brandTagline}>Planejamento patrimonial global</Text>
    </View>
  );

  const formPanel = (
    <View style={[s.formPanel, !isWide && s.formPanelNarrow]}>
      <View style={s.formInner}>
        <Text style={s.formTitulo}>Entrar</Text>
        <Text style={s.label}>E-mail</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemplo.com"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={s.label}>Senha</Text>
        <TextInput
          style={s.input}
          value={senha}
          onChangeText={setSenha}
          placeholder="••••••••"
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry
        />
        {erro && <Text style={s.erro}>{erro}</Text>}
        <TouchableOpacity style={s.btn} onPress={entrar} disabled={carregando}>
          {carregando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Entrar</Text>}
        </TouchableOpacity>
        {branding?.nomeConsultoria && (
          <Text style={s.rodape}>Ambiente exclusivo de {branding.nomeConsultoria}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[s.container, isWide && s.containerWide]}>
      {marcaPanel}
      {formPanel}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: c.background },
  containerWide:   { flexDirection: 'row' },

  // Painel da marca (esquerda no desktop; topo no mobile)
  brandPanel:      { flex: 1, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center', padding: 32 },
  brandPanelNarrow:{ flex: 0, paddingVertical: 40 },
  brandLogo:       { width: 260, height: 180, maxWidth: '80%' },
  brandLogoTxt:    { fontSize: 72, color: c.green },
  brandNome:       { fontFamily: FONT_SERIF, fontSize: 30, fontWeight: '700', color: c.text, marginTop: 16, textAlign: 'center', letterSpacing: 0.3 },
  brandTagline:    { fontSize: 13, color: c.textSecondary, marginTop: 6, letterSpacing: 0.5 },

  // Painel do formulário (direita no desktop; abaixo no mobile)
  formPanel:       { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  formPanelNarrow: { flex: 1 },
  formInner:       { width: '100%', maxWidth: 380 },
  formTitulo:      { fontFamily: FONT_SERIF, fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 20 },
  label:           { color: c.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 13, color: c.text, fontSize: 15, marginBottom: 16,
  },
  erro:            { color: c.red, fontSize: 13, marginBottom: 12 },
  btn:             { backgroundColor: c.green, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  rodape:          { color: c.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 18 },
});
