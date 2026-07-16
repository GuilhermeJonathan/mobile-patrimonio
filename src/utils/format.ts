// Formatação pt-BR SEM depender de Intl/toLocaleString.
// Em device (Hermes) e alguns runtimes web o locale 'pt-BR' não existe e o
// toLocaleString cai no formato US (1,234.56 / MM/DD/YYYY). Estes helpers
// garantem o padrão brasileiro em qualquer ambiente.

const SIMBOLO: Record<string, string> = { BRL: 'R$', USD: 'US$', EUR: '€', CHF: 'CHF', GBP: '£' };

/** Número no padrão BR: 1.234,56 (milhar com ".", decimal com ","). */
export function numBR(v: number, casas = 2): string {
  if (v == null || isNaN(v)) v = 0;
  const neg = v < 0;
  const fixed = Math.abs(v).toFixed(casas);
  const [inteiro, dec] = fixed.split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const s = dec ? `${comMilhar},${dec}` : comMilhar;
  return neg ? `-${s}` : s;
}

/** Valor monetário: "R$ 1.234,56" (aceita moeda: BRL/USD/EUR/CHF/GBP). */
export function brl(v: number, moeda = 'BRL'): string {
  return `${SIMBOLO[moeda] ?? ''} ${numBR(v, 2)}`;
}

// ─── Máscara para INPUTS de valor monetário ────────────────────────────────
// Máscara de agrupamento: o que o usuário digita é tratado como REAIS (não
// centavos). A parte inteira ganha separador de milhar "." e a vírgula (se
// digitada) separa até 2 casas decimais.
// Ex.: "1500000" → "1.500.000"; "1500000,5" → "1.500.000,5"; "1234,567" → "1.234,56".

/** Aplica máscara BR ao texto digitado num input de dinheiro. */
export function maskMoeda(texto: string): string {
  if (!texto) return '';
  const t = texto.replace(/[^\d,]/g, '');
  const iVirg = t.indexOf(',');
  let inteiro = iVirg >= 0 ? t.slice(0, iVirg) : t;
  inteiro = inteiro.replace(/,/g, '').replace(/^0+(?=\d)/, '');
  const grupos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const intFinal = grupos === '' ? '0' : grupos;
  if (iVirg < 0) return intFinal;
  const dec = t.slice(iVirg + 1).replace(/,/g, '').slice(0, 2);
  return `${intFinal},${dec}`;
}

/** Converte um valor numérico já existente para o texto do input mascarado. */
export function moedaParaInput(v?: number | null): string {
  if (v == null || isNaN(v)) return '';
  return numBR(v, 2);
}

/** Converte o texto BR de um input ("1.500.000,00") de volta para número. */
export function parseMoeda(texto?: string | null): number {
  if (!texto) return 0;
  const limpo = texto.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

/** Data "dd/MM/aaaa" a partir de ISO ("2026-07-12T…") sem shift de fuso. */
export function dataBR(iso?: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
