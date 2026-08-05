import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import {
  EXTENDED_MIXING_COLORS,
  mixboxMultiBlend,
  hexToRgb,
  hexToRAL,
  type PaintBrand,
} from '@gk-mixer/core';

const SW = Dimensions.get('window').width;
const CX = SW / 2;
const CY = 230;
const OUTER_R = 140;
const INNER_R = 44;
const DOT_R = 14;
const SLOT_COUNT = EXTENDED_MIXING_COLORS.length;

interface SliderState {
  id: string;
  paint: PaintBrand;
  angle: number;
  position: number; // 0.0 (outer) .. 1.0 (inner)
  weight: number;   // normalized after every drag
}

function mkSliders(): SliderState[] {
  return EXTENDED_MIXING_COLORS.map((p, i) => ({
    id: p.id,
    paint: p,
    angle: (360 / SLOT_COUNT) * i,
    position: 0,
    weight: 0,
  }));
}

const CMY_COLORS: PaintBrand[] = [
  { id: 'cmy-add-c', brand: 'CMY Pigment' as any, code: 'C', name: 'Cyan', hex: '#00B7EB' },
  { id: 'cmy-add-m', brand: 'CMY Pigment' as any, code: 'M', name: 'Magenta', hex: '#FF0090' },
  { id: 'cmy-add-y', brand: 'CMY Pigment' as any, code: 'Y', name: 'Yellow', hex: '#FFEF00' },
];
const BW_COLORS: PaintBrand[] = [
  { id: 'bw-add-w', brand: 'Gaia', code: 'W', name: 'White', hex: '#FFFFFF' },
  { id: 'bw-add-b', brand: 'Gaia', code: 'B', name: 'Black', hex: '#000000' },
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
function sliderPos(s: SliderState): { x: number; y: number } {
  const r = OUTER_R - s.position * (OUTER_R - INNER_R - DOT_R);
  const rad = (s.angle * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * r, y: CY - Math.sin(rad) * r };
}

export default function RadialMixerScreen() {
  const [sliders, setSliders] = useState<SliderState[]>(mkSliders);
  const [targetVolume, setTargetVolume] = useState('20');
  const [targetHex, setTargetHex] = useState('#FF9900');
  const slidersRef = useRef(sliders);
  slidersRef.current = sliders;
  const draggingIdx = useRef<number | null>(null);

  const tv = parseFloat(targetVolume) || 20;

  // blend
  const blendedHex = useMemo(() => {
    const active = sliders.filter((s) => s.weight > 0.001);
    if (active.length < 2) return active[0]?.paint.hex ?? '#2A2A2A';
    return mixboxMultiBlend(active.map((s) => ({ hex: s.paint.hex, weight: s.weight })));
  }, [sliders]);
  const blendedRgb = useMemo(() => hexToRgb(blendedHex), [blendedHex]);
  const ralMatch = useMemo(() => hexToRAL(blendedHex), [blendedHex]);

  // recipe
  const recipe = useMemo(() => {
    const active = sliders.filter((s) => s.weight > 0.001);
    const totalW = active.reduce((sum, s) => sum + s.weight, 0);
    if (totalW === 0) return [];
    return active.map((s) => ({
      ...s,
      percentage: (s.weight / totalW) * 100,
      ml: (s.weight / totalW) * tv,
    }));
  }, [sliders, tv]);

  // -- PanResponder -------------------------------------------------------
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const cur = slidersRef.current;
        let best = -1; let bestD = Infinity;
        for (let i = 0; i < cur.length; i++) {
          const { x, y } = sliderPos(cur[i]);
          const d = dist(pageX, pageY, x, y);
          if (d < DOT_R * 2.6 && d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0) draggingIdx.current = best;
      },
      onPanResponderMove: (e) => {
        if (draggingIdx.current === null) return;
        const { pageX, pageY } = e.nativeEvent;
        const di = draggingIdx.current;
        const d = dist(pageX, pageY, CX, CY);
        const max = OUTER_R - DOT_R * 2;
        const pos = clamp(1 - (max - d) / max, 0, 1);
        setSliders((prev) =>
          prev.map((s, i) => {
            if (i !== di) return s;
            return { ...s, position: pos, weight: pos };
          }),
        );
      },
      onPanResponderRelease: () => {
        if (draggingIdx.current !== null) {
          const di = draggingIdx.current;
          setSliders((prev) => {
            const totalW = prev.reduce((sum, s, i) => sum + (i === di ? s.position : s.weight), 0);
            return prev.map((s, i) => {
              const rawW = i === di ? s.position : s.weight;
              return { ...s, weight: totalW > 0 ? rawW / totalW : 0 };
            });
          });
        }
        draggingIdx.current = null;
      },
    }),
  ).current;

  // -- Buttons -----------------------------------------------------------
  const addColors = useCallback((paints: PaintBrand[]) => {
    const now = slidersRef.current;
    const step = 360 / (now.length + paints.length);
    setSliders(
      now.map((s, i) => ({ ...s, angle: step * i })).concat(
        paints.map((p, i) => ({
          id: p.id,
          paint: p,
          angle: step * (now.length + i),
          position: 0.3,
          weight: 0,
        })),
      ),
    );
  }, []);
  const reset = useCallback(() => {
    draggingIdx.current = null;
    setSliders(mkSliders());
  }, []);

  return (
    <View style={styles.outer} {...panResponder.panHandlers}>
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <Text style={styles.title}>自选混色台</Text>
        <TouchableOpacity onPress={reset}>
          <Text style={styles.resetBtn}>重置</Text>
        </TouchableOpacity>
      </View>

      {/* ---- SVG Canvas ---- */}
      <Svg width={SW} height={CY + OUTER_R + 16}>
        <Circle cx={CX} cy={CY} r={OUTER_R} stroke="#2A2A2A" strokeWidth={1.5} fill="none" />
        <Circle cx={CX} cy={CY} r={(OUTER_R + INNER_R) / 2} stroke="#1F1F1F" strokeWidth={0.6} fill="none" strokeDasharray="4,4" />
        <Circle cx={CX} cy={CY} r={INNER_R} stroke="#2A2A2A" strokeWidth={1.5} fill="none" />

        {sliders.map((s) => (
          <Line key={`g-${s.id}`} x1={CX} y1={CY}
            x2={CX + Math.cos((s.angle * Math.PI) / 180) * OUTER_R}
            y2={CY - Math.sin((s.angle * Math.PI) / 180) * OUTER_R}
            stroke="#1A1A1A" strokeWidth={0.5} />
        ))}
        {sliders.map((s) => (
          s.weight > 0.01 && (
            <Line key={`c-${s.id}`} x1={CX} y1={CY}
              x2={CX + Math.cos((s.angle * Math.PI) / 180) * (OUTER_R - s.position * (OUTER_R - INNER_R - DOT_R))}
              y2={CY - Math.sin((s.angle * Math.PI) / 180) * (OUTER_R - s.position * (OUTER_R - INNER_R - DOT_R))}
              stroke={s.paint.hex} strokeWidth={1} opacity={s.weight * 0.8} />
          )
        ))}
        {sliders.map((s) => {
          const { x, y } = sliderPos(s);
          const textColor = hexToRgb(s.paint.hex).r > 128 ? '#000' : '#fff';
          return (
            <G key={`d-${s.id}`}>
              <Circle cx={x} cy={y} r={DOT_R} fill={s.paint.hex}
                opacity={s.weight > 0.001 ? 1 : 0.25}
                stroke={s.weight > 0.001 ? '#888' : '#444'}
                strokeWidth={s.weight > 0.001 ? 1.5 : 0.5} />
              <SvgText x={x} y={y + 4} fill={textColor} fontSize={7} fontWeight="bold" textAnchor="middle">
                {s.paint.code}
              </SvgText>
            </G>
          );
        })}

        {/* center */}
        <Circle cx={CX} cy={CY} r={INNER_R - 3} fill={blendedHex} stroke="#555" strokeWidth={2} />
        <SvgText x={CX} y={CY - 7} fill={blendedRgb.r > 128 ? '#000' : '#fff'} fontSize={10} fontWeight="bold" textAnchor="middle">
          {blendedHex}
        </SvgText>
        <SvgText x={CX} y={CY + 7} fill={blendedRgb.r > 128 ? '#000' : '#fff'} fontSize={7} textAnchor="middle">
          {blendedRgb.r},{blendedRgb.g},{blendedRgb.b}
        </SvgText>
      </Svg>

      {/* ---- Hint ---- */}
      <Text style={styles.hint}>
        拖拽色点到圆心调整比例 · 外侧 0% · 中心 100%
      </Text>

      <ScrollView style={styles.panelArea} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* ---- Readout Panel ---- */}
        <View style={styles.panel}>
          {/* mixed result */}
          <View style={styles.panelRow}>
            <View style={[styles.swatchSmall, { backgroundColor: blendedHex }]} />
            <View>
              <Text style={styles.label}>混合结果</Text>
              <Text style={styles.value}>{blendedHex}</Text>
            </View>
          </View>

          {/* target color */}
          <View style={styles.panelRow}>
            <View style={[styles.swatchSmall, { backgroundColor: targetHex }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>目标颜色</Text>
              <TextInput
                style={styles.hexInput}
                value={targetHex}
                onChangeText={(t) => setTargetHex(t.replace(/[^#0-9a-fA-F]/g, '').slice(0, 7))}
                placeholder="#FF9900"
                placeholderTextColor="#555"
              />
            </View>
          </View>

          {/* RAL match */}
          {ralMatch && (
            <View style={styles.panelRow}>
              <Text style={[styles.label, { flex: 1 }]}>
                RAL 匹配: {ralMatch.ral} {ralMatch.name}
              </Text>
            </View>
          )}

          {/* volume + button row */}
          <View style={styles.volRow}>
            <View>
              <Text style={styles.label}>目标总量 (ml)</Text>
              <TextInput style={styles.volInput} value={targetVolume}
                onChangeText={setTargetVolume} keyboardType="numeric" maxLength={3} />
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => addColors(CMY_COLORS)}>
              <Text style={styles.addBtnText}>+ 添加三原色</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => addColors(BW_COLORS)}>
              <Text style={styles.addBtnText}>+ 黑白</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---- Recipe Display ---- */}
        {recipe.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.recipeTitle}>📊 混合配方</Text>
            {recipe.map((r) => (
              <View key={r.id} style={styles.recipeRow}>
                <View style={[styles.recipeSwatch, { backgroundColor: r.paint.hex }]} />
                <Text style={styles.recipeHex}>{r.paint.hex}</Text>
                <Text style={styles.recipePct}>{r.percentage.toFixed(1)}%</Text>
                <Text style={styles.recipeMl}>{r.ml.toFixed(1)} ml</Text>
              </View>
            ))}
            <View style={[styles.recipeRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8 }]}>
              <View style={{ width: 22 }} />
              <Text style={[styles.recipeHex, { fontWeight: '700' }]}>总计</Text>
              <Text style={[styles.recipePct, { fontWeight: '700' }]}>100%</Text>
              <Text style={[styles.recipeMl, { fontWeight: '700' }]}>{tv.toFixed(1)} ml</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#111' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 50, marginBottom: 4 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  resetBtn: { color: '#FF9900', fontSize: 14, fontWeight: '600', paddingBottom: 2 },
  hint: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 2 },

  panelArea: { flex: 1, paddingHorizontal: 12 },
  panel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  swatchSmall: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#444' },
  label: { color: '#888', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  value: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'monospace' as any },
  hexInput: {
    color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'monospace' as any,
    marginTop: 2, padding: 0,
  },
  volRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  volInput: {
    color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'monospace' as any,
    backgroundColor: '#2A2A2A', borderRadius: 8, padding: 6, width: 56, textAlign: 'center', marginTop: 4,
  },
  addBtn: {
    flex: 1, backgroundColor: '#FF9900', borderRadius: 8, paddingVertical: 10, alignItems: 'center',
  },
  addBtnText: { color: '#111', fontSize: 12, fontWeight: '700' },

  recipeTitle: { color: '#888', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  recipeSwatch: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#555' },
  recipeHex: { color: '#ccc', fontSize: 12, fontFamily: 'monospace' as any, width: 72 },
  recipePct: { color: '#FF9900', fontSize: 12, fontWeight: '700', width: 50, textAlign: 'right' },
  recipeMl: { color: '#aaa', fontSize: 12, fontFamily: 'monospace' as any, flex: 1, textAlign: 'right' },
});
