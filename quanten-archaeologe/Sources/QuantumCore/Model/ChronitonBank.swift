import Foundation

/// Globales Punkte- und Zeit-Tracking für den Archäologen.
///
/// Resonanz-Score = Chronitonen / √(verbrauchte Zeit)
/// Je höher der Informationsgewinn pro Zeiteinheit, desto besser.
public class ChronitonBank: ObservableObject {
    @Published public var chronitonen: Double = 0
    @Published public var totalTimeElapsed: Double = 0
    @Published public var solvedProblems: Int = 0
    @Published public var optimalSolutions: Int = 0

    public var resonanceScore: Double {
        chronitonen / sqrt(max(totalTimeElapsed, 1.0))
    }

    public init() {}

    /// Zeit vergeht bei jeder Aktion, jeder Bewegung, jeder Berechnung.
    public func tickTime(_ dt: Double) {
        totalTimeElapsed += dt
    }

    /// Chronitonen werden nach Lösungsqualität vergeben.
    public func addChronitonen(_ amount: Double) {
        chronitonen += max(amount, 0)
    }

    /// 1–3 Sterne je nach Optimalitätslücke
    public func awardStars(forProblem problem: OptimizationProblem, solution: RealVector) -> Int {
        let gap = problem.optimalityGap(at: solution)
        solvedProblems += 1
        if gap < 0.001 {
            optimalSolutions += 1
            addChronitonen(1000)
            return 3
        } else if gap < 0.05 {
            addChronitonen(500)
            return 2
        } else {
            addChronitonen(100)
            return 1
        }
    }
}
