// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "QuantumArchaeologist",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "QuantumCore", targets: ["QuantumCore"]),
        .library(name: "QuantumGame", targets: ["QuantumGame"]),
        .executable(name: "QuantumApp", targets: ["QuantumApp"]),
    ],
    targets: [
        .target(name: "QuantumCore"),
        .target(name: "QuantumGame", dependencies: ["QuantumCore"]),
        .executableTarget(name: "QuantumApp", dependencies: ["QuantumGame"]),
        .testTarget(name: "QuantumCoreTests", dependencies: ["QuantumCore"]),
    ]
)
