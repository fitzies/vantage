import Foundation
#if canImport(UIKit)
import UIKit
#endif

public typealias VantageProperties = [String: Any]

public struct VantageConfiguration {
    public let endpoint: URL
    public let writeKey: String
    public let project: String
    public let debug: Bool
    public let autoLifecycleEvents: Bool
    public let sessionTimeout: TimeInterval
    public let flushInterval: TimeInterval
    public let flushAtCount: Int

    public init(
        endpoint: URL,
        writeKey: String,
        project: String,
        debug: Bool = false,
        autoLifecycleEvents: Bool = true,
        sessionTimeout: TimeInterval = 30 * 60,
        flushInterval: TimeInterval = 1,
        flushAtCount: Int = 20
    ) {
        self.endpoint = endpoint
        self.writeKey = writeKey
        self.project = project
        self.debug = debug
        self.autoLifecycleEvents = autoLifecycleEvents
        self.sessionTimeout = sessionTimeout
        self.flushInterval = flushInterval
        self.flushAtCount = min(max(flushAtCount, 1), 100)
    }
}

public enum Vantage {
    private static let client = VantageClient()

    public static func configure(_ configuration: VantageConfiguration) {
        client.configure(configuration)
    }

    public static func configure(
        endpoint: URL,
        writeKey: String,
        project: String,
        debug: Bool = false,
        autoLifecycleEvents: Bool = true
    ) {
        configure(
            VantageConfiguration(
                endpoint: endpoint,
                writeKey: writeKey,
                project: project,
                debug: debug,
                autoLifecycleEvents: autoLifecycleEvents
            )
        )
    }

    public static func track(_ event: String, _ props: VantageProperties = [:]) {
        client.track(event, props)
    }

    public static func screen(_ name: String, _ props: VantageProperties = [:]) {
        var merged = props
        merged["screen"] = name
        client.track("screen_view", merged)
    }

    public static func identify(_ userId: String, traits: VantageProperties = [:]) {
        client.identify(userId, traits: traits)
    }

    public static func reset() {
        client.reset()
    }

    public static func flush() {
        client.flush()
    }
}

private final class VantageClient {
    private let queue = DispatchQueue(label: "com.ojflabs.vantage")
    private let defaults = UserDefaults.standard
    private let session = URLSession(configuration: .default)

    private var config: VantageConfiguration?
    private var anonId: String = ""
    private var userId: String?
    private var sessionId: String = UUID().uuidString
    private var previousAnonId: String?
    private var events: [[String: Any]] = []
    private var timer: DispatchSourceTimer?
    private var flushing = false
    private var lastBackgroundedAt: Date?
    #if canImport(UIKit)
    private var lifecycleObserver: VantageLifecycleObserver?
    #endif

    private let maxQueue = 1_000
    private let maxBodyBytes = 220 * 1024

    func configure(_ configuration: VantageConfiguration) {
        queue.async {
            guard self.config == nil else {
                self.log("configure called more than once")
                return
            }

            self.config = configuration
            self.anonId = self.defaults.string(forKey: self.key("anon")) ?? UUID().uuidString
            self.defaults.set(self.anonId, forKey: self.key("anon"))
            self.userId = self.defaults.string(forKey: self.key("user"))
            self.sessionId = UUID().uuidString
            self.events = self.loadQueue()

            if configuration.autoLifecycleEvents {
                self.bindLifecycle()
                if !self.defaults.bool(forKey: self.key("first_open_sent")) {
                    self.enqueue(self.buildEvent("app_first_open", props: [:]))
                    self.defaults.set(true, forKey: self.key("first_open_sent"))
                }
                self.enqueue(self.buildEvent("app_open", props: [:]))
            }

            self.scheduleFlush()
        }
    }

    func track(_ event: String, _ props: VantageProperties) {
        queue.async {
            guard self.config != nil else {
                self.log("track called before configure: \(event)")
                return
            }
            self.enqueue(self.buildEvent(event, props: props))
        }
    }

    func identify(_ newUserId: String, traits: VantageProperties) {
        queue.async {
            guard self.config != nil else { return }
            self.previousAnonId = self.anonId
            self.userId = newUserId
            self.defaults.set(newUserId, forKey: self.key("user"))

            var props = traits
            props["previous_anon_id"] = self.previousAnonId
            self.enqueue(self.buildEvent("$identify", props: props))
            self.previousAnonId = nil
        }
    }

    func reset() {
        queue.async {
            guard self.config != nil else { return }
            self.flushLocked()
            self.userId = nil
            self.previousAnonId = nil
            self.anonId = UUID().uuidString
            self.sessionId = UUID().uuidString
            self.defaults.set(self.anonId, forKey: self.key("anon"))
            self.defaults.removeObject(forKey: self.key("user"))
        }
    }

    func flush() {
        queue.async {
            self.flushLocked()
        }
    }

    fileprivate func handleBackground() {
        queue.async {
            guard self.config != nil else { return }
            self.lastBackgroundedAt = Date()
            self.enqueue(self.buildEvent("app_background", props: [:]))
            self.flushLocked()
        }
    }

    fileprivate func handleForeground() {
        queue.async {
            guard let config = self.config else { return }
            if let last = self.lastBackgroundedAt, Date().timeIntervalSince(last) > config.sessionTimeout {
                self.sessionId = UUID().uuidString
            }
            self.lastBackgroundedAt = nil
            self.enqueue(self.buildEvent("app_foreground", props: [:]))
        }
    }

    private func buildEvent(_ name: String, props: VantageProperties) -> [String: Any] {
        var finalProps = automaticProps()
        for (key, value) in props { finalProps[key] = sanitize(value) }
        if let previousAnonId {
            finalProps["previous_anon_id"] = previousAnonId
            self.previousAnonId = nil
        }

        return compactDictionary([
            "event": name,
            "event_id": UUID().uuidString,
            "user_id": userId as Any?,
            "anon_id": anonId,
            "session_id": sessionId,
            "timestamp": ISO8601DateFormatter.vantage.string(from: Date()),
            "props": finalProps
        ])
    }

    private func automaticProps() -> [String: Any] {
        guard let config else { return [:] }
        var props: [String: Any] = [
            "project": config.project,
            "sdk_name": "vantage-swift",
            "sdk_version": "0.1.0",
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? NSNull(),
            "build_number": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? NSNull(),
            "locale": Locale.current.identifier
        ]

        #if os(iOS)
        props["platform"] = "ios"
        props["sdk_type"] = "native_mobile"
        props["os_version"] = UIDevice.current.systemVersion
        props["device_model"] = UIDevice.current.model
        #elseif os(macOS)
        props["platform"] = "macos"
        props["sdk_type"] = "desktop"
        props["os_version"] = ProcessInfo.processInfo.operatingSystemVersionString
        props["device_model"] = "Mac"
        #else
        props["platform"] = "swift"
        props["sdk_type"] = "native"
        #endif

        return props
    }

    private func enqueue(_ event: [String: Any]) {
        events.append(event)
        if events.count > maxQueue { events.removeFirst(events.count - maxQueue) }
        persistQueue()

        if let config, events.count >= config.flushAtCount {
            flushLocked()
        } else {
            scheduleFlush()
        }
    }

    private func scheduleFlush() {
        guard let config, timer == nil, !events.isEmpty else { return }
        let newTimer = DispatchSource.makeTimerSource(queue: queue)
        newTimer.schedule(deadline: .now() + config.flushInterval)
        newTimer.setEventHandler { [weak self] in
            self?.timer = nil
            self?.flushLocked()
        }
        timer = newTimer
        newTimer.resume()
    }

    private func flushLocked() {
        guard let config, !flushing, !events.isEmpty else { return }
        flushing = true
        timer?.cancel()
        timer = nil

        let batch = takeBatch()
        events.removeFirst(batch.count)
        persistQueue()

        var request = URLRequest(url: config.endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(config.writeKey, forHTTPHeaderField: "x-vantage-key")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "key": config.writeKey,
            "events": batch
        ])

        session.dataTask(with: request) { _, response, error in
            self.queue.async {
                defer {
                    self.flushing = false
                    self.scheduleFlush()
                }

                if let error {
                    self.log("send failed: \(error.localizedDescription)")
                    self.events.insert(contentsOf: batch, at: 0)
                    self.persistQueue()
                    return
                }

                if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                    self.log("non-ok response: \(http.statusCode)")
                    if http.statusCode >= 500 {
                        self.events.insert(contentsOf: batch, at: 0)
                        self.persistQueue()
                    }
                }
            }
        }.resume()
    }

    private func takeBatch() -> [[String: Any]] {
        guard let config else { return [] }
        var batch: [[String: Any]] = []
        for event in events {
            if batch.count >= config.flushAtCount { break }
            var next = batch
            next.append(event)
            let data = try? JSONSerialization.data(withJSONObject: [
                "key": config.writeKey,
                "events": next
            ])
            if !batch.isEmpty, let data, data.count > maxBodyBytes { break }
            batch.append(event)
        }
        return batch
    }

    private func loadQueue() -> [[String: Any]] {
        guard
            let data = defaults.data(forKey: key("queue")),
            let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
        else { return [] }
        return Array(array.suffix(maxQueue))
    }

    private func persistQueue() {
        let bounded = Array(events.suffix(maxQueue))
        events = bounded
        if let data = try? JSONSerialization.data(withJSONObject: bounded) {
            defaults.set(data, forKey: key("queue"))
        }
    }

    private func key(_ name: String) -> String {
        let project = config?.project ?? "default"
        return "vntg.\(project).\(name)"
    }

    private func log(_ message: String) {
        if config?.debug == true { print("[Vantage] \(message)") }
    }

    private func bindLifecycle() {
        #if canImport(UIKit)
        lifecycleObserver = VantageLifecycleObserver(client: self)
        #endif
    }
}

#if canImport(UIKit)
private final class VantageLifecycleObserver {
    private weak var client: VantageClient?

    init(client: VantageClient) {
        self.client = client
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(didEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(willEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func didEnterBackground() {
        client?.handleBackground()
    }

    @objc private func willEnterForeground() {
        client?.handleForeground()
    }
}
#endif

private extension ISO8601DateFormatter {
    static let vantage: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private func compactDictionary(_ input: [String: Any?]) -> [String: Any] {
    var output: [String: Any] = [:]
    for (key, value) in input {
        if let value { output[key] = value }
    }
    return output
}

private func sanitize(_ value: Any) -> Any {
    switch value {
    case Optional<Any>.none:
        return NSNull()
    case let value as NSNull:
        return value
    case let value as String:
        return value
    case let value as Bool:
        return value
    case let value as Int:
        return value
    case let value as Int8:
        return Int(value)
    case let value as Int16:
        return Int(value)
    case let value as Int32:
        return Int(value)
    case let value as Int64:
        return value
    case let value as UInt:
        return value
    case let value as UInt8:
        return UInt(value)
    case let value as UInt16:
        return UInt(value)
    case let value as UInt32:
        return UInt(value)
    case let value as UInt64:
        return value
    case let value as Double:
        return value.isFinite ? value : NSNull()
    case let value as Float:
        return value.isFinite ? Double(value) : NSNull()
    case let value as Date:
        return ISO8601DateFormatter.vantage.string(from: value)
    case let value as URL:
        return value.absoluteString
    case let value as [Any]:
        return value.map { sanitize($0) }
    case let value as [String: Any]:
        var output: [String: Any] = [:]
        for (key, nested) in value { output[key] = sanitize(nested) }
        return output
    default:
        return String(describing: value)
    }
}
