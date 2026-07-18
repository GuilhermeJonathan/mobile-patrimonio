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

/** Máscara de INPUT de data: dígitos → "dd/mm/aaaa" enquanto digita. */
export function maskData(texto: string): string {
  const d = (texto ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Converte "dd/mm/aaaa" para ISO "aaaa-mm-dd". Retorna null se incompleto/ inválido. */
export function dataInputParaISO(br?: string | null): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((br ?? '').trim());
  if (!m) return null;
  const dia = +m[1], mes = +m[2], ano = +m[3];
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
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
