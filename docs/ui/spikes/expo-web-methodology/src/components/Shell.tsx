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

function Wordmark() {
  return (
    <Link href="/" aria-label="BlackStory · home">
      <XStack alignItems="center" gap="$2" minHeight={44}>
        <YStack width={14} height={22} backgroundColor="$copperPin" borderRadius={3} />
        <SizableText color="$archivePaper" fontWeight="700" fontSize={18}>
          BlackStory
        </SizableText>
      </XStack>
    </Link>
  );
}

export function CommandBar() {
  const pathname = usePathname();
  return (
    <XStack
      tag="header"
      backgroundColor="$charcoal"
      borderBottomWidth={1}
      borderBottomColor="$stone"
      paddingHorizontal="$4"
      alignItems="center"
      gap="$4"
      minHeight={56}
    >
      <Wordmark />
      <Link href="/records" aria-label="Search the record index" style={{ flex: 1 }}>
        <XStack
          borderWidth={1}
          borderColor="$stone"
          borderRadius={999}
          paddingHorizontal="$3"
          minHeight={44}
          alignItems="center"
        >
          <SizableText color="$pageSand" fontSize={15}>
            Search records, places, eras
          </SizableText>
        </XStack>
      </Link>
      <XStack tag="nav" gap="$3" $maxMd={{ display: 'none' }}>
        {AXES.map((a) => (
          <Link key={a.path} href={a.path as never}>
            <SizableText
              color={pathname === a.path ? '$copperDark' : '$archivePaper'}
              fontSize={14}
            >
              {a.label}
            </SizableText>
          </Link>
        ))}
      </XStack>
    </XStack>
  );
}

export function PhoneTabBar() {
  const pathname = usePathname();
  return (
    <XStack
      tag="nav"
      aria-label="Primary"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      backgroundColor="$charcoal"
      borderTopWidth={1}
      borderTopColor="$stone"
      justifyContent="space-around"
      display="none"
      $maxMd={{ display: 'flex' }}
    >
      {AXES.map((a) => (
        <Link key={a.path} href={a.path as never} style={{ flex: 1 }}>
          <YStack alignItems="center" justifyContent="center" minHeight={56} gap={2}>
            <YStack
              width={20}
              height={20}
              borderRadius={4}
              borderWidth={2}
              borderColor={pathname === a.path ? '$copperDark' : '$stone'}
            />
            <SizableText
              fontSize={11}
              color={pathname === a.path ? '$copperDark' : '$archivePaper'}
            >
              {a.label}
            </SizableText>
          </YStack>
        </Link>
      ))}
    </XStack>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <YStack backgroundColor="$blackInk" minHeight="100vh">
      <CommandBar />
      <YStack flex={1} paddingBottom={64}>
        {children}
      </YStack>
      <PhoneTabBar />
    </YStack>
  );
}
