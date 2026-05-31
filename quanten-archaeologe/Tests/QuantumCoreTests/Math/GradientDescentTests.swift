import XCTest
@testable import QuantumCore

final class GradientDescentTests: XCTestCase {

    func testMinimizeQuadratic1D() {
        // f(x) = (x - 5)², grad = 2(x - 5)
        let f: (RealVector) -> Double = { v in (v[0] - 5) * (v[0] - 5) }
        let grad: (RealVector) -> RealVector = { v in RealVector([2 * (v[0] - 5)]) }

        let result = GradientDescent.minimize(
            f: f, grad: grad, start: RealVector([0.0]),
            learningRate: 0.1, maxIterations: 1000, tolerance: 1e-8
        )
        XCTAssertEqual(result.point[0], 5.0, accuracy: 1e-4)
        XCTAssertEqual(result.value, 0.0, accuracy: 1e-8)
    }

    func testMinimizeQuadratic2D() {
        // f(x,y) = x² + 2y², Minimum bei (0,0)
        let f: (RealVector) -> Double = { v in v[0]*v[0] + 2*v[1]*v[1] }
        let grad: (RealVector) -> RealVector = { v in RealVector([2*v[0], 4*v[1]]) }

        let result = GradientDescent.minimize(
            f: f, grad: grad, start: RealVector([10.0, 10.0]),
            learningRate: 0.05, maxIterations: 2000, tolerance: 1e-8
        )
        XCTAssertEqual(result.point[0], 0.0, accuracy: 1e-3)
        XCTAssertEqual(result.point[1], 0.0, accuracy: 1e-3)
        XCTAssertEqual(result.value, 0.0, accuracy: 1e-6)
    }

    func testMinimizeParaboloidShifted() {
        // f(x,y) = (x-3)² + (y+2)²
        let f: (RealVector) -> Double = { v in
            (v[0]-3)*(v[0]-3) + (v[1]+2)*(v[1]+2)
        }
        let grad: (RealVector) -> RealVector = { v in
            RealVector([2*(v[0]-3), 2*(v[1]+2)])
        }
        let result = GradientDescent.minimize(
            f: f, grad: grad, start: RealVector([0, 0]),
            learningRate: 0.1, maxIterations: 1000, tolerance: 1e-8
        )
        XCTAssertEqual(result.point[0], 3.0, accuracy: 1e-4)
        XCTAssertEqual(result.point[1], -2.0, accuracy: 1e-4)
    }

    func testAdaptiveLineSearch() {
        // Streng konvex: f(x) = x⁴, grad = 4x³
        // Minimum bei 0, aber flach nahe 0
        let f: (RealVector) -> Double = { v in v[0]*v[0]*v[0]*v[0] }
        let grad: (RealVector) -> RealVector = { v in RealVector([4*v[0]*v[0]*v[0]]) }

        let result = GradientDescent.minimizeAdaptive(
            f: f, grad: grad, start: RealVector([5.0]),
            initialLR: 0.5, maxIterations: 1000, tolerance: 1e-7
        )
        // x⁴ hat bei 0 verschwindende zweite Ableitung → sublineare Konvergenz.
        // Wir testen, dass der Wert deutlich kleiner als der Start ist.
        XCTAssertLessThan(abs(result.point[0]), 1.0)
        XCTAssertLessThan(result.value, f(RealVector([5.0])))
    }

    func testValueDecreases() {
        let f: (RealVector) -> Double = { v in v[0]*v[0] + 4*v[1]*v[1] }
        let grad: (RealVector) -> RealVector = { v in RealVector([2*v[0], 8*v[1]]) }
        let start = RealVector([10.0, 10.0])
        let startVal = f(start)

        let result = GradientDescent.minimize(
            f: f, grad: grad, start: start,
            learningRate: 0.05, maxIterations: 1000, tolerance: 1e-8
        )
        XCTAssertLessThan(result.value, startVal)
    }
}
