import Foundation

/// ℝ^n — reeller Vektor mit Analysis-Operationen
public struct RealVector: Equatable, CustomStringConvertible {
    public let dim: Int
    public var components: [Double]

    public init(_ components: [Double]) {
        self.components = components
        self.dim = components.count
    }

    public subscript(i: Int) -> Double {
        get { components[i] }
        set { components[i] = newValue }
    }

    public static func + (lhs: RealVector, rhs: RealVector) -> RealVector {
        RealVector(zip(lhs.components, rhs.components).map(+))
    }

    public static func - (lhs: RealVector, rhs: RealVector) -> RealVector {
        RealVector(zip(lhs.components, rhs.components).map(-))
    }

    public static func * (scalar: Double, v: RealVector) -> RealVector {
        RealVector(v.components.map { $0 * scalar })
    }

    public static func / (v: RealVector, scalar: Double) -> RealVector {
        RealVector(v.components.map { $0 / scalar })
    }

    public var norm: Double {
        sqrt(components.map { $0 * $0 }.reduce(0, +))
    }

    public var squaredNorm: Double {
        components.map { $0 * $0 }.reduce(0, +)
    }

    public func dot(_ other: RealVector) -> Double {
        zip(components, other.components).map(*).reduce(0, +)
    }

    public func distance(to other: RealVector) -> Double {
        (self - other).norm
    }

    public var description: String {
        let inner = components.map { String(format: "%+.4f", $0) }.joined(separator: ", ")
        return "( \(inner) )"
    }
}
