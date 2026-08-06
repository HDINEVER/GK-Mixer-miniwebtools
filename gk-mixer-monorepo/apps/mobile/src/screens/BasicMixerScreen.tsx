import React, { useMemo, useState } from 'react';
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
import { mixboxMultiBlend, hexToRgb, type BaseColor } from '@gk-mixer/core';
import { Colors, FontSize, Spacing, MinTouchTarget, FontMono } from '../theme';

const DEFAULT_COLORS: BaseColor[] = [
  { id: 'b-w', brand: '色源', code: 'W', name: '白', hex: '#FFFFFF' },
  { id: 'b-k', brand: '色源', code: 'K', name: '黑', hex: '#000000' },
  { id: 'b-r', brand: '色源', code: 'R', name: '红', hex: '#FF0000' },
  { id: 'b-y', brand: '色源', code: 'Y', name: '黄', hex: '#FFFF00' },
  { id: 'b-bl', brand: '色源', code: 'B', name: '蓝', hex: '#0000FF' },
  { id: 'b-c', brand: '色源', code: 'C', name: '青', hex: '#00FFFF' },
  { id: 'b-m', brand: '色源', code: 'M', name: '品红', hex: '#FF00FF' },
  { id: 'b-o', brand: '色源', code: 'O', name: '橙', hex: '#FF8000' },
];

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

export default function BasicMixerScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() !== 'light';
  const c = isDark ? Colors.dark : Colors.light;
  const [ratios, setRatios] = useState<number[]>(DEFAULT_COLORS.map(() => 0));
  const [totalVolume, setTotalVolume] = useState('20');
  const tv = parseFloat(totalVolume) || 20;

  const blendedHex = useMemo(() => {
    const active = DEFAULT_COLORS.map((c, i) => ({ hex: c.hex, weight: ratios[i] })).filter((r) => r.weight > 0.001);
    if (active.length < 2) return active[0]?.hex ?? '#2A2A2A';
    return mixboxMultiBlend(active);
  }, [ratios]);
  const blendedRgb = useMemo(() => hexToRgb(blendedHex), [blendedHex]);

  const recipe = useMemo(() => {
    const totalW = ratios.reduce((a, b) => a + b, 0);
    if (totalW === 0) return [];
    return DEFAULT_COLORS.map((c, i) => ({ ...c, ratio: ratios[i] })).filter((r) => r.ratio > 0.001)
      .map((r) => ({ ...r, pct: (r.ratio / totalW) * 100, ml: (r.ratio / totalW) * tv }));
  }, [ratios, tv]);

  const updateRatio = (idx: number, val: number) => setRatios((prev) => prev.map((r, i) => (i === idx ? clamp(val, 0, 1) : r)));
  const reset = () => setRatios(DEFAULT_COLORS.map(() => 0));

  return (
    <View style={[styles.outer, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={[styles.resultSwatch, { backgroundColor: blendedHex }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.resultLabel, { color: c.tertiaryText }]}>混合结果</Text>
          <Text style={[styles.resultHex, { color: c.primaryText }]}>{blendedHex}</Text>
          <Text style={[styles.resultRgb, { color: c.secondaryText }]}>RGB {blendedRgb.r},{blendedRgb.g},{blendedRgb.b}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.volLabel, { color: c.tertiaryText }]}>总量 ml</Text>
          <TextInput style={[styles.volInput, { color: c.primaryText, backgroundColor: c.bg, borderColor: c.divider }]} value={totalVolume}
            onChangeText={setTotalVolume} keyboardType="numeric" maxLength={3} />
          <TouchableOpacity onPress={reset} style={{ marginTop: 6 }}>
            <Text style={{ color: c.accent, fontSize: FontSize.caption1, fontWeight: '700' }}>重置</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }}>
        {DEFAULT_COLORS.map((co, i) => {
          const ratio = ratios[i];
          const active = ratio > 0.001;
          const tc = hexToRgb(co.hex).r > 128 ? '#000' : '#fff';
          return (
            <View key={co.id} style={[styles.row, { borderBottomColor: c.divider }]}>
              <View style={[styles.swatch, { backgroundColor: co.hex }]}>
                <Text style={[styles.swatchCode, { color: tc }]}>{co.code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[styles.name, { color: c.primaryText }]}>{co.brand} {co.name}</Text>
                  <Text style={[styles.pct, { color: active ? c.accent : c.tertiaryText }]}>{((ratio * 100) / 1).toFixed(1)}%</Text>
                </View>
                <Slider style={{ width: '100%', height: 32 }} minimumValue={0} maximumValue={1} value={ratio}
                  onValueChange={(v) => updateRatio(i, v)}
                  minimumTrackTintColor={c.accent} maximumTrackTintColor={c.divider}
                  thumbTintColor={active ? co.hex : c.tertiaryText} />
              </View>
            </View>
          );
        })}

        {recipe.length > 0 && (
          <View style={[styles.recipeCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
            <Text style={[styles.recipeTitle, { color: c.accent }]}>📊 配方</Text>
            {recipe.map((r) => (
              <View key={r.id} style={styles.recipeRow}>
                <View style={[styles.recipeSwatch, { backgroundColor: r.hex }]} />
                <Text style={[styles.recipeName, { color: c.secondaryText }]}>{r.brand} {r.code}</Text>
                <Text style={[styles.recipePct, { color: c.accent }]}>{r.pct.toFixed(1)}%</Text>
                <Text style={[styles.recipeMl, { color: c.secondaryText }]}>{r.ml.toFixed(1)} ml</Text>
              </View>
            ))}
            <View style={[styles.recipeRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider, paddingTop: 6 }]}>
              <View style={{ width: 20 }} />
              <Text style={[styles.recipeName, { fontWeight: '700', color: c.primaryText }]}>总计</Text>
              <Text style={[styles.recipePct, { fontWeight: '700', color: c.accent }]}>100%</Text>
              <Text style={[styles.recipeMl, { fontWeight: '700', color: c.primaryText }]}>{tv.toFixed(1)} ml</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  resultCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: Spacing.md,
    margin: Spacing.sm, gap: Spacing.sm, borderWidth: StyleSheet.hairlineWidth,
  },
  resultSwatch: { width: 56, height: 56, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  resultLabel: { fontSize: FontSize.caption2, fontWeight: '600' },
  resultHex: { fontSize: FontSize.title3, fontWeight: '700', fontFamily: FontMono },
  resultRgb: { fontSize: FontSize.caption2, fontFamily: FontMono },
  volLabel: { fontSize: FontSize.caption2 },
  volInput: {
    fontSize: FontSize.callout, fontWeight: '700', borderRadius: 6, padding: 4,
    width: 48, textAlign: 'center', marginTop: 2, borderWidth: StyleSheet.hairlineWidth, fontFamily: FontMono,
  },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: Spacing.sm, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  swatch: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  swatchCode: { fontSize: FontSize.caption2, fontWeight: '800' },
  name: { fontSize: FontSize.footnote },
  pct: { fontSize: FontSize.caption1, fontWeight: '600' },

  recipeCard: { borderRadius: 12, padding: Spacing.sm, margin: Spacing.sm, marginTop: Spacing.xs, borderWidth: StyleSheet.hairlineWidth },
  recipeTitle: { fontSize: FontSize.caption2, fontWeight: '700', marginBottom: 6 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: 3, minHeight: 28 },
  recipeSwatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#FFFFFF20' },
  recipeName: { fontSize: FontSize.caption1, width: 76 },
  recipePct: { fontSize: FontSize.caption1, fontWeight: '700', width: 48, textAlign: 'right' },
  recipeMl: { fontSize: FontSize.caption1, flex: 1, textAlign: 'right' },
});
