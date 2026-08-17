import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from '../i18n';
import { FONT_SERIF } from '../theme/fonts';
import DocumentosPanel from '../components/DocumentosPanel';
import { AlvoDocumento, estruturasService, contasService, EstruturaDto, ContaDto } from '../services/api';

type Escopo = 'cliente' | 'conta' | 'estrutura';

/**
 * Central de documentos do cliente. Escolha ONDE anexar (Cliente / Conta / Estrutura) + qual,
 * e gerencie os arquivos. (Documentos de Ativo aparecem no modal de edição do ativo.)
 */
export default function DocumentosScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const s = makeStyles(colors);

  const [escopo, setEscopo] = useState<Escopo>('cliente');
  const [estruturas, setEstruturas] = useState<EstruturaDto[]>([]);
  const [contas, setContas] = useState<ContaDto[]>([]);
  const [contaId, setContaId] = useState<string | null>(null);
  const [estruturaId, setEstruturaId] = useState<string | null>(null);

  useEffect(() => {
    estruturasService.grafo().then(g => setEstruturas(g.estruturas ?? [])).catch(() => {});
    contasService.listar().then(r => setContas(r.contas ?? [])).catch(() => {});
  }, []);

  const alvo = escopo === 'cliente' ? AlvoDocumento.Cliente : escopo === 'conta' ? AlvoDocumento.Conta : AlvoDocumento.Estrutura;
  const alvoId = escopo === 'cliente' ? null : escopo === 'conta' ? contaId : estruturaId;
  const prontoParaPainel = escopo === 'cliente' || !!alvoId;

  const chip = (ativo: boolean) => [s.chip, ativo && s.chipOn];
  const chipTxt = (ativo: boolean) => [s.chipTxt, ativo && { color: colors.green }];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}>
      <Text style={s.title}>{t('docs.titulo')}</Text>
      <Text style={s.subtitle}>{t('docs.sub')}</Text>

      <Text style={s.label}>{t('docs.escopo')}</Text>
      <View style={s.chipsRow}>
        <TouchableOpacity style={chip(escopo === 'cliente')} onPress={() => setEscopo('cliente')}>
          <Text style={chipTxt(escopo === 'cliente')}>👤 {t('docs.escopoCliente')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={chip(escopo === 'conta')} onPress={() => setEscopo('conta')}>
          <Text style={chipTxt(escopo === 'conta')}>🏦 {t('docs.escopoConta')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={chip(escopo === 'estrutura')} onPress={() => setEscopo('estrutura')}>
          <Text style={chipTxt(escopo === 'estrutura')}>🏛️ {t('docs.escopoEstrutura')}</Text>
        </TouchableOpacity>
      </View>

      {escopo === 'conta' && (
        <>
          <Text style={s.label}>{t('docs.selecioneConta')}</Text>
          {contas.length === 0 ? <Text style={s.vazio}>{t('docs.semContas')}</Text> : (
            <View style={s.chipsRow}>
              {contas.map(c => (
                <TouchableOpacity key={c.id} style={chip(contaId === c.id)} onPress={() => setContaId(c.id)}>
                  <Text style={chipTxt(contaId === c.id)}>{c.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
      {escopo === 'estrutura' && (
        <>
          <Text style={s.label}>{t('docs.selecioneEstrutura')}</Text>
          {estruturas.length === 0 ? <Text style={s.vazio}>{t('docs.semEstruturas')}</Text> : (
            <View style={s.chipsRow}>
              {estruturas.map(e => (
                <TouchableOpacity key={e.id} style={chip(estruturaId === e.id)} onPress={() => setEstruturaId(e.id)}>
                  <Text style={chipTxt(estruturaId === e.id)}>{e.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {prontoParaPainel && (
        <View style={{ marginTop: 14 }}>
          <DocumentosPanel key={`${alvo}-${alvoId ?? 'cliente'}`} alvo={alvo} alvoId={alvoId} />
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 16 },
  title:     { fontFamily: FONT_SERIF, color: c.text, fontSize: 22, fontWeight: '700' },
  subtitle:  { color: c.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 16 },
  label:     { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  chipsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipOn:    { backgroundColor: c.greenDim, borderColor: c.greenBorder },
  chipTxt:   { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  vazio:     { color: c.textSecondary, fontSize: 13, paddingVertical: 8 },
});
