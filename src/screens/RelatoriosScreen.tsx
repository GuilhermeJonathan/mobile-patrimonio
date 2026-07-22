import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { relatorioService } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAssessoria } from '../contexts/AssessoriaContext';

interface Props { userName?: string; avatarUrl?: string | null; }

export default function RelatoriosScreen({ userName, avatarUrl }: Props) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const { cliente } = useAssessoria();

  const [gerando, setGerando] = useState<'patrimonial' | 'sucessao' | 'completo' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // No view-as o relatório é do cliente; senão, do próprio usuário.
  const clienteNome = cliente?.nome ?? userName ?? null;
  const marca = {
    nomeConsultoria: userName ?? null,   // marca: nome do assessor (v1). Logo = avatar.
    logoBase64: avatarUrl ?? null,        // aceita data URL; se for URL remota, o backend ignora
    corMarca: '#16a34a',
  };

  function baixar(blob: Blob, prefixo: string) {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefixo}-${(clienteNome ?? 'cliente').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Relatório', 'O download do PDF está disponível na versão web por enquanto.');
    }
  }

  async function gerar(tipo: 'patrimonial' | 'sucessao' | 'completo') {
    setGerando(tipo);
    setErro(null);
    try {
      const input = { clienteNome, ...marca };
      const blob = tipo === 'patrimonial' ? await relatorioService.gerar(input)
        : tipo === 'sucessao' ? await relatorioService.gerarSucessao(input)
        : await relatorioService.gerarCompleto(input);
      baixar(blob, tipo === 'patrimonial' ? 'relatorio-patrimonial' : tipo === 'sucessao' ? 'relatorio-sucessao' : 'relatorio-completo');
    } catch {
      setErro('Não foi possível gerar o relatório. Tente novamente.');
    } finally {
      setGerando(null);
    }
  }

  return (
    <View style={s.root}>
      <Text style={s.title}>Relatórios</Text>
      <Text style={s.subtitle}>Relatórios em PDF com a sua marca, para enviar ao cliente.</Text>

      {erro && <Text style={s.erro}>{erro}</Text>}

      <View style={s.grid}>
        <View style={s.card}>
          <Text style={s.cardIcon}>📄</Text>
          <Text style={s.cardTitulo}>Relatório Patrimonial</Text>
          <Text style={s.cardDesc}>
            Um PDF completo: balanço (bens − dívidas = patrimônio líquido), composição por categoria,
            fluxo de caixa, investimentos e a projeção patrimonial{clienteNome ? ` de ${clienteNome}` : ''}.
          </Text>
          <TouchableOpacity style={[s.btn, gerando && { opacity: 0.7 }]} onPress={() => gerar('patrimonial')} disabled={gerando !== null}>
            {gerando === 'patrimonial' ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Gerar relatório PDF</Text>}
          </TouchableOpacity>
          <Text style={s.nota}>A marca (nome/logo) usa o seu perfil. Câmbio consolidado é estimado.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardIcon}>👑</Text>
          <Text style={s.cardTitulo}>Relatório de Sucessão</Text>
          <Text style={s.cardDesc}>
            Estrutura patrimonial (grafo), beneficiários (planejado × distribuído), distribuições,
            contas (nacionais e internacionais) e os planos de ação{clienteNome ? ` de ${clienteNome}` : ''}.
          </Text>
          <TouchableOpacity style={[s.btn, s.btnGold, gerando && { opacity: 0.7 }]} onPress={() => gerar('sucessao')} disabled={gerando !== null}>
            {gerando === 'sucessao' ? <ActivityIndicator color="#241a08" /> : <Text style={[s.btnTxt, { color: '#241a08' }]}>Gerar relatório PDF</Text>}
          </TouchableOpacity>
          <Text style={s.nota}>A marca (nome/logo) usa o seu perfil. Câmbio consolidado é estimado.</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardIcon}>📚</Text>
          <Text style={s.cardTitulo}>Relatório Completo</Text>
          <Text style={s.cardDesc}>
            Um único PDF com tudo: o relatório patrimonial + o de sucessão, na sequência —
            ideal para enviar a visão completa{clienteNome ? ` de ${clienteNome}` : ''} de uma vez.
          </Text>
          <TouchableOpacity style={[s.btn, s.btnDark, gerando && { opacity: 0.7 }]} onPress={() => gerar('completo')} disabled={gerando !== null}>
            {gerando === 'completo' ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Gerar relatório PDF</Text>}
          </TouchableOpacity>
          <Text style={s.nota}>Combina os dois relatórios num documento só, com a sua marca.</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root:      { flex: 1, backgroundColor: c.background, padding: 20 },
  title:     { color: c.text, fontSize: 24, fontWeight: '900' },
  subtitle:  { color: c.textSecondary, fontSize: 13, marginTop: 2, marginBottom: 20 },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card:      { backgroundColor: c.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: c.border, flexGrow: 1, flexBasis: 340, maxWidth: 460, alignItems: 'flex-start' },
  cardIcon:  { fontSize: 40, marginBottom: 8 },
  cardTitulo:{ color: c.text, fontSize: 18, fontWeight: '800' },
  cardDesc:  { color: c.textSecondary, fontSize: 14, marginTop: 8, lineHeight: 20 },
  erro:      { color: c.red, fontSize: 13, marginTop: 12 },
  btn:       { backgroundColor: c.green, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginTop: 20, alignSelf: 'stretch' },
  btnGold:   { backgroundColor: '#C79A4E' },
  btnDark:   { backgroundColor: c.text === '#ffffff' ? '#334155' : '#0f172a' },
  btnTxt:    { color: '#fff', fontWeight: '800', fontSize: 15 },
  nota:      { color: c.textTertiary, fontSize: 11, marginTop: 12, fontStyle: 'italic' },
});
