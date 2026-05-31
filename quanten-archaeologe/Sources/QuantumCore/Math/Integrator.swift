import Foundation

/// Numerische Integration — das Herz der Pfad-Optimierung (Mechanik A)
public enum Integrator {

    public static func simpson(f: (Double) -> Double, a: Double, b: Double, n: Int = 200) -> Double {
        let n2 = (n % 2 == 0) ? n : n + 1
        let h = (b - a) / Double(n2)
        var sum = f(a) + f(b)
        for i in 1..<n2 {
            let x = a + Double(i) * h
            sum += (i % 2 == 0 ? 2.0 : 4.0) * f(x)
        }
        return sum * h / 3.0
    }

    public static func trapezoidal(f: (Double) -> Double, a: Double, b: Double, n: Int = 200) -> Double {
        let h = (b - a) / Double(n)
        var sum = 0.5 * (f(a) + f(b))
        for i in 1..<n {
            sum += f(a + Double(i) * h)
        }
        return sum * h
    }

    /// Integral entlang eines parametrisierten Pfades γ(t) mit Zeitkostenfeld f.
    /// T[γ] = ∫ f(γ(t)) · |γ'(t)| dt  (t ∈ [0,1])
    public static func pathIntegral(
        controlPoints: [RealVector],
        timeField: (RealVector) -> Double,
        samples: Int = 300
    ) -> Double {
        guard controlPoints.count >= 2 else { return 0 }
        let segments = controlPoints.count - 1

        func interpolate(t: Double) -> RealVector {
            let s = t * Double(segments)
            let idx = min(Int(s), segments - 1)
            let local = s - Double(idx)
            let a = controlPoints[idx]
            let b = controlPoints[idx + 1]
            return a + local * (b - a)
        }

        func derivative(t: Double) -> RealVector {
            let s = t * Double(segments)
            let idx = min(Int(s), segments - 1)
            let a = controlPoints[idx]
            let b = controlPoints[idx + 1]
            return Double(segments) * (b - a)
        }

        let integrand: (Double) -> Double = { t in
            let pos = interpolate(t: t)
            let vel = derivative(t: t)
            return timeField(pos) * vel.norm
        }

        return simpson(f: integrand, a: 0, b: 1, n: samples)
    }
}
