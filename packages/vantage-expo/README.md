# @ojflabs/vantage-expo

Expo / React Native tracker for Vantage.

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Localization from "expo-localization";
import { AppState, Platform } from "react-native";
import { handleAppStateChange, init, screen, track, identify } from "@ojflabs/vantage-expo";

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

await screen("Welcome");
await track("onboarding_started");
await track("onboarding_step_completed", { step: "permissions", step_index: 2 });
await identify("user_123");
```

The SDK emits `app_first_open` once per install and `app_open` on init by default. It stores `anon_id`, queues events offline, batches requests, and adds `event_id` for idempotent retries.

## Source availability and rights

This source is visible for portfolio presentation and code review only. No open-source or reuse license is granted; all rights are reserved.
