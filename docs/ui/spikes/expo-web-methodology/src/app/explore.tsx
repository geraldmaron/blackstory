import Head from 'expo-router/head';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { YStack } from '@tamagui/stacks';
import { H1 } from '@tamagui/text';

export default function Explore() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [-95, 38],
      zoom: 3,
    });
    return () => map.remove();
  }, []);
  return (
    <>
      <Head>
        <title>Map · BlackStory</title>
      </Head>
      <YStack padding="$4">
        <H1 color="$archivePaper">Map</H1>
        <div ref={ref} style={{ height: 400 }} />
      </YStack>
    </>
  );
}
