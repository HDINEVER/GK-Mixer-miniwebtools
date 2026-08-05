import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ExtractScreen from '../screens/ExtractScreen';
import MixerScreen from '../screens/MixerScreen';
import RadialMixerScreen from '../screens/RadialMixerScreen';
import BasicMixerScreen from '../screens/BasicMixerScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Extract: undefined;
  Mixer: undefined;
  RadialMixer: undefined;
  BasicMixer: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * iOS 底部 Dock (5 Tab) - 按用户定义:
 * 1 图像输入+提取颜色 | 2 Mixbox 核心算法区 | 3 自选混色台 | 4 基础混色台 | 5 设置
 */
export default function RootTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Mixer"
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#FF9900',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#151515', borderTopColor: '#333' },
      }}
    >
      <Tab.Screen name="Extract" component={ExtractScreen} options={{ title: '拾色器', tabBarLabel: '拾色', tabBarIcon: () => <TextIcon glyph="📷" /> }} />
      <Tab.Screen name="Mixer" component={MixerScreen} options={{ title: '混色台', tabBarLabel: '混色', tabBarIcon: () => <TextIcon glyph="🧪" /> }} />
      <Tab.Screen name="RadialMixer" component={RadialMixerScreen} options={{ title: '自选混色台', tabBarLabel: '自选', tabBarIcon: () => <TextIcon glyph="🎨" /> }} />
      <Tab.Screen name="BasicMixer" component={BasicMixerScreen} options={{ title: '基础混色台', tabBarLabel: '基础', tabBarIcon: () => <TextIcon glyph="🖌️" /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '设置', tabBarLabel: '设置', tabBarIcon: () => <TextIcon glyph="⚙️" /> }} />
    </Tab.Navigator>
  );
}

// 占位图标: 后续换 @expo/vector-icons (Expo) 或 SF Symbols (原生)
function TextIcon({ glyph }: { glyph: string }) {
  return <Text style={{ fontSize: 18 }}>{glyph}</Text>;
}

import { Text } from 'react-native';
