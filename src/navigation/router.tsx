import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export type Rota =
  | 'home' | 'patrimonio' | 'ativos' | 'passivos' | 'projecao' | 'plano-acao' | 'planos' | 'clientes' | 'recomendacoes' | 'conta' | 'investimentos' | 'relatorios' | 'estruturas'
  | 'cadastros-tipos-ativo' | 'cadastros-tipos-investimento' | 'cadastros-moedas' | 'cadastros-consultoria' | 'cadastros-saude'
  | 'gp-dashboard' | 'gp-lancamentos' | 'gp-categorias' | 'gp-dividas' | 'gp-assinaturas' | 'gp-metas' | 'gp-cartoes'
  | 'corretores' | 'admin' | 'estruturas-exemplo' | 'beneficiarios';

export const ROTAS: Rota[] = [
  'home', 'patrimonio', 'ativos', 'passivos', 'projecao', 'plano-acao', 'planos', 'clientes', 'recomendacoes', 'conta', 'investimentos', 'relatorios', 'estruturas',
  'cadastros-tipos-ativo', 'cadastros-tipos-investimento', 'cadastros-moedas', 'cadastros-consultoria', 'cadastros-saude',
  'gp-dashboard', 'gp-lancamentos', 'gp-categorias', 'gp-dividas', 'gp-assinaturas', 'gp-metas', 'gp-cartoes',
  'corretores', 'admin', 'estruturas-exemplo', 'beneficiarios',
];

// Lê a rota a partir da URL (web). Em native não há URL → sempre 'home'.
function rotaAtualDaUrl(): Rota {
  if (Platform.OS !== 'web') return 'home';
  const seg = window.location.pathname.replace(/^\//, '').split('/')[0];
  return (ROTAS as string[]).includes(seg) ? (seg as Rota) : 'home';
}

interface RouterContextValue {
  rota: Rota;
  /** Parâmetro opcional passado na navegação (ex.: id de recomendação a abrir). */
  param?: string;
  navigate: (r: Rota, param?: string) => void;
  /** Limpa o parâmetro após ser consumido pela tela de destino. */
  clearParam: () => void;
}

const RouterContext = createContext<RouterContextValue>({ rota: 'home', navigate: () => {}, clearParam: () => {} });

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [rota, setRota] = useState<Rota>(rotaAtualDaUrl());
  const [param, setParam] = useState<string | undefined>(undefined);

  // Sincroniza com botões voltar/avançar do navegador
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPop = () => { setRota(rotaAtualDaUrl()); setParam(undefined); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((r: Rota, p?: string) => {
    setRota(r);
    setParam(p);
    if (Platform.OS === 'web' && window.location.pathname !== `/${r}`) {
      window.history.pushState({}, '', `/${r}`);
    }
  }, []);

  const clearParam = useCallback(() => setParam(undefined), []);

  return <RouterContext.Provider value={{ rota, param, navigate, clearParam }}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);
