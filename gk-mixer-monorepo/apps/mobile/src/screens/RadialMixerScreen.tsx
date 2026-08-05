import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Tab 3: 自选混色台
 * 对应网页 RadialPaletteMixer.tsx (拖拽圆形混合)
 * 待移植: 手势 (react-native-gesture-handler) + 动画 (reanimated)
 */
export default function RadialMixerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎨</Text>
      <Text style={styles.title}>自选混色台</Text>
      <Text style={styles.desc}>
        径向拖拽混合{'\n'}
        手势 + 物理动画 (待移植){'\n'}
        calculateMixboxRatios 算法已就绪
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#111' },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  desc: { color: '#999', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
