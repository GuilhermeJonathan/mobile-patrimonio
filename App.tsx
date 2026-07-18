import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
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
import RecomendacoesScreen from './src/screens/RecomendacoesScreen';
import ContaScreen from './src/screens/ContaScreen';
import InvestimentosScreen from './src/screens/InvestimentosScreen';
import ParamCrudScreen from './src/screens/ParamCrudScreen';
import ConsultoriaScreen from './src/screens/ConsultoriaScreen';
import RelatoriosScreen from './src/screens/RelatoriosScreen';
import AppShell from './src/components/AppShell';
import DashboardGPScreen from './src/screens/DashboardGPScreen';
import LancamentosScreen from './src/screens/LancamentosScreen';
import CategoriasScreen from './src/screens/CategoriasScreen';
import DividasScreen from './src/screens/DividasScreen';
import AssinaturasScreen from './src/screens/AssinaturasScreen';
import MetasScreen from './src/screens/MetasScreen';
import CartoesGPScreen from './src/screens/CartoesGPScreen';
import CorretoresScreen from './src/screens/CorretoresScreen';
import HomeCorretorScreen from './src/screens/HomeCorretorScreen';
import AceitarConviteScreen from './src/screens/AceitarConviteScreen';

function isRotaAceitar(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    && window.location.pathname.replace(/^\//, '').split('/')[0] === 'aceitar';
}

const ROTAS_CLIENTE = [
  'patrimonio', 'ativos', 'passivos', 'projecao', 'investimentos',
  'gp-dashboard', 'gp-lancamentos', 'gp-categorias',
  'gp-dividas', 'gp-assinaturas', 'gp-metas', 'gp-cartoes',
];

function AreaLogada({ onLogout, isAssessor, isCorretor, userName, avatarUrl }: { onLogout: () => void; isAssessor: boolean; isCorretor: boolean; userName: string; avatarUrl: string | null }) {
  const { rota, navigate } = useRouter();
  const { cliente } = useAssessoria();
  const emViewAs = !!cliente?.clienteId;
  const assessorPuro = isAssessor && !emViewAs;
  const corretorPuro = isCorretor && !emViewAs;

  // Corretor/assessor FORA do view-as não acessam dados de cliente.
  // No view-as, ambos podem ver o painel do cliente (patrimônio, ativos, relatório, etc.).
  useEffect(() => {
    if (corretorPuro && rota !== 'home' && rota !== 'corretores' && rota !== 'conta') navigate('home');
    else if (assessorPuro && ROTAS_CLIENTE.includes(rota)) navigate('clientes');
    else if (rota === 'relatorios' && !emViewAs) navigate('home');
  }, [assessorPuro, corretorPuro, emViewAs, rota, navigate]);

  const conteudo: Record<string, React.ReactNode> = {
    home:          (isCorretor && !emViewAs) ? <HomeCorretorScreen /> : <HomeScreen isAssessor={isAssessor} />,
    patrimonio:    <PatrimonioDashboardScreen onLogout={onLogout} />,
    ativos:        <AtivosScreen />,
    passivos:      <PassivosScreen />,
    projecao:      <ProjecaoPatrimonialScreen />,
    clientes:                      <AssessorClientesScreen userName={userName} avatarUrl={avatarUrl} />,
    recomendacoes:                 <RecomendacoesScreen />,
    'cadastros-tipos-ativo':       <ParamCrudScreen kind="tipoAtivo" />,
    'cadastros-tipos-investimento':<ParamCrudScreen kind="tipoInvestimento" />,
    'cadastros-moedas':            <ParamCrudScreen kind="moeda" />,
    'cadastros-consultoria':       <ConsultoriaScreen />,
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
    corretores:        <CorretoresScreen />,
  };

  return (
    <AppShell onLogout={onLogout} isAssessor={isAssessor} isCorretor={isCorretor} userName={userName} avatarUrl={avatarUrl}>
      {conteudo[rota] ?? conteudo['home']}
    </AppShell>
  );
}

function Root() {
  const { colors } = useTheme();
  const [logado, setLogado]         = useState<boolean | null>(null);
  const [isAssessor, setIsAssessor] = useState(false);
  const [isCorretor, setIsCorretor] = useState(false);
  const [userName, setUserName]     = useState('');
  const [avatarUrl, setAvatarUrl]   = useState<string | null>(null);
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [aceitarConvite, setAceitarConvite] = useState(isRotaAceitar());

  async function carregarPerfil() {
    setPerfilCarregado(false);
    try {
      const p = await profileService.get();
      setIsAssessor(p.isAssessor);
      setIsCorretor(p.isCorretor);
      setUserName(p.name);
      setAvatarUrl(p.avatarUrl);
    } catch (e: any) {
      // Sessão inválida/expirada → sai da área logada e mostra o login (evita shell preso no spinner).
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        await authService.logout();
        setLogado(false);
      }
    }
    finally {
      // Só liberamos a UI depois do perfil — evita o "flash" de menus da permissão errada.
      setPerfilCarregado(true);
    }
  }

  useEffect(() => {
    authService.isLogged().then(async (ok) => {
      setLogado(ok);
      if (ok) carregarPerfil();
    });
  }, []);

  // Rota pública de aceite de convite (link do e-mail) — renderiza fora do gate de login.
  if (aceitarConvite) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <AceitarConviteScreen onAceito={() => { setAceitarConvite(false); setLogado(true); carregarPerfil(); }} />
      </SafeAreaView>
    );
  }

  // Enquanto o login não resolveu, ou o perfil (permissões) ainda não chegou → spinner.
  // Sem isso, a UI renderiza com isAssessor/isCorretor=false e "pisca" os menus errados.
  if (logado === null || (logado && !perfilCarregado)) {
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
        ? <AreaLogada onLogout={() => setLogado(false)} isAssessor={isAssessor} isCorretor={isCorretor} userName={userName} avatarUrl={avatarUrl} />
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
