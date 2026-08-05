import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  convertHexToAllSpaces,
  findNearestPaints,
  findNearestRAL,
  calculateMixboxRatios,
  calculateProfessionalRecipe,
  EXTENDED_MIXING_COLORS,
  type ColorData,
  type PaintBrand,
  type RALColor,
} from '@gk-mixer/core';

const VOLUMES = [10, 20, 30, 50, 100];

export default function MixerScreen() {
  const [hexInput, setHexInput] = useState('FF9900');
  const [bottleVolume, setBottleVolume] = useState(20);
  const animValues = useRef<Animated.Value[]>([]);

  const colorData: ColorData = useMemo(() => convertHexToAllSpaces(`#${hexInput.replace(/^#/, '')}`), [hexInput]);
  const ralMatch: RALColor | null = useMemo(() => findNearestRAL(colorData.rgb), [colorData]);
  const nearestPaints: PaintBrand[] = useMemo(() => findNearestPaints(colorData.hex, 3), [colorData.hex]);
  const recipe = useMemo(() => calculateProfessionalRecipe(colorData.hex), [colorData.hex]);
  const mixRatios = useMemo(() => calculateMixboxRatios(colorData.hex, 'srgb', true), [colorData.hex]);

  // Normalize 8-color ratios to percentages and pair with palette
  const layers = useMemo(() => {
    return mixRatios
      .map((r, i) => ({
        ratio: r,
        paint: EXTENDED_MIXING_COLORS[i],
        volume: ((r / 100) * bottleVolume).toFixed(1),
      }))
      .filter(l => l.ratio > 1)
      .sort((a, b) => b.ratio - a.ratio);
  }, [mixRatios, bottleVolume]);

  // Animate layer heights on change
  useEffect(() => {
    // Ensure enough anim values
    while (animValues.current.length < layers.length) {
      animValues.current.push(new Animated.Value(0));
    }
    const animations = layers.map((_, i) => {
      animValues.current[i]?.setValue(0);
      return Animated.timing(animValues.current[i]!, {
        toValue: 1,
        duration: 500,
        delay: i * 80,
        useNativeDriver: false,
      });
    });
    Animated.stagger(80, animations).start();
  }, [layers]);

  const hex = colorData.hex;
  const { rgb, cmyk, hsb, lab } = colorData;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={layers}
      keyExtractor={(item, i) => `${item.paint.code}-${i}`}
      ListHeaderComponent={
        <View>
          {/* Color Input */}
          <View style={styles.inputRow}>
            <Text style={styles.hash}>#</Text>
            <TextInput
              style={styles.hexInput}
              value={hexInput}
              onChangeText={(t) => setHexInput(t.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
              maxLength={6}
              autoCapitalize="none"
              placeholderTextColor="#555"
            />
          </View>

          {/* Color Swatch + Data */}
          <View style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: hex }]} />
            <View style={styles.colorData}>
              <Text style={styles.hexLabel}>{hex}</Text>
              <Text style={styles.dataLine}>RGB  {rgb.r}, {rgb.g}, {rgb.b}</Text>
              <Text style={styles.dataLine}>CMYK {cmyk.c}, {cmyk.m}, {cmyk.y}, {cmyk.k}</Text>
              <Text style={styles.dataLine}>HSB  {hsb.h}° {hsb.s}% {hsb.b}%</Text>
            </View>
          </View>

          {/* RAL Match */}
          {ralMatch && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 RAL 标准色</Text>
              <View style={styles.ralCard}>
                <View style={[styles.ralSwatch, { backgroundColor: ralMatch.hex }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ralName}>RAL {ralMatch.ral} {ralMatch.name}</Text>
                  <Text style={styles.ralHex}>{ralMatch.hex}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bottle Volume */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 烧杯容量 (ml)</Text>
            <View style={styles.volumeRow}>
              {VOLUMES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.volumeBtn, bottleVolume === v && styles.volumeBtnActive]}
                  onPress={() => setBottleVolume(v)}
                >
                  <Text style={[styles.volumeText, bottleVolume === v && styles.volumeTextActive]}>
                    {v}ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Layers Header */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 混合比例</Text>
          </View>
        </View>
      }
      renderItem={({ item, index }) => (
        <Animated.View
          style={{
            opacity: animValues.current[index] ?? new Animated.Value(1),
            transform: [{
              translateY: (animValues.current[index] ?? new Animated.Value(1)).interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          }}
        >
          <View style={styles.layerRow}>
            <View style={[styles.layerBar, { flex: item.ratio, backgroundColor: item.paint.hex }]} />
            <View style={{ flex: 100 - item.ratio }} />
            <Text style={styles.layerLabel}>{item.paint.name}</Text>
            <View style={styles.layerVol}>
              <Text style={styles.layerVolText}>{item.ratio.toFixed(0)}%</Text>
              <Text style={styles.layerMl}>{item.volume}ml</Text>
            </View>
          </View>
        </Animated.View>
      )}
      ListFooterComponent={
        nearestPaints.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎨 最近漆料匹配</Text>
            {nearestPaints.map((p) => (
              <View key={p.id} style={styles.paintRow}>
                <View style={[styles.paintSwatch, { backgroundColor: p.hex }]} />
                <Text style={styles.paintName}>{p.brand} {p.code} {p.name}</Text>
              </View>
            ))}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, paddingBottom: 120 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 12, paddingHorizontal: 16, marginBottom: 16,
  },
  hash: { color: '#FF9900', fontSize: 24, fontWeight: '700', marginRight: 4 },
  hexInput: { flex: 1, color: '#fff', fontSize: 24, fontFamily: 'monospace', paddingVertical: 14 },
  swatchRow: { flexDirection: 'row', marginBottom: 20 },
  swatch: { width: 80, height: 80, borderRadius: 16, marginRight: 16, borderWidth: 1, borderColor: '#333' },
  colorData: { flex: 1, justifyContent: 'center' },
  hexLabel: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  dataLine: { color: '#999', fontSize: 12, fontFamily: 'monospace', marginBottom: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  ralCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12 },
  ralSwatch: { width: 40, height: 40, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#333' },
  ralName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  ralHex: { color: '#888', fontSize: 12, fontFamily: 'monospace', marginTop: 2 },
  volumeRow: { flexDirection: 'row', gap: 8 },
  volumeBtn: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  volumeBtnActive: { backgroundColor: '#FF9900' },
  volumeText: { color: '#888', fontSize: 13, fontWeight: '600' },
  volumeTextActive: { color: '#111', fontWeight: '700' },
  layerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  layerBar: { height: 36, borderRadius: 8 },
  layerLabel: { color: '#ccc', fontSize: 13, fontWeight: '500', marginLeft: 10, minWidth: 50 },
  layerVol: { alignItems: 'flex-end', minWidth: 60, marginLeft: 8 },
  layerVolText: { color: '#FF9900', fontSize: 14, fontWeight: '700' },
  layerMl: { color: '#666', fontSize: 11 },
  paintRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 10, padding: 10, marginBottom: 6 },
  paintSwatch: { width: 28, height: 28, borderRadius: 6, marginRight: 10, borderWidth: 1, borderColor: '#333' },
  paintName: { color: '#ccc', fontSize: 13 },
});
