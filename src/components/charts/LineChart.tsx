import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { numBR } from '../../utils/format';

interface Props {
  values: number[];          // série principal (ex: patrimônio líquido por mês)
  width?: number;
  height?: number;
  color?: string;
  gridColor?: string;
  labelColor?: string;
  xStart?: string;           // rótulo do primeiro ponto (ex: "jun/27")
  xEnd?: string;             // rótulo do último ponto (ex: "jun/36")
  formatY?: (v: number) => string;
  dots?: boolean;            // desenha marcadores em cada ponto (ambas as séries)
  series2?: number[];        // série secundária sobreposta (ex: saldo de dívidas)
  color2?: string;           // cor da série secundária
  gridValues?: boolean;      // mostra o valor em cada linha de grade
  pointLabels?: boolean;     // mostra o valor acima/abaixo de cada ponto
}

const MAX_LABELS = 16; // acima disso os rótulos poluem

const MAX_DOTS = 48; // acima disso os pontos poluem — só a linha

/** Gráfico de linha + área via react-native-svg. Escala automática ao maior valor (compartilhada entre as séries). */
export default function LineChart({
  values, width = 320, height = 180,
  color = '#22c55e', gridColor = '#ffffff14', labelColor = '#ffffff88',
  xStart, xEnd, formatY = (v) => numBR(v, 0),
  dots = false, series2, color2 = '#ef4444', gridValues = false, pointLabels = false,
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

  const s2 = series2 && series2.length >= 2 ? series2 : null;
  const maxV = Math.max(...values, ...(s2 ?? []), 1);
  const minV = 0;

  const path = (arr: number[]) => {
    const n = arr.length;
    const x = (i: number) => padL + (i / (n - 1)) * w;
    const y = (v: number) => padT + h - ((v - minV) / (maxV - minV)) * h;
    const line = arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    const area = `${line} L ${x(n - 1).toFixed(1)} ${(padT + h).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + h).toFixed(1)} Z`;
    return { line, area, x, y };
  };

  const main = path(values);
  const sec = s2 ? path(s2) : null;

  // 3 linhas de grade horizontais (com valor opcional)
  const gridFr = [0, 0.5, 1];
  const grid = gridFr.map(f => padT + h - f * h);
  const showDots = dots && values.length <= MAX_DOTS;
  const showDots2 = showDots && !!s2 && s2.length <= MAX_DOTS;
  const lastI = values.length - 1;

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
          <LinearGradient id="area2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color2} stopOpacity={0.18} />
            <Stop offset="1" stopColor={color2} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {grid.map((gy, i) => (
          <Line key={i} x1={padL} y1={gy} x2={padL + w} y2={gy} stroke={gridColor} strokeWidth={1} />
        ))}
        {gridValues && gridFr.filter(f => f < 1).map((f, i) => (
          <SvgText key={`gv${i}`} x={padL + 2} y={padT + h - f * h - 3} fontSize={9} fill={labelColor} opacity={0.8}>
            {formatY(f * maxV)}
          </SvgText>
        ))}

        {/* Série secundária (ex.: dívidas) desenhada primeiro, por baixo */}
        {sec && <Path d={sec.area} fill="url(#area2)" />}
        {sec && <Path d={sec.line} stroke={color2} strokeWidth={2} fill="none" strokeLinejoin="round" strokeDasharray="5 4" />}
        {showDots2 && s2!.map((v, i) => (
          <Circle key={`d2${i}`} cx={sec!.x(i)} cy={sec!.y(v)} r={2.4} fill={color2} />
        ))}

        {/* Série principal */}
        <Path d={main.area} fill="url(#area)" />
        <Path d={main.line} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />

        {showDots && values.map((v, i) => (
          <Circle key={i} cx={main.x(i)} cy={main.y(v)} r={2.8} fill={color} />
        ))}
        {/* Destaque nos últimos pontos de cada série */}
        {sec && <Circle cx={sec.x(s2!.length - 1)} cy={sec.y(s2![s2!.length - 1])} r={4} fill={color2} stroke="#00000030" strokeWidth={1} />}
        <Circle cx={main.x(lastI)} cy={main.y(values[lastI])} r={4.5} fill={color} stroke="#00000030" strokeWidth={1} />

        {/* Rótulos de valor em cada ponto */}
        {pointLabels && values.length <= MAX_LABELS && values.map((v, i) => (
          <SvgText key={`pl${i}`} x={main.x(i)} y={Math.max(9, main.y(v) - 8)} fontSize={8.5} fontWeight="bold" fill={color} textAnchor="middle">
            {formatY(v)}
          </SvgText>
        ))}
        {pointLabels && s2 && s2.length <= MAX_LABELS && s2.map((v, i) => (
          <SvgText key={`pl2${i}`} x={sec!.x(i)} y={Math.min(height - 3, sec!.y(v) + 14)} fontSize={8} fill={color2} textAnchor="middle">
            {formatY(v)}
          </SvgText>
        ))}
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
