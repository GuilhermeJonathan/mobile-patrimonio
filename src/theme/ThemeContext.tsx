import React, { createContext, useContext, useMemo, useState } from 'react';
import { darkColors, lightColors, ColorScheme } from './colors';

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorScheme;
  toggleTheme: () => void;
  /** Cor de marca (whitelabel) — re-skina o accent do app. null = padrão. */
  brandColor: string | null;
  setBrandColor: (hex: string | null) => void;
}

// Aplica a cor da marca (whitelabel) sobre o accent do tema (verde padrão → cor do assessor).
function withBrand(base: ColorScheme, hex: string | null): ColorScheme {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return base;
  return {
    ...base,
    green:       hex,
    greenDim:    hex + '18',   // 6-dígitos + alpha → RGBA de 8 dígitos
    greenBorder: hex + '50',
  };
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  brandColor: null,
  setBrandColor: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [brandColor, setBrandColor] = useState<string | null>(null);

  const colors = useMemo(
    () => withBrand(isDark ? darkColors : lightColors, brandColor),
    [isDark, brandColor],
  );

  return (
    <ThemeContext.Provider value={{
      isDark, colors, brandColor,
      toggleTheme: () => setIsDark(p => !p),
      setBrandColor,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
