import Foundation

/// ℝ^(m×n) — reelle Matrix mit linearer Algebra, SVD und Gleichungslöser
public struct RealMatrix: Equatable {
    public let rows: Int
    public let cols: Int
    public var data: [Double]

    public init(rows: Int, cols: Int, data: [Double]) {
        assert(data.count == rows * cols, "Data count \(data.count) does not match \(rows)×\(cols)")
        self.rows = rows
        self.cols = cols
        self.data = data
    }

    public init(rows: Int, cols: Int, repeating: Double) {
        self.rows = rows
        self.cols = cols
        self.data = Array(repeating: repeating, count: rows * cols)
    }

    public subscript(r: Int, c: Int) -> Double {
        get { data[r * cols + c] }
        set { data[r * cols + c] = newValue }
    }

    public var transpose: RealMatrix {
        var result = RealMatrix(rows: cols, cols: rows, repeating: 0)
        for r in 0..<rows {
            for c in 0..<cols {
                result[c, r] = self[r, c]
            }
        }
        return result
    }

    public static func * (lhs: RealMatrix, rhs: RealMatrix) -> RealMatrix {
        assert(lhs.cols == rhs.rows)
        var result = RealMatrix(rows: lhs.rows, cols: rhs.cols, repeating: 0)
        for i in 0..<lhs.rows {
            for j in 0..<rhs.cols {
                var sum = 0.0
                for k in 0..<lhs.cols {
                    sum += lhs[i, k] * rhs[k, j]
                }
                result[i, j] = sum
            }
        }
        return result
    }

    public static func * (lhs: RealMatrix, rhs: RealVector) -> RealVector {
        assert(lhs.cols == rhs.dim)
        var result = Array(repeating: 0.0, count: lhs.rows)
        for i in 0..<lhs.rows {
            for j in 0..<lhs.cols {
                result[i] += lhs[i, j] * rhs[j]
            }
        }
        return RealVector(result)
    }

    /// Gauß-Elimination mit Spaltenpivotisierung für quadratische Systeme A x = b
    public func solve(_ b: RealVector) -> RealVector? {
        guard rows == cols else { return nil }
        let n = rows
        var A = self.data
        var B = b.components

        for k in 0..<n {
            var maxRow = k
            var maxVal = abs(A[k * n + k])
            for i in (k + 1)..<n {
                let val = abs(A[i * n + k])
                if val > maxVal {
                    maxVal = val
                    maxRow = i
                }
            }
            if maxVal < 1e-12 { return nil }

            if maxRow != k {
                for j in 0..<n {
                    let tmp = A[k * n + j]
                    A[k * n + j] = A[maxRow * n + j]
                    A[maxRow * n + j] = tmp
                }
                let tmp = B[k]
                B[k] = B[maxRow]
                B[maxRow] = tmp
            }

            for i in (k + 1)..<n {
                let factor = A[i * n + k] / A[k * n + k]
                for j in k..<n {
                    A[i * n + j] -= factor * A[k * n + j]
                }
                B[i] -= factor * B[k]
            }
        }

        var x = Array(repeating: 0.0, count: n)
        for i in (0..<n).reversed() {
            var sum = B[i]
            for j in (i + 1)..<n {
                sum -= A[i * n + j] * x[j]
            }
            x[i] = sum / A[i * n + i]
        }
        return RealVector(x)
    }

    /// Singulärwertzerlegung via Jacobi-Eigenwertverfahren auf A^T A.
    /// Funktional für kleine Dimensionen (n ≤ 20) wie im Spiel benötigt.
    public func svd() -> (U: RealMatrix, Sigma: [Double], Vt: RealMatrix) {
        let m = rows
        let n = cols
        let AtA = self.transpose * self

        var V = RealMatrix(rows: n, cols: n, repeating: 0)
        for i in 0..<n { V[i, i] = 1.0 }
        var D = AtA

        let maxIter = 100
        let eps = 1e-10
        for _ in 0..<maxIter {
            var p = 0, q = 1
            var maxOff = abs(D[0, 1])
            for i in 0..<n {
                for j in (i + 1)..<n {
                    let val = abs(D[i, j])
                    if val > maxOff {
                        maxOff = val
                        p = i; q = j
                    }
                }
            }
            if maxOff < eps { break }

            let diff = D[q, q] - D[p, p]
            let tau = diff / (2.0 * D[p, q])
            let t = tau >= 0 ? 1.0 / (tau + sqrt(1 + tau * tau)) : -1.0 / (-tau + sqrt(1 + tau * tau))
            let c = 1.0 / sqrt(1 + t * t)
            let s = t * c

            let dpp = D[p, p] - t * D[p, q]
            let dqq = D[q, q] + t * D[p, q]
            D[p, p] = dpp
            D[q, q] = dqq
            D[p, q] = 0
            D[q, p] = 0

            for i in 0..<n {
                if i != p && i != q {
                    let dip = D[i, p]
                    let diq = D[i, q]
                    D[i, p] = c * dip - s * diq
                    D[p, i] = D[i, p]
                    D[i, q] = s * dip + c * diq
                    D[q, i] = D[i, q]
                }
            }

            for i in 0..<n {
                let vip = V[i, p]
                let viq = V[i, q]
                V[i, p] = c * vip - s * viq
                V[i, q] = s * vip + c * viq
            }
        }

        var sigma = (0..<n).map { sqrt(max(D[$0, $0], 0)) }
        let indices = sigma.indices.sorted { sigma[$0] > sigma[$1] }
        sigma = indices.map { sigma[$0] }

        var Vsorted = RealMatrix(rows: n, cols: n, repeating: 0)
        for i in 0..<n {
            for j in 0..<n {
                Vsorted[j, i] = V[j, indices[i]]
            }
        }
        V = Vsorted

        var U = RealMatrix(rows: m, cols: n, repeating: 0)
        for j in 0..<n {
            if sigma[j] > 1e-12 {
                for i in 0..<m {
                    var sum = 0.0
                    for k in 0..<n {
                        sum += self[i, k] * V[k, j]
                    }
                    U[i, j] = sum / sigma[j]
                }
            }
        }

        for j in 0..<n {
            for i in 0..<j {
                var dot = 0.0
                for k in 0..<m { dot += U[k, i] * U[k, j] }
                for k in 0..<m { U[k, j] -= dot * U[k, i] }
            }
            var norm = 0.0
            for k in 0..<m { norm += U[k, j] * U[k, j] }
            norm = sqrt(norm)
            if norm > 1e-12 {
                for k in 0..<m { U[k, j] /= norm }
            }
        }

        let Vt = V.transpose
        return (U, sigma, Vt)
    }
}
