import React from 'react';
import { Text, useColorScheme } from 'react-native';
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

function TabIcon({ glyph }: { glyph: string }) {
  return <Text style={{ fontSize: 20, lineHeight: 24 }}>{glyph}</Text>;
}

export default function RootTabs() {
  const isDark = useColorScheme() === 'dark';

  return (
    <Tab.Navigator
      initialRouteName="Mixer"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF9900',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          backgroundColor: isDark ? '#151515' : '#fff',
          borderTopColor: isDark ? '#333' : '#e5e5e5',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: -2 },
      }}
    >
      <Tab.Screen
        name="Extract"
        component={ExtractScreen}
        options={{
          tabBarLabel: '拾色',
          tabBarIcon: () => <TabIcon glyph="📷" />,
        }}
      />
      <Tab.Screen
        name="Mixer"
        component={MixerScreen}
        options={{
          tabBarLabel: '混色',
          tabBarIcon: () => <TabIcon glyph="🧪" />,
        }}
      />
      <Tab.Screen
        name="RadialMixer"
        component={RadialMixerScreen}
        options={{
          tabBarLabel: '自选',
          tabBarIcon: () => <TabIcon glyph="🎨" />,
        }}
      />
      <Tab.Screen
        name="BasicMixer"
        component={BasicMixerScreen}
        options={{
          tabBarLabel: '基础',
          tabBarIcon: () => <TabIcon glyph="🖌️" />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '设置',
          tabBarIcon: () => <TabIcon glyph="⚙️" />,
        }}
      />
    </Tab.Navigator>
  );
}
