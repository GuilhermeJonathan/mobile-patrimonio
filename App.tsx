import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { PrivacyProvider } from './src/theme/PrivacyContext';
import { authService, profileService } from './src/services/api';
import { RouterProvider, useRouter } from './src/navigation/router';
import { AssessoriaProvider, useAssessoria } from './src/contexts/AssessoriaContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PatrimonioDashboardScreen from './src/screens/PatrimonioDashboardScreen';
import AtivosScreen from './src/screens/AtivosScreen';
import PassivosScreen from './src/screens/PassivosScreen';
import ProjecaoPatrimonialScreen from './src/screens/ProjecaoPatrimonialScreen';
import AssessorClientesScreen from './src/screens/AssessorClientesScreen';
import ContaScreen from './src/screens/ContaScreen';
import InvestimentosScreen from './src/screens/InvestimentosScreen';
import ParamCrudScreen from './src/screens/ParamCrudScreen';
import RelatoriosScreen from './src/screens/RelatoriosScreen';
import AppShell from './src/components/AppShell';
import DashboardGPScreen from './src/screens/DashboardGPScreen';
import LancamentosScreen from './src/screens/LancamentosScreen';
import CategoriasScreen from './src/screens/CategoriasScreen';
import DividasScreen from './src/screens/DividasScreen';
import AssinaturasScreen from './src/screens/AssinaturasScreen';
import MetasScreen from './src/screens/MetasScreen';
import CartoesGPScreen from './src/screens/CartoesGPScreen';

const ROTAS_CLIENTE = [
  'patrimonio', 'ativos', 'passivos', 'projecao', 'investimentos',
  'gp-dashboard', 'gp-lancamentos', 'gp-categorias',
  'gp-dividas', 'gp-assinaturas', 'gp-metas', 'gp-cartoes',
];

function AreaLogada({ onLogout, isAssessor, userName, avatarUrl }: { onLogout: () => void; isAssessor: boolean; userName: string; avatarUrl: string | null }) {
  const { rota, navigate } = useRouter();
  const { cliente } = useAssessoria();
  const emViewAs = !!cliente?.clienteId;
  const assessorPuro = isAssessor && !emViewAs;

  // Assessor fora do view-as não acessa dados de cliente (mesmo por URL direta) → carteira
  // Relatório só existe no view-as (ferramenta do assessor sobre o cliente) → fora dele, Início
  useEffect(() => {
    if (assessorPuro && ROTAS_CLIENTE.includes(rota)) navigate('clientes');
    else if (rota === 'relatorios' && !emViewAs) navigate('home');
  }, [assessorPuro, emViewAs, rota, navigate]);

  const conteudo: Record<string, React.ReactNode> = {
    home:          <HomeScreen isAssessor={isAssessor} />,
    patrimonio:    <PatrimonioDashboardScreen onLogout={onLogout} />,
    ativos:        <AtivosScreen />,
    passivos:      <PassivosScreen />,
    projecao:      <ProjecaoPatrimonialScreen />,
    clientes:                      <AssessorClientesScreen userName={userName} avatarUrl={avatarUrl} />,
    'cadastros-tipos-ativo':       <ParamCrudScreen kind="tipoAtivo" />,
    'cadastros-tipos-investimento':<ParamCrudScreen kind="tipoInvestimento" />,
    'cadastros-moedas':            <ParamCrudScreen kind="moeda" />,
    conta:         <ContaScreen onLogout={onLogout} onAvatarChange={(url) => {/* propagado via reload */}} />,
    investimentos: <InvestimentosScreen />,
    relatorios:    <RelatoriosScreen userName={userName} avatarUrl={avatarUrl} />,
    'gp-dashboard':   <DashboardGPScreen />,
    'gp-lancamentos': <LancamentosScreen />,
    'gp-categorias':  <CategoriasScreen />,
    'gp-cartoes':     <CartoesGPScreen />,
    'gp-dividas':     <DividasScreen />,
    'gp-assinaturas': <AssinaturasScreen />,
    'gp-metas':       <MetasScreen />,
  };

  return (
    <AppShell onLogout={onLogout} isAssessor={isAssessor} userName={userName} avatarUrl={avatarUrl}>
      {conteudo[rota] ?? conteudo['home']}
    </AppShell>
  );
}

function Root() {
  const { colors } = useTheme();
  const [logado, setLogado]         = useState<boolean | null>(null);
  const [isAssessor, setIsAssessor] = useState(false);
  const [userName, setUserName]     = useState('');
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null);

  async function carregarPerfil() {
    try {
      const p = await profileService.get();
      setIsAssessor(p.isAssessor);
      setUserName(p.name);
      setAvatarUrl(p.avatarUrl);
    } catch {}
  }

  useEffect(() => {
    authService.isLogged().then(async (ok) => {
      setLogado(ok);
      if (ok) carregarPerfil();
    });
  }, []);

  if (logado === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      {logado
        ? <AreaLogada onLogout={() => setLogado(false)} isAssessor={isAssessor} userName={userName} avatarUrl={avatarUrl} />
        : <LoginScreen onLogin={() => { setLogado(true); carregarPerfil(); }} />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PrivacyProvider>
          <AssessoriaProvider>
            <RouterProvider>
              <Root />
            </RouterProvider>
          </AssessoriaProvider>
        </PrivacyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
