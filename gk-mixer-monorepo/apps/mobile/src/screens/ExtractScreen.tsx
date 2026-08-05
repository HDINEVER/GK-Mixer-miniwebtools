import React, { useCallback, useState } from 'react';

declare function atob(encoded: string): string;
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
import { decode } from 'jpeg-js';
import { extractProminentColorsFromPixels, type ColorData } from '@gk-mixer/core';

export default function ExtractScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(false);

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

      // Decode JPEG base64 → RGBA pixel array
      if (!asset.base64) {
        Alert.alert('错误', '无法读取图片数据');
        return;
      }
      const binaryStr = atob(asset.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const jpeg = decode(bytes, { useTArray: true });
      const pixels = new Uint8ClampedArray(
        jpeg.data.buffer,
        jpeg.data.byteOffset,
        jpeg.data.byteLength,
      );

      // Feed to core (shared with web)
      const extracted = extractProminentColorsFromPixels(pixels, { count: 5 });
      setColors(extracted);
    } catch (error: any) {
      Alert.alert('提取失败', error.message ?? '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  const renderColor = ({ item }: { item: ColorData }) => (
    <View style={styles.colorCard}>
      <View style={[styles.swatch, { backgroundColor: item.hex }]} />
      <View style={styles.colorInfo}>
        <Text style={styles.hexLabel}>{item.hex}</Text>
        <Text style={styles.rgbLabel}>
          RGB({item.rgb.r},{item.rgb.g},{item.rgb.b})
        </Text>
        <Text style={styles.cmykLabel}>
          CMYK {item.cmyk.c}/{item.cmyk.m}/{item.cmyk.y}/{item.cmyk.k}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={styles.placeholderText}>选择一张图片</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.pickButton}
        onPress={pickAndExtract}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" size="small" />
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
  placeholder: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, marginBottom: 12 },
  placeholderIcon: { fontSize: 48, marginBottom: 8 },
  placeholderText: { color: '#666', fontSize: 14 },
  preview: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: '#1A1A1A' },
  pickButton: { backgroundColor: '#FF9900', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  pickButtonText: { color: '#111', fontSize: 16, fontWeight: '700' },
  list: { flex: 1 },
  colorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 8 },
  swatch: { width: 56, height: 56, borderRadius: 10, marginRight: 14, borderWidth: 1, borderColor: '#333' },
  colorInfo: { flex: 1 },
  hexLabel: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 2 },
  rgbLabel: { color: '#999', fontSize: 12 },
  cmykLabel: { color: '#666', fontSize: 11, marginTop: 2 },
});
