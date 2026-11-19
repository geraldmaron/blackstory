/**
 * Adopts the UIScene life cycle on iOS (`expo prebuild` config plugin).
 *
 * iOS 27 refuses to launch an app that has not adopted the scene life cycle ("UIScene life cycle
 * is required"). Expo SDK 57 ships the scene delegate (`ExpoAppSceneDelegate`, Objective-C name
 * `EXExpoAppSceneDelegate`) but its bare template still creates the window in the app delegate,
 * so a fresh prebuild alone keeps crashing. This plugin does the two documented steps:
 *
 * 1. Info.plist: declare a single-window scene manifest whose delegate is Expo's.
 * 2. AppDelegate.swift: conform to `ExpoReactNativeFactoryProvider` and stop creating the window
 *    in `didFinishLaunching`; the scene delegate creates it and starts React Native into it.
 *
 * Deep links keep working: the scene delegate forwards URL and user-activity events to this app
 * delegate's existing `RCTLinkingManager` overrides, and rebuilds cold-start launch options so
 * `Linking.getInitialURL()` still sees the URL.
 *
 * Retire this plugin when Expo's template adopts scenes itself: the transforms below throw if the
 * AppDelegate no longer matches the shape they expect, so a template change cannot be patched
 * silently into something half-migrated.
 */
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';

/** Adds the scene manifest to an Info.plist object. Idempotent. */
function applySceneManifest(plist) {
  return {
    ...plist,
    UIApplicationSceneManifest: {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    },
  };
}

const CLASS_LINE = /class AppDelegate: ExpoAppDelegate \{/;
const WINDOW_BLOCK =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

/** Rewrites the Swift AppDelegate for the scene life cycle. Idempotent. */
function applySceneAppDelegate(contents) {
  if (contents.includes('ExpoReactNativeFactoryProvider')) return contents;
  if (!CLASS_LINE.test(contents) || !WINDOW_BLOCK.test(contents)) {
    throw new Error(
      '[with-scene-lifecycle] AppDelegate.swift no longer matches the SDK 57 template. ' +
        'Check whether Expo now adopts the scene life cycle itself, and retire or update this plugin.',
    );
  }
  return contents
    .replace(CLASS_LINE, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
    .replace(
      WINDOW_BLOCK,
      '\n    // The window is created by the scene delegate (EXExpoAppSceneDelegate), which starts\n' +
        '    // React Native with this factory. See plugins/with-scene-lifecycle.js.\n',
    );
}

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults = applySceneManifest(mod.modResults);
    return mod;
  });
  return withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') {
      throw new Error('[with-scene-lifecycle] expected a Swift AppDelegate');
    }
    mod.modResults.contents = applySceneAppDelegate(mod.modResults.contents);
    return mod;
  });
}

module.exports = withSceneLifecycle;
module.exports.applySceneManifest = applySceneManifest;
module.exports.applySceneAppDelegate = applySceneAppDelegate;
