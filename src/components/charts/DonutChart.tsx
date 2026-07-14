import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

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
}

/**
 * Donut de composição via react-native-svg. Cada fatia é um Circle com
 * strokeDasharray/offset; funciona igual em web e nativo.
 */
export default function DonutChart({
  data, size = 180, strokeWidth = 26,
  centerTop, centerMain, centerSub,
  trackColor = '#ffffff18', textColor = '#fff', subColor = '#ffffff99',
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0);

  let acc = 0;
  const arcs = total > 0 ? data.map((d, i) => {
    const frac = Math.max(d.value, 0) / total;
    const dash = frac * circ;
    const offset = -acc * circ;
    acc += frac;
    return { key: i, color: d.color, dash, gap: circ - dash, offset };
  }) : [];

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
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${a.dash} ${a.gap}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        {centerTop ? <Text style={{ color: subColor, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{centerTop}</Text> : null}
        {centerMain ? <Text style={{ color: textColor, fontSize: 22, fontWeight: '900', marginTop: 2 }}>{centerMain}</Text> : null}
        {centerSub ? <Text style={{ color: subColor, fontSize: 11, marginTop: 2 }}>{centerSub}</Text> : null}
      </View>
    </View>
  );
}
