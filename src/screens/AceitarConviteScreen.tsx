import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
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
    if (!nome.trim()) { setErro('Informe seu nome.'); return; }
    if (senha.length < 6) { setErro('A senha deve ter ao menos 6 caracteres.'); return; }
    setEnviando(true); setErro(null);
    try {
      const { accessToken } = await conviteService.aceitar(tipo, codigo, nome.trim(), senha);
      await authService.setToken(accessToken);
      irParaApp();
    } catch (e: any) {
      setErro(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Não foi possível aceitar o convite.');
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
          <Text style={s.titulo}>Convite inválido</Text>
          <Text style={s.sub}>Este link de convite não é válido ou expirou. Peça um novo convite a quem enviou.</Text>
        </View>
      </View>
    );
  }

  if (info!.jaAceito) {
    return (
      <View style={s.center}>
        <View style={s.card}>
          <Text style={s.titulo}>Convite já utilizado</Text>
          <Text style={s.sub}>Este convite já foi aceito. Faça login normalmente pelo app.</Text>
        </View>
      </View>
    );
  }

  const papel = tipo === 'corretor' ? 'corretor' : 'cliente';

  return (
    <View style={s.center}>
      <View style={s.card}>
        <Text style={s.marca}>{info!.nomeAssessor ?? 'Seu assessor'}</Text>
        <Text style={s.titulo}>Você foi convidado 👋</Text>
        <Text style={s.sub}>
          Crie sua conta de {papel} em segundos e comece a acompanhar tudo em um só lugar.
        </Text>

        <Text style={s.label}>E-mail</Text>
        <TextInput style={[s.input, s.inputDisabled]} value={info!.emailConvidado ?? ''} editable={false} />

        <Text style={s.label}>Seu nome</Text>
        <TextInput style={s.input} value={nome} onChangeText={setNome}
          placeholder="Nome completo" placeholderTextColor={colors.inputPlaceholder} />

        <Text style={s.label}>Crie uma senha</Text>
        <TextInput style={s.input} value={senha} onChangeText={setSenha}
          placeholder="Mínimo 6 caracteres" placeholderTextColor={colors.inputPlaceholder} secureTextEntry />

        {erro && <Text style={s.erro}>{erro}</Text>}

        <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={aceitar} disabled={enviando}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Aceitar convite e criar conta</Text>}
        </TouchableOpacity>
        <Text style={s.rodape}>
          Já tem conta com este e-mail? Informe a senha da sua conta para vincular.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  center:        { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:          { width: '100%', maxWidth: 420, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 24 },
  marca:         { color: c.green, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  titulo:        { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: 6 },
  sub:           { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 18 },
  label:         { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input:         { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15 },
  inputDisabled: { opacity: 0.7 },
  erro:          { color: c.red, fontSize: 13, marginTop: 10 },
  btn:           { backgroundColor: c.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  btnTxt:        { color: '#fff', fontWeight: '800', fontSize: 15 },
  rodape:        { color: c.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
