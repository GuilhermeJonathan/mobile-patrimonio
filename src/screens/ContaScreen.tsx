import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { profileService, UserProfile } from '../services/api';
import { timeUntilExpiry } from '../utils/tokenUtils';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { FONT_SERIF } from '../theme/fonts';

export default function ContaScreen({ onLogout, onAvatarChange }: { onLogout: () => void; onAvatarChange?: (url: string | null) => void }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const [perfil, setPerfil] = useState<UserProfile | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [salvandoAvatar, setSalvandoAvatar] = useState(false);

  // edição de dados
  const [editNome, setEditNome] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDoc, setEditDoc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // alterar senha
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdAtual, setPwdAtual] = useState('');
  const [pwdNova, setPwdNova] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [salvandoPwd, setSalvandoPwd] = useState(false);
  const [erroPwd, setErroPwd] = useState<string | null>(null);

  // excluir conta
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    profileService.get()
      .then(p => {
        setPerfil(p);
        setAvatarLocal(p.avatarUrl);
        setEditNome(p.name);
        setEditPhone(p.cellphone ?? '');
        setEditDoc(p.document ?? '');
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function salvarPerfil() {
    setSalvando(true);
    setErroSalvar(null);
    setSucesso(false);
    try {
      await profileService.updateProfile(editNome.trim(), editPhone.trim() || null, editDoc.trim() || null);
      setSucesso(true);
      setTimeout(() => setSucesso(false), 2500);
    } catch {
      setErroSalvar(t('conta.erroSalvar'));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarSenha() {
    if (!pwdAtual) { setErroPwd(t('conta.erroSenhaAtual')); return; }
    if (pwdNova.length < 6) { setErroPwd(t('conta.erroSenhaMin')); return; }
    if (pwdNova !== pwdConfirm) { setErroPwd(t('conta.erroSenhasNaoCoincidem')); return; }
    setSalvandoPwd(true);
    setErroPwd(null);
    try {
      await profileService.changePassword(pwdAtual, pwdNova);
      setPwdModal(false);
      Alert.alert(t('conta.senhaAlteradaTitulo'), t('conta.senhaAlteradaMsg'));
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? err?.message ?? t('conta.erroAlterarSenha');
      setErroPwd(msg.toLowerCase().includes('incorreta') || msg.toLowerCase().includes('incorrect')
        ? t('conta.senhaAtualIncorreta') : msg);
    } finally {
      setSalvandoPwd(false);
    }
  }

  async function excluirConta() {
    setDeletando(true);
    try {
      await profileService.deleteAccount();
      onLogout();
    } catch {
      Alert.alert(t('conta.erroTitulo'), t('conta.erroExcluirConta'));
    } finally {
      setDeletando(false);
      setDeleteModal(false);
    }
  }

  async function selecionarFoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('conta.permissaoTitulo'), t('conta.permissaoMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    setSalvandoAvatar(true);
    try {
      await profileService.updateAvatar(dataUrl);
      setAvatarLocal(dataUrl);
      onAvatarChange?.(dataUrl);
    } catch {
      Alert.alert(t('conta.erroTitulo'), t('conta.erroSalvarFoto'));
    } finally {
      setSalvandoAvatar(false);
    }
  }

  if (carregando) {
    return <View style={s.center}><ActivityIndicator color={colors.green} size="large" /></View>;
  }

  const iniciais = perfil?.name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>

      {/* Avatar + nome */}
      <View style={s.avatarWrap}>
        <TouchableOpacity onPress={selecionarFoto} style={s.avatarTouch} disabled={salvandoAvatar}>
          {avatarLocal
            ? <Image source={{ uri: avatarLocal }} style={s.avatarImg} />
            : <View style={s.avatar}><Text style={s.avatarText}>{iniciais}</Text></View>
          }
          <View style={s.avatarOverlay}>
            {salvandoAvatar
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.avatarOverlayText}>📷</Text>
            }
          </View>
        </TouchableOpacity>
        <Text style={s.avatarDica}>{t('conta.tocarAlterarFoto')}</Text>
        <Text style={s.nomeHeader}>{perfil?.name}</Text>
        <Text style={s.emailHeader}>{perfil?.email}</Text>
        {perfil?.planLabel && (
          <View style={s.planBadge}><Text style={s.planBadgeText}>💳 {perfil.planLabel}</Text></View>
        )}
        {perfil?.expiresAt && (
          <Text style={s.sessao}>🔑 {timeUntilExpiry(perfil.expiresAt)}</Text>
        )}
      </View>

      {/* Meus dados */}
      <Text style={s.secaoLabel}>{t('conta.meusDados')}</Text>
      <View style={s.card}>
        <Text style={s.label}>{t('conta.nome')}</Text>
        <TextInput style={s.input} value={editNome} onChangeText={setEditNome} placeholderTextColor={colors.inputPlaceholder} />

        <Text style={s.label}>{t('conta.email')}</Text>
        <View style={s.inputLocked}>
          <Text style={s.inputLockedText}>{perfil?.email}</Text>
          <Text style={{ fontSize: 16 }}>🔒</Text>
        </View>

        <Text style={s.label}>{t('conta.telefoneWhatsapp')}</Text>
        <TextInput style={s.input} value={editPhone} onChangeText={setEditPhone}
          placeholder="(00) 00000-0000" placeholderTextColor={colors.inputPlaceholder} keyboardType="phone-pad" />

        <Text style={s.label}>{t('conta.documento')}</Text>
        <TextInput style={s.input} value={editDoc} onChangeText={setEditDoc}
          placeholder="000.000.000-00" placeholderTextColor={colors.inputPlaceholder} keyboardType="numeric" />

        {erroSalvar && <Text style={s.erro}>{erroSalvar}</Text>}
        {sucesso    && <Text style={s.ok}>✓ {t('conta.dadosSalvos')}</Text>}

        <TouchableOpacity style={s.btnSalvar} onPress={salvarPerfil} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSalvarText}>{t('conta.salvarAlteracoes')}</Text>}
        </TouchableOpacity>
      </View>

      {/* Segurança */}
      <Text style={s.secaoLabel}>{t('conta.seguranca')}</Text>
      <TouchableOpacity style={s.cardRow} onPress={() => { setPwdAtual(''); setPwdNova(''); setPwdConfirm(''); setErroPwd(null); setPwdModal(true); }}>
        <Text style={s.cardRowText}>🔑 {t('conta.alterarSenha')}</Text>
        <Text style={s.chevron}>›</Text>
      </TouchableOpacity>

      {/* Tema */}
      <Text style={s.secaoLabel}>{t('conta.aparencia')}</Text>
      <TouchableOpacity style={s.cardRow} onPress={toggleTheme}>
        <Text style={s.cardRowText}>{isDark ? `🌙 ${t('conta.temaEscuro')}` : `☀️ ${t('conta.temaClaro')}`}</Text>
        <Text style={[s.chevron, { color: colors.green }]}>{isDark ? t('conta.ativo') : t('conta.ativo')}</Text>
      </TouchableOpacity>

      {/* Zona de perigo */}
      <Text style={[s.secaoLabel, { color: colors.red, marginTop: 32 }]}>{t('conta.zonaPerigo')}</Text>
      <TouchableOpacity style={s.cardRowPerigo} onPress={() => setDeleteModal(true)}>
        <Text style={s.cardRowPerigoText}>🗑 {t('conta.excluirMinhaConta')}</Text>
      </TouchableOpacity>

      {/* Modal — alterar senha */}
      <Modal visible={pwdModal} transparent animationType="slide" onRequestClose={() => setPwdModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('conta.alterarSenha')}</Text>
            {(['senhaAtual', 'novaSenha', 'confirmarNovaSenha'] as const).map((chave, i) => {
              const vals  = [pwdAtual, pwdNova, pwdConfirm];
              const setters = [setPwdAtual, setPwdNova, setPwdConfirm];
              return (
                <React.Fragment key={chave}>
                  <Text style={s.label}>{t(`conta.${chave}`).toUpperCase()}</Text>
                  <TextInput style={s.input} value={vals[i]} onChangeText={setters[i]}
                    secureTextEntry placeholderTextColor={colors.inputPlaceholder} placeholder="••••••" />
                </React.Fragment>
              );
            })}
            {erroPwd && <Text style={s.erro}>{erroPwd}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setPwdModal(false)}>
                <Text style={s.btnCancelarText}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, s.btnSalvar]} onPress={salvarSenha} disabled={salvandoPwd}>
                {salvandoPwd ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSalvarText}>{t('common.salvar')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal — excluir conta */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <View style={s.overlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitulo}>{t('conta.excluirConta')}</Text>
            <Text style={[s.cardRowText, { color: colors.textSecondary, marginBottom: 16 }]}>
              {t('conta.excluirAviso')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={[s.btnModal, s.btnCancelar]} onPress={() => setDeleteModal(false)}>
                <Text style={s.btnCancelarText}>{t('common.cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnModal, { backgroundColor: colors.red }]} onPress={excluirConta} disabled={deletando}>
                {deletando ? <ActivityIndicator color="#fff" /> : <Text style={s.btnSalvarText}>{t('conta.simExcluir')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
  avatarWrap: { alignItems: 'center', marginBottom: 28 },
  avatarTouch: { position: 'relative' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.green, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  avatarOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.surfaceElevated, borderWidth: 2, borderColor: c.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarOverlayText: { fontSize: 13 },
  avatarDica: { color: c.textTertiary, fontSize: 11, marginTop: 6, marginBottom: 4 },
  nomeHeader: { fontFamily: FONT_SERIF, color: c.text, fontSize: 20, fontWeight: '800' },
  emailHeader: { color: c.textSecondary, fontSize: 13, marginTop: 2 },
  planBadge: { backgroundColor: c.greenDim, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 16, marginTop: 10 },
  planBadgeText: { color: c.green, fontSize: 13, fontWeight: '700' },
  sessao: { color: c.textTertiary, fontSize: 12, marginTop: 6 },
  secaoLabel: { color: c.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  card: { backgroundColor: c.surface, borderRadius: 14, padding: 18, marginBottom: 20 },
  label: { color: c.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10, padding: 12, color: c.text, fontSize: 15, marginBottom: 14 },
  inputLocked: { backgroundColor: c.surfaceElevated, borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  inputLockedText: { color: c.textSecondary, fontSize: 15 },
  erro: { color: c.red, fontSize: 13, marginBottom: 10 },
  ok: { color: c.green, fontSize: 13, marginBottom: 10 },
  btnSalvar: { backgroundColor: c.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnSalvarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cardRow: { backgroundColor: c.surface, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardRowText: { color: c.text, fontSize: 15 },
  chevron: { color: c.textSecondary, fontSize: 20 },
  cardRowPerigo: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.red },
  cardRowPerigoText: { color: c.red, fontSize: 15, fontWeight: '600' },
  // modal
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  btnModal: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnCancelar: { backgroundColor: c.surfaceElevated },
  btnCancelarText: { color: c.textSecondary, fontWeight: '700' },
});
