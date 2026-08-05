import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  convertHexToAllSpaces,
  calculateMixboxRatios,
  calculateProfessionalRecipe,
  findNearestRAL,
  findNearestPaints,
  BASE_MIXING_COLORS,
  EXTENDED_MIXING_COLORS,
  hexToRgb,
  type ColorData,
} from '@gk-mixer/core';
import { useTargetColor } from '../context/ColorContext';

export default function MixerScreen() {
  const { targetColor } = useTargetColor();
  const [bottleVolume, setBottleVolume] = useState('20');
  const tv = parseFloat(bottleVolume) || 20;

  // Ensure we always have valid ColorData to work with
  const color: ColorData = useMemo(
    () => targetColor ?? convertHexToAllSpaces('#FF9900'),
    [targetColor],
  );

  const rgb = useMemo(() => hexToRgb(color.hex), [color.hex]);

  // ── Computations ──
  const ratios5 = useMemo(() => calculateMixboxRatios(color.hex), [color.hex]);
  const ratios8 = useMemo(() => calculateMixboxRatios(color.hex, 'srgb', true), [color.hex]);
  const ral = useMemo(() => findNearestRAL(color.rgb), [color.rgb]);
  const nearest = useMemo(() => findNearestPaints(color.hex, 5), [color.hex]);
  const recipe = useMemo(() => calculateProfessionalRecipe(color.hex), [color.hex]);

  const recipeMl = useMemo(() => {
    const r = recipe?.ratios as { color: string; percentage: number }[] | undefined;
    if (!r) return [];
    return r.map((n) => ({ ...n, ml: (n.percentage / 100) * tv }));
  }, [recipe, tv]);

  // ── Render ──
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }}>
      {/* Target color header */}
      <View style={styles.headerCard}>
        <View style={[styles.bigSwatch, { backgroundColor: color.hex }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.hex}>{color.hex}</Text>
          <Text style={styles.rgb}>RGB {color.rgb.r}, {color.rgb.g}, {color.rgb.b}</Text>
          <View style={styles.cmykRow}>
            <Text style={styles.cmyk}>C{color.cmyk.c}</Text>
            <Text style={styles.cmyk}>M{color.cmyk.m}</Text>
            <Text style={styles.cmyk}>Y{color.cmyk.y}</Text>
            <Text style={styles.cmyk}>K{color.cmyk.k}</Text>
          </View>
        </View>
        {targetColor ? (
          <View style={styles.badge}><Text style={styles.badgeText}>已设目标</Text></View>
        ) : (
          <View style={styles.badgeDefault}><Text style={styles.badgeText}>默认色</Text></View>
        )}
      </View>

      {/* RAL */}
      {ral && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>RAL 标准色</Text>
          <Text style={styles.ralText}>
            RAL {ral.ral} · {ral.name}
          </Text>
          <View style={[styles.ralSwatch, { backgroundColor: ral.hex }]} />
        </View>
      )}

      {/* Bottle volume */}
      <View style={styles.card}>
        <View style={styles.volRow}>
          <Text style={styles.volLabel}>烧杯容量 (ml)</Text>
          <TextInput
            style={styles.volInput}
            value={bottleVolume}
            onChangeText={setBottleVolume}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>
      </View>

      {/* 5-color ratios */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>5色 Mixbox 配比</Text>
        <View style={styles.barTrack}>
          {BASE_MIXING_COLORS.map((p, i) => {
            const v = ratios5[i] ?? 0;
            return v > 0.5 ? (
              <View
                key={p.id}
                style={[styles.bar, { flex: v, backgroundColor: p.hex }]}
              />
            ) : null;
          })}
        </View>
        <View style={styles.ratioGrid}>
          {BASE_MIXING_COLORS.map((p, i) => {
            const v = ratios5[i] ?? 0;
            const ml = tv * (v / 100);
            return (
              <View key={p.id} style={styles.ratioItem}>
                <View style={[styles.dot, { backgroundColor: p.hex }]} />
                <Text style={styles.ratioText}>
                  {p.name} {v.toFixed(1)}%
                </Text>
                {v > 0.01 && (
                  <Text style={styles.ratioMl}>{ml.toFixed(1)}ml</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 8-color ratios */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>8色 Mixbox 配比</Text>
        <View style={styles.barTrack}>
          {EXTENDED_MIXING_COLORS.map((p, i) => {
            const v = ratios8[i] ?? 0;
            return v > 0.5 ? (
              <View
                key={p.id}
                style={[styles.bar, { flex: v, backgroundColor: p.hex }]}
              />
            ) : null;
          })}
        </View>
        {EXTENDED_MIXING_COLORS.map((p, i) => {
          const v = ratios8[i] ?? 0;
          const ml = tv * (v / 100);
          if (v < 0.01) return null;
          return (
            <View key={p.id} style={styles.ratioItem}>
              <View style={[styles.dot, { backgroundColor: p.hex }]} />
              <Text style={styles.ratioText}>{p.name} {v.toFixed(1)}%</Text>
              <Text style={styles.ratioMl}>{ml.toFixed(1)}ml</Text>
            </View>
          );
        })}
      </View>

      {/* Nearest paints */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>最近漆料匹配 (ΔE)</Text>
        {nearest.map((p) => (
          <View key={p.id} style={styles.ratioItem}>
            <View style={[styles.dot, { backgroundColor: p.hex }]} />
            <Text style={styles.ratioText}>{p.brand} {p.code}</Text>
            <Text style={styles.ratioMl}>{p.name}</Text>
          </View>
        ))}
      </View>

      {/* Professional recipe */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>专业配方</Text>
        {recipe?.strategy && (
          <Text style={styles.strategy}>策略: {recipe.strategy}</Text>
        )}
        {recipe?.steps?.map((s: string, i: number) => (
          <Text key={i} style={styles.step}>{i + 1}. {s}</Text>
        ))}
        {recipe?.ratios && recipeMl.length > 0 && (
          <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8 }}>
            {recipeMl.map((r, i) => (
              <View key={i} style={styles.ratioItem}>
                <View style={[styles.dot, { backgroundColor: r.color }]} />
                <Text style={styles.ratioText}>{r.percentage.toFixed(1)}%</Text>
                <Text style={styles.ratioMl}>{r.ml.toFixed(1)}ml</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },

  headerCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, margin: 12,
    borderWidth: 1, borderColor: '#2A2A2A', gap: 14,
  },
  bigSwatch: { width: 64, height: 64, borderRadius: 14, borderWidth: 1, borderColor: '#555' },
  hex: { color: '#fff', fontSize: 22, fontWeight: '700', fontFamily: 'monospace' as any },
  rgb: { color: '#999', fontSize: 12, marginTop: 2, fontFamily: 'monospace' as any },
  cmykRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cmyk: { color: '#666', fontSize: 11, fontFamily: 'monospace' as any },
  badge: { backgroundColor: '#FF9900', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDefault: { backgroundColor: '#444', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#111', fontSize: 10, fontWeight: '700' },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginHorizontal: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  sectionTitle: { color: '#FF9900', fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' as any },

  ralText: { color: '#ddd', fontSize: 16, fontWeight: '600' },
  ralSwatch: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#555', marginTop: 6 },

  volRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  volLabel: { color: '#aaa', fontSize: 14 },
  volInput: {
    color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'monospace' as any,
    backgroundColor: '#2A2A2A', borderRadius: 8, padding: 6, width: 56, textAlign: 'center',
  },

  barTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: '#333', marginBottom: 10 },
  bar: { minWidth: 2, borderRightWidth: 1, borderRightColor: '#111' },

  ratioGrid: { gap: 3 },
  ratioItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#555' },
  ratioText: { color: '#ccc', fontSize: 13 },
  ratioMl: { color: '#888', fontSize: 12, fontFamily: 'monospace' as any },

  strategy: { color: '#aaa', fontSize: 12, marginBottom: 6 },
  step: { color: '#999', fontSize: 12, lineHeight: 18 },
});
