import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { numBR } from '../../utils/format';

interface Props {
  values: number[];          // série (ex: saldo devedor por mês)
  width?: number;
  height?: number;
  color?: string;
  gridColor?: string;
  labelColor?: string;
  xStart?: string;           // rótulo do primeiro ponto (ex: "jun/27")
  xEnd?: string;             // rótulo do último ponto (ex: "jun/36")
  formatY?: (v: number) => string;
}

/** Gráfico de linha + área via react-native-svg. Escala automática ao maior valor. */
export default function LineChart({
  values, width = 320, height = 180,
  color = '#22c55e', gridColor = '#ffffff14', labelColor = '#ffffff88',
  xStart, xEnd, formatY = (v) => numBR(v, 0),
}: Props) {
  const padL = 8, padR = 8, padT = 10, padB = 4;
  const w = width - padL - padR;
  const h = height - padT - padB;

  if (values.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: labelColor, fontSize: 12 }}>Sem dados para projetar.</Text>
      </View>
    );
  }

  const maxV = Math.max(...values, 1);
  const minV = 0;
  const n = values.length;

  const x = (i: number) => padL + (i / (n - 1)) * w;
  const y = (v: number) => padT + h - ((v - minV) / (maxV - minV)) * h;

  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)} ${(padT + h).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + h).toFixed(1)} Z`;

  // 3 linhas de grade horizontais
  const grid = [0, 0.5, 1].map(f => padT + h - f * h);

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ color: labelColor, fontSize: 10 }}>{formatY(maxV)}</Text>
      </View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {grid.map((gy, i) => (
          <Line key={i} x1={padL} y1={gy} x2={padL + w} y2={gy} stroke={gridColor} strokeWidth={1} />
        ))}
        <Path d={areaPath} fill="url(#area)" />
        <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
      </Svg>
      {(xStart || xEnd) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: labelColor, fontSize: 10 }}>{xStart}</Text>
          <Text style={{ color: labelColor, fontSize: 10 }}>{xEnd}</Text>
        </View>
      )}
    </View>
  );
}
