import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Tab 4: 基础混色台
 * 对应网页 BasicColorMixer.tsx
 * 待移植: 基础色网格 (BASE_MIXING_COLORS/EXTENDED_MIXING_COLORS 已就绪)
 */
export default function BasicMixerScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🖌️</Text>
      <Text style={styles.title}>基础混色台</Text>
      <Text style={styles.desc}>
        快速基础色混合{'\n'}
        5色/8色体系数据已就绪{'\n'}
        网格 UI 待移植
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
