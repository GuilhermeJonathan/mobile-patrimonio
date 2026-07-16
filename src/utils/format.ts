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

/** Data "dd/MM/aaaa" a partir de ISO ("2026-07-12T…") sem shift de fuso. */
export function dataBR(iso?: string | null): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
