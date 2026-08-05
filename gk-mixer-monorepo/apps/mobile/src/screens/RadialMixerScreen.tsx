import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { mixboxMultiBlend, EXTENDED_MIXING_COLORS } from '@gk-mixer/core';

const PALETTE = EXTENDED_MIXING_COLORS;
const RING_RADIUS = 100;
const DOT_RADIUS = 14;

export default function RadialMixerScreen() {
  const [weights, setWeights] = useState<number[]>(new Array(PALETTE.length).fill(0));

  const activeColors = useMemo(() => {
    return PALETTE
      .map((p, i) => ({ ...p, weight: weights[i] }))
      .filter((c) => c.weight > 0);
  }, [weights]);

  const mixedHex = useMemo(() => {
    if (activeColors.length === 0) return '#333';
    const total = activeColors.reduce((s, c) => s + c.weight, 0);
    if (total < 0.01) return '#333';
    return mixboxMultiBlend(
      activeColors.map((c) => ({ hex: c.hex, weight: c.weight / total })),
    );
  }, [activeColors]);

  const updateWeight = (index: number, value: number) => {
    setWeights((prev) => {
      const next = [...prev];
      next[index] = Math.max(0, Math.min(100, value));
      return next;
    });
  };

  const quickSet = (index: number, value: number) => {
    setWeights((prev) => {
      const next = [...prev];
      next[index] = Math.round(next[index] + value);
      if (next[index] > 100) next[index] = 100;
      return next;
    });
  };

  const dotPositions = useMemo(() => {
    return activeColors.map((c, i) => {
      const angle = (i / Math.max(activeColors.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const ratio = c.weight / 100;
      const r = 30 + ratio * (RING_RADIUS - DOT_RADIUS);
      return { x: 150 + Math.cos(angle) * r, y: 150 + Math.sin(angle) * r };
    });
  }, [activeColors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mix Result */}
      <View style={styles.mixResult}>
        <Svg width={300} height={300} viewBox="0 0 300 300">
          {/* Ring */}
          <Circle cx={150} cy={150} r={RING_RADIUS} fill="none" stroke="#222" strokeWidth={2} />
          <Circle cx={150} cy={150} r={30} fill="none" stroke="#333" strokeWidth={1} strokeDasharray="4,4" />
          {/* Mix result */}
          <Circle cx={150} cy={150} r={28} fill={mixedHex} stroke="#444" strokeWidth={2} />
          {/* Color dots */}
          {dotPositions.map((pos, i) => (
            <G key={i}>
              <Circle cx={pos.x} cy={pos.y} r={DOT_RADIUS} fill={activeColors[i].hex} stroke="#555" strokeWidth={2} />
              <Circle cx={pos.x} cy={pos.y} r={8} fill="rgba(255,255,255,0.35)" />
            </G>
          ))}
        </Svg>
        <Text style={styles.mixLabel}>{activeColors.length === 0 ? '添加颜色开始混合' : mixedHex}</Text>
      </View>

      {/* Color Palette */}
      <Text style={styles.sectionTitle}>🎨 8 色体系</Text>
      {PALETTE.map((paint, index) => (
        <View key={paint.id} style={styles.colorRow}>
          <View style={[styles.swatch, { backgroundColor: paint.hex }]} />
          <View style={styles.colorInfo}>
            <Text style={styles.colorName}>{paint.name}</Text>
            <Text style={styles.colorCode}>{paint.brand} {paint.code}</Text>
          </View>
          <TouchableOpacity
            style={styles.adjBtn}
            onPress={() => quickSet(index, -5)}
          >
            <Text style={styles.adjText}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.weightInput}
            value={String(Math.round(weights[index]))}
            onChangeText={(t) => updateWeight(index, parseInt(t, 10) || 0)}
            keyboardType="numeric"
            maxLength={3}
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.adjBtn}
            onPress={() => quickSet(index, 5)}
          >
            <Text style={styles.adjText}>+</Text>
          </TouchableOpacity>
          <View style={styles.quickBtns}>
            {[25, 50, 75, 100].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.quickBtn, weights[index] >= v && styles.quickBtnActive]}
                onPress={() => updateWeight(index, v)}
              >
                <Text style={[styles.quickText, weights[index] >= v && styles.quickTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Active mix summary */}
      {activeColors.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.sectionTitle}>🧪 当前混合</Text>
          {activeColors.map((c) => (
            <View key={c.id} style={styles.summaryRow}>
              <View style={[styles.miniSwatch, { backgroundColor: c.hex }]} />
              <Text style={styles.summaryLabel}>{c.name}</Text>
              <View style={[styles.summaryBar, { flex: c.weight, backgroundColor: c.hex }]} />
              <View style={{ flex: 100 - c.weight }} />
              <Text style={styles.summaryPct}>{Math.round(c.weight)}%</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, paddingBottom: 120 },
  mixResult: { alignItems: 'center', marginBottom: 16 },
  mixLabel: { color: '#fff', fontSize: 16, fontFamily: 'monospace', fontWeight: '700', marginTop: -12 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  colorRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 10, marginBottom: 8, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  colorInfo: { flex: 1, minWidth: 70 },
  colorName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  colorCode: { color: '#666', fontSize: 10, marginTop: 2 },
  adjBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  adjText: { color: '#FF9900', fontSize: 20, fontWeight: '700' },
  weightInput: { width: 44, height: 36, backgroundColor: '#222', borderRadius: 8, color: '#FF9900', fontSize: 16, fontWeight: '700', textAlign: 'center', marginHorizontal: 4, fontFamily: 'monospace', padding: 0 },
  quickBtns: { width: '100%', flexDirection: 'row', gap: 6, marginTop: 8, paddingLeft: 46 },
  quickBtn: { flex: 1, backgroundColor: '#222', borderRadius: 6, paddingVertical: 4, alignItems: 'center' },
  quickBtnActive: { backgroundColor: '#FF9900' },
  quickText: { color: '#888', fontSize: 11, fontWeight: '600' },
  quickTextActive: { color: '#111', fontWeight: '700' },
  summary: { marginTop: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, height: 24 },
  miniSwatch: { width: 14, height: 14, borderRadius: 4, marginRight: 8 },
  summaryLabel: { color: '#999', fontSize: 11, width: 36 },
  summaryBar: { height: '100%', borderRadius: 4, minWidth: 2 },
  summaryPct: { color: '#FF9900', fontSize: 12, fontWeight: '700', marginLeft: 8, width: 36, textAlign: 'right' },
});
