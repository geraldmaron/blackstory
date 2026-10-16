import { Slot } from 'expo-router';
import { TamaguiProvider } from '@tamagui/core';
import { config } from '../../tamagui.config';
import { Shell } from '../components/Shell';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Shell>
        <Slot />
      </Shell>
    </TamaguiProvider>
  );
}
