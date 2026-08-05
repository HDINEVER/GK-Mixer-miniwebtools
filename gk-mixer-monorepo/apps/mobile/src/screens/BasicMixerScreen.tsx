import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  mixboxMultiBlend,
  hexToRgb,
  type BaseColor,
} from '@gk-mixer/core';

const DEFAULT_COLORS: BaseColor[] = [
  { id: 'gaia-001', brand: 'Gaia', code: '001', name: '白', hex: '#FFFFFF' },
  { id: 'gaia-002', brand: 'Gaia', code: '002', name: '黑', hex: '#000000' },
  { id: 'gaia-003', brand: 'Gaia', code: '003', name: '红', hex: '#E60012' },
  { id: 'gaia-004', brand: 'Gaia', code: '004', name: '蓝', hex: '#004098' },
  { id: 'gaia-005', brand: 'Gaia', code: '005', name: '黄', hex: '#FFD900' },
  { id: 'gaia-006', brand: 'Gaia', code: '006', name: '品红', hex: '#FF00FF' },
  { id: 'gaia-007', brand: 'Gaia', code: '007', name: '青', hex: '#00FFFF' },
  { id: 'gaia-008', brand: 'Gaia', code: '008', name: '橙', hex: '#FF8000' },
];

export default function BasicMixerScreen() {
  const [ratios, setRatios] = useState<number[]>(DEFAULT_COLORS.map(() => 0));
  const [totalVolume, setTotalVolume] = useState('20');
  const tv = parseFloat(totalVolume) || 20;

  const blendedHex = useMemo(() => {
    const active = DEFAULT_COLORS
      .map((c, i) => ({ hex: c.hex, weight: ratios[i] }))
      .filter((r) => r.weight > 0.001);
    if (active.length < 2) return active[0]?.hex ?? '#1A1A1A';
    return mixboxMultiBlend(active);
  }, [ratios]);
  const blendedRgb = useMemo(() => hexToRgb(blendedHex), [blendedHex]);

  const recipe = useMemo(() => {
    const totalWeight = ratios.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return [];
    return DEFAULT_COLORS
      .map((c, i) => ({ ...c, ratio: ratios[i] }))
      .filter((r) => r.ratio > 0.001)
      .map((r) => ({
        ...r,
        pct: (r.ratio / totalWeight) * 100,
        ml: (r.ratio / totalWeight) * tv,
      }));
  }, [ratios, tv]);

  const updateRatio = (idx: number, val: number) => {
    setRatios((prev) => prev.map((r, i) => (i === idx ? clamp(val, 0, 1) : r)));
  };
  const reset = () => setRatios(DEFAULT_COLORS.map(() => 0));

  return (
    <View style={styles.outer}>
      {/* Blended result */}
      <View style={styles.resultCard}>
        <View style={[styles.resultSwatch, { backgroundColor: blendedHex }]} />
        <View>
          <Text style={styles.resultLabel}>混合结果</Text>
          <Text style={styles.resultHex}>{blendedHex}</Text>
          <Text style={styles.resultRgb}>
            RGB {blendedRgb.r},{blendedRgb.g},{blendedRgb.b}
          </Text>
        </View>
        <View style={{ marginLeft: 'auto', alignItems: 'center' }}>
          <Text style={styles.label}>总量 ml</Text>
          <TextInput
            style={styles.volInput}
            value={totalVolume}
            onChangeText={setTotalVolume}
            keyboardType="numeric"
            maxLength={3}
          />
          <TouchableOpacity onPress={reset} style={{ marginTop: 6 }}>
            <Text style={styles.resetBtn}>重置</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 160 }}>
        {/* Color sliders */}
        {DEFAULT_COLORS.map((c, i) => {
          const ratio = ratios[i];
          const active = ratio > 0.001;
          const textColor = hexToRgb(c.hex).r > 128 ? '#000' : '#fff';
          return (
            <View key={c.id} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: c.hex }]}>
                <Text style={[styles.swatchCode, { color: textColor }]}>
                  {c.code}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.name}>{c.brand} {c.name}</Text>
                  <Text style={[styles.pct, active && { color: '#FF9900' }]}>
                    {((ratio * 100) / 1).toFixed(1)}%
                  </Text>
                </View>
                <Slider
                  style={{ width: '100%', height: 32 }}
                  minimumValue={0}
                  maximumValue={1}
                  value={ratio}
                  onValueChange={(v) => updateRatio(i, v)}
                  minimumTrackTintColor="#FF9900"
                  maximumTrackTintColor="#333"
                  thumbTintColor={active ? c.hex : '#555'}
                />
              </View>
            </View>
          );
        })}

        {/* Recipe */}
        {recipe.length > 0 && (
          <View style={styles.recipeCard}>
            <Text style={styles.recipeTitle}>📊 配方</Text>
            {recipe.map((r) => (
              <View key={r.id} style={styles.recipeRow}>
                <View style={[styles.recipeSwatch, { backgroundColor: r.hex }]} />
                <Text style={styles.recipeName}>{r.brand} {r.code}</Text>
                <Text style={styles.recipePct}>{r.pct.toFixed(1)}%</Text>
                <Text style={styles.recipeMl}>{r.ml.toFixed(1)} ml</Text>
              </View>
            ))}
            <View style={[styles.recipeRow, { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 6 }]}>
              <View style={{ width: 20 }} />
              <Text style={[styles.recipeName, { fontWeight: '700' }]}>总计</Text>
              <Text style={[styles.recipePct, { fontWeight: '700' }]}>100%</Text>
              <Text style={[styles.recipeMl, { fontWeight: '700' }]}>{tv.toFixed(1)} ml</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#111' },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    margin: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  resultSwatch: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: '#555' },
  resultLabel: { color: '#888', fontSize: 10, fontWeight: '600' },
  resultHex: { color: '#fff', fontSize: 20, fontWeight: '700', fontFamily: 'monospace' as any },
  resultRgb: { color: '#666', fontSize: 11, fontFamily: 'monospace' as any },
  label: { color: '#666', fontSize: 10 },
  volInput: {
    color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'monospace' as any,
    backgroundColor: '#2A2A2A', borderRadius: 6, padding: 4,
    width: 48, textAlign: 'center', marginTop: 2,
  },
  resetBtn: { color: '#FF9900', fontSize: 12, fontWeight: '700' },

  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  swatch: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  swatchCode: { fontSize: 10, fontWeight: '800' },
  name: { color: '#ccc', fontSize: 13 },
  pct: { color: '#555', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' as any },

  recipeCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, margin: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  recipeTitle: { color: '#888', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  recipeSwatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#555' },
  recipeName: { color: '#ccc', fontSize: 12, width: 80 },
  recipePct: { color: '#FF9900', fontSize: 12, fontWeight: '700', width: 48, textAlign: 'right' },
  recipeMl: { color: '#aaa', fontSize: 12, fontFamily: 'monospace' as any, flex: 1, textAlign: 'right' },
});
