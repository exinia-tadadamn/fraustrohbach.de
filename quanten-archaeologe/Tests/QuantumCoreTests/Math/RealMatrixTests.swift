import XCTest
@testable import QuantumCore

final class RealMatrixTests: XCTestCase {

    func testTranspose() {
        let A = RealMatrix(rows: 2, cols: 3, data: [1, 2, 3, 4, 5, 6])
        let At = A.transpose
        XCTAssertEqual(At.rows, 3)
        XCTAssertEqual(At.cols, 2)
        XCTAssertEqual(At[0, 0], 1)
        XCTAssertEqual(At[1, 0], 2)
        XCTAssertEqual(At[2, 0], 3)
        XCTAssertEqual(At[0, 1], 4)
    }

    func testMatrixVectorMultiplication() {
        let A = RealMatrix(rows: 2, cols: 2, data: [1, 2, 3, 4])
        let x = RealVector([5, 6])
        let b = A * x
        XCTAssertEqual(b[0], 1*5 + 2*6, accuracy: 1e-10)
        XCTAssertEqual(b[1], 3*5 + 4*6, accuracy: 1e-10)
    }

    func testMatrixMatrixMultiplication() {
        let A = RealMatrix(rows: 2, cols: 2, data: [1, 2, 3, 4])
        let B = RealMatrix(rows: 2, cols: 2, data: [5, 6, 7, 8])
        let C = A * B
        // C[0,0] = 1*5 + 2*7 = 19
        XCTAssertEqual(C[0, 0], 19, accuracy: 1e-10)
        // C[1,1] = 3*6 + 4*8 = 50
        XCTAssertEqual(C[1, 1], 50, accuracy: 1e-10)
    }

    func testSolveIdentity() {
        let I = RealMatrix(rows: 3, cols: 3, data: [1, 0, 0, 0, 1, 0, 0, 0, 1])
        let b = RealVector([7, 8, 9])
        let x = I.solve(b)!
        XCTAssertEqual(x[0], 7, accuracy: 1e-10)
        XCTAssertEqual(x[1], 8, accuracy: 1e-10)
        XCTAssertEqual(x[2], 9, accuracy: 1e-10)
    }

    func testSolve2x2() {
        // 2x + 3y = 8
        // x + 2y = 5
        let A = RealMatrix(rows: 2, cols: 2, data: [2, 3, 1, 2])
        let b = RealVector([8, 5])
        let x = A.solve(b)!
        XCTAssertEqual(x[0], 1.0, accuracy: 1e-10)  // x = 1
        XCTAssertEqual(x[1], 2.0, accuracy: 1e-10)  // y = 2
    }

    func testSolveSingular() {
        let A = RealMatrix(rows: 2, cols: 2, data: [1, 2, 2, 4])
        let b = RealVector([3, 6])
        let x = A.solve(b)
        XCTAssertNil(x)
    }

    func testSVDReconstruction() {
        // Teste SVD an einer kleinen Matrix
        var data: [Double] = []
        for i in 0..<3 {
            for j in 0..<3 {
                data.append(Double(i + j))
            }
        }
        let X = RealMatrix(rows: 3, cols: 3, data: data)
        let (U, sigma, Vt) = X.svd()

        // U sollte 3×3 sein
        XCTAssertEqual(U.rows, 3)
        XCTAssertEqual(U.cols, 3)

        // Rekonstruktion: X ≈ U * Σ * Vt
        var Sigma = RealMatrix(rows: 3, cols: 3, repeating: 0)
        for i in 0..<3 { Sigma[i, i] = sigma[i] }
        let recon = U * Sigma * Vt

        for i in 0..<3 {
            for j in 0..<3 {
                XCTAssertEqual(recon[i, j], X[i, j], accuracy: 1e-6)
            }
        }
    }

    func testSVDOrthogonality() {
        let X = RealMatrix(rows: 3, cols: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 10])
        let (U, _, Vt) = X.svd()

        // U^T * U ≈ I
        let UtU = U.transpose * U
        for i in 0..<3 {
            for j in 0..<3 {
                let expected = (i == j) ? 1.0 : 0.0
                XCTAssertEqual(UtU[i, j], expected, accuracy: 1e-6)
            }
        }

        // V * Vt ≈ I  (Vt = V^T, also V * Vt = I)
        let V = Vt.transpose
        let VVt = V * Vt
        for i in 0..<3 {
            for j in 0..<3 {
                let expected = (i == j) ? 1.0 : 0.0
                XCTAssertEqual(VVt[i, j], expected, accuracy: 1e-6)
            }
        }
    }
}
