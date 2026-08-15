import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, useWindowDimensions, Platform } from 'react-native';
import { authService, consultoriaService, ConsultoriaBrandingDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { FONT_SERIF } from '../theme/fonts';
import { useTranslation } from '../i18n';

const GUID_RE = /^[0-9a-fA-F-]{36}$/;

/**
 * Lê o parâmetro whitelabel da URL. Aceita:
 *  - query: /login?a={slug|assessorId}
 *  - path:  /{slug}  (ex.: /aurea-capital) — link "limpo" do assessor
 * Só web tem URL.
 */
function paramWhitelabelDaUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search).get('a');
  if (q && q.trim().length > 0) return q.trim();
  // Fallback: 1º segmento do path (ex.: /aurea-capital). Ignora 'login' e raiz.
  const seg = (window.location.pathname || '').replace(/^\//, '').split('/')[0];
  return seg && seg !== 'login' ? decodeURIComponent(seg) : null;
}

export default function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const { colors, setBrandColor } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [param] = useState<string | null>(paramWhitelabelDaUrl());
  const [assessorId, setAssessorId] = useState<string | null>(null);
  const [branding, setBranding] = useState<ConsultoriaBrandingDto | null>(null);

  // Whitelabel: resolve a marca por Guid OU pela rota/slug definida no admin, e aplica a cor.
  useEffect(() => {
    if (!param) return;
    const p = GUID_RE.test(param)
      ? consultoriaService.branding(param)
      : consultoriaService.brandingBySlug(param);
    p.then(b => { setBranding(b); setAssessorId(b?.assessorId ?? null); if (b?.corMarca) setBrandColor(b.corMarca); })
      .catch(() => {});
  }, [param]);

  const s = makeStyles(colors);
  const marca = branding?.nomeConsultoria?.trim() || 'Patrimônio';
  const temLogo = !!(assessorId && branding?.temLogo);

  async function entrar() {
    setCarregando(true);
    setErro(null);
    try {
      const ok = await authService.login(email.trim(), senha);
      if (ok) onLogin();
      else setErro(t('login.erroCredenciais'));
    } catch {
      setErro(t('login.erroCredenciais'));
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
      <Text style={s.brandTagline}>{t('login.tagline')}</Text>
    </View>
  );

  const formPanel = (
    <View style={[s.formPanel, !isWide && s.formPanelNarrow]}>
      <View style={s.formInner}>
        <Text style={s.formTitulo}>{t('login.entrar')}</Text>
        <Text style={s.label}>{t('login.email')}</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemplo.com"
          placeholderTextColor={colors.inputPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={s.label}>{t('login.senha')}</Text>
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
          {carregando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{t('login.entrar')}</Text>}
        </TouchableOpacity>
        {branding?.nomeConsultoria && (
          <Text style={s.rodape}>{t('login.ambienteDe', { nome: branding.nomeConsultoria })}</Text>
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
