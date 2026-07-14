import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * "Ocultar Valores": quando ativo, todo valor monetário é mascarado na tela.
 * Útil para o assessor apresentar o painel sem expor os números do cliente.
 */
interface PrivacyContextValue {
  ocultar: boolean;
  toggle: () => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({ ocultar: false, toggle: () => {} });

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [ocultar, setOcultar] = useState(false);
  const toggle = useCallback(() => setOcultar(o => !o), []);
  return <PrivacyContext.Provider value={{ ocultar, toggle }}>{children}</PrivacyContext.Provider>;
}

export const usePrivacy = () => useContext(PrivacyContext);

const MOEDA_SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: '€', CHF: 'CHF', GBP: '£' };

/** Formata valor monetário respeitando o modo "Ocultar Valores". */
export function formatMoney(valor: number, ocultar: boolean, moeda = 'BRL'): string {
  const simbolo = MOEDA_SIMBOLO[moeda] ?? '';
  if (ocultar) return `${simbolo} ••••••`;
  return `${simbolo} ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
