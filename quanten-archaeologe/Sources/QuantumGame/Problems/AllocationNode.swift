import SpriteKit
import QuantumCore

/// Mechanik C: Energie-Zeit-Allokation (Konvexe Optimierung / LP)
///
/// Ziel: max Σ aᵢ·√tᵢ   u.d.N.   Σ Pᵢ·tᵢ ≤ E , tᵢ ≥ 0
public class AllocationNode: SKNode, OptimizableNode {
    public var onComplete: ((OptimizationResult) -> Void)?

    private let panel = CGSize(width: 700, height: 450)
    private var scanBars: [(node: SKSpriteNode, a: Double, P: Double, t: Double)] = []
    private var energyFill: SKSpriteNode!
    private var totalEnergy: Double = 100.0
    private var usedEnergy: Double = 0.0

    private let aValues = [4.0, 3.0, 5.0, 2.5, 3.5]
    private let pValues = [2.0, 1.5, 3.0, 1.0, 2.5]
    private var problem: AllocationProblem!

    public init(size: CGSize) {
        super.init()
        setupBackground()
        setupScans()
        setupProblem()
        updateEnergy()
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    private func setupBackground() {
        let bg = SKSpriteNode(color: NSColor(calibratedRed: 0.05, green: 0.05, blue: 0.12, alpha: 1), size: panel)
        bg.position = .zero
        addChild(bg)

        let title = SKLabelNode(text: "Mechanik C: Energie-Zeit-Allokation")
        title.fontSize = 18
        title.fontColor = .white
        title.position = CGPoint(x: 0, y: panel.height/2 + 30)
        addChild(title)

        let sub = SKLabelNode(text: "Maximiere Σ aᵢ·√tᵢ bei Σ Pᵢ·tᵢ ≤ 100. Ziehe Balken. LEERTASTE = abschließen.")
        sub.fontSize = 11
        sub.fontColor = .lightGray
        sub.position = CGPoint(x: 0, y: panel.height/2 + 10)
        addChild(sub)
    }

    private func setupScans() {
        let count = aValues.count
        let barWidth: CGFloat = 400
        let barHeight: CGFloat = 28
        let spacing: CGFloat = 50
        let startY = CGFloat(count - 1) * spacing / 2

        for i in 0..<count {
            let y = startY - CGFloat(i) * spacing

            let label = SKLabelNode(text: "Scan \(i+1): a=\(aValues[i]), P=\(pValues[i])")
            label.fontSize = 12
            label.fontColor = .white
            label.horizontalAlignmentMode = .left
            label.position = CGPoint(x: -panel.width/2 + 20, y: y + 8)
            addChild(label)

            let track = SKSpriteNode(color: .darkGray, size: CGSize(width: barWidth, height: barHeight))
            track.position = CGPoint(x: 30, y: y)
            track.name = "track_\(i)"
            addChild(track)

            let fill = SKSpriteNode(color: .systemOrange, size: CGSize(width: 0, height: barHeight))
            fill.anchorPoint = CGPoint(x: 0, y: 0.5)
            fill.position = CGPoint(x: -barWidth/2, y: y)
            fill.name = "fill_\(i)"
            addChild(fill)

            let valueLabel = SKLabelNode(text: "t=0.00")
            valueLabel.fontSize = 11
            valueLabel.fontColor = .systemOrange
            valueLabel.horizontalAlignmentMode = .left
            valueLabel.position = CGPoint(x: 30 + barWidth/2 + 10, y: y - 4)
            valueLabel.name = "value_\(i)"
            addChild(valueLabel)

            scanBars.append((fill, aValues[i], pValues[i], 0.0))
        }

        // Energie-Füllstand
        let energyTrack = SKSpriteNode(color: .darkGray, size: CGSize(width: 300, height: 16))
        energyTrack.position = CGPoint(x: 0, y: -panel.height/2 + 40)
        addChild(energyTrack)

        energyFill = SKSpriteNode(color: .cyan, size: CGSize(width: 0, height: 16))
        energyFill.anchorPoint = CGPoint(x: 0, y: 0.5)
        energyFill.position = CGPoint(x: -150, y: -panel.height/2 + 40)
        addChild(energyFill)

        let eLabel = SKLabelNode(text: "Energie: 0 / 100")
        eLabel.fontSize = 12
        eLabel.fontColor = .cyan
        eLabel.position = CGPoint(x: 0, y: -panel.height/2 + 18)
        eLabel.name = "energyLabel"
        addChild(eLabel)

        let objLabel = SKLabelNode(text: "Zielwert: 0.00")
        objLabel.fontSize = 13
        objLabel.fontColor = .white
        objLabel.position = CGPoint(x: 0, y: -panel.height/2 - 10)
        objLabel.name = "objLabel"
        addChild(objLabel)
    }

    private func setupProblem() {
        problem = AllocationProblem(a: aValues, P: pValues, E: totalEnergy)
    }

    private func updateEnergy() {
        usedEnergy = scanBars.map { $0.P * $0.t }.reduce(0, +)
        let ratio = min(usedEnergy / totalEnergy, 1.0)
        energyFill.size.width = CGFloat(ratio * 300)
        energyFill.color = usedEnergy > totalEnergy ? .systemRed : .cyan

        if let label = childNode(withName: "//energyLabel") as? SKLabelNode {
            label.text = String(format: "Energie: %.1f / %.0f", usedEnergy, totalEnergy)
        }

        let obj = ConvexOptimizer.objective(a: aValues, t: scanBars.map(\.t))
        if let label = childNode(withName: "//objLabel") as? SKLabelNode {
            label.text = String(format: "Zielwert: %.2f  (Optimum: %.2f)", obj, problem.analyticOptimumValue ?? 0)
        }
    }

    // MARK: — Interaktion

    private var activeBarIndex: Int?
    private let barWidth: CGFloat = 400

    override public func mouseDown(with event: NSEvent) {
        let loc = event.location(in: self)
        for (i, bar) in scanBars.enumerated() {
            let trackRect = CGRect(
                x: 30 - Int(barWidth/2),
                y: Int(bar.node.position.y) - 14,
                width: Int(barWidth),
                height: 28
            )
            if trackRect.contains(NSPoint(x: loc.x, y: loc.y)) {
                activeBarIndex = i
                return
            }
        }
    }

    override public func mouseDragged(with event: NSEvent) {
        guard let idx = activeBarIndex else { return }
        let loc = event.location(in: self)
        let trackLeft = 30.0 - Double(barWidth) / 2.0
        let localX = max(0, min(Double(barWidth), Double(loc.x) - trackLeft))
        let t = localX / 10.0  // 1 px ≈ 0.1 Zeit

        scanBars[idx].t = t
        scanBars[idx].node.size.width = CGFloat(localX)

        if let vLabel = childNode(withName: "value_\(idx)") as? SKLabelNode {
            vLabel.text = String(format: "t=%.2f", t)
        }

        updateEnergy()
    }

    override public func mouseUp(with event: NSEvent) {
        activeBarIndex = nil
    }

    override public func keyDown(with event: NSEvent) {
        if event.keyCode == 49 || event.keyCode == 36 {
            let tVec = RealVector(scanBars.map(\.t))
            let result = OptimizationResult(problem: problem, solution: tVec)
            onComplete?(result)
        }
    }
}

// MARK: — Problem

struct AllocationProblem: OptimizationProblem {
    let a: [Double]
    let P: [Double]
    let E: Double

    var dimension: Int { a.count }
    var name: String { "Konvexe Energie-Allokation" }
    var analyticOptimum: RealVector? {
        RealVector(ConvexOptimizer.optimalAllocation(a: a, P: P, E: E))
    }
    var analyticOptimumValue: Double? {
        guard let t = analyticOptimum else { return nil }
        return ConvexOptimizer.objective(a: a, t: t.components)
    }

    func objective(at x: RealVector) -> Double {
        return -ConvexOptimizer.objective(a: a, t: (0..<dimension).map { x[$0] })
    }

    func constraints(at x: RealVector) -> [Double] {
        var g: [Double] = []
        let energy = zip(P, (0..<dimension).map { x[$0] }).map(*).reduce(0, +)
        g.append(energy - E)
        for i in 0..<dimension {
            g.append(-x[i]) // t_i >= 0  =>  -t_i <= 0
        }
        return g
    }
}
