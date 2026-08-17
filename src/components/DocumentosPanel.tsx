import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { documentosService, DocumentoDto } from '../services/api';
import { confirmar } from '../utils/confirm';

function fmtTam(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Painel de documentos reutilizável. Anexa/lista/baixa/exclui documentos de um alvo
 * (1=Cliente, 2=Ativo, 3=Estrutura). Upload por proxy do backend (Supabase Storage).
 */
export default function DocumentosPanel({ alvo, alvoId }: { alvo: number; alvoId?: string | null }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const [docs, setDocs] = useState<DocumentoDto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setErro(null); setDocs(await documentosService.listar(alvo, alvoId ?? undefined)); }
    catch { setErro(t('docs.erroCarregar')); }
    finally { setCarregando(false); }
  }, [alvo, alvoId, t]);
  useEffect(() => { load(); }, [load]);

  function escolherEnviar() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') { setErro(t('docs.soWeb')); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setEnviando(true); setErro(null);
      try { await documentosService.upload(alvo, alvoId ?? null, file); await load(); }
      catch { setErro(t('docs.erroEnviar')); }
      finally { setEnviando(false); }
    };
    input.click();
  }

  async function baixar(d: DocumentoDto) {
    try { await documentosService.baixar(d.id, d.nome); } catch { setErro(t('docs.erroCarregar')); }
  }

  async function excluir(d: DocumentoDto) {
    if (!(await confirmar(t('docs.titulo'), t('docs.confirmExcluir', { nome: d.nome })))) return;
    try { await documentosService.deletar(d.id); await load(); }
    catch { setErro(t('docs.erroExcluir')); }
  }

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>📎 {t('docs.titulo')}</Text>
          <Text style={s.sub}>{t('docs.sub')}</Text>
        </View>
        <TouchableOpacity style={[s.btn, enviando && { opacity: 0.6 }]} onPress={escolherEnviar} disabled={enviando}>
          {enviando ? <ActivityIndicator size="small" color={colors.green} /> : <Text style={s.btnTxt}>{t('docs.enviar')}</Text>}
        </TouchableOpacity>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      {carregando ? (
        <ActivityIndicator color={colors.green} style={{ marginVertical: 14 }} />
      ) : docs.length === 0 ? (
        <Text style={s.vazio}>{t('docs.vazio')}</Text>
      ) : docs.map(d => (
        <View key={d.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.nome} numberOfLines={1}>📄 {d.nome}</Text>
            <Text style={s.meta}>{fmtTam(d.tamanho)}{d.categoria ? ` · ${d.categoria}` : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => baixar(d)}><Text style={[s.lnk, { color: colors.green }]}>{t('docs.baixar')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => excluir(d)}><Text style={[s.lnk, { color: colors.red }]}>{t('common.excluir')}</Text></TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrap:   { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 14 },
  head:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  titulo: { color: c.text, fontSize: 15, fontWeight: '800' },
  sub:    { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  btn:    { backgroundColor: c.greenDim, borderColor: c.greenBorder, borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  btnTxt: { color: c.green, fontSize: 13, fontWeight: '700' },
  erro:   { color: c.red, fontSize: 13, marginVertical: 6 },
  vazio:  { color: c.textSecondary, fontSize: 13, paddingVertical: 12, textAlign: 'center' },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  nome:   { color: c.text, fontSize: 13, fontWeight: '600' },
  meta:   { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  lnk:    { fontSize: 12, fontWeight: '700' },
});
