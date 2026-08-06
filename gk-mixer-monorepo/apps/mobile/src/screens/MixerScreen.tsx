import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  convertHexToAllSpaces,
  calculateMixboxRatios,
  findNearestRAL,
  EXTENDED_MIXING_COLORS,
  hexToRgb,
  type ColorData,
} from '@gk-mixer/core';
import { useTargetColor } from '../context/ColorContext';
import { Colors, FontSize, Spacing, MinTouchTarget, FontMono } from '../theme';

export default function MixerScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() !== 'light';
  const c = isDark ? Colors.dark : Colors.light;
  const { targetColor } = useTargetColor();
  const [bottleVolume, setBottleVolume] = useState('20');
  const tv = parseFloat(bottleVolume) || 20;

  const color: ColorData = useMemo(
    () => targetColor ?? convertHexToAllSpaces('#FF9900'),
    [targetColor],
  );

  const rgb = useMemo(() => hexToRgb(color.hex), [color.hex]);
  // 8-color extended palette (matches original web MixerResult)
  const ratios = useMemo(() => calculateMixboxRatios(color.hex, 'srgb', true), [color.hex]);
  const ral = useMemo(() => findNearestRAL(color.rgb), [color.rgb]);

  const beakerLayers = EXTENDED_MIXING_COLORS
    .map((p, i) => ({ ...p, ratio: ratios[i] ?? 0 }))
    .filter((r) => r.ratio > 0.3)
    .map((r) => {
      const pr = hexToRgb(r.hex);
      const lum = pr.r * 0.299 + pr.g * 0.587 + pr.b * 0.114;
      return {
        key: r.id,
        hex: r.hex,
        pct: r.ratio,
        ml: tv * (r.ratio / 100),
        label: `${r.name} ${r.ratio.toFixed(1)}%`,
        textColor: lum > 128 ? '#000' : '#fff',
      };
    });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.xs, paddingBottom: 120 }}
    >
      {/* Target Color */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <View style={[styles.swatch, { backgroundColor: color.hex }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.hex, { color: c.primaryText }]}>{color.hex}</Text>
            <Text style={[styles.rgb, { color: c.secondaryText }]}>
              RGB {color.rgb.r}, {color.rgb.g}, {color.rgb.b}
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xxs }}>
              <Text style={[styles.chip, { color: c.tertiaryText }]}>C{color.cmyk.c}</Text>
              <Text style={[styles.chip, { color: c.tertiaryText }]}>M{color.cmyk.m}</Text>
              <Text style={[styles.chip, { color: c.tertiaryText }]}>Y{color.cmyk.y}</Text>
              <Text style={[styles.chip, { color: c.tertiaryText }]}>K{color.cmyk.k}</Text>
            </View>
            <Text style={[styles.hsbLab, { color: c.tertiaryText }]}>
              HSB {color.hsb.h}°/{color.hsb.s}%/{color.hsb.b}% · LAB {color.lab.l}/{color.lab.a}/{color.lab.b}
            </Text>
          </View>
          {targetColor ? (
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Text style={styles.badgeText}>目标</Text>
            </View>
          ) : (
            <View style={[styles.badgeDefault, { backgroundColor: c.divider }]}>
              <Text style={[styles.badgeText, { color: c.secondaryText }]}>默认</Text>
            </View>
          )}
        </View>
      </View>

      {/* RAL */}
      {ral && (
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: c.accent }]}>RAL 标准色</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View style={[styles.ralSwatch, { backgroundColor: ral.hex }]} />
            <View>
              <Text style={[styles.ralText, { color: c.primaryText }]}>RAL {ral.ral}</Text>
              <Text style={[styles.ralName, { color: c.secondaryText }]}>{ral.name}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Bottle Volume */}
      <View style={styles.volRow}>
        <Text style={[styles.volLabel, { color: c.secondaryText }]}>烧杯容量</Text>
        <TextInput
          style={[styles.volInput, { color: c.primaryText, backgroundColor: c.card, borderColor: c.cardBorder }]}
          value={bottleVolume} onChangeText={setBottleVolume} keyboardType="numeric" maxLength={3}
        />
        <Text style={[styles.volUnit, { color: c.secondaryText }]}>ml</Text>
      </View>

      {/* Beaker (8-color Mixbox) */}
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={{ flexDirection: 'row', height: 180, gap: 4 }}>
          <View style={{ width: 32, justifyContent: 'flex-end' }}>
            {[100, 80, 60, 40, 20, 0].map((t) => (
              <View key={t} style={{ flex: 0.2, justifyContent: 'flex-end', alignItems: 'flex-end', paddingRight: 4 }}>
                <Text style={[styles.tick, { color: c.tertiaryText }]}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.beakerBody, { borderColor: c.cardBorder }]}>
            <View style={{ flex: 1, flexDirection: 'column-reverse' }}>
              {beakerLayers.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: c.tertiaryText, fontSize: FontSize.footnote }}>配比为零</Text>
                </View>
              ) : (
                beakerLayers.map((l) => (
                  <View key={l.key} style={{ flex: l.pct, backgroundColor: l.hex, justifyContent: 'center', alignItems: 'center', minHeight: 1 }}>
                    <Text style={{ fontSize: FontSize.caption1, fontWeight: '700', color: l.textColor }}>
                      {l.label} {l.ml.toFixed(1)}ml
                    </Text>
                  </View>
                ))
              )}
            </View>
            <View style={styles.reflection} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs }}>
          {EXTENDED_MIXING_COLORS.map((p, i) => {
            const v = ratios[i] ?? 0;
            if (v < 0.5) return null;
            return (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={[styles.legendDot, { backgroundColor: p.hex }]} />
                <Text style={[styles.legendText, { color: c.secondaryText }]}>{p.name} {v.toFixed(1)}%</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderRadius: 12, padding: Spacing.md, marginHorizontal: Spacing.md, marginBottom: Spacing.xs, borderWidth: StyleSheet.hairlineWidth },
  swatch: { width: 60, height: 60, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  hex: { fontSize: FontSize.title2, fontWeight: '700', fontFamily: FontMono },
  rgb: { fontSize: FontSize.footnote, marginTop: 2, fontFamily: FontMono },
  chip: { fontSize: FontSize.caption2, fontFamily: FontMono },
  hsbLab: { fontSize: FontSize.caption2, marginTop: 3, fontFamily: FontMono },
  badge: { borderRadius: 6, paddingHorizontal: Spacing.xs, paddingVertical: 3 },
  badgeDefault: { borderRadius: 6, paddingHorizontal: Spacing.xs, paddingVertical: 3 },
  badgeText: { color: '#111', fontSize: FontSize.caption2, fontWeight: '700' },

  sectionTitle: { fontSize: FontSize.caption1, fontWeight: '700', marginBottom: Spacing.xs, textTransform: 'uppercase' as any },
  ralSwatch: { width: MinTouchTarget, height: MinTouchTarget, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  ralText: { fontSize: FontSize.title3, fontWeight: '700', fontFamily: FontMono },
  ralName: { fontSize: FontSize.footnote, marginTop: 2 },

  volRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  volLabel: { fontSize: FontSize.subheadline },
  volInput: { fontSize: FontSize.title3, fontWeight: '700', borderRadius: 8, padding: 6, width: 56, textAlign: 'center', borderWidth: StyleSheet.hairlineWidth },
  volUnit: { fontSize: FontSize.subheadline },

  beakerBody: { flex: 1, backgroundColor: '#0D0D0D', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tick: { fontSize: FontSize.caption2 },
  reflection: { position: 'absolute', left: 4, top: 14, width: 5, height: 120, backgroundColor: '#fff', opacity: 0.08, borderRadius: 3 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  legendText: { fontSize: FontSize.caption2, fontFamily: FontMono },
});
