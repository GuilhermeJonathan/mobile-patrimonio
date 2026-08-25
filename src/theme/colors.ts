// Design system "Casa Patrimônio" — visual de escritório de família (papelaria, não dashboard de dev).
// Tema primário = CLARO (porcelana + tinta verde-grafite). A cor da marca (whitelabel) sobrescreve o accent.
// O tema escuro é a variante obsidiana-verde, coerente com o mesmo sistema.
export type ColorScheme = typeof lightColors;

export const lightColors = {
  background:        '#EEEDE6',  // porcelana (fundo)
  surface:           '#FFFFFF',  // papel-carta (cartão)
  surfaceElevated:   '#F3F2EB',  // linho (controles/chips)
  surfaceSubtle:     '#E7E6DD',
  inputBg:           '#FFFFFF',
  inputBorder:       '#DCDBD1',
  inputPlaceholder:  '#A6ABA0',
  text:              '#17201C',  // tinta verde-grafite
  textSecondary:     '#59635C',
  textTertiary:      '#9A9F96',
  border:            '#E2E1D8',
  green:             '#15806A',  // accent padrão (sobrescrito pelo whitelabel)
  greenDim:          '#15806A14',
  greenBorder:       '#15806A45',
  red:               '#BE4A3D',
  orange:            '#B07A16',
  blue:              '#2C6E9E',
  purple:            '#7B57B0',
};

export const darkColors: ColorScheme = {
  background:        '#0C0F0D',
  surface:           '#191F1B',
  surfaceElevated:   '#212A24',
  surfaceSubtle:     '#080B09',
  inputBg:           '#0C0F0D',
  inputBorder:       '#2C332D',
  inputPlaceholder:  '#4C554E',
  text:              '#EEF1EE',
  textSecondary:     '#97A29B',
  textTertiary:      '#616B65',
  border:            '#29312C',
  green:             '#46B79C',
  greenDim:          '#46B79C1F',
  greenBorder:       '#46B79C55',
  red:               '#D9766C',
  orange:            '#D6A24A',
  blue:              '#6FA8D8',
  purple:            '#B99BE0',
};
