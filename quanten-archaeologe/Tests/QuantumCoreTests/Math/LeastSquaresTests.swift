import XCTest
@testable import QuantumCore

final class LeastSquaresTests: XCTestCase {

    func testExactFit() {
        // y = 2x, perfekte Daten ohne Rauschen
        // A = [[1], [2], [3]], b = [2, 4, 6]
        let A = RealMatrix(rows: 3, cols: 1, data: [1, 2, 3])
        let b = RealVector([2, 4, 6])
        let c = LeastSquaresSolver.solve(A: A, b: b)!
        XCTAssertEqual(c[0], 2.0, accuracy: 1e-10)

        let res = LeastSquaresSolver.residual(A: A, b: b, c: c)
        XCTAssertEqual(res, 0.0, accuracy: 1e-10)
    }

    func testLinearFitWithNoise() {
        // y ≈ 3 + 2x, leicht verrauscht
        let A = RealMatrix(rows: 5, cols: 2, data: [
            1, 0,
            1, 1,
            1, 2,
            1, 3,
            1, 4,
        ])
        let b = RealVector([3.1, 5.0, 6.9, 9.2, 10.8])
        let c = LeastSquaresSolver.solve(A: A, b: b)!

        // c[0] ≈ 3, c[1] ≈ 2
        XCTAssertEqual(c[0], 3.0, accuracy: 0.2)
        XCTAssertEqual(c[1], 2.0, accuracy: 0.2)
    }

    func testResidualDecreasesWithOptimal() {
        let A = RealMatrix(rows: 3, cols: 2, data: [1, 0, 0, 1, 1, 1])
        let b = RealVector([1, 2, 3])
        let cOpt = LeastSquaresSolver.solve(A: A, b: b)!
        let resOpt = LeastSquaresSolver.residual(A: A, b: b, c: cOpt)

        let cBad = RealVector([0, 0])
        let resBad = LeastSquaresSolver.residual(A: A, b: b, c: cBad)

        XCTAssertLessThan(resOpt, resBad)
    }

    func testPlaneFit() {
        // z = a + b·x + c·y, perfekte Ebene z = 1 + 2x - 3y
        var Adata: [Double] = []
        var bdata: [Double] = []
        for x in 0..<3 {
            for y in 0..<3 {
                Adata.append(1)       // Konstante
                Adata.append(Double(x))
                Adata.append(Double(y))
                bdata.append(1 + 2*Double(x) - 3*Double(y))
            }
        }
        let A = RealMatrix(rows: 9, cols: 3, data: Adata)
        let b = RealVector(bdata)
        let c = LeastSquaresSolver.solve(A: A, b: b)!
        XCTAssertEqual(c[0], 1.0, accuracy: 1e-10)
        XCTAssertEqual(c[1], 2.0, accuracy: 1e-10)
        XCTAssertEqual(c[2], -3.0, accuracy: 1e-10)
    }
}
