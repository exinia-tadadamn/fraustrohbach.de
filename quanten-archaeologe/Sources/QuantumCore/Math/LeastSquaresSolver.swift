import Foundation

/// Minimiere ‖A·c − b‖₂²  über c ∈ ℝⁿ
public struct LeastSquaresSolver {

    /// Löst die Normalengleichung (A^T A) c = A^T b via Gauß-Elimination.
    public static func solve(A: RealMatrix, b: RealVector) -> RealVector? {
        let At = A.transpose
        let AtA = At * A
        let Atb = At * b
        return AtA.solve(Atb)
    }

    /// Berechnet den Residuen-Fehler ‖A·c − b‖₂.
    public static func residual(A: RealMatrix, b: RealVector, c: RealVector) -> Double {
        let Ac = A * c
        let diff = Ac - b
        return diff.norm
    }
}
