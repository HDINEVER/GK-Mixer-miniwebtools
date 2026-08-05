import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Tab 5: 设置
 * 对应网页 App.tsx 的主题/语言/色彩空间切换
 * 待移植: 深色模式、三语切换、色彩空间 (sRGB/P3/Adobe RGB)、默认烧杯容量
 */
export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚙️</Text>
      <Text style={styles.title}>设置</Text>
      <Text style={styles.desc}>
        主题 / 语言 / 色彩空间{'\n'}
        默认烧杯容量{'\n'}
        类型定义已就绪
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
