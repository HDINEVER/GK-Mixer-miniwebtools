// GK Mixer Mobile - 5-Tab 壳
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootTabs from './src/navigation/RootTabs';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
