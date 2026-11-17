import { Slot } from 'expo-router';
import { useColorScheme } from 'react-native';
import { TamaguiProvider, Theme } from '@tamagui/core';
import { config } from '../../tamagui.config';
import { Shell } from '../components/Shell';

export default function RootLayout() {
  // Dark is the default (and the server render); a reader whose system is set to light gets light.
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Theme name={scheme}>
        <Shell>
          <Slot />
        </Shell>
      </Theme>
    </TamaguiProvider>
  );
}
