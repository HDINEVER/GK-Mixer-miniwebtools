// GK Mixer Mobile - 5-Tab 壳
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import RootTabs from './src/navigation/RootTabs';

function App() {
  return (
    <>
      <StatusBar barStyle="light-content" />
      <NavigationContainer>
        <RootTabs />
      </NavigationContainer>
    </>
  );
}

export default App;
