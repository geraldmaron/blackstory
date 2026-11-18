const { readFileSync } = require('fs');
const path = require('path');
const {
  applySceneAppDelegate,
  applySceneManifest,
} = require('../with-scene-lifecycle');

// The AppDelegate the SDK 57 prebuild generates for this app, captured verbatim.
const TEMPLATE = readFileSync(path.join(__dirname, 'AppDelegate.sdk57.swift.fixture'), 'utf8');

describe('with-scene-lifecycle', () => {
  it('declares one window scene handled by Expo’s scene delegate', () => {
    const plist = applySceneManifest({ CFBundleName: 'BlackStory' });
    expect(plist.CFBundleName).toBe('BlackStory');
    expect(plist.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    });
  });

  it('hands window creation to the scene delegate and keeps the factory and links', () => {
    const out = applySceneAppDelegate(TEMPLATE);
    expect(out).toContain('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    expect(out).not.toContain('UIWindow(frame: UIScreen.main.bounds)');
    expect(out).not.toContain('factory.startReactNative(');
    expect(out).toContain('reactNativeFactory = factory');
    expect(out).toContain('RCTLinkingManager.application(app, open: url, options: options)');
    expect(applySceneAppDelegate(out)).toBe(out);
  });

  it('refuses an AppDelegate it does not recognize rather than half-migrating it', () => {
    expect(() => applySceneAppDelegate('class AppDelegate: UIResponder {}')).toThrow(
      /no longer matches the SDK 57 template/,
    );
  });
});
