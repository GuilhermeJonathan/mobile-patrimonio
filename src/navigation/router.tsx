import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export type Rota =
  | 'home' | 'patrimonio' | 'ativos' | 'passivos' | 'projecao' | 'clientes' | 'conta' | 'investimentos' | 'relatorios'
  | 'cadastros-tipos-ativo' | 'cadastros-tipos-investimento' | 'cadastros-moedas'
  | 'gp-dashboard' | 'gp-lancamentos' | 'gp-categorias' | 'gp-dividas' | 'gp-assinaturas' | 'gp-metas' | 'gp-cartoes';

export const ROTAS: Rota[] = [
  'home', 'patrimonio', 'ativos', 'passivos', 'projecao', 'clientes', 'conta', 'investimentos', 'relatorios',
  'cadastros-tipos-ativo', 'cadastros-tipos-investimento', 'cadastros-moedas',
  'gp-dashboard', 'gp-lancamentos', 'gp-categorias', 'gp-dividas', 'gp-assinaturas', 'gp-metas', 'gp-cartoes',
];

// Lê a rota a partir da URL (web). Em native não há URL → sempre 'home'.
function rotaAtualDaUrl(): Rota {
  if (Platform.OS !== 'web') return 'home';
  const seg = window.location.pathname.replace(/^\//, '').split('/')[0];
  return (ROTAS as string[]).includes(seg) ? (seg as Rota) : 'home';
}

interface RouterContextValue {
  rota: Rota;
  navigate: (r: Rota) => void;
}

const RouterContext = createContext<RouterContextValue>({ rota: 'home', navigate: () => {} });

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [rota, setRota] = useState<Rota>(rotaAtualDaUrl());

  // Sincroniza com botões voltar/avançar do navegador
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPop = () => setRota(rotaAtualDaUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((r: Rota) => {
    setRota(r);
    if (Platform.OS === 'web' && window.location.pathname !== `/${r}`) {
      window.history.pushState({}, '', `/${r}`);
    }
  }, []);

  return <RouterContext.Provider value={{ rota, navigate }}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);
