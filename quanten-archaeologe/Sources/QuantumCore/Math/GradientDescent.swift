import Foundation

/// Gradientenabstieg für glatte Zielfunktionen (Mechanik A & C)
public struct GradientDescent {

    public static func minimize(
        f: (RealVector) -> Double,
        grad: (RealVector) -> RealVector,
        start: RealVector,
        learningRate: Double = 0.1,
        maxIterations: Int = 1000,
        tolerance: Double = 1e-6
    ) -> (point: RealVector, value: Double, iterations: Int) {
        var x = start
        var iter = 0
        for i in 0..<maxIterations {
            let g = grad(x)
            if g.norm < tolerance { iter = i; break }
            x = x - learningRate * g
            iter = i
        }
        return (x, f(x), iter)
    }

    /// Line-Search mit adaptiver Schrittweite (Armijo-Regel)
    public static func minimizeAdaptive(
        f: (RealVector) -> Double,
        grad: (RealVector) -> RealVector,
        start: RealVector,
        initialLR: Double = 0.5,
        maxIterations: Int = 1000,
        tolerance: Double = 1e-6
    ) -> (point: RealVector, value: Double) {
        var x = start
        var lr = initialLR
        for _ in 0..<maxIterations {
            let g = grad(x)
            if g.norm < tolerance { break }
            let fx = f(x)
            var xNew = x - lr * g
            var fNew = f(xNew)
            while fNew > fx && lr > 1e-12 {
                lr *= 0.5
                xNew = x - lr * g
                fNew = f(xNew)
            }
            x = xNew
        }
        return (x, f(x))
    }
}
