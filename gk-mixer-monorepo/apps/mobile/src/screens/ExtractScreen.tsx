import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { Buffer } from 'buffer';
import { decode } from 'jpeg-js';
import {
  extractProminentColorsFromPixels,
  convertHexToAllSpaces,
  hexToRgb,
  rgbToHex,
  rgbToHsb,
  rgbToLab,
  rgbToCmyk,
  type ColorData,
} from '@gk-mixer/core';
import { useTargetColor } from '../context/ColorContext';
import { Colors, FontSize, Spacing, MinTouchTarget } from '../theme';
import { NativeModules } from 'react-native';

const NativeColorPicker: { showColorPicker(hex: string): Promise<string> } | undefined =
  NativeModules.ColorPickerModule;

(globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;

// atob-based base64 decode (avoids Buffer.from bugs in Hermes)
declare function atob(s: string): string;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  const str = atob(clean);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

export default function ExtractScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() !== 'light';
  const c = isDark ? Colors.dark : Colors.light;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(false);
  const { targetColor, setTargetColor, setExtractedColors } = useTargetColor();

  // Manual picking state
  const [isPicking, setIsPicking] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [manualHex, setManualHex] = useState('');
  const [showHexInput, setShowHexInput] = useState(false);

  // Decoded image data for manual pixel picking
  const pixelDataRef = useRef<{ pixels: Uint8ClampedArray; w: number; h: number } | null>(null);
  const imageLayoutRef = useRef({ x: 0, y: 0, w: 300, h: 180 });

  // ── Auto Extract ──
  const pickAndExtract = useCallback(async () => {
    try {
      setLoading(true);
      setIsPicking(false);
      const result = await launchImageLibrary({ mediaType: 'photo', includeBase64: true, maxWidth: 300, maxHeight: 300, quality: 0.9 });
      if (result.didCancel || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImageUri(asset.uri ?? null);
      if (!asset.base64) { Alert.alert('错误', '无法读取图片数据'); return; }

      const bytes = base64ToBytes(asset.base64);
      const jpeg = decode(bytes, { useTArray: true });
      const pixels = new Uint8ClampedArray(jpeg.data.buffer, jpeg.data.byteOffset, jpeg.data.byteLength);

      // Store for manual picking
      pixelDataRef.current = { pixels, w: jpeg.width, h: jpeg.height };

      const extracted = extractProminentColorsFromPixels(pixels, { count: 5 });
      setColors(extracted);
      setExtractedColors(extracted);
      if (extracted.length > 0) setTargetColor(extracted[0]);
    } catch (error: any) {
      Alert.alert('提取失败', error.message ?? String(error));
    } finally { setLoading(false); }
  }, [setTargetColor]);

  // ── Manual Pick (tap on image) ──
  const handleImagePress = useCallback((e: any) => {
    if (!isPicking) return;
    const data = pixelDataRef.current;
    if (!data) return;
    const { pageX, pageY } = e.nativeEvent;
    const layout = imageLayoutRef.current;

    // Map touch to image pixel
    const relX = pageX - layout.x;
    const relY = pageY - layout.y;
    const imgScaleX = data.w / layout.w;
    const imgScaleY = data.h / layout.h;
    const px = Math.floor(relX * imgScaleX);
    const py = Math.floor(relY * imgScaleY);
    if (px < 0 || px >= data.w || py < 0 || py >= data.h) return;

    const idx = (py * data.w + px) * 4;
    const r = data.pixels[idx], g = data.pixels[idx + 1], b = data.pixels[idx + 2];
    const hex = rgbToHex(r, g, b);
    const newColor: ColorData = {
      id: Math.random().toString(36).substr(2, 9),
      hex,
      rgb: { r, g, b },
      cmyk: rgbToCmyk(r, g, b),
      hsb: rgbToHsb(r, g, b),
      lab: rgbToLab(r, g, b),
      source: 'manual',
    };
    setColors(prev => [newColor, ...prev]);
    setExtractedColors([newColor, ...colors]);
    setTargetColor(newColor);
    if (!isContinuous) setIsPicking(false);
  }, [isPicking, isContinuous, setTargetColor, setExtractedColors, colors]);

  // ── Manual Hex Input ──
  const handleHexSubmit = useCallback(() => {
    const hex = manualHex.replace(/[^#0-9a-fA-F]/g, '').slice(0, 7);
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) { Alert.alert('格式错误', '请输入 #RRGGBB 格式'); return; }
    const color = convertHexToAllSpaces(hex);
    setColors(prev => [color, ...prev]);
    setExtractedColors([color, ...colors]);
    setTargetColor(color);
    setManualHex('');
    setShowHexInput(false);
  }, [manualHex, setTargetColor]);

  // ── Native iOS Color Picker ──
  const openNativePicker = useCallback(async () => {
    if (!NativeColorPicker) {
      Alert.alert('不支持', '原生取色不可用');
      return;
    }
    try {
      const initialHex = targetColor?.hex ?? '#FF9900';
      const hex = await NativeColorPicker.showColorPicker(initialHex);
      const color = convertHexToAllSpaces(hex);
      setColors(prev => [color, ...prev]);
      setExtractedColors([color, ...colors]);
      setTargetColor(color);
    } catch (e) {
      // User cancelled
    }
  }, [targetColor, setTargetColor, setExtractedColors, colors]);

  const togglePick = () => {
    if (!imageUri) return;
    const next = !isPicking;
    setIsPicking(next);
    if (!next) setIsContinuous(false);
  };

  const toggleContinuous = () => {
    if (!imageUri) return;
    const next = !isContinuous;
    setIsContinuous(next);
    if (next) setIsPicking(true);
    else setIsPicking(false);
  };

  // ── Render color item ──
  const renderColor = ({ item }: { item: ColorData }) => (
    <TouchableOpacity
      style={[styles.colorCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}
      onPress={() => setTargetColor(item)}
      onLongPress={() => {
        setColors(prev => prev.filter(cl => cl.id !== item.id));
        setExtractedColors(colors.filter(cl => cl.id !== item.id));
        if (targetColor?.id === item.id) setTargetColor(null);
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.swatch, { backgroundColor: item.hex }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.hexLabel, { color: c.primaryText }]}>
          {item.source === 'auto' ? '🤖 ' : '👆 '}{item.hex}
        </Text>
        <Text style={[styles.rgbLabel, { color: c.secondaryText }]}>RGB {item.rgb.r},{item.rgb.g},{item.rgb.b}</Text>
      </View>
      <Text style={{ color: c.accent, fontSize: FontSize.caption2, fontWeight: '600' }}>设目标</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top + Spacing.md }]}>
      {/* Image area */}
      {imageUri ? (
        <TouchableOpacity activeOpacity={1} onPress={handleImagePress}
          onLayout={(e) => { imageLayoutRef.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y, w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          {isPicking && (
            <View style={styles.pickOverlay}>
              <Text style={styles.pickOverlayText}>
                {isContinuous ? '连续吸取中...每点添加一个颜色' : '点击图片吸取颜色'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={[styles.placeholderText, { color: c.tertiaryText }]}>选择一张图片开始取色</Text>
        </View>
      )}

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={[styles.pickButton, { backgroundColor: c.accent }]} onPress={pickAndExtract} disabled={loading}>
          {loading ? <ActivityIndicator color="#111" /> : <Text style={styles.pickButtonText}>📷 自动提取</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickButton, { backgroundColor: c.card, borderColor: c.accent, borderWidth: 1, flex: 0.45, marginLeft: Spacing.xs }]} onPress={openNativePicker}>
          <Text style={[styles.pickButtonText, { color: c.accent }]}>🎨 iOS 取色</Text>
        </TouchableOpacity>
      </View>

      {/* Manual pick controls */}
      {imageUri && (
        <View style={styles.manualRow}>
          <TouchableOpacity style={[styles.manualBtn, { backgroundColor: isPicking ? c.accent : c.card, borderColor: isPicking ? c.accent : c.cardBorder }]}
            onPress={togglePick}>
            <Text style={[styles.manualBtnText, { color: isPicking ? '#111' : c.primaryText }]}>
              {isPicking ? '✓ 手动吸取' : '👆 手动吸取'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.manualBtn, { backgroundColor: isContinuous ? c.accent : c.card, borderColor: isContinuous ? c.accent : c.cardBorder }]}
            onPress={toggleContinuous}>
            <Text style={[styles.manualBtnText, { color: isContinuous ? '#111' : c.primaryText }]}>
              {isContinuous ? '✓ 连续吸取' : '🔄 连续吸取'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.manualBtn, { backgroundColor: c.card, borderColor: c.cardBorder }]}
            onPress={() => setShowHexInput(true)}>
            <Text style={[styles.manualBtnText, { color: c.primaryText }]}># 输入</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hex input modal */}
      {showHexInput && (
        <View style={[styles.hexInputRow, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <TextInput style={[styles.hexField, { color: c.primaryText, borderColor: c.divider }]}
            value={manualHex} onChangeText={setManualHex} placeholder="#FF9900" placeholderTextColor={c.tertiaryText}
            autoFocus maxLength={7} />
          <TouchableOpacity style={[styles.hexSubmit, { backgroundColor: c.accent }]} onPress={handleHexSubmit}>
            <Text style={styles.hexSubmitText}>添加</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowHexInput(false); setManualHex(''); }}>
            <Text style={{ color: c.tertiaryText, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Color list */}
      {colors.length > 0 && (
        <FlatList data={colors} renderItem={renderColor} keyExtractor={(it) => it.id}
          style={styles.list} contentContainerStyle={{ paddingBottom: 120 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md },
  placeholder: { height: 180, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginBottom: Spacing.xs, borderWidth: StyleSheet.hairlineWidth },
  placeholderIcon: { fontSize: 48, marginBottom: Spacing.xs },
  placeholderText: { fontSize: FontSize.subheadline },
  preview: { width: '100%', height: 180, borderRadius: 12 },
  pickOverlay: { position: 'absolute', inset: 0, backgroundColor: '#FF990040', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pickOverlayText: { color: '#111', fontSize: FontSize.body, fontWeight: '700' },

  toolbar: { flexDirection: 'row', marginTop: Spacing.xs, marginBottom: Spacing.xxs },
  pickButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', minHeight: MinTouchTarget },
  pickButtonText: { color: '#111', fontSize: FontSize.callout, fontWeight: '700' },

  manualRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.xs },
  manualBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, minHeight: 36 },
  manualBtnText: { fontSize: FontSize.caption1, fontWeight: '600' },

  hexInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10, marginBottom: Spacing.xs, borderWidth: StyleSheet.hairlineWidth },
  hexField: { flex: 1, fontSize: FontSize.callout, borderBottomWidth: 1, paddingVertical: 4, paddingHorizontal: 8 },
  hexSubmit: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  hexSubmitText: { color: '#111', fontSize: FontSize.footnote, fontWeight: '700' },

  list: { flex: 1 },
  colorCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: Spacing.sm,
    marginBottom: Spacing.xxs, borderWidth: StyleSheet.hairlineWidth, minHeight: 68,
  },
  swatch: { width: 48, height: 48, borderRadius: 10, marginRight: Spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF20' },
  hexLabel: { fontSize: FontSize.footnote, fontWeight: '600', marginBottom: 2 },
  rgbLabel: { fontSize: FontSize.caption2 },
});
