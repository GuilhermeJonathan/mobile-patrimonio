import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeToken, tokenExpiresAt } from '../utils/tokenUtils';
import { dataBR } from '../utils/format';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5241/api';
const LOGIN_API_URL = process.env.EXPO_PUBLIC_LOGIN_URL ?? 'http://localhost:5290';

const TOKEN_KEY   = '@patrimonio_token';
const AVATAR_KEY  = '@patrimonio_avatar';

// API de domínio (compartilhada com o FinDog) — módulo /patrimonio
export const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
// API de autenticação (mesma Login API do FinDog)
export const loginApi = axios.create({ baseURL: LOGIN_API_URL, headers: { 'Content-Type': 'application/json' } });

// modo view-as: quando ativo toda requisição à api leva X-Assessoria-Cliente
let _assessoriaClienteId: string | null = null;
export function setAssessoriaCliente(id: string | null) { _assessoriaClienteId = id; }
export function getAssessoriaCliente(): string | null    { return _assessoriaClienteId; }

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (_assessoriaClienteId && !config.headers['X-Assessoria-Cliente'])
    config.headers['X-Assessoria-Cliente'] = _assessoriaClienteId;
  return config;
});

loginApi.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 = token inválido/expirado → limpa para forçar novo login (auto-recuperação)
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error?.response?.status === 401) {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(error);
  },
);

export const authService = {
  async login(email: string, password: string): Promise<boolean> {
    const { data } = await loginApi.post('/user/authenticate', { email, password });
    const token = data.accessToken ?? data.token;
    if (!token) return false;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(AVATAR_KEY, data.avatarUrl ?? '');
    return true;
  },
  async logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(AVATAR_KEY);
  },
  async isLogged(): Promise<boolean> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return false;
    // Token inválido ou expirado → limpa e força novo login (evita área logada com 401 em loop).
    const payload = decodeToken(token);
    const expMs = payload?.exp ? payload.exp * 1000 : 0;
    if (!payload || !expMs || expMs <= Date.now()) {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(AVATAR_KEY);
      return false;
    }
    return true;
  },
  /** Guarda um token já emitido (usado no aceite público de convite). */
  async setToken(token: string) { await AsyncStorage.setItem(TOKEN_KEY, token); },
};

// ── Convite público (tela /aceitar, sem login) ──
export interface ConviteInfo { valido: boolean; nomeAssessor: string | null; emailConvidado: string | null; jaAceito: boolean; }
export type ConviteTipo = 'cliente' | 'corretor';

export const conviteService = {
  validar: (tipo: ConviteTipo, codigo: string): Promise<ConviteInfo> => {
    const base = tipo === 'corretor' ? '/corretores' : '/assessoria';
    return api.get(`${base}/convite/validar/${encodeURIComponent(codigo)}`).then(r => r.data);
  },
  aceitar: (tipo: ConviteTipo, codigo: string, nome: string, senha: string): Promise<{ accessToken: string }> => {
    const base = tipo === 'corretor' ? '/corretores' : '/assessoria';
    return api.post(`${base}/aceitar-publico`, { codigo, nome, senha }).then(r => r.data);
  },
};

// ── Patrimônio ──
export interface AtivoResumoDto {
  id: string;
  nome: string;
  tipo: number;
  moeda: string;
  valorAtual: number;
  valorizacaoAnualPct: number | null;
  receitaMensal: number;
  despesaMensal: number;
  fluxoLiquidoMensal: number;
  roiAnualPct: number | null;   // retorno total anual = yield + valorização
  yieldAnualPct: number | null; // só o fluxo de caixa / valor
}
export interface PassivoResumoDto {
  id: string;
  nome: string;
  moeda: string;
  valor: number;
  prazo: number;        // 1=Curto, 2=Longo
  valorBRL: number;
}
export interface CategoriaComposicaoDto { categoria: string; totalBRL: number; pct: number; roiAnualPct: number | null; }
export interface TotalPorMoedaDto { moeda: string; total: number; quantidade: number; }
export interface ResumoPatrimonialDto {
  qtdAtivos: number;
  totalBensBRL: number;
  totalDividasBRL: number;
  patrimonioLiquidoBRL: number;
  alavancagemPct: number;
  receitaMensalBRL: number;
  despesaMensalBRL: number;
  saldoLiquidoMensalBRL: number;
  roiAnualPct: number | null;
  composicao: CategoriaComposicaoDto[];
  totaisPorMoeda: TotalPorMoedaDto[];
  totalConsolidadoBRL: number;
  cambioEstimado: boolean;
  ativos: AtivoResumoDto[];
  passivos: PassivoResumoDto[];
}

// payloads de escrita (só os campos que o usuário informa)
export interface AtivoInput {
  nome: string; tipo: number; moeda: string; valorAtual: number;
  valorizacaoAnualPct: number | null; receitaMensal: number; despesaMensal: number;
}
export interface PassivoInput {
  nome: string; moeda: string; valor: number; prazo: number;
  taxaJurosAnualPct: number | null; prazoMeses: number | null;
}
export interface PontoProjecaoDto { mesOffset: number; saldoBRL: number; }
export interface ProjecaoDividasDto {
  saldoInicialBRL: number; horizonteMeses: number; cambioEstimado: boolean; pontos: PontoProjecaoDto[];
}

export interface PontoProjecaoPatrimonioDto {
  mesOffset: number; bensBRL: number; dividasBRL: number; patrimonioLiquidoBRL: number;
}
export interface ProjecaoPatrimonioDto {
  horizonteMeses: number;
  cambioEstimado: boolean;
  patrimonioInicialBRL: number;
  patrimonioFinalBRL: number;
  mesesQuitacaoDividas: number | null;
  pontos: PontoProjecaoPatrimonioDto[];
}

export interface DicaFinanceiraDto {
  tipo: 'critico' | 'atencao' | 'positivo';
  titulo: string;
  descricao: string;
  dicaEducativa?: string;
  acaoLabel?: string;
  acaoRota?: string;
}

export interface InsightDto {
  severidade: string;   // "alerta" | "atencao" | "positivo"
  titulo: string;
  mensagem: string;
  recomendacaoSugerida: string;
}

export interface RebalanceamentoClasseDto {
  tipo: number;
  atualBRL: number;
  atualPct: number;
  alvoPct: number;
  desvioPct: number;
}
export interface RebalanceamentoDto {
  totalBRL: number;
  temAlvo: boolean;
  classes: RebalanceamentoClasseDto[];
}

export interface EvolucaoPontoDto {
  ano: number;
  mes: number;
  patrimonioLiquidoBRL: number;
  totalBensBRL: number;
  totalDividasBRL: number;
}

export const patrimonioService = {
  resumo: (): Promise<ResumoPatrimonialDto> =>
    api.get('/patrimonio/resumo').then(r => r.data),

  evolucao: (meses = 12): Promise<EvolucaoPontoDto[]> =>
    api.get(`/patrimonio/evolucao?meses=${meses}`).then(r => r.data),

  insights: (): Promise<InsightDto[]> =>
    api.get('/patrimonio/insights').then(r => r.data),

  importarInvestimentos: (conteudo: string): Promise<{ importados: number; erros: string[] }> =>
    api.post('/patrimonio/investimentos/importar', { conteudo }).then(r => r.data),

  rebalanceamento: (): Promise<RebalanceamentoDto> =>
    api.get('/patrimonio/rebalanceamento').then(r => r.data),
  salvarAlocacaoAlvo: (alvos: { tipo: number; percentualAlvo: number }[]): Promise<void> =>
    api.put('/patrimonio/alocacao-alvo', alvos).then(r => r.data),

  dicas: (): Promise<DicaFinanceiraDto[]> =>
    api.get('/patrimonio/dicas').then(r => r.data),

  criarAtivo: (data: AtivoInput): Promise<{ id: string }> =>
    api.post('/patrimonio/ativos', data).then(r => r.data),

  atualizarAtivo: (id: string, data: AtivoInput): Promise<void> =>
    api.put(`/patrimonio/ativos/${id}`, data).then(r => r.data),

  deletarAtivo: (id: string): Promise<void> =>
    api.delete(`/patrimonio/ativos/${id}`).then(r => r.data),

  criarPassivo: (data: PassivoInput): Promise<{ id: string }> =>
    api.post('/patrimonio/passivos', data).then(r => r.data),

  atualizarPassivo: (id: string, data: PassivoInput): Promise<void> =>
    api.put(`/patrimonio/passivos/${id}`, data).then(r => r.data),

  deletarPassivo: (id: string): Promise<void> =>
    api.delete(`/patrimonio/passivos/${id}`).then(r => r.data),

  projecaoDividas: (meses?: number): Promise<ProjecaoDividasDto> =>
    api.get('/patrimonio/projecao-dividas', { params: meses ? { meses } : {} }).then(r => r.data),

  projecaoPatrimonio: (meses?: number): Promise<ProjecaoPatrimonioDto> =>
    api.get('/patrimonio/projecao-patrimonio', { params: meses ? { meses } : {} }).then(r => r.data),
};

// ── Plano de Ação (jornada de etapas do cliente) ──
export interface EtapaPlanoDto {
  ordem: number; titulo: string; descricao: string | null; prazo: string | null; alvo: string | null; status: number;
}
export interface PlanoAcaoDto { id: string; objetivo: string; prazo: string | null; etapas: EtapaPlanoDto[]; }
export interface EtapaPlanoInput {
  titulo: string; descricao?: string | null; prazo?: string | null; alvo?: string | null; status: number;
}

export const planoAcaoService = {
  // Um cliente pode ter vários planos. clienteId opcional envia o header de view-as só nesta
  // requisição (usado pelo hub de Planos do assessor, sem entrar em view-as global).
  listar: (clienteId?: string): Promise<PlanoAcaoDto[]> =>
    api.get('/patrimonio/plano-acao', clienteId ? { headers: { 'X-Assessoria-Cliente': clienteId } } : undefined)
      .then(r => r.data || []),
  criar: (objetivo: string, prazo: string | null, etapas: EtapaPlanoInput[]): Promise<{ id: string }> =>
    api.post('/patrimonio/plano-acao', { objetivo, prazo, etapas }).then(r => r.data),
  atualizar: (id: string, objetivo: string, prazo: string | null, etapas: EtapaPlanoInput[]): Promise<{ id: string }> =>
    api.put(`/patrimonio/plano-acao/${id}`, { objetivo, prazo, etapas }).then(r => r.data),
  excluir: (id: string): Promise<void> =>
    api.delete(`/patrimonio/plano-acao/${id}`).then(r => r.data),
};

// ── Simulações (proteção patrimonial) ────────────────────────────────────────
export interface CenarioDto {
  nome: string;
  tipo: number;          // 1=AporteExtra, 2=ResgateExtra
  valor: number;
  idadeInicio: number;
  idadeFim: number | null;
}
export interface SimulacaoDto {
  id: string;
  nome: string;
  favorita: boolean;
  idadeAtual: number;
  idadeAlvo: number;
  patrimonioInicial: number;
  modoAutomatico: boolean;
  aporteMensal: number;
  taxaRetornoRealAnualPct: number;
  retiradaMensal: number;
  criadoEm: string;
  atualizadoEm: string | null;
  cenarios: CenarioDto[];
}
export interface SimulacaoInput {
  nome: string;
  favorita: boolean;
  idadeAtual: number;
  idadeAlvo: number;
  patrimonioInicial: number;
  modoAutomatico: boolean;
  aporteMensal: number;
  taxaRetornoRealAnualPct: number;
  retiradaMensal: number;
  cenarios: CenarioDto[];
}

// ── Relatório PDF (patrimonial, com marca do assessor) ───────────────────────
export interface RelatorioInput {
  clienteNome: string | null;
  nomeConsultoria: string | null;
  logoBase64: string | null;   // aceita data URL
  corMarca: string | null;     // hex, ex: "#16a34a"
}

export const relatorioService = {
  // Retorna o PDF como Blob (para download no web). Usa o cliente em view-as (header global), se houver.
  gerar: (data: RelatorioInput): Promise<Blob> =>
    api.post('/patrimonio/relatorio', data, { responseType: 'blob' }).then(r => r.data),

  // Gera o relatório de um cliente específico (atalho da carteira), sem entrar no view-as.
  gerarParaCliente: (clienteId: string, data: RelatorioInput): Promise<Blob> =>
    api.post('/patrimonio/relatorio', data, {
      responseType: 'blob',
      headers: { 'X-Assessoria-Cliente': clienteId },
    }).then(r => r.data),
};

// ── Consultoria (marca do assessor) ──────────────────────────────────────────
export interface ConsultoriaConfigDto {
  nomeConsultoria: string;
  logoBase64: string | null;
  corMarca: string | null;
  whatsApp: string | null;
  mensagemRodape: string | null;
}

export const consultoriaService = {
  get: (): Promise<ConsultoriaConfigDto> =>
    api.get('/consultoria').then(r => r.data),

  salvar: (data: ConsultoriaConfigDto): Promise<void> =>
    api.put('/consultoria', data).then(r => r.data),
};

export const simulacaoService = {
  listar: (): Promise<SimulacaoDto[]> =>
    api.get('/simulacoes').then(r => r.data),

  criar: (data: SimulacaoInput): Promise<{ id: string }> =>
    api.post('/simulacoes', data).then(r => r.data),

  atualizar: (id: string, data: SimulacaoInput): Promise<void> =>
    api.put(`/simulacoes/${id}`, data).then(r => r.data),

  deletar: (id: string): Promise<void> =>
    api.delete(`/simulacoes/${id}`).then(r => r.data),
};

// ── Perfil (Login API) ──────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  cellphone: string | null;
  document: string | null;
  avatarUrl: string | null;
  expiresAt: Date | null;
  planLabel: string | null;    // ex: "Pago · expira 22/07/2026"
  isAssessor: boolean;
  isCorretor: boolean;
}

export const profileService = {
  async get(): Promise<UserProfile> {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const payload = token ? decodeToken(token) : null;
    const { data } = await loginApi.get('/user/me');
    const avatarUrl = (await AsyncStorage.getItem(AVATAR_KEY)) || data.avatarUrl || null;

    let planLabel: string | null = null;
    const plan = data.planInfo;
    if (plan?.hasPaidPlan && plan?.planExpiresAt) {
      const exp = dataBR(plan.planExpiresAt);
      planLabel = `Pago · expira ${exp}`;
    } else if (plan?.isTrialActive) {
      planLabel = `Trial · ${plan.trialDaysRemaining ?? 0} dias restantes`;
    }

    return {
      id: payload?.nameid ?? '',
      name: data.name ?? payload?.unique_name ?? '',
      email: data.email ?? payload?.email ?? '',
      cellphone: data.cellphone ?? null,
      document: data.document ?? null,
      avatarUrl,
      expiresAt: token ? tokenExpiresAt(token) : null,
      planLabel,
      isAssessor: payload?.userType === '3' || payload?.userType === '1',
      isCorretor: payload?.userType === '4',
    };
  },

  async updateProfile(name: string, cellphone: string | null, document: string | null): Promise<void> {
    await loginApi.patch('/user/me/profile', { name, cellphone, document });
  },

  async updateAvatar(dataUrl: string | null): Promise<void> {
    await loginApi.patch('/user/me/avatar', { avatarUrl: dataUrl });
    await AsyncStorage.setItem(AVATAR_KEY, dataUrl ?? '');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await loginApi.patch('/user/me/password', { currentPassword, newPassword });
  },

  async deleteAccount(): Promise<void> {
    await loginApi.delete('/user/me');
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(AVATAR_KEY);
  },
};

// ── Investimentos ───────────────────────────────────────────────────────────
export interface InvestimentoDto {
  id: string;
  nome: string;
  tipo: number;
  moeda: string;
  corretora: string | null;
  ticker: string | null;
  valorAplicado: number;
  valorAtual: number;
  rentabilidadeAnualPct: number | null;
  valorAplicadoBRL?: number;   // calculado no backend (câmbio) — só leitura
  valorAtualBRL?: number;      // calculado no backend (câmbio) — só leitura
}
export interface TotalInvestPorMoedaDto { moeda: string; totalAplicado: number; totalAtual: number; quantidade: number; }
export interface ResumoInvestimentosDto {
  qtdInvestimentos: number;
  totalAplicadoBRL: number;
  totalAtualBRL: number;
  rentabilidadePct: number | null;
  cambioEstimado: boolean;
  totaisPorMoeda: TotalInvestPorMoedaDto[];
  investimentos: InvestimentoDto[];
}

export const investimentosService = {
  resumo: (): Promise<ResumoInvestimentosDto> =>
    api.get('/investimentos/resumo').then(r => r.data),

  criar: (data: Omit<InvestimentoDto, 'id'>): Promise<{ id: string }> =>
    api.post('/investimentos', data).then(r => r.data),

  atualizar: (id: string, data: Omit<InvestimentoDto, 'id'>): Promise<void> =>
    api.put(`/investimentos/${id}`, data).then(r => r.data),

  deletar: (id: string): Promise<void> =>
    api.delete(`/investimentos/${id}`).then(r => r.data),
};

// ── Parâmetros (gerenciados pelo assessor) ───────────────────────────────────
export interface ParamItemDto  { id: number; nome: string; icone: string | null; ordem: number; ativo: boolean; isSystem: boolean; }
export interface MoedaParamDto { id: number; codigo: string; nome: string; cotacaoBRL: number; ordem: number; ativo: boolean; isSystem: boolean; }

export const parametrosService = {
  tiposAtivo:        (): Promise<ParamItemDto[]>  => api.get('/parametros/tipos-ativo').then(r => r.data),
  tiposInvestimento: (): Promise<ParamItemDto[]>  => api.get('/parametros/tipos-investimento').then(r => r.data),
  moedas:            (): Promise<MoedaParamDto[]> => api.get('/parametros/moedas').then(r => r.data),

  salvarTipoAtivo: (data: { id?: number; nome: string; icone?: string | null; ordem: number; ativo: boolean }): Promise<{ id: number }> =>
    api.post('/parametros/tipos-ativo', data).then(r => r.data),
  deletarTipoAtivo: (id: number): Promise<void> =>
    api.delete(`/parametros/tipos-ativo/${id}`).then(r => r.data),

  salvarTipoInvestimento: (data: { id?: number; nome: string; icone?: string | null; ordem: number; ativo: boolean }): Promise<{ id: number }> =>
    api.post('/parametros/tipos-investimento', data).then(r => r.data),
  deletarTipoInvestimento: (id: number): Promise<void> =>
    api.delete(`/parametros/tipos-investimento/${id}`).then(r => r.data),

  salvarMoeda: (data: { id?: number; codigo: string; nome: string; cotacaoBRL: number; ordem: number; ativo: boolean }): Promise<{ id: number }> =>
    api.post('/parametros/moedas', data).then(r => r.data),
  deletarMoeda: (id: number): Promise<void> =>
    api.delete(`/parametros/moedas/${id}`).then(r => r.data),
};

// ── Assessoria ───────────────────────────────────────────────────────────────
export interface ClienteAssessoriaDto {
  vinculoId: string;
  clienteId: string;
  nomeCliente: string | null;
  codigoConvite: string;
  aceito: boolean;
  ativo: boolean;
  criadoEm: string;
  aceitoEm: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailConvidado: string | null;
  expiraEm: string | null;
  expirado: boolean;
}

export interface SaudeFinanceiraDto {
  scoreGeral: number;
  classificacao: string; // 'Excelente' | 'Boa' | 'Atenção' | 'Crítica'
}

export interface RecomendacaoDto {
  id: string;
  clienteId: string;
  tipo: number; // 1=AjusteCategoria 2=Dica 3=Alerta
  categoriaId: string | null;
  texto: string;
  status: number; // 1=Pendente 2=Aceita 3=Recusada
  respostaCliente: string | null;
  criadoEm: string;
  respondidoEm: string | null;
}

export interface RespostaRecomendacaoDto {
  id: string;
  nomeCliente: string;
  tipo: number;   // 1=Ajuste 2=Dica 3=Alerta
  texto: string;
  status: number; // 2=Aceita 3=Recusada
  respostaCliente: string | null;
  respondidoEm: string | null;
  vista: boolean;
}
export interface RespostasRecomendacoesDto {
  naoVistas: number;
  itens: RespostaRecomendacaoDto[];
}

export interface AnaliseIaDto {
  rascunho: string;
  tipoSugerido: number; // 2=Dica 3=Alerta
}

export const assessoriaService = {
  gerarConvite: (): Promise<{ codigo: string }> =>
    api.post('/assessoria/convite').then(r => r.data),

  clientes: (): Promise<ClienteAssessoriaDto[]> =>
    api.get('/assessoria/clientes').then(r => r.data),

  revogar: (vinculoId: string): Promise<void> =>
    api.delete(`/assessoria/${vinculoId}`).then(r => r.data),

  resumoCliente: (clienteId: string): Promise<ResumoPatrimonialDto> =>
    api.get('/patrimonio/resumo', {
      headers: { 'X-Assessoria-Cliente': clienteId },
    }).then(r => r.data),

  saude: (clienteId: string, mes: number, ano: number): Promise<SaudeFinanceiraDto> =>
    api.get(`/assessoria/saude/${mes}/${ano}`, {
      headers: { 'X-Assessoria-Cliente': clienteId },
    }).then(r => r.data),

  meuAssessor: (): Promise<MeuAssessorDto> =>
    api.get('/assessoria/meu-assessor').then(r => r.data),

  // Recomendações
  getRecomendacoes: (clienteId: string): Promise<RecomendacaoDto[]> =>
    api.get(`/assessoria/recomendacoes/cliente/${clienteId}`).then(r => r.data),

  criarRecomendacao: (clienteId: string, tipo: number, texto: string, categoriaId?: string): Promise<{ id: string }> =>
    api.post('/assessoria/recomendacoes', { clienteId, tipo, texto, categoriaId: categoriaId ?? null }).then(r => r.data),

  // Gera um convite e envia por e-mail ao cliente (com link para /aceitar).
  enviarConviteEmail: (email: string): Promise<{ codigo: string }> =>
    api.post('/assessoria/convite/email', { email }).then(r => r.data),
  reenviarConvite: (vinculoId: string): Promise<void> =>
    api.post(`/assessoria/convite/${vinculoId}/reenviar`).then(r => r.data),

  // Sino do assessor: respostas dos clientes às recomendações.
  respostasRecomendacoes: (): Promise<RespostasRecomendacoesDto> =>
    api.get('/assessoria/recomendacoes/respostas').then(r => r.data),
  marcarRespostasVistas: (): Promise<void> =>
    api.post('/assessoria/recomendacoes/respostas/marcar-vistas').then(r => r.data),

  // Rascunho de recomendação gerado por IA (o assessor edita antes de enviar).
  analiseIa: (clienteId: string, mes: number, ano: number): Promise<AnaliseIaDto> =>
    api.get(`/assessoria/analise-ia/${mes}/${ano}`, {
      headers: { 'X-Assessoria-Cliente': clienteId },
    }).then(r => r.data),

  excluirRecomendacao: (id: string): Promise<void> =>
    api.delete(`/assessoria/recomendacoes/${id}`).then(r => r.data),

  // Visão do cliente: suas próprias recomendações recebidas
  minhasRecomendacoes: (): Promise<RecomendacaoDto[]> =>
    api.get('/assessoria/recomendacoes').then(r => r.data),

  responderRecomendacao: (id: string, aceitar: boolean, comentario?: string): Promise<void> =>
    api.patch(`/assessoria/recomendacoes/${id}/responder`, { aceitar, comentario: comentario ?? null }).then(r => r.data),
};

export interface MeuAssessorDto {
  temAssessor: boolean;
  vinculoId: string | null;
  nomeAssessor: string | null;
  aceitoEm: string | null;
  whatsApp: string | null;
}

// ── Gestão Pessoal (FinDog integrado) ────────────────────────────────────────

// Dashboard
export interface ResumoCategoriaDto { categoria: string; total: number; icone: string | null; cor: string | null; }
export interface DashboardDto {
  mes: number; ano: number;
  totalCreditos: number; totalDebitos: number; saldo: number;
  resumoDebitos: ResumoCategoriaDto[];
  variacaoCreditos: number | null; variacaoDebitos: number | null; variacaoSaldo: number | null;
  diasReserva: number | null; comprometimentoRenda: number | null;
}

// Lançamentos
export interface LancamentoDto {
  id: string; descricao: string; data: string; valor: number;
  tipo: number; situacao: number; mes: number; ano: number;
  categoriaId: string | null; categoriaNome: string | null; categoriaIcone: string | null; categoriaCor: string | null;
  cartaoId: string | null; cartaoNome: string | null;
  parcelaAtual: number | null; totalParcelas: number | null; grupoParcelas: string | null;
  isRecorrente: boolean;
  contaBancariaId: string | null; contaBancariaNome: string | null;
  dataPagamento: string | null;
}
export interface PagedResult<T> { items: T[]; total: number; page: number; pageSize: number; }

// Categorias
export interface CategoriaDto {
  id: string; nome: string; tipo: number; limiteMensal: number | null; icone: string | null; cor: string | null;
}

// Saldos
export interface SaldoContaDto { id: string; banco: string; saldo: number; tipo: number; dataAtualizacao: string; }

// Cartões
export interface CartaoLancamentoDto {
  id: string; descricao: string; valor: number; data: string;
  situacao: number; parcelaAtual: number | null; totalParcelas: number | null;
  categoriaNome: string | null; categoriaIcone: string | null; categoriaCor: string | null;
}
export interface CartaoDto {
  id: string; nome: string; diaVencimento: number | null; totalMes: number;
  lancamentos: CartaoLancamentoDto[];
}
// kept for backward compat
export type ParcelaDto = CartaoLancamentoDto;

// Dívidas / parcelados vigentes
export interface ParceladoVigenteDto {
  descricao: string; categoriaNome: string | null; cartaoNome: string | null;
  primeiraData: string; parcelaMin: number; totalParcelas: number;
  valorParcela: number; saldoRestante: number;
}
export interface ParceladosVigentesResultDto {
  totalDivida: number;
  itens: ParceladoVigenteDto[];
}

// Assinaturas
export interface AssinaturaDto {
  grupoId: string; descricao: string; valorMensal: number;
  categoriaNome: string | null; categoriaIcone: string | null; categoriaCor: string | null;
  proximoVencimento: string | null; totalLancamentos: number; lancamentosPagos: number;
}

// Metas
export interface MetaDto {
  id: string; titulo: string; descricao?: string;
  valorMeta: number; valorAtual: number;
  dataMeta: string | null; status: number;
  capa?: string | null; corFundo?: string | null;
  criadoEm: string;
  contribuicaoMensalValor?: number | null;
  contribuicaoDia?: number | null;
}

// Orçamento
export interface OrcamentoItemDto {
  id: string; nome: string; limiteMensal: number | null; gastoAtual: number; icone: string | null; cor: string | null;
}

// Receitas recorrentes
export interface ReceitaRecorrenteDto {
  id: string; descricao: string; tipo: number; valor: number;
  valorHora: number | null; quantidadeHoras: number | null; ativo: boolean;
}

export const gestaoService = {
  // Dashboard
  dashboard: (mes: number, ano: number): Promise<DashboardDto> =>
    api.get(`/lancamentos/dashboard/${mes}/${ano}`).then(r => r.data),

  // Lançamentos
  lancamentos: (mes: number, ano: number, page = 1, pageSize = 200): Promise<PagedResult<LancamentoDto>> =>
    api.get(`/lancamentos/${mes}/${ano}`, { params: { page, pageSize } }).then(r => r.data),
  criarLancamento: (data: Omit<LancamentoDto, 'id' | 'categoriaNome' | 'categoriaIcone' | 'categoriaCor' | 'cartaoNome' | 'contaBancariaNome' | 'dataPagamento'>): Promise<{ id: string }> =>
    api.post('/lancamentos', data).then(r => r.data),
  atualizarLancamento: (id: string, data: object): Promise<void> =>
    api.put(`/lancamentos/${id}`, data).then(r => r.data),
  deletarLancamento: (id: string): Promise<void> =>
    api.delete(`/lancamentos/${id}`).then(r => r.data),
  atualizarSituacao: (id: string, situacao: number): Promise<void> =>
    api.patch(`/lancamentos/${id}/situacao`, { situacao }).then(r => r.data),

  // Categorias
  categorias: (page = 1, pageSize = 100): Promise<PagedResult<CategoriaDto>> =>
    api.get('/categorias', { params: { page, pageSize } }).then(r => r.data),
  criarCategoria: (data: { nome: string; tipo: number; limiteMensal?: number | null; icone?: string | null; cor?: string | null }): Promise<{ id: string }> =>
    api.post('/categorias', data).then(r => r.data),
  atualizarCategoria: (id: string, data: object): Promise<void> =>
    api.put(`/categorias/${id}`, data).then(r => r.data),
  deletarCategoria: (id: string): Promise<void> =>
    api.delete(`/categorias/${id}`).then(r => r.data),

  // Orçamento
  orcamento: (mes: number, ano: number): Promise<OrcamentoItemDto[]> =>
    api.get('/categorias/orcamento', { params: { mes, ano } }).then(r => r.data),

  // Saldos / Contas
  saldos: (): Promise<SaldoContaDto[]> =>
    api.get('/saldos').then(r => r.data),
  criarConta: (data: { banco: string; saldo: number; tipo: number }): Promise<{ id: string }> =>
    api.post('/saldos', data).then(r => r.data),
  atualizarConta: (id: string, data: object): Promise<void> =>
    api.put(`/saldos/${id}`, data).then(r => r.data),
  deletarConta: (id: string): Promise<void> =>
    api.delete(`/saldos/${id}`).then(r => r.data),

  // Cartões
  cartoes: (mes: number, ano: number): Promise<PagedResult<CartaoDto>> =>
    api.get('/cartoes', { params: { mes, ano } }).then(r => r.data),
  criarCartao: (data: { nome: string; diaVencimento?: number | null }): Promise<{ id: string }> =>
    api.post('/cartoes', data).then(r => r.data),
  atualizarCartao: (id: string, data: { nome: string; diaVencimento?: number | null }): Promise<void> =>
    api.put(`/cartoes/${id}`, data).then(r => r.data),
  deletarCartao: (id: string): Promise<void> =>
    api.delete(`/cartoes/${id}`).then(r => r.data),

  // Dívidas / parcelados
  dividasVigentes: (): Promise<ParceladosVigentesResultDto> =>
    api.get('/lancamentos/parcelados-vigentes').then(r => r.data),

  // Assinaturas
  assinaturas: (): Promise<AssinaturaDto[]> =>
    api.get('/lancamentos/assinaturas').then(r => r.data),

  // Metas
  metas: (): Promise<MetaDto[]> =>
    api.get('/metas').then(r => r.data),
  criarMeta: (data: { titulo: string; valorMeta: number; valorAtual?: number; dataMeta?: string | null; contribuicaoMensalValor?: number | null }): Promise<{ id: string }> =>
    api.post('/metas', data).then(r => r.data),
  atualizarMeta: (id: string, data: object): Promise<void> =>
    api.put(`/metas/${id}`, data).then(r => r.data),
  deletarMeta: (id: string): Promise<void> =>
    api.delete(`/metas/${id}`).then(r => r.data),

  // Receitas recorrentes
  receitasRecorrentes: (): Promise<ReceitaRecorrenteDto[]> =>
    api.get('/receitasrecorrentes').then(r => r.data),
};

// ── Corretores ──────────────────────────────────────────────────────────────

export interface CorretorDto {
  vinculoId: string;
  corretorId: string;
  nomeCorretor: string | null;
  codigoConvite: string;
  criadoEm: string;
  aceitoEm: string | null;
  revogadoEm: string | null;
  ativo: boolean;
  qtdClientesDelegados: number;
  emailConvidado: string | null;
  expiraEm: string | null;
  expirado: boolean;
}

export interface DelegacaoDto {
  id: string;
  corretorId: string;
  nomeCorretor: string | null;
  clienteId: string;
  nomeCliente: string | null;
  delegadoEm: string;
  revogadoEm: string | null;
  ativa: boolean;
}

export interface ClienteDelegadoDto {
  clienteId: string;
  nomeCliente: string | null;
  delegacaoId: string;
  delegadoEm: string;
}

export const corretoresService = {
  // Assessor
  gerarConvite: (): Promise<{ codigo: string }> =>
    api.post('/corretores/convite').then(r => r.data),
  enviarConviteEmail: (email: string): Promise<{ codigo: string }> =>
    api.post('/corretores/convite/email', { email }).then(r => r.data),
  listar: (): Promise<CorretorDto[]> =>
    api.get('/corretores').then(r => r.data),
  revogar: (vinculoId: string): Promise<void> =>
    api.delete(`/corretores/${vinculoId}`).then(r => r.data),
  reenviarConvite: (vinculoId: string): Promise<void> =>
    api.post(`/corretores/${vinculoId}/reenviar`).then(r => r.data),
  delegar: (corretorId: string, clienteId: string): Promise<{ id: string }> =>
    api.post('/corretores/delegacoes', { corretorId, clienteId }).then(r => r.data),
  listarDelegacoes: (): Promise<DelegacaoDto[]> =>
    api.get('/corretores/delegacoes').then(r => r.data),
  revogarDelegacao: (id: string): Promise<void> =>
    api.delete(`/corretores/delegacoes/${id}`).then(r => r.data),

  // Corretor
  aceitarConvite: (codigo: string): Promise<void> =>
    api.post('/corretores/aceitar', { codigo }).then(r => r.data),
  meusClientes: (): Promise<ClienteDelegadoDto[]> =>
    api.get('/corretores/meus-clientes').then(r => r.data),
};
