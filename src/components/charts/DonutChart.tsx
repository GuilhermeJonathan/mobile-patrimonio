import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

export interface DonutSlice { label: string; value: number; color: string; }

interface Props {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerTop?: string;    // texto pequeno acima
  centerMain?: string;   // texto grande (ex: "R$ 5,4M")
  centerSub?: string;    // texto pequeno abaixo
  trackColor?: string;
  textColor?: string;
  subColor?: string;
  sliceLabels?: boolean; // mostra o % dentro de cada fatia (as grandes o bastante)
  interactive?: boolean; // hover (web) mostra a classe + % no centro
}

/**
 * Donut de composição via react-native-svg. Cada fatia é um Circle com
 * strokeDasharray/offset; funciona igual em web e nativo.
 */
export default function DonutChart({
  data, size = 180, strokeWidth = 26,
  centerTop, centerMain, centerSub,
  trackColor = '#ffffff18', textColor = '#fff', subColor = '#ffffff99',
  sliceLabels = false, interactive = false,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  // fonte do valor central escala com o tamanho do donut (evita quebra de linha em donuts menores)
  const mainSize = size >= 170 ? 22 : size >= 140 ? 19 : 16;
  const circ = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0);

  let acc = 0;
  const arcs = total > 0 ? data.map((d, i) => {
    const frac = Math.max(d.value, 0) / total;
    const dash = frac * circ;
    const offset = -acc * circ;
    const midFrac = acc + frac / 2;
    acc += frac;
    return { key: i, color: d.color, dash, gap: circ - dash, offset, frac, midFrac };
  }) : [];

  // rótulos de % posicionados no meio de cada fatia (só as grandes o bastante para caber)
  const labels = sliceLabels
    ? arcs.filter(a => a.frac >= 0.045).map(a => {
        const ang = (-90 + a.midFrac * 360) * Math.PI / 180;
        return { key: a.key, x: cx + radius * Math.cos(ang), y: cx + radius * Math.sin(ang), pct: Math.round(a.frac * 100) };
      })
    : [];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cx}`}>
          <Circle cx={cx} cy={cx} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          {arcs.map(a => (
            <Circle
              key={a.key}
              cx={cx} cy={cx} r={radius}
              stroke={a.color}
              strokeWidth={hover === a.key ? strokeWidth + 5 : strokeWidth}
              fill="none"
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
              opacity={hover !== null && hover !== a.key ? 0.4 : 1}
              {...(interactive ? { onMouseEnter: () => setHover(a.key), onMouseLeave: () => setHover(null) } as any : {})}
            />
          ))}
        </G>
        {labels.map(l => (
          <SvgText key={`sl${l.key}`} x={l.x} y={l.y + 3} fontSize={9} fontWeight="bold" fill="#ffffff" textAnchor="middle">
            {l.pct}%
          </SvgText>
        ))}
      </Svg>
      <View style={{ position: 'absolute', width: size, alignItems: 'center', paddingHorizontal: Math.max(6, strokeWidth * 0.35) }}>
        {hover !== null && arcs[hover] ? (
          <>
            <Text style={{ color: data[hover].color, fontSize: 13, fontWeight: '800', textAlign: 'center' }} numberOfLines={2}>{data[hover].label}</Text>
            <Text style={{ color: textColor, fontSize: 20, fontWeight: '900', marginTop: 2 }}>{Math.round(arcs[hover].frac * 100)}%</Text>
          </>
        ) : (
          <>
            {centerTop ? <Text numberOfLines={1} style={{ color: subColor, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{centerTop}</Text> : null}
            {centerMain ? <Text numberOfLines={1} style={{ color: textColor, fontSize: mainSize, fontWeight: '900', marginTop: 2, textAlign: 'center' }}>{centerMain}</Text> : null}
            {centerSub ? <Text numberOfLines={1} style={{ color: subColor, fontSize: 11, marginTop: 2 }}>{centerSub}</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}
