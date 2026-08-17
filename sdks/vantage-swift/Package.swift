// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Vantage",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(name: "Vantage", targets: ["Vantage"])
    ],
    targets: [
        .target(name: "Vantage")
    ]
)
