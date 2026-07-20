import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const GOLD = '#C79A4E';
const GOLD2 = '#E7C57E';

interface EtapaTrilha { titulo: string; prazo?: string | null; status: number }

interface Props {
  etapas: EtapaTrilha[];
  objetivo: string;
  objetivoPrazo?: string | null;
  width: number;
  height?: number;
  mutedColor: string;   // linha futura / pendente
  surfaceColor: string; // preenchimento do nó atual/pendente
  textColor: string;
  fadeColor: string;    // rótulos secundários
}

/** Trilha ascendente: a jornada sobe rumo ao objetivo (nó estrela ao final). */
export default function PlanoTrilha({
  etapas, objetivo, objetivoPrazo, width, height = 190,
  mutedColor, surfaceColor, textColor, fadeColor,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1900, useNativeDriver: false }));
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const pulseR = pulse.interpolate({ inputRange: [0, 1], outputRange: [15, 30] });
  const pulseOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  if (!etapas.length || width < 40) return null;

  const n = etapas.length + 1; // + nó objetivo
  const comLabels = n <= 7;
  const padL = 34, padR = 62, padT = comLabels ? 46 : 26, padB = comLabels ? 40 : 22;
  const yBottom = height - padB, yTop = padT;

  const X = (i: number) => (n === 1 ? padL : padL + (i * (width - padL - padR)) / (n - 1));
  const Y = (i: number) => (n === 1 ? yBottom : yBottom - (i * (yBottom - yTop)) / (n - 1));
  const pts = Array.from({ length: n }, (_, i) => ({ x: X(i), y: Y(i) }));

  const smooth = (arr: { x: number; y: number }[]) => {
    let d = `M ${arr[0].x.toFixed(1)} ${arr[0].y.toFixed(1)}`;
    for (let i = 1; i < arr.length; i++) {
      const p0 = arr[i - 1], p1 = arr[i], cx = (p0.x + p1.x) / 2;
      d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)} ${cx.toFixed(1)} ${p1.y.toFixed(1)} ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const todasConcluidas = etapas.every(e => e.status === 3);
  let goldEnd = 0;
  for (let i = 0; i < etapas.length; i++) if (etapas[i].status !== 1) goldEnd = i;
  if (todasConcluidas) goldEnd = n - 1;

  const fullPath = smooth(pts);
  const goldPath = goldEnd >= 1 ? smooth(pts.slice(0, goldEnd + 1)) : null;
  const areaPath = `${fullPath} L ${pts[n - 1].x.toFixed(1)} ${height} L ${pts[0].x.toFixed(1)} ${height} Z`;

  const trunc = (t: string, m = 16) => (t.length > m ? t.slice(0, m - 1) + '…' : t);

  return (
    <View style={{ width }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="pt-gold" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={GOLD2} /><Stop offset="1" stopColor={GOLD} />
          </LinearGradient>
          <LinearGradient id="pt-area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={GOLD} stopOpacity={0.14} />
            <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Path d={areaPath} fill="url(#pt-area)" />
        {/* trilha completa (futuro, pontilhada) */}
        <Path d={fullPath} stroke={mutedColor} strokeWidth={4} strokeLinecap="round" strokeDasharray="1 12" fill="none" />
        {/* trilha percorrida (ouro) */}
        {goldPath && <Path d={goldPath} stroke="url(#pt-gold)" strokeWidth={4.5} strokeLinecap="round" fill="none" />}

        {/* nós das etapas */}
        {etapas.map((e, i) => {
          const cx = pts[i].x, cy = pts[i].y;
          const concl = e.status === 3, atual = e.status === 2;
          return (
            <React.Fragment key={i}>
              {atual && <AnimatedCircle cx={cx} cy={cy} r={pulseR} fill={GOLD} opacity={pulseOp} />}
              <Circle
                cx={cx} cy={cy} r={concl ? 13 : 12}
                fill={concl ? GOLD : surfaceColor}
                stroke={concl ? GOLD : atual ? GOLD : mutedColor}
                strokeWidth={concl ? 0 : atual ? 3.2 : 2.5}
              />
              {concl
                ? <SvgText x={cx} y={cy + 4.5} fontSize={13} fontWeight="bold" fill="#241a08" textAnchor="middle">✓</SvgText>
                : <SvgText x={cx} y={cy + 4.5} fontSize={12} fontWeight="bold" fill={atual ? GOLD : fadeColor} textAnchor="middle">{i + 1}</SvgText>}
              {comLabels && (
                <>
                  <SvgText x={cx} y={cy - 22} fontSize={11} fontWeight="bold" fill={concl || atual ? textColor : fadeColor} textAnchor="middle">{trunc(e.titulo, 14)}</SvgText>
                  {!!e.prazo && <SvgText x={cx} y={cy + 26} fontSize={10} fill={fadeColor} textAnchor="middle">{e.prazo}</SvgText>}
                </>
              )}
            </React.Fragment>
          );
        })}

        {/* nó objetivo (estrela) */}
        <Circle cx={pts[n - 1].x} cy={pts[n - 1].y} r={16}
          fill={todasConcluidas ? GOLD : surfaceColor} stroke={GOLD} strokeWidth={2} />
        <SvgText x={pts[n - 1].x} y={pts[n - 1].y + 5} fontSize={15} fill={todasConcluidas ? '#241a08' : GOLD2} textAnchor="middle">★</SvgText>
        {comLabels && (
          <>
            <SvgText x={pts[n - 1].x} y={pts[n - 1].y - 24} fontSize={11} fontWeight="bold" fill={GOLD} textAnchor="middle">Objetivo</SvgText>
            {!!objetivoPrazo && <SvgText x={pts[n - 1].x} y={pts[n - 1].y + 30} fontSize={10} fill={fadeColor} textAnchor="middle">{objetivoPrazo}</SvgText>}
          </>
        )}
      </Svg>
    </View>
  );
}
