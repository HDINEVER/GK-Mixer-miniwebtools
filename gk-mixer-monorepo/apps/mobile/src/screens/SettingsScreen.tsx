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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, MinTouchTarget, FontMono } from '../theme';

type Language = 'zh' | 'en' | 'ja';
const LANGS: { key: Language; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() !== 'light';
  const c = isDark ? Colors.dark : Colors.light;
  const systemDark = useColorScheme() === 'dark';
  const [lang, setLang] = useState<Language>('zh');
  const [followSystem, setFollowSystem] = useState(true);
  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const sections = (gap = Spacing.xl) => ({ marginTop: gap });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: 120 }}
    >
      {/* ── Appearance ── */}
      <Text style={[styles.sectionHeader, { color: c.accent }]}>外观</Text>

      <View style={[styles.group, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={[styles.groupRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }]}>
          <Text style={[styles.rowLabel, { color: c.primaryText }]}>语言</Text>
          <View style={styles.langRow}>
            {LANGS.map((l) => {
              const active = lang === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  style={[
                    styles.langBtn,
                    { height: MinTouchTarget - 4 },
                    active
                      ? { backgroundColor: c.accent }
                      : { backgroundColor: c.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider },
                  ]}
                  onPress={() => setLang(l.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.langText,
                      active ? { color: '#111', fontWeight: '700' } : { color: c.secondaryText },
                    ]}
                  >
                    {l.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.groupRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: c.primaryText }]}>跟随系统深色模式</Text>
            <Text style={[styles.rowHint, { color: c.tertiaryText }]}>
              当前: {systemDark ? '深色' : '浅色'}
            </Text>
          </View>
          <Switch
            value={followSystem}
            onValueChange={setFollowSystem}
            trackColor={{ false: c.divider, true: c.accent }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.groupRow}>
          <Text style={[styles.rowLabel, { color: c.primaryText }]}>App 图标</Text>
          <Text style={[styles.rowValue, { color: c.tertiaryText }]}>默认</Text>
        </View>
      </View>

      {/* ── Premium ── */}
      <Text style={[styles.sectionHeader, { color: c.accent, ...sections() }]}>高级功能</Text>

      <TouchableOpacity
        style={[styles.premiumCard, { backgroundColor: c.card, borderColor: c.accent }]}
        onPress={() => {}}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.premiumTitle, { color: c.accent }]}>🚀 GK Mixer Pro</Text>
          <Text style={[styles.premiumDesc, { color: c.secondaryText }]}>
            解锁无限取色 · AI 配方 · 自定义漆料库
          </Text>
        </View>
        <Text style={[styles.premiumArrow, { color: c.accent }]}>›</Text>
      </TouchableOpacity>

      {/* ── Developer ── */}
      <Text style={[styles.sectionHeader, { color: c.accent, ...sections() }]}>开发者</Text>

      <View style={[styles.group, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={[styles.groupRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }]}>
          <Text style={[styles.rowLabel, { color: c.primaryText }]}>开发者</Text>
          <Text style={[styles.rowValue, { color: c.secondaryText, fontSize: FontSize.body }]}>@HDIN</Text>
        </View>
        <View style={styles.groupRow}>
          <Text style={[styles.rowValue, { color: c.tertiaryText }]}>为模型爱好者打造</Text>
        </View>
      </View>

      {/* ── Social ── */}
      <Text style={[styles.sectionHeader, { color: c.accent, ...sections() }]}>讨论群</Text>

      <View style={[styles.group, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        {[
          ['📺', 'Bilibili', 'https://space.bilibili.com/23848833'],
          ['𝕏', 'X / Twitter', 'https://x.com/rfQ4nGLccl4bqCP'],
          ['🐧', 'QQ 功能讨论群', 'https://qm.qq.com/q/QtX0ZBOWIe'],
        ].map(([icon, label, url], i, arr) => (
          <TouchableOpacity
            key={label}
            style={[
              styles.socialRow,
              i < arr.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.divider,
              },
            ]}
            onPress={() => openLink(url)}
            activeOpacity={0.5}
          >
            <View style={styles.socialIconBox}>
              <Text style={styles.socialIcon}>{icon}</Text>
            </View>
            <Text style={[styles.socialLabel, { color: c.primaryText }]}>{label}</Text>
            <Text style={[styles.arrow, { color: c.tertiaryText }]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Thanks ── */}
      <Text style={[styles.sectionHeader, { color: c.accent, ...sections() }]}>特别鸣谢</Text>

      <View style={[styles.group, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={styles.groupRow}>
          <Text style={[styles.rowLabel, { color: c.primaryText }]}>✨ スミレ</Text>
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: c.tertiaryText }]}>
          © 2025 GK-Mixer
        </Text>
        <Text style={[styles.footerSub, { color: c.tertiaryText }]}>
          Powered by Mixbox 2.0 · RAL Color Library
        </Text>
        <Text style={[styles.footerSub, { color: c.tertiaryText, marginTop: 2 }]}>
          v0.0.1 · iOS 26
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Section header
  sectionHeader: {
    fontSize: FontSize.footnote,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.md + 4,
    paddingBottom: 6,
  },

  // Grouped list (iOS style)
  group: {
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: MinTouchTarget,
  },

  // Language picker
  langRow: { flexDirection: 'row', gap: 6, marginTop: Spacing.xs },
  langBtn: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  langText: { fontSize: FontSize.footnote },

  // Standard rows
  rowLabel: { fontSize: FontSize.body, flex: 1 },
  rowHint: { fontSize: FontSize.caption2, marginTop: 3 },
  rowValue: { fontSize: FontSize.footnote, fontFamily: FontMono },

  // Premium card
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1.5,
  },
  premiumTitle: { fontSize: FontSize.callout, fontWeight: '700', fontFamily: FontMono },
  premiumDesc: { fontSize: FontSize.footnote, marginTop: 4 },
  premiumArrow: { fontSize: 28, marginLeft: Spacing.xs },

  // Social links
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    minHeight: MinTouchTarget,
  },
  socialIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#00000010',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  socialIcon: { fontSize: 16 },
  socialLabel: { fontSize: FontSize.body, flex: 1 },
  arrow: { fontSize: 20, marginLeft: Spacing.xs },

  // Footer
  footer: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingBottom: 60 },
  footerText: { fontSize: FontSize.footnote },
  footerSub: { fontSize: FontSize.caption2, marginTop: 4 },
});
