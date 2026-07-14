// Copiado do FinDog (mobile/src/theme/colors.ts) — mesmo design system.
// Se virar produto de verdade, extrair para um pacote compartilhado (monorepo).
export type ColorScheme = typeof darkColors;

export const darkColors = {
  background:        '#0d1117',
  surface:           '#161b22',
  surfaceElevated:   '#21262d',
  surfaceSubtle:     '#010409',
  inputBg:           '#0d1117',
  inputBorder:       '#30363d',
  inputPlaceholder:  '#484f58',
  text:              '#e6edf3',
  textSecondary:     '#8b949e',
  textTertiary:      '#484f58',
  border:            '#30363d',
  green:             '#3fb950',
  greenDim:          '#3fb95018',
  greenBorder:       '#3fb95050',
  red:               '#f85149',
  orange:            '#d29922',
  blue:              '#58a6ff',
  purple:            '#bc8cff',
};

export const lightColors: ColorScheme = {
  background:        '#f5f5f5',
  surface:           '#ffffff',
  surfaceElevated:   '#ffffff',
  surfaceSubtle:     '#fafafa',
  inputBg:           '#ffffff',
  inputBorder:       '#dddddd',
  inputPlaceholder:  '#aaaaaa',
  text:              '#1a1a2e',
  textSecondary:     '#666666',
  textTertiary:      '#aaaaaa',
  border:            '#f0f0f0',
  green:             '#4CAF50',
  greenDim:          '#E8F5E9',
  greenBorder:       '#A5D6A7',
  red:               '#e53935',
  orange:            '#FF9800',
  blue:              '#1565C0',
  purple:            '#7B1FA2',
};
