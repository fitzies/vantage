# Vantage Swift App Integration

Use this for native Swift / SwiftUI iOS apps that should send analytics into Vantage.

## 1. Install

Add the Swift package in Xcode:

1. Open your app in Xcode.
2. Go to **File → Add Package Dependencies…**
3. Add the Vantage Swift package from this repo: `sdks/vantage-swift`
4. Add the `Vantage` product to your app target.

## 2. Configure once at app startup

```swift
import SwiftUI
import Vantage

@main
struct MyApp: App {
    init() {
        Vantage.configure(
            endpoint: URL(string: "https://vantage.example.com/api/events")!,
            writeKey: "vntg_pk_...",
            project: "my-ios-app"
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## 3. Track onboarding

```swift
Vantage.track("onboarding_started")

Vantage.track("onboarding_step_viewed", [
    "step": "permissions",
    "step_index": 1
])

Vantage.track("onboarding_step_completed", [
    "step": "permissions",
    "step_index": 1
])

Vantage.track("onboarding_completed")
```

## 4. Track screens

```swift
Vantage.screen("Welcome")
Vantage.screen("CreateAccount")
Vantage.screen("Home")
```

This sends `screen_view` events with `props.screen`.

## 5. Identify users after login

```swift
Vantage.identify("user_123", traits: [
    "plan": "pro"
])
```

Before login, Vantage uses a persisted anonymous install ID. After login, future events include `user_id`.

## Automatic events

The Swift SDK sends these by default:

- `app_first_open` once per install/app storage
- `app_open` on configure
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

## Manual flush / logout

Flush pending events:

```swift
Vantage.flush()
```

Reset identity on logout:

```swift
Vantage.reset()
```

## Notes

- Vantage measures installs as `app_first_open`, not true App Store downloads.
- The SDK queues events offline and retries safely using `event_id` dedupe.
- The write key is public and safe to ship in the app bundle.

## Source availability and rights

This source is visible for portfolio presentation and code review only. No open-source or reuse license is granted; all rights are reserved.
