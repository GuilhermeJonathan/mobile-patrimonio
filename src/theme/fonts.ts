import { Platform } from 'react-native';

/**
 * Tipografia do produto (visual private-banking):
 * - Corpo: Inter (sans limpa, legível).
 * - Títulos/marca: Playfair Display (serifada elegante).
 *
 * Estratégia web-first: carregamos as famílias via Google Fonts e definimos Inter
 * como fonte base do documento (todos os Text herdam sem precisar tocar cada tela).
 * Em nativo, as famílias custom são ignoradas (cai na fonte do sistema) — o app é
 * usado majoritariamente na web; fontes nativas podem ser adicionadas depois via
 * @expo-google-fonts se necessário.
 */

// Só aplica família custom na web (no nativo, undefined = fonte padrão do sistema).
export const FONT_SANS = Platform.OS === 'web' ? 'Inter, system-ui, -apple-system, sans-serif' : undefined;
export const FONT_SERIF = Platform.OS === 'web' ? '"Playfair Display", Georgia, serif' : undefined;

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
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap';
  document.head.appendChild(link);

  // Fonte base do ecossistema: aplicamos no html/body E no container raiz do RN Web (#root),
  // pois o RN Web define uma fonte própria no root que bloquearia a herança só via body.
  // É herança (baixa prioridade) → NÃO sobrepõe o Playfair aplicado explicitamente nos títulos.
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root, #root > div, [data-reactroot] {
      font-family: Inter, system-ui, -apple-system, sans-serif;
    }
    input, textarea, button, select { font-family: inherit; }
  `;
  document.head.appendChild(style);
}
