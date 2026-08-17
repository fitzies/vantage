# Vantage Expo App Integration

Use this for Expo / React Native apps that should send analytics into Vantage.

## 1. Install

From your Expo app:

```bash
pnpm add @ojflabs/vantage-expo @react-native-async-storage/async-storage expo-constants expo-device expo-localization
```

If `@ojflabs/vantage-expo` is not published yet, install it from this repo/workspace or copy the package in `packages/vantage-expo`.

## 2. Configure once at app startup

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import { AppState, Platform } from "react-native";
import {
  handleAppStateChange,
  init,
  identify,
  screen,
  track,
} from "@ojflabs/vantage-expo";

await init({
  project: "my-expo-app",
  writeKey: "vntg_pk_...",
  endpoint: "https://vantage.example.com/api/events",
  storage: AsyncStorage,
  context: () => ({
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version ?? null,
    buildNumber:
      Platform.OS === "ios"
        ? Constants.expoConfig?.ios?.buildNumber ?? null
        : Constants.expoConfig?.android?.versionCode?.toString() ?? null,
    osVersion: Device.osVersion ?? null,
    deviceModel: Device.modelName ?? null,
    locale: Localization.getLocales()[0]?.languageTag ?? null,
  }),
});

AppState.addEventListener("change", (state) => {
  void handleAppStateChange(state);
});
```

## 3. Track onboarding

```ts
await track("onboarding_started");

await track("onboarding_step_viewed", {
  step: "permissions",
  step_index: 1,
});

await track("onboarding_step_completed", {
  step: "permissions",
  step_index: 1,
});

await track("onboarding_completed");
```

## 4. Track screens

```ts
await screen("Welcome");
await screen("CreateAccount");
await screen("Home");
```

This sends `screen_view` events with `props.screen`.

## 5. Identify users after login

```ts
await identify("user_123", {
  plan: "pro",
});
```

Before login, Vantage uses a persisted anonymous install ID. After login, future events include `user_id`.

## Automatic events

The Expo SDK sends these by default:

- `app_first_open` once per install/app storage
- `app_open` on init
- `app_background`
- `app_foreground`

## Automatic props

Every event includes useful mobile metadata:

- `platform`
- `app_version`
- `build_number`
- `os_version`
- `device_model`
- `locale`
- `sdk_name`
- `sdk_version`

## Notes

- Vantage measures installs as `app_first_open`, not true App Store / Play Store downloads.
- The SDK queues events offline and retries safely using `event_id` dedupe.
- The write key is public and safe to ship in the app bundle.

## Source availability and rights

This source is visible for portfolio presentation and code review only. No open-source or reuse license is granted; all rights are reserved.
