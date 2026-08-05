import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

type Language = 'zh' | 'en' | 'ja';
const LANGS: { key: Language; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

export default function SettingsScreen() {
  const systemDark = useColorScheme() === 'dark';
  const [lang, setLang] = useState<Language>('zh');
  const [followSystem, setFollowSystem] = useState(true);

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
      {/* ── Appearance ── */}
      <Text style={styles.section}>外观</Text>

      <View style={styles.card}>
        <Text style={styles.rowLabel}>语言 / Language</Text>
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.key}
              style={[styles.langBtn, lang === l.key && styles.langBtnActive]}
              onPress={() => setLang(l.key)}
            >
              <Text style={[styles.langText, lang === l.key && styles.langTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>跟随系统深色模式</Text>
            <Text style={styles.rowHint}>当前: {systemDark ? '深色' : '浅色'}</Text>
          </View>
          <Switch
            value={followSystem}
            onValueChange={setFollowSystem}
            trackColor={{ false: '#444', true: '#FF9900' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={() => {}}>
          <Text style={styles.rowLabel}>App 图标</Text>
          <Text style={styles.rowValue}>默认</Text>
        </TouchableOpacity>
      </View>

      {/* ── Premium ── */}
      <Text style={styles.section}>高级功能</Text>
      <TouchableOpacity style={styles.premiumCard} onPress={() => {}}>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumTitle}>🚀 GK Mixer Pro</Text>
          <Text style={styles.premiumDesc}>解锁无限取色 · AI 配方 · 自定义漆料库</Text>
        </View>
        <Text style={styles.premiumArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Developer ── */}
      <Text style={styles.section}>开发者</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>开发者</Text>
          <Text style={styles.rowValue}>@HDIN</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>为模型爱好者打造</Text>
        </View>
      </View>

      {/* ── Social Links ── */}
      <Text style={styles.section}>讨论群</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => openLink('https://space.bilibili.com/23848833')}
        >
          <Text style={styles.linkIcon}>📺</Text>
          <Text style={styles.linkLabel}>Bilibili</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => openLink('https://x.com/rfQ4nGLccl4bqCP')}
        >
          <Text style={styles.linkIcon}>𝕏</Text>
          <Text style={styles.linkLabel}>X / Twitter</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => openLink('https://qm.qq.com/q/QtX0ZBOWIe')}
        >
          <Text style={styles.linkIcon}>🐧</Text>
          <Text style={styles.linkLabel}>功能讨论群</Text>
          <Text style={styles.linkArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Thanks ── */}
      <Text style={styles.section}>特别鸣谢</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>✨ スミレ</Text>
        </View>
      </View>

      {/* ── Credits ── */}
      <View style={styles.credits}>
        <Text style={styles.creditText}>© 2025 GK-Mixer</Text>
        <Text style={styles.creditSub}>Powered by Mixbox 2.0 · RAL Color Library</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  section: {
    color: '#FF9900',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },

  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowLabel: { color: '#ddd', fontSize: 15, flex: 1 },
  rowHint: { color: '#666', fontSize: 11, marginTop: 2 },
  rowValue: { color: '#888', fontSize: 14 },

  // language picker
  langRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 },
  langBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#2A2A2A', alignItems: 'center',
  },
  langBtnActive: { backgroundColor: '#FF9900' },
  langText: { color: '#888', fontSize: 13, fontWeight: '600' },
  langTextActive: { color: '#111' },

  // premium
  premiumCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, marginHorizontal: 12,
    padding: 16, borderWidth: 1, borderColor: '#FF9900',
  },
  premiumTitle: { color: '#FF9900', fontSize: 16, fontWeight: '700' },
  premiumDesc: { color: '#888', fontSize: 12, marginTop: 4 },
  premiumArrow: { color: '#FF9900', fontSize: 28, marginLeft: 8 },

  // links
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  linkIcon: { fontSize: 16, width: 32, textAlign: 'center' },
  linkLabel: { color: '#ddd', fontSize: 15, flex: 1 },
  linkArrow: { color: '#555', fontSize: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#333' },

  // credits
  credits: { alignItems: 'center', paddingVertical: 24, paddingBottom: 40 },
  creditText: { color: '#555', fontSize: 12 },
  creditSub: { color: '#444', fontSize: 10, marginTop: 4 },
});
