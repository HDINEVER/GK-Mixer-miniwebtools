import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import RootTabs from './src/navigation/RootTabs';
import { ColorProvider } from './src/context/ColorContext';

function App() {
  return (
    <ColorProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </ColorProvider>
  );
}

export default App;
