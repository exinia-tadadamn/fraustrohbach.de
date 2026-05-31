import Foundation

/// Protokoll für alle Spiel-internen Optimierungsprobleme.
/// Jede Mechanik implementiert dieses Interface, damit die Ω-Orbit
/// einheitlich arbeiten kann.
public protocol OptimizationProblem {
    var dimension: Int { get }
    var name: String { get }

    /// Zielfunktion f(x). Ob Minimierung oder Maximierung ist problemabhängig.
    func objective(at x: RealVector) -> Double

    /// Ungleichungsnebenbedingungen gᵢ(x) ≤ 0.
    func constraints(at x: RealVector) -> [Double]

    /// Optionale analytische Lösung — für Chronitonen-Bonus-Vergleich.
    var analyticOptimum: RealVector? { get }
    var analyticOptimumValue: Double? { get }
}

public extension OptimizationProblem {
    var analyticOptimum: RealVector? { nil }
    var analyticOptimumValue: Double? { nil }

    func isFeasible(at x: RealVector) -> Bool {
        constraints(at: x).allSatisfy { $0 <= 1e-9 }
    }

    /// Relative Distanz zum Optimum (0.0 = perfekt)
    func optimalityGap(at x: RealVector) -> Double {
        guard let opt = analyticOptimumValue else { return 1.0 }
        let val = objective(at: x)
        guard abs(opt) > 1e-12 else { return abs(val - opt) }
        return abs(val - opt) / abs(opt)
    }
}

/// Typen der 5 Mechaniken
public enum MechanicType: String, CaseIterable {
    case pathOptimization = "Pfad-Optimierung"
    case signalFit = "Signal-Dekomposition"
    case allocation = "Energie-Allokation"
    case compression = "Dimensionale Kompression"
    case sync = "Multiversum-Synchronisation"
}
