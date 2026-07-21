import React, { createContext, useContext, useState, useCallback } from 'react';
import { Platform } from 'react-native';
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

// Persistência do modo view-as (só web precisa: é onde há F5/reload).
const STORAGE_KEY = 'assessoria_cliente';

function lerClientePersistido(): AssessoriaCliente | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AssessoriaCliente) : null;
  } catch { return null; }
}

function persistirCliente(c: AssessoriaCliente | null) {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    if (c) localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignora — storage indisponível */ }
}

export function AssessoriaProvider({ children }: { children: React.ReactNode }) {
  // Inicialização SÍNCRONA: restaura o view-as do storage e religa o header do axios
  // ANTES de qualquer tela montar (evita o F5 cair na tela de clientes e evita
  // buscar os dados do assessor no lugar do cliente).
  const [cliente, setCliente] = useState<AssessoriaCliente | null>(() => {
    const salvo = lerClientePersistido();
    if (salvo) setAssessoriaCliente(salvo.clienteId);
    return salvo;
  });

  // O contexto é o DONO do modo view-as: ao entrar/sair ele liga/desliga o header
  // X-Assessoria-Cliente do axios E persiste, para sobreviver ao reload.
  const entrar = useCallback((c: AssessoriaCliente) => {
    setAssessoriaCliente(c.clienteId);
    persistirCliente(c);
    setCliente(c);
  }, []);

  const sair = useCallback(() => {
    setAssessoriaCliente(null);
    persistirCliente(null);
    setCliente(null);
  }, []);

  return (
    <AssessoriaContext.Provider value={{ cliente, entrar, sair }}>
      {children}
    </AssessoriaContext.Provider>
  );
}

export const useAssessoria = () => useContext(AssessoriaContext);
