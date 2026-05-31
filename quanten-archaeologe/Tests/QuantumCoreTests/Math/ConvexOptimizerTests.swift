import XCTest
@testable import QuantumCore

final class ConvexOptimizerTests: XCTestCase {

    func testAllocationExactBudgetUsage() {
        let a = [4.0, 3.0, 5.0]
        let P = [2.0, 1.5, 3.0]
        let E = 100.0
        let t = ConvexOptimizer.optimalAllocation(a: a, P: P, E: E)
        let used = zip(P, t).map(*).reduce(0, +)
        XCTAssertEqual(used, E, accuracy: 1e-10)
    }

    func testAllocationNonNegative() {
        let a = [4.0, 3.0]
        let P = [2.0, 1.5]
        let E = 100.0
        let t = ConvexOptimizer.optimalAllocation(a: a, P: P, E: E)
        XCTAssertTrue(t.allSatisfy { $0 >= 0 })
    }

    func testAllocationBetterThanUniform() {
        let a = [5.0, 1.0]
        let P = [1.0, 5.0]
        let E = 10.0

        // Optimal
        let tOpt = ConvexOptimizer.optimalAllocation(a: a, P: P, E: E)
        let valOpt = ConvexOptimizer.objective(a: a, t: tOpt)

        // Gleichverteilt: t_i = E/2
        let tUni = [5.0, 5.0]
        let valUni = ConvexOptimizer.objective(a: a, t: tUni)

        // Das optimale sollte besser (größer) sein als gleichverteilt
        XCTAssertGreaterThan(valOpt, valUni)
    }

    func testAllocationClosedFormMatchesLagrange() {
        // Für a=[1,1], P=[1,1], E=10 sollte t=[5,5]
        let a = [1.0, 1.0]
        let P = [1.0, 1.0]
        let E = 10.0
        let t = ConvexOptimizer.optimalAllocation(a: a, P: P, E: E)
        XCTAssertEqual(t[0], 5.0, accuracy: 1e-10)
        XCTAssertEqual(t[1], 5.0, accuracy: 1e-10)
    }

    func testObjectiveCalculation() {
        let a = [2.0, 3.0]
        let t = [4.0, 9.0]
        let val = ConvexOptimizer.objective(a: a, t: t)
        // 2*sqrt(4) + 3*sqrt(9) = 2*2 + 3*3 = 13
        XCTAssertEqual(val, 13.0, accuracy: 1e-10)
    }

    func testEnergyUsedCalculation() {
        let P = [2.0, 3.0]
        let t = [5.0, 10.0]
        let used = ConvexOptimizer.energyUsed(P: P, t: t)
        // 2*5 + 3*10 = 40
        XCTAssertEqual(used, 40.0, accuracy: 1e-10)
    }

    func testSingleTaskGetsAll() {
        // Nur eine Aufgabe → alles Energie dorthin
        let a = [5.0]
        let P = [2.0]
        let E = 100.0
        let t = ConvexOptimizer.optimalAllocation(a: a, P: P, E: E)
        XCTAssertEqual(t[0], E / P[0], accuracy: 1e-10)
    }
}
