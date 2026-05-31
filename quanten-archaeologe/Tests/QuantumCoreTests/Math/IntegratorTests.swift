import XCTest
@testable import QuantumCore

final class IntegratorTests: XCTestCase {

    func testSimpsonConstant() {
        let result = Integrator.simpson(f: { _ in 5.0 }, a: 0, b: 10, n: 100)
        XCTAssertEqual(result, 50.0, accuracy: 1e-10)
    }

    func testSimpsonLinear() {
        let result = Integrator.simpson(f: { x in x }, a: 0, b: 4, n: 100)
        // ∫₀⁴ x dx = 8
        XCTAssertEqual(result, 8.0, accuracy: 1e-10)
    }

    func testSimpsonQuadratic() {
        let result = Integrator.simpson(f: { x in x * x }, a: 0, b: 3, n: 100)
        // ∫₀³ x² dx = 9
        XCTAssertEqual(result, 9.0, accuracy: 1e-6)
    }

    func testSimpsonSine() {
        let result = Integrator.simpson(f: { x in sin(x) }, a: 0, b: .pi, n: 200)
        // ∫₀^π sin(x) dx = 2
        XCTAssertEqual(result, 2.0, accuracy: 1e-6)
    }

    func testTrapezoidalConstant() {
        let result = Integrator.trapezoidal(f: { _ in 5.0 }, a: 0, b: 10, n: 100)
        XCTAssertEqual(result, 50.0, accuracy: 1e-10)
    }

    func testTrapezoidalLinear() {
        let result = Integrator.trapezoidal(f: { x in x }, a: 0, b: 4, n: 100)
        XCTAssertEqual(result, 8.0, accuracy: 1e-6)
    }

    func testPathIntegralStraightLine() {
        // Zeitkostenfeld f(x,y) = 1 (konstant)
        // Gerade von (0,0) nach (10,0): |γ'| = 10, f = 1
        // T[γ] = ∫ 1 · 10 dt = 10
        let points = [
            RealVector([0, 0]),
            RealVector([10, 0]),
        ]
        let T = Integrator.pathIntegral(controlPoints: points, timeField: { _ in 1.0 }, samples: 300)
        XCTAssertEqual(T, 10.0, accuracy: 1e-3)
    }

    func testPathIntegralUniformScaling() {
        // f(x,y) = 2 überall, Strecke (0,0)→(5,0)
        // Erwartung: 2 · 5 = 10
        let points = [
            RealVector([0, 0]),
            RealVector([5, 0]),
        ]
        let T = Integrator.pathIntegral(controlPoints: points, timeField: { _ in 2.0 }, samples: 300)
        XCTAssertEqual(T, 10.0, accuracy: 1e-3)
    }
}
