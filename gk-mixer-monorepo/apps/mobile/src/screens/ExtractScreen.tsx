import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Buffer } from 'buffer';
import { decode } from 'jpeg-js';
import {
  extractProminentColorsFromPixels,
  convertHexToAllSpaces,
  type ColorData,
} from '@gk-mixer/core';
import { useTargetColor } from '../context/ColorContext';

// RN doesn't auto-polyfill Buffer globally — jpeg-js needs it
(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

export default function ExtractScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(false);
  const { setTargetColor } = useTargetColor();

  const pickAndExtract = useCallback(async () => {
    try {
      setLoading(true);
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.9,
      });

      if (result.didCancel || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImageUri(asset.uri ?? null);

      if (!asset.base64) {
        Alert.alert('错误', '无法读取图片数据');
        return;
      }

      // Buffer polyfill provides proper base64 decoding
      const bytes = Buffer.from(asset.base64, 'base64');
      const jpeg = decode(bytes, { useTArray: true });
      const pixels = new Uint8ClampedArray(
        jpeg.data.buffer,
        jpeg.data.byteOffset,
        jpeg.data.byteLength,
      );

      const extracted = extractProminentColorsFromPixels(pixels, { count: 5 });
      setColors(extracted);

      // Auto-set the dominant color as shared target (→ Mixer tab picks it up)
      if (extracted.length > 0) {
        setTargetColor(extracted[0]);
      }
    } catch (error: any) {
      Alert.alert('提取失败', error.message ?? String(error));
    } finally {
      setLoading(false);
    }
  }, [setTargetColor]);

  const pickTarget = useCallback(
    (item: ColorData) => {
      setTargetColor(item);
    },
    [setTargetColor],
  );

  const renderColor = ({ item, index }: { item: ColorData; index: number }) => (
    <TouchableOpacity style={styles.colorCard} onPress={() => pickTarget(item)}>
      <View style={[styles.swatch, { backgroundColor: item.hex }]} />
      <View style={styles.colorInfo}>
        <Text style={styles.hexLabel}>
          {index === 0 && '★ '}{item.hex}
        </Text>
        <Text style={styles.rgbLabel}>
          RGB({item.rgb.r},{item.rgb.g},{item.rgb.b})
        </Text>
        <Text style={styles.cmykLabel}>
          CMYK {item.cmyk.c}/{item.cmyk.m}/{item.cmyk.y}/{item.cmyk.k}
        </Text>
      </View>
      <Text style={styles.tapHint}>设为{'\n'}目标</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={styles.placeholderText}>选择一张图片提取主色</Text>
        </View>
      )}

      <TouchableOpacity style={styles.pickButton} onPress={pickAndExtract} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={styles.pickButtonText}>📷 从相册选图并提取颜色</Text>
        )}
      </TouchableOpacity>

      {colors.length > 0 && (
        <FlatList
          data={colors}
          renderItem={renderColor}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 16 },
  placeholder: { height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, marginBottom: 12 },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { color: '#666', fontSize: 14 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12, backgroundColor: '#1A1A1A' },
  pickButton: { backgroundColor: '#FF9900', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  pickButtonText: { color: '#111', fontSize: 16, fontWeight: '700' },
  list: { flex: 1 },
  colorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8 },
  swatch: { width: 52, height: 52, borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: '#333' },
  colorInfo: { flex: 1 },
  hexLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  rgbLabel: { color: '#999', fontSize: 12 },
  cmykLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  tapHint: { color: '#FF9900', fontSize: 10, fontWeight: '600', textAlign: 'center', paddingLeft: 6 },
});
