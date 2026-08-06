import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootTabs from './src/navigation/RootTabs';
import { ColorProvider } from './src/context/ColorContext';

function App() {
  const isDark = useColorScheme() !== 'light';

  return (
    <SafeAreaProvider>
      <ColorProvider>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <NavigationContainer>
          <RootTabs />
        </NavigationContainer>
      </ColorProvider>
    </SafeAreaProvider>
  );
}

export default App;
