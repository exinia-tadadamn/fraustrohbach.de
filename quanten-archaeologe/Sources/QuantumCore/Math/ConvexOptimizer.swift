import Foundation

/// Konvexe Optimierung für Ressourcen-Allokation (Mechanik C)
///
/// Problem: max Σ aᵢ·√tᵢ  u.d.N.  Σ Pᵢ·tᵢ ≤ E ,  tᵢ ≥ 0
///
/// Lagrange-Analytik liefert geschlossene Lösung:
///   tᵢ = (E / Pᵢ) · (aᵢ² / Pᵢ) / (Σ aⱼ² / Pⱼ)
public struct ConvexOptimizer {

    public static func optimalAllocation(a: [Double], P: [Double], E: Double) -> [Double] {
        assert(a.count == P.count, "Dimension mismatch")
        let n = a.count
        var weights = [Double](repeating: 0.0, count: n)
        var totalWeight = 0.0
        for i in 0..<n {
            let pi = P[i]
            if pi > 0 {
                weights[i] = (a[i] * a[i]) / pi
                totalWeight += weights[i]
            }
        }

        var t = [Double](repeating: 0.0, count: n)
        guard totalWeight > 0 else { return t }

        for i in 0..<n {
            let pi = P[i]
            if pi > 0 {
                t[i] = (E / pi) * (weights[i] / totalWeight)
            }
        }
        return t
    }

    /// Zielfunktionswert Σ aᵢ·√tᵢ
    public static func objective(a: [Double], t: [Double]) -> Double {
        zip(a, t).map { $0 * sqrt(max($1, 0)) }.reduce(0, +)
    }

    /// Energie-Verbrauch Σ Pᵢ·tᵢ
    public static func energyUsed(P: [Double], t: [Double]) -> Double {
        zip(P, t).map(*).reduce(0, +)
    }
}
