import React from 'react';
import { Platform, Text, useColorScheme } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExtractScreen from '../screens/ExtractScreen';
import MixerScreen from '../screens/MixerScreen';
import RadialMixerScreen from '../screens/RadialMixerScreen';
import BasicMixerScreen from '../screens/BasicMixerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors, FontSize } from '../theme';

export type RootTabParamList = {
  Extract: undefined;
  Mixer: undefined;
  RadialMixer: undefined;
  BasicMixer: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabIcon({ glyph }: { glyph: string }) {
  return <Text style={{ fontSize: 22 }}>{glyph}</Text>;
}

export default function RootTabs() {
  const isDark = useColorScheme() !== 'light';
  const c = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Mixer"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.tertiaryText,
        tabBarStyle: {
          backgroundColor: c.tabBarBg,
          borderTopColor: c.tabBarBorder,
          height: 49 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: Platform.OS === 'ios' ? 10 : FontSize.caption2,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen name="Extract" component={ExtractScreen}
        options={{ tabBarLabel: '拾色', tabBarIcon: () => <TabIcon glyph="📷" /> }} />
      <Tab.Screen name="Mixer" component={MixerScreen}
        options={{ tabBarLabel: '混色', tabBarIcon: () => <TabIcon glyph="🧪" /> }} />
      <Tab.Screen name="RadialMixer" component={RadialMixerScreen}
        options={{ tabBarLabel: '自选', tabBarIcon: () => <TabIcon glyph="🎨" /> }} />
      <Tab.Screen name="BasicMixer" component={BasicMixerScreen}
        options={{ tabBarLabel: '基础', tabBarIcon: () => <TabIcon glyph="🖌️" /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ tabBarLabel: '设置', tabBarIcon: () => <TabIcon glyph="⚙️" /> }} />
    </Tab.Navigator>
  );
}
