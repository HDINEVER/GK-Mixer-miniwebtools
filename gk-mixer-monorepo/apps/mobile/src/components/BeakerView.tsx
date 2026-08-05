import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Rect, Defs, ClipPath, Line } from 'react-native-svg';

const BEAKER_PATH = 'M 35,25 L 35,205 C 35,215,50,270,55,275 L 145,275 C 150,270,165,215,165,205 L 165,25 Z';
const BEAKER_CLIP = 'M 37,27 L 37,205 C 37,214,51,268,56,273 L 144,273 C 149,268,163,214,163,205 L 163,27 Z';
const LIQUID_TOP = 273;
const LIQUID_FULL_HEIGHT = 240;
const WAVE_AMP = 4;

interface BeakerLayer {
  ratio: number;
  color: string;
  label?: string;
  volume?: string;
}

interface BeakerViewProps {
  layers: BeakerLayer[];
  width?: number;
  height?: number;
}

export default function BeakerView({ layers, width = 220, height = 340 }: BeakerViewProps) {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setPhase((p) => (p + 0.15) % (Math.PI * 2));
    }, 33); // ~30fps
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const filled = useMemo(() => {
    let total = 0;
    return layers.map((l) => {
      total += l.ratio;
      return { ...l, fillTo: total };
    });
  }, [layers]);

  const wavePath = useMemo(() => {
    if (filled.length === 0) return '';
    const topRatio = filled[filled.length - 1].fillTo;
    const yBase = LIQUID_TOP - (topRatio / 100) * LIQUID_FULL_HEIGHT;
    let d = '';
    for (let x = 37; x <= 163; x += 3) {
      const y = yBase + WAVE_AMP * Math.sin(x * 0.12 + phase);
      d += `${x === 37 ? 'M' : 'L'}${x},${y} `;
    }
    d += `L${163},${LIQUID_TOP} L${37},${LIQUID_TOP} Z`;
    return d;
  }, [filled, phase]);

  const rulerMarks = [0, 25, 50, 75, 100].map((pct) => {
    const y = LIQUID_TOP - (pct / 100) * LIQUID_FULL_HEIGHT;
    return <Line key={pct} x1={30} y1={y} x2={36} y2={y} stroke="#444" strokeWidth={1} />;
  });

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg viewBox="0 0 200 320" width={width} height={height}>
        <Defs>
          <ClipPath id="beakerClip">
            <Path d={BEAKER_CLIP} />
          </ClipPath>
        </Defs>
        {rulerMarks}
        {filled.map((layer, index) => {
          const prevFill = index === 0 ? LIQUID_TOP : filled[index - 1].fillTo;
          const thisFill = layer.fillTo;
          const y = LIQUID_TOP - (thisFill / 100) * LIQUID_FULL_HEIGHT;
          const prevY = LIQUID_TOP - (prevFill / 100) * LIQUID_FULL_HEIGHT;
          const h = prevY - y;
          return (
            <Rect key={index} x={37} y={y} width={126} height={h > 0 ? h : 0} fill={layer.color} clipPath="url(#beakerClip)" />
          );
        })}
        <Path d={wavePath} fill={filled.length > 0 ? filled[filled.length - 1].color : 'transparent'} opacity={0.5} clipPath="url(#beakerClip)" />
        <Path d={BEAKER_PATH} fill="none" stroke="#555" strokeWidth={2.5} strokeLinecap="round" />
        <Line x1={30} y1={25} x2={170} y2={25} stroke="#555" strokeWidth={3} />
      </Svg>
      <View style={styles.legend}>
        {filled.map((layer, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: layer.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>{layer.label} {layer.ratio.toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', alignSelf: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, gap: 6, paddingHorizontal: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendSwatch: { width: 12, height: 12, borderRadius: 3, marginRight: 4 },
  legendText: { color: '#aaa', fontSize: 10 },
});
