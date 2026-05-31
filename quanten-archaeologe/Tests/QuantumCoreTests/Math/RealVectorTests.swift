import XCTest
@testable import QuantumCore

final class RealVectorTests: XCTestCase {

    func testInitialization() {
        let v = RealVector([1.0, 2.0, 3.0])
        XCTAssertEqual(v.dim, 3)
        XCTAssertEqual(v[0], 1.0)
        XCTAssertEqual(v[1], 2.0)
        XCTAssertEqual(v[2], 3.0)
    }

    func testAddition() {
        let a = RealVector([1.0, 2.0])
        let b = RealVector([3.0, 4.0])
        let c = a + b
        XCTAssertEqual(c[0], 4.0)
        XCTAssertEqual(c[1], 6.0)
    }

    func testSubtraction() {
        let a = RealVector([5.0, 7.0])
        let b = RealVector([2.0, 3.0])
        let c = a - b
        XCTAssertEqual(c[0], 3.0)
        XCTAssertEqual(c[1], 4.0)
    }

    func testScalarMultiplication() {
        let v = RealVector([1.0, 2.0, 3.0])
        let w = 2.0 * v
        XCTAssertEqual(w[0], 2.0)
        XCTAssertEqual(w[1], 4.0)
        XCTAssertEqual(w[2], 6.0)
    }

    func testDotProduct() {
        let a = RealVector([1.0, 2.0, 3.0])
        let b = RealVector([4.0, 5.0, 6.0])
        XCTAssertEqual(a.dot(b), 32.0, accuracy: 1e-10)
    }

    func testNorm() {
        let v = RealVector([3.0, 4.0])
        XCTAssertEqual(v.norm, 5.0, accuracy: 1e-10)
    }

    func testSquaredNorm() {
        let v = RealVector([1.0, 2.0, 2.0])
        XCTAssertEqual(v.squaredNorm, 9.0, accuracy: 1e-10)
    }

    func testDistance() {
        let a = RealVector([0.0, 0.0])
        let b = RealVector([3.0, 4.0])
        XCTAssertEqual(a.distance(to: b), 5.0, accuracy: 1e-10)
    }

    func testZeroVector() {
        let z = RealVector([0.0, 0.0, 0.0])
        XCTAssertEqual(z.norm, 0.0, accuracy: 1e-10)
    }

    func testDescription() {
        let v = RealVector([1.0, -2.0])
        XCTAssertTrue(v.description.contains("+1.0000"))
        XCTAssertTrue(v.description.contains("-2.0000"))
    }
}
