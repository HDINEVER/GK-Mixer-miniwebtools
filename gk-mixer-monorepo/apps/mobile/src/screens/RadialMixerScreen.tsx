import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { mixboxMultiBlend, hexToRgb, convertHexToAllSpaces, type ColorData } from '@gk-mixer/core';
import { useTargetColor } from '../context/ColorContext';
import { Colors, FontSize, Spacing, MinTouchTarget } from '../theme';

const CMY_ADD: Omit<ColorData, 'id'>[] = [
  { hex: '#00B7EB', rgb: { r: 0, g: 183, b: 235 }, cmyk: { c: 100, m: 0, y: 0, k: 0 }, hsb: { h: 193, s: 100, b: 92 }, lab: { l: 69, a: -30, b: -25 }, source: 'manual' },
  { hex: '#FF0090', rgb: { r: 255, g: 0, b: 144 }, cmyk: { c: 0, m: 100, y: 0, k: 0 }, hsb: { h: 326, s: 100, b: 100 }, lab: { l: 54, a: 84, b: 0 }, source: 'manual' },
  { hex: '#FFEF00', rgb: { r: 255, g: 239, b: 0 }, cmyk: { c: 0, m: 0, y: 100, k: 0 }, hsb: { h: 56, s: 100, b: 100 }, lab: { l: 93, a: -8, b: 95 }, source: 'manual' },
];
const BW_ADD: Omit<ColorData, 'id'>[] = [
  { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, cmyk: { c: 0, m: 0, y: 0, k: 0 }, hsb: { h: 0, s: 0, b: 100 }, lab: { l: 100, a: 0, b: 0 }, source: 'manual' },
  { hex: '#000000', rgb: { r: 0, g: 0, b: 0 }, cmyk: { c: 0, m: 0, y: 0, k: 100 }, hsb: { h: 0, s: 0, b: 0 }, lab: { l: 0, a: 0, b: 0 }, source: 'manual' },
];

export default function RadialMixerScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() !== 'light';
  const c = isDark ? Colors.dark : Colors.light;
  const { extractedColors } = useTargetColor();

  const [extraColors, setExtraColors] = useState<ColorData[]>([]);
  const [totalVolume, setTotalVolume] = useState('20');
  const tv = parseFloat(totalVolume) || 20;
  const [ratios, setRatios] = useState<number[]>([]);

  const allColors = [...extractedColors, ...extraColors];

  const syncedRatios = useMemo(() => {
    if (allColors.length === 0) return [];
    const r = [...ratios];
    while (r.length < allColors.length) r.push(0);
    return r.slice(0, allColors.length);
  }, [ratios, allColors]);

  const updateRatio = (idx: number, val: number) => {
    setRatios(prev => {
      const r = [...prev];
      while (r.length < allColors.length) r.push(0);
      r[idx] = Math.max(0, Math.min(1, val));
      return r;
    });
  };

  const blendedHex = useMemo(() => {
    const active = allColors
      .map((col, i) => ({ hex: col.hex, weight: syncedRatios[i] ?? 0 }))
      .filter(r => r.weight > 0.01);
    if (active.length === 0) return allColors[0]?.hex ?? '#333';
    if (active.length === 1) return active[0].hex;
    return mixboxMultiBlend(active);
  }, [allColors, syncedRatios]);

  const blendedRgb = useMemo(() => hexToRgb(blendedHex), [blendedHex]);

  const recipe = useMemo(() => {
    const totalW = syncedRatios.reduce((a, b) => a + b, 0);
    if (totalW === 0) return [];
    return allColors
      .map((col, i) => ({ id: col.id, hex: col.hex, ratio: syncedRatios[i] ?? 0 }))
      .filter(r => r.ratio > 0.001)
      .map(r => ({
        ...r,
        pct: (r.ratio / totalW) * 100,
        ml: (r.ratio / totalW) * tv,
      }));
  }, [allColors, syncedRatios, tv]);

  const addColors = useCallback((colors: Omit<ColorData, 'id'>[]) => {
    const created = colors.map(c => ({
      ...c,
      id: Math.random().toString(36).substr(2, 9),
    }));
    setExtraColors(prev => [...prev, ...created]);
  }, []);

  if (extractedColors.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg, paddingTop: insets.top + Spacing.xl }]}>
        <Text style={[styles.emptyText, { color: c.tertiaryText }]}>
          还没有提取颜色{'\n'}去「拾色」Tab 选一张图片
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.sm, paddingBottom: 140 }}
    >
      {/* Blended result */}
      <View style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={[styles.swatch, { backgroundColor: blendedHex }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: c.tertiaryText }]}>混合结果</Text>
          <Text style={[styles.hex, { color: c.primaryText }]}>{blendedHex}</Text>
          <Text style={[styles.rgb, { color: c.secondaryText }]}>
            RGB {blendedRgb.r},{blendedRgb.g},{blendedRgb.b}
          </Text>
        </View>
      </View>

      {/* Volume + Add buttons */}
      <View style={[styles.toolRow, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.toolLabel, { color: c.secondaryText }]}>总量</Text>
          <TextInput style={[styles.volInput, { color: c.primaryText, backgroundColor: c.bg, borderColor: c.divider }]}
            value={totalVolume} onChangeText={setTotalVolume} keyboardType="numeric" maxLength={3} />
          <Text style={[styles.toolLabel, { color: c.secondaryText }]}>ml</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: c.accent }]} onPress={() => addColors(CMY_ADD)}>
          <Text style={styles.addBtnText}>+ 三原色</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtnLight, { backgroundColor: c.bg, borderColor: c.divider }]} onPress={() => addColors(BW_ADD)}>
          <Text style={[styles.addBtnLightText, { color: c.secondaryText }]}>+ 黑白</Text>
        </TouchableOpacity>
      </View>

      {/* Color sliders */}
      {allColors.map((color, i) => {
        const ratio = syncedRatios[i] ?? 0;
        const active = ratio > 0.01;
        const tc = hexToRgb(color.hex).r > 128 ? '#000' : '#fff';
        const isExtra = i >= extractedColors.length;
        return (
          <View key={color.id} style={[styles.row, { borderBottomColor: c.divider }]}>
            <View style={[styles.dot, { backgroundColor: color.hex }]}>
              <Text style={[styles.dotCode, { color: tc }]}>
                {isExtra ? '+' : 'A'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.name, { color: c.primaryText }]}>{color.hex}</Text>
                <Text style={[styles.pct, { color: active ? c.accent : c.tertiaryText }]}>
                  {(ratio * 100).toFixed(1)}%
                </Text>
              </View>
              <Slider style={{ width: '100%', height: 32 }}
                minimumValue={0} maximumValue={1} value={ratio}
                onValueChange={(v) => updateRatio(i, v)}
                minimumTrackTintColor={c.accent} maximumTrackTintColor={c.divider}
                thumbTintColor={active ? color.hex : c.tertiaryText} />
            </View>
          </View>
        );
      })}

      {/* Recipe */}
      {recipe.length > 0 && (
        <View style={[styles.recipeCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.recipeTitle, { color: c.accent }]}>📊 混合配方</Text>
          {recipe.map((r) => (
            <View key={r.id} style={styles.recipeRow}>
              <View style={[styles.recipeSwatch, { backgroundColor: r.hex }]} />
              <Text style={[styles.recipeHex, { color: c.secondaryText }]}>{r.hex}</Text>
              <Text style={[styles.recipePct, { color: c.accent }]}>{r.pct.toFixed(1)}%</Text>
              <Text style={[styles.recipeMl, { color: c.secondaryText }]}>{r.ml.toFixed(1)} ml</Text>
            </View>
          ))}
          <View style={[styles.recipeRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, paddingTop: 6 }]}>
            <View style={{ width: 20 }} />
            <Text style={[styles.recipeHex, { fontWeight: '700', color: c.primaryText }]}>总计</Text>
            <Text style={[styles.recipePct, { fontWeight: '700', color: c.accent }]}>100%</Text>
            <Text style={[styles.recipeMl, { fontWeight: '700', color: c.primaryText }]}>{tv.toFixed(1)} ml</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  empty: { flex: 1, alignItems: 'center' },
  emptyText: { fontSize: FontSize.body, textAlign: 'center', lineHeight: 24 },

  resultCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: Spacing.md,
    marginHorizontal: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, gap: Spacing.sm,
  },
  swatch: { width: 56, height: 56, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  label: { fontSize: FontSize.caption2, fontWeight: '600' },
  hex: { fontSize: FontSize.title3, fontWeight: '700', fontFamily: 'Menlo' },
  rgb: { fontSize: FontSize.caption2 },

  toolRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: Spacing.sm,
    marginHorizontal: Spacing.md, marginBottom: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth, gap: 6, flexWrap: 'wrap',
  },
  toolLabel: { fontSize: FontSize.caption2 },
  volInput: { fontSize: FontSize.subheadline, fontWeight: '700', borderRadius: 6, padding: 4, width: 44, textAlign: 'center', borderWidth: StyleSheet.hairlineWidth },
  addBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: Spacing.xs, alignItems: 'center', minHeight: MinTouchTarget, justifyContent: 'center' },
  addBtnText: { color: '#111', fontSize: FontSize.caption2, fontWeight: '700' },
  addBtnLight: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: Spacing.xs, alignItems: 'center', minHeight: MinTouchTarget, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  addBtnLightText: { fontSize: FontSize.caption2, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    paddingHorizontal: Spacing.md, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52,
  },
  dot: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  dotCode: { fontSize: FontSize.caption2, fontWeight: '800' },
  name: { fontSize: FontSize.footnote },
  pct: { fontSize: FontSize.caption1, fontWeight: '600' },

  recipeCard: {
    borderRadius: 12, padding: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recipeTitle: { fontSize: FontSize.caption2, fontWeight: '700', marginBottom: 6 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, minHeight: 28 },
  recipeSwatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#FFFFFF20' },
  recipeHex: { fontSize: FontSize.caption1, width: 82 },
  recipePct: { fontSize: FontSize.caption1, fontWeight: '700', width: 50, textAlign: 'right' },
  recipeMl: { fontSize: FontSize.caption1, flex: 1, textAlign: 'right' },
});
