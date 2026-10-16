import { Link, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { XStack, YStack } from '@tamagui/stacks';
import { SizableText } from '@tamagui/text';

const AXES = [
  { path: '/', label: 'Map' },
  { path: '/stories', label: 'Stories' },
  { path: '/records', label: 'Records' },
  { path: '/methodology', label: 'Rooms' },
] as const;

/** Placeholder shell proving the layout pattern; the real header and tab bar land with repo-8vkuz. */
export function CommandBar() {
  const pathname = usePathname();
  return (
    <XStack
      render="header"
      backgroundColor="$backgroundRaised"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
      paddingHorizontal="$4"
      alignItems="center"
      gap="$4"
      minHeight={56}
    >
      <Link href="/" aria-label="BlackStory · home">
        <XStack alignItems="center" gap="$2" minHeight={44}>
          <YStack width={14} height={22} backgroundColor="$accentFill" borderRadius={3} />
          <SizableText color="$color" fontWeight="700" fontSize={18}>
            BlackStory
          </SizableText>
        </XStack>
      </Link>
      <XStack render="nav" aria-label="Primary" gap="$4" marginLeft="auto">
        {AXES.map((axis) => (
          <Link key={axis.path} href={axis.path as never}>
            <XStack minHeight={44} alignItems="center">
              <SizableText color={pathname === axis.path ? '$accent' : '$color'} fontSize={14}>
                {axis.label}
              </SizableText>
            </XStack>
          </Link>
        ))}
      </XStack>
    </XStack>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <YStack backgroundColor="$background" minHeight="100vh">
      <CommandBar />
      <YStack flex={1}>{children}</YStack>
    </YStack>
  );
}
