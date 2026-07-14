import React, { createContext, useContext, useState } from 'react';
import { darkColors, lightColors, ColorScheme } from './colors';

interface ThemeContextValue {
  isDark: boolean;
  colors: ColorScheme;
  toggleTheme: () => void;
}

// Produto B2B nasce em dark (visual premium/sóbrio).
const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? darkColors : lightColors, toggleTheme: () => setIsDark(p => !p) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
