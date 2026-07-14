import React, { createContext, useContext, useState, useCallback } from 'react';
import { setAssessoriaCliente } from '../services/api';

export interface AssessoriaCliente {
  clienteId: string;
  nome: string;
}

interface AssessoriaContextValue {
  /** Cliente sendo visualizado (null = modo normal do assessor) */
  cliente: AssessoriaCliente | null;
  entrar: (c: AssessoriaCliente) => void;
  sair: () => void;
}

const AssessoriaContext = createContext<AssessoriaContextValue>({
  cliente: null,
  entrar: () => {},
  sair: () => {},
});

export function AssessoriaProvider({ children }: { children: React.ReactNode }) {
  const [cliente, setCliente] = useState<AssessoriaCliente | null>(null);

  // O contexto é o DONO do modo view-as: ao entrar/sair ele também liga/desliga
  // o header X-Assessoria-Cliente do axios. Assim qualquer lugar que chame sair()
  // (ex: banner do AppShell) garante que o assessor volta a ver os próprios dados.
  const entrar = useCallback((c: AssessoriaCliente) => {
    setAssessoriaCliente(c.clienteId);
    setCliente(c);
  }, []);

  const sair = useCallback(() => {
    setAssessoriaCliente(null);
    setCliente(null);
  }, []);

  return (
    <AssessoriaContext.Provider value={{ cliente, entrar, sair }}>
      {children}
    </AssessoriaContext.Provider>
  );
}

export const useAssessoria = () => useContext(AssessoriaContext);
