import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { patrimonioService, assessoriaService, MeuAssessorDto } from '../services/api';
import { useTheme } from '../theme/ThemeContext';

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function abrirWhatsApp(numero: string, nome: string | null) {
  const digits = numero.replace(/\D/g, '');
  const comDdi = digits.startsWith('55') ? digits : `55${digits}`;
  const msg = encodeURIComponent(`Olá${nome ? `, ${nome}` : ''}! Falo pelo app de patrimônio.`);
  Linking.openURL(`https://wa.me/${comDdi}?text=${msg}`);
}

interface Resumo { total: number; qtdAtivos: number; qtdClientes: number | null; }

export default function HomeScreen({ isAssessor = false }: { isAssessor?: boolean }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [consultor, setConsultor] = useState<MeuAssessorDto | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        if (isAssessor) {
          // Patrimônio sob gestão = soma do patrimônio de todos os clientes ativos
          const clientes = (await assessoriaService.clientes()).filter(c => c.ativo);
          const resumos = await Promise.all(
            clientes.map(c => assessoriaService.resumoCliente(c.clienteId).catch(() => null)),
          );
          const total = resumos.reduce((sum, r) => sum + (r?.totalConsolidadoBRL ?? 0), 0);
          const qtdAtivos = resumos.reduce((sum, r) => sum + (r?.qtdAtivos ?? 0), 0);
          if (vivo) setResumo({ total, qtdAtivos, qtdClientes: clientes.length });
        } else {
          const [r, cons] = await Promise.all([
            patrimonioService.resumo(),
            assessoriaService.meuAssessor().catch(() => null),
          ]);
          if (vivo) {
            setResumo({ total: r.totalConsolidadoBRL, qtdAtivos: r.qtdAtivos, qtdClientes: null });
            setConsultor(cons);
          }
        }
      } catch {
        if (vivo) setResumo(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [isAssessor]);

  const label = isAssessor
    ? 'Patrimônio sob gestão (consolidado em BRL)'
    : 'Meu patrimônio (consolidado em BRL)';

  const rodape = isAssessor
    ? `${resumo?.qtdClientes ?? 0} cliente(s) · ${resumo?.qtdAtivos ?? 0} ativo(s)`
    : `${resumo?.qtdAtivos ?? 0} ativo(s)`;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={s.saudacao}>Bem-vindo 👋</Text>
      <Text style={s.sub}>{isAssessor ? 'Painel do assessor' : 'Painel de gestão patrimonial'}</Text>

      {consultor?.temAssessor && (
        <View style={s.consultor}>
          <View style={{ flex: 1 }}>
            <Text style={s.consultorLabel}>👤 Seu consultor</Text>
            <Text style={s.consultorNome}>{consultor.nomeAssessor ?? 'Seu assessor'}</Text>
          </View>
          {consultor.whatsApp
            ? (
              <TouchableOpacity style={s.whatsBtn} onPress={() => abrirWhatsApp(consultor.whatsApp!, consultor.nomeAssessor)}>
                <Text style={s.whatsTxt}>💬  Falar pelo WhatsApp</Text>
              </TouchableOpacity>
            )
            : <Text style={s.semWhats}>WhatsApp não informado</Text>}
        </View>
      )}

      <View style={s.destaque}>
        <Text style={s.destaqueLabel}>{label}</Text>
        {carregando
          ? <ActivityIndicator color={colors.green} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
          : <Text style={s.destaqueValor}>{fmtBRL(resumo?.total ?? 0)}</Text>}
        <Text style={s.destaqueQtd}>{rodape}</Text>
      </View>

      {isAssessor && (
        <View style={s.metricas}>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>👥</Text>
            <Text style={s.metricaValor}>{resumo?.qtdClientes ?? 0}</Text>
            <Text style={s.metricaLabel}>Clientes ativos</Text>
          </View>
          <View style={s.metricaCard}>
            <Text style={s.metricaIcon}>🏛️</Text>
            <Text style={s.metricaValor}>{resumo?.qtdAtivos ?? 0}</Text>
            <Text style={s.metricaLabel}>Ativos na carteira</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  saudacao: { color: c.text, fontSize: 26, fontWeight: '800' },
  sub: { color: c.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 24 },
  consultor: { backgroundColor: c.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.border, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  consultorLabel: { color: c.textSecondary, fontSize: 12 },
  consultorNome: { color: c.text, fontSize: 17, fontWeight: '800', marginTop: 2 },
  whatsBtn: { backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  whatsTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  semWhats: { color: c.textTertiary, fontSize: 12, fontStyle: 'italic' },
  destaque: { backgroundColor: c.surface, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: c.greenBorder, marginBottom: 28 },
  destaqueLabel: { color: c.textSecondary, fontSize: 13 },
  destaqueValor: { color: c.green, fontSize: 36, fontWeight: '800', marginTop: 8 },
  destaqueQtd: { color: c.textSecondary, fontSize: 12, marginTop: 8 },
  metricas: { flexDirection: 'row', gap: 14 },
  metricaCard: { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 20 },
  metricaIcon: { fontSize: 22 },
  metricaValor: { color: c.text, fontSize: 30, fontWeight: '800', marginTop: 8 },
  metricaLabel: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
});
