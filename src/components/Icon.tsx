import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

/**
 * Ícones de linha do design system "Casa Patrimônio".
 * Traço 1.7px, cantos arredondados, herdam a cor via prop `color` (default: accent).
 * Substituem os emojis do menu — acompanham a cor da marca (whitelabel) automaticamente.
 */
export type IconName =
  | 'home' | 'building' | 'shield' | 'shield-check' | 'users' | 'handshake' | 'settings'
  | 'tag' | 'trending' | 'trending-down' | 'coins' | 'gauge' | 'chat' | 'compass'
  | 'chart' | 'bank' | 'landmark' | 'clipboard' | 'network' | 'family' | 'flask'
  | 'paperclip' | 'activity' | 'file-text' | 'briefcase' | 'grid' | 'exchange'
  | 'card' | 'receipt' | 'refresh' | 'target' | 'seal' | 'bell' | 'chevron-left';

interface Props { name: string; size?: number; color?: string; strokeWidth?: number; }

function paths(name: string): React.ReactNode {
  switch (name) {
    case 'home': return <><Path d="M3 11.5 12 4l9 7.5" /><Path d="M5 10v10h14V10" /><Path d="M10 20v-6h4v6" /></>;
    case 'building': return <><Rect x="4" y="3" width="16" height="18" rx="1.5" /><Path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>;
    case 'shield': return <Path d="M12 3l7 3v5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />;
    case 'shield-check': return <><Path d="M12 3l7 3v5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" /><Path d="M9 11l2 2 4-4" /></>;
    case 'users': return <><Circle cx="9" cy="8" r="3" /><Path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><Path d="M16 5.5a3 3 0 0 1 0 6" /><Path d="M17.6 20a5.5 5.5 0 0 0-2.2-4.4" /></>;
    case 'handshake': return <><Circle cx="9" cy="8" r="3.2" /><Path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><Path d="M15.5 12l2 2 4-4" /></>;
    case 'settings': return <><Circle cx="12" cy="12" r="3" /><Path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>;
    case 'tag': return <><Path d="M4 4h7l9 9-7 7-9-9z" /><Circle cx="8.5" cy="8.5" r="1.3" /></>;
    case 'trending': return <><Path d="M4 17l6-6 4 3 6-7" /><Path d="M16 7h4v4" /></>;
    case 'trending-down': return <><Path d="M4 7l6 6 4-3 6 7" /><Path d="M16 17h4v-4" /></>;
    case 'coins': return <><Circle cx="9" cy="9" r="5" /><Path d="M15 6.2a5 5 0 0 1 0 9.6" /></>;
    case 'gauge': return <><Path d="M4 18a8 8 0 1 1 16 0" /><Path d="M12 13l4-3.5" /></>;
    case 'chat': return <Path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />;
    case 'compass': return <><Circle cx="12" cy="12" r="9" /><Path d="M15.5 8.5l-2 5-5 2 2-5z" /></>;
    case 'chart': return <><Circle cx="12" cy="12" r="8" /><Path d="M12 4a8 8 0 0 1 8 8h-8z" /></>;
    case 'bank': return <><Rect x="3" y="6" width="18" height="13" rx="1.5" /><Path d="M3 10h18" /><Path d="M7 6V4h10v2" /></>;
    case 'landmark': return <><Path d="M3 21h18" /><Path d="M5 21V10l7-5 7 5v11" /><Path d="M9 21v-6h6v6" /></>;
    case 'clipboard': return <><Rect x="5" y="4" width="14" height="17" rx="1.5" /><Path d="M9 4V3h6v1" /><Path d="M9 10h6M9 14h6" /></>;
    case 'network': return <><Circle cx="12" cy="5" r="2.2" /><Circle cx="6" cy="19" r="2.2" /><Circle cx="18" cy="19" r="2.2" /><Path d="M12 7.2v3.8M12 11L6.5 16.9M12 11l5.5 5.9" /></>;
    case 'family': return <><Circle cx="8" cy="8" r="2.4" /><Circle cx="16" cy="8" r="2.4" /><Path d="M3.5 19a4.5 4.5 0 0 1 9 0" /><Path d="M11.5 19a4.5 4.5 0 0 1 9 0" /></>;
    case 'flask': return <><Path d="M9 3h6" /><Path d="M10 3v6l-5 9a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 18l-5-9V3" /></>;
    case 'paperclip': return <Path d="M20 11.5l-8.2 8.2a4.5 4.5 0 0 1-6.4-6.4L13 5.3a3 3 0 0 1 4.3 4.3l-8.1 8.1a1.5 1.5 0 0 1-2.2-2.1l7.4-7.4" />;
    case 'activity': return <Path d="M3 12h4l3 8 4-16 3 8h4" />;
    case 'file-text': return <><Path d="M14 3v4a1 1 0 0 0 1 1h4" /><Path d="M6 3h8l5 5v13H6z" /><Path d="M9 13h6M9 17h6" /></>;
    case 'briefcase': return <><Rect x="3" y="7" width="18" height="13" rx="1.5" /><Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><Path d="M3 12h18" /></>;
    case 'grid': return <><Rect x="4" y="4" width="7" height="7" rx="1" /><Rect x="13" y="4" width="7" height="7" rx="1" /><Rect x="4" y="13" width="7" height="7" rx="1" /><Rect x="13" y="13" width="7" height="7" rx="1" /></>;
    case 'exchange': return <><Path d="M4 8h13l-3-3" /><Path d="M20 16H7l3 3" /></>;
    case 'card': return <><Rect x="3" y="5" width="18" height="14" rx="2" /><Path d="M3 9h18" /><Path d="M7 15h4" /></>;
    case 'receipt': return <><Path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><Path d="M9 8h6M9 12h6" /></>;
    case 'refresh': return <><Path d="M20 8a8 8 0 0 0-14-3L4 7" /><Path d="M4 4.5V7.5h3" /><Path d="M4 16a8 8 0 0 0 14 3l2-2" /><Path d="M20 19.5v-3h-3" /></>;
    case 'target': return <><Circle cx="12" cy="12" r="8" /><Circle cx="12" cy="12" r="4" /><Circle cx="12" cy="12" r="1" /></>;
    case 'seal': return <><Circle cx="12" cy="10" r="6" /><Path d="M8.5 15l-1 6 4.5-2.6L16.5 21l-1-6" /></>;
    case 'bell': return <><Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.7 21a2 2 0 0 1-3.4 0" /></>;
    case 'chevron-left': return <Path d="M15 18l-6-6 6-6" />;
    default: return <Circle cx="12" cy="12" r="2.5" />;
  }
}

export default function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 1.7 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths(name)}
    </Svg>
  );
}
