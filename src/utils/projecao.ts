// Motor de projeção patrimonial (acúmulo → decumulação) — cálculo 100% no cliente.
// Passo mensal, com juros compostos sobre a taxa real anual e cenários extras.

export interface CenarioCalc {
  tipo: number;        // 1=AporteExtra, 2=ResgateExtra
  valor: number;
  idadeInicio: number;
  idadeFim: number | null; // null = evento único na idadeInicio; senão recorrente mensal na faixa
}

export interface ParametrosProjecao {
  idadeAtual: number;
  idadeAlvo: number;
  patrimonioInicial: number;
  aporteMensal: number;
  taxaRetornoRealAnualPct: number;
  retiradaMensal: number;
  cenarios: CenarioCalc[];
}

export interface PontoProjecao { idade: number; total: number; principal: number; }

export interface ResultadoProjecao {
  pontos: PontoProjecao[];
  patrimonioNaIdadeAlvo: number;
  idadeExtincao: number | null;   // idade em que o patrimônio zera na decumulação (null = sustentável)
  sustentavel: boolean;
}

const IDADE_MAX = 100;

export function calcularProjecao(p: ParametrosProjecao): ResultadoProjecao {
  const rm = Math.pow(1 + p.taxaRetornoRealAnualPct / 100, 1 / 12) - 1;

  let saldo = p.patrimonioInicial;
  let principal = p.patrimonioInicial;   // aportes acumulados sem rendimento
  let patrimonioNaIdadeAlvo = p.patrimonioInicial;
  let idadeExtincao: number | null = null;

  const pontos: PontoProjecao[] = [{ idade: p.idadeAtual, total: saldo, principal }];

  for (let idade = p.idadeAtual; idade < IDADE_MAX; idade++) {
    for (let mes = 0; mes < 12; mes++) {
      saldo *= 1 + rm;

      if (idade < p.idadeAlvo) {
        saldo += p.aporteMensal;
        principal += p.aporteMensal;
      } else {
        saldo -= p.retiradaMensal;
        principal -= p.retiradaMensal;
      }

      // Cenários
      for (const c of p.cenarios) {
        const aplica = c.idadeFim == null
          ? (idade === c.idadeInicio && mes === 0)          // evento único
          : (idade >= c.idadeInicio && idade <= c.idadeFim); // recorrente mensal
        if (!aplica) continue;
        const delta = c.tipo === 1 ? c.valor : -c.valor;
        saldo += delta;
        principal += delta;
      }

      if (saldo <= 0 && idade >= p.idadeAlvo && idadeExtincao == null) {
        idadeExtincao = idade;
        saldo = 0;
      }
    }

    if (idade + 1 === p.idadeAlvo) patrimonioNaIdadeAlvo = saldo;
    pontos.push({ idade: idade + 1, total: Math.max(saldo, 0), principal });

    if (idadeExtincao != null) break;
  }

  // Se idadeAlvo == idadeAtual, o patrimônio na idade-alvo é o inicial
  if (p.idadeAlvo <= p.idadeAtual) patrimonioNaIdadeAlvo = p.patrimonioInicial;

  return {
    pontos,
    patrimonioNaIdadeAlvo,
    idadeExtincao,
    sustentavel: idadeExtincao == null,
  };
}
