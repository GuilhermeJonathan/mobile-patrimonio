import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { FONT_SERIF } from '../theme/fonts';
import { authService, conviteService, ConviteInfo, ConviteTipo } from '../services/api';

/** Lê ?codigo=&tipo= da URL (web). O convite chega por e-mail, então é sempre web. */
function lerParams(): { codigo: string; tipo: ConviteTipo } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { codigo: '', tipo: 'cliente' };
  const q = new URLSearchParams(window.location.search);
  const tipo = q.get('tipo') === 'corretor' ? 'corretor' : 'cliente';
  return { codigo: (q.get('codigo') ?? '').toUpperCase(), tipo };
}

export default function AceitarConviteScreen({ onAceito }: { onAceito: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);
  const [{ codigo, tipo }] = useState(lerParams);

  const [carregando, setCarregando] = useState(true);
  const [info, setInfo]             = useState<ConviteInfo | null>(null);
  const [nome, setNome]             = useState('');
  const [senha, setSenha]           = useState('');
  const [enviando, setEnviando]     = useState(false);
  const [erro, setErro]             = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!codigo) { setCarregando(false); return; }
    conviteService.validar(tipo, codigo)
      .then(i => { if (vivo) setInfo(i); })
      .catch(() => { if (vivo) setInfo({ valido: false, nomeAssessor: null, emailConvidado: null, jaAceito: false }); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [codigo, tipo]);

  const irParaApp = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState({}, '', '/home');
    onAceito();
  }, [onAceito]);

  async function aceitar() {
    if (!nome.trim()) { setErro(t('convite.erroNome')); return; }
    if (senha.length < 6) { setErro(t('convite.erroSenha')); return; }
    setEnviando(true); setErro(null);
    try {
      const { accessToken } = await conviteService.aceitar(tipo, codigo, nome.trim(), senha);
      await authService.setToken(accessToken);
      irParaApp();
    } catch (e: any) {
      setErro(e?.response?.data?.error ?? e?.response?.data?.message ?? t('convite.erroAceitar'));
    } finally { setEnviando(false); }
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const invalido = !codigo || !info || (!info.valido && !info.jaAceito) || (info && info.emailConvidado == null);

  if (invalido) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.titulo}>{t('convite.invalidoTitulo')}</Text>
          <Text style={s.sub}>{t('convite.invalidoSub')}</Text>
        </View>
      </View>
    );
  }

  if (info!.jaAceito) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.titulo}>{t('convite.usadoTitulo')}</Text>
          <Text style={s.sub}>{t('convite.usadoSub')}</Text>
        </View>
      </View>
    );
  }

  const papel = tipo === 'corretor' ? t('convite.papelCorretor') : t('convite.papelCliente');

  return (
    <View style={s.center}>
      <View style={s.card}>
        <Text style={s.marca}>{info!.nomeAssessor ?? t('convite.assessorPadrao')}</Text>
        <Text style={s.titulo}>{t('convite.boasVindas')} 👋</Text>
        <Text style={s.sub}>
          {t('convite.subConvite', { papel })}
        </Text>

        <Text style={s.label}>{t('convite.labelEmail')}</Text>
        <TextInput style={[s.input, s.inputDisabled]} value={info!.emailConvidado ?? ''} editable={false} />

        <Text style={s.label}>{t('convite.labelNome')}</Text>
        <TextInput style={s.input} value={nome} onChangeText={setNome}
          placeholder={t('convite.placeholderNome')} placeholderTextColor={colors.inputPlaceholder} />

        <Text style={s.label}>{t('convite.labelSenha')}</Text>
        <TextInput style={s.input} value={senha} onChangeText={setSenha}
          placeholder={t('convite.placeholderSenha')} placeholderTextColor={colors.inputPlaceholder} secureTextEntry />

        {erro && <Text style={s.erro}>{erro}</Text>}

        <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={aceitar} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>{t('convite.btnAceitar')}</Text>}
        </TouchableOpacity>
        <Text style={s.rodape}>
          {t('convite.rodape')}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  center:        { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:          { width: '100%', maxWidth: 420, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 24 },
  marca:         { color: c.green, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  titulo:        { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sub:           { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  label:         { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input:         { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  inputDisabled: { opacity: 0.7 },
  erro:          { color: c.red, fontSize: 13, marginTop: 10 },
  btn:           { backgroundColor: c.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnTxt:        { color: '#fff', fontWeight: '800', fontSize: 15 },
  rodape:        { color: c.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
