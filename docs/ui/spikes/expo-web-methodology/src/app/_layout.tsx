import { Slot } from 'expo-router';
import { TamaguiProvider } from '@tamagui/core';
import { config } from '../../tamagui.config';

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Slot />
    </TamaguiProvider>
  );
}
