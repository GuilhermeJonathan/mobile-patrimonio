import { Platform } from 'react-native';

/**
 * Tipografia do produto (visual "Casa Patrimônio", escritório de família):
 * - Corpo/interface: Inter (sans limpa, legível), com figuras tabulares para alinhar cifras.
 * - Display/marca: Fraunces (serifada editorial, contraste gravado) — usada com parcimônia
 *   em nomes, monogramas, títulos de seção e no número-herói. NÃO em corpo de texto.
 *
 * Estratégia web-first: carregamos as famílias via Google Fonts e definimos Inter
 * como fonte base do documento (todos os Text herdam sem precisar tocar cada tela).
 * Em nativo, as famílias custom são ignoradas (cai na fonte do sistema) — o app é
 * usado majoritariamente na web; fontes nativas podem ser adicionadas depois via
 * @expo-google-fonts se necessário.
 */

// Só aplica família custom na web (no nativo, undefined = fonte padrão do sistema).
export const FONT_SANS = Platform.OS === 'web' ? 'Inter, system-ui, -apple-system, sans-serif' : undefined;
export const FONT_SERIF = Platform.OS === 'web' ? '"Fraunces", Georgia, "Times New Roman", serif' : undefined;

let injetado = false;

/** Injeta as fontes do Google + define Inter como base do documento (web, uma vez). */
export function injectWebFonts() {
  if (injetado || Platform.OS !== 'web' || typeof document === 'undefined') return;
  injetado = true;

  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://fonts.gstatic.com';
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap';
  document.head.appendChild(link);

  // Fonte base do ecossistema. Usamos `body *` (aplica em TODOS os elementos direto, não só
  // por herança — cobre árvores do RN Web onde a herança não chega). A especificidade de
  // `body *` (0,0,1) é MENOR que a de uma classe (0,1,0), então o Playfair aplicado
  // explicitamente nos títulos (vira classe no RN Web) continua vencendo.
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root { font-family: Inter, system-ui, -apple-system, sans-serif; }
    body * { font-family: Inter, system-ui, -apple-system, sans-serif; }
    input, textarea, button, select { font-family: Inter, system-ui, -apple-system, sans-serif; }
    /* Cifras alinham coluna em todo o app (número é conteúdo neste produto). */
    body, body * { font-variant-numeric: tabular-nums lining-nums; }
    /* Fraunces usa o eixo óptico onde for aplicada explicitamente (títulos/monogramas). */
    html { font-optical-sizing: auto; }
  `;
  document.head.appendChild(style);
}
