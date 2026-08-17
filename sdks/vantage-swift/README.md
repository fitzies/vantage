# Vantage Swift

Swift Package tracker for Vantage iOS apps.

## Install

In Xcode: **File → Add Package Dependencies…** and point at this package directory/repo. Add the `Vantage` product to your app target.

## Usage

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
        WindowGroup { ContentView() }
    }
}
```

Track onboarding:

```swift
Vantage.track("onboarding_started")
Vantage.track("onboarding_step_viewed", ["step": "permissions", "step_index": 2])
Vantage.track("onboarding_step_completed", ["step": "permissions", "step_index": 2])
Vantage.track("onboarding_completed")
```

Track screens and identify signed-in users:

```swift
Vantage.screen("CreateAccount")
Vantage.identify("user_123", traits: ["plan": "pro"])
```

The SDK emits `app_first_open` once per install and `app_open` on configure by default. It persists `anon_id`, creates mobile sessions, queues events offline, batches requests, and adds `event_id` for idempotent retries.

## Source availability and rights

This source is visible for portfolio presentation and code review only. No open-source or reuse license is granted; all rights are reserved.
