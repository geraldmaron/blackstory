/**
 * Jest mock for react-native-reanimated.
 *
 * The real package initializes a native Worklets runtime on import, which does not
 * exist under jest-expo's node environment ("Native part of Worklets doesn't seem to
 * be initialized"). Shipped as a `moduleNameMapper` entry in jest.config.js so every
 * suite that transitively renders an `Animated.View` (UI primitives, browse screens)
 * gets a plain RN View instead.
 *
 * Individual suites may still override this with their own `jest.mock` factory.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { View, Text, Image, ScrollView } = require('react-native');

const noop = () => {};
const identity = (value) => value;

/** Layout/entering/exiting animation builders are chainable no-op descriptors. */
function makeAnimationBuilder() {
  const builder = {};
  const chain = () => builder;
  for (const method of [
    'duration',
    'delay',
    'springify',
    'damping',
    'stiffness',
    'mass',
    'easing',
    'withInitialValues',
    'withCallback',
    'randomDelay',
    'reduceMotion',
    'build',
  ]) {
    builder[method] = chain;
  }
  return builder;
}

const animationBuilderProxy = new Proxy(makeAnimationBuilder(), {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => animationBuilderProxy;
  },
});

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent: identity,
  call: noop,
};

module.exports = {
  __esModule: true,
  default: Animated,
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent: identity,
  Easing: {
    linear: identity,
    ease: identity,
    bezier: () => identity,
    out: identity,
    inOut: identity,
  },
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: () => ({}),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedRef: () => ({ current: null }),
  useAnimatedReaction: noop,
  useAnimatedScrollHandler: () => noop,
  withTiming: identity,
  withSpring: identity,
  withDelay: (_delay, value) => value,
  withSequence: identity,
  cancelAnimation: noop,
  runOnJS: identity,
  runOnUI: identity,
  interpolate: () => 0,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  FadeIn: animationBuilderProxy,
  FadeOut: animationBuilderProxy,
  FadeInDown: animationBuilderProxy,
  FadeOutUp: animationBuilderProxy,
  FadeInUp: animationBuilderProxy,
  FadeOutDown: animationBuilderProxy,
  LinearTransition: animationBuilderProxy,
  Layout: animationBuilderProxy,
};
