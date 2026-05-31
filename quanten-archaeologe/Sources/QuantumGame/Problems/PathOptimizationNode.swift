import SpriteKit
import QuantumCore

/// Mechanik A: Pfad-Optimierung (Variationsrechnung / Analysis)
///
/// Der Spieler setzt Kontrollpunkte in ein Zeitkostenfeld.
/// Ziel: Minimiere  T[γ] = ∫ f(γ(t)) · |γ'(t)| dt
public class PathOptimizationNode: SKNode, OptimizableNode {
    public var onComplete: ((OptimizationResult) -> Void)?

    private let fieldSize = CGSize(width: 600, height: 400)
    private var controlPoints: [CGPoint] = []
    private var pointNodes: [SKShapeNode] = []
    private var pathNode: SKShapeNode!
    private var heatmapNode: SKSpriteNode!
    private var draggingPoint: SKShapeNode?

    // Mathematisches Zeitkostenfeld: f(x,y) = 1 + 0.3·sin(0.02x)·cos(0.02y) + 0.2·x/600
    private func timeField(at p: RealVector) -> Double {
        let x = p[0]
        let y = p[1]
        return 1.0 + 0.3 * sin(0.02 * x) * cos(0.02 * y) + 0.2 * (x / 600.0)
    }

    private var problem: PathOptimizationProblem!

    public init(size: CGSize) {
        super.init()
        self.setScale(1.0)
        setupBackground()
        setupHeatmap()
        setupPathUI()
        setupProblem()
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    private func setupBackground() {
        let bg = SKSpriteNode(color: .darkGray, size: fieldSize)
        bg.position = .zero
        bg.name = "background"
        addChild(bg)
    }

    private func setupHeatmap() {
        // Prozedurale Textur des Gradientenfeldes (vereinfacht als farbige Sprite)
        let heatmap = SKSpriteNode(color: .clear, size: fieldSize)
        heatmap.position = .zero
        addChild(heatmap)
        self.heatmapNode = heatmap
    }

    private func setupPathUI() {
        pathNode = SKShapeNode()
        pathNode.strokeColor = .cyan
        pathNode.lineWidth = 3.0
        pathNode.glowWidth = 2.0
        addChild(pathNode)

        // Start- und Ziel festlegen
        let start = CGPoint(x: -fieldSize.width/2 + 20, y: 0)
        let end = CGPoint(x: fieldSize.width/2 - 20, y: 0)
        controlPoints = [start, CGPoint(x: -100, y: 80), CGPoint(x: 100, y: -60), end]
        rebuildPointNodes()
        updatePath()

        let title = SKLabelNode(text: "Mechanik A: Optimaler Pfad")
        title.fontSize = 20
        title.fontColor = .white
        title.position = CGPoint(x: 0, y: fieldSize.height/2 + 30)
        addChild(title)

        let instr = SKLabelNode(text: "Verschiebe Punkte. Minimiere die Integral-Zeit. LEERTASTE = abschließen.")
        instr.fontSize = 12
        instr.fontColor = .lightGray
        instr.position = CGPoint(x: 0, y: fieldSize.height/2 + 10)
        addChild(instr)

        let timeLabel = SKLabelNode(text: "Zeit: --")
        timeLabel.fontSize = 14
        timeLabel.fontColor = .cyan
        timeLabel.position = CGPoint(x: 0, y: -fieldSize.height/2 - 30)
        timeLabel.name = "timeLabel"
        addChild(timeLabel)
    }

    private func setupProblem() {
        problem = PathOptimizationProblem(field: timeField, points: controlPoints)
    }

    private func rebuildPointNodes() {
        pointNodes.forEach { $0.removeFromParent() }
        pointNodes = controlPoints.map { cp in
            let node = SKShapeNode(circleOfRadius: 8)
            node.fillColor = .magenta
            node.strokeColor = .white
            node.position = cp
            node.name = "cp"
            addChild(node)
            return node
        }
    }

    private func updatePath() {
        guard controlPoints.count > 1 else { return }
        let path = CGMutablePath()
        path.move(to: controlPoints[0])
        for i in 1..<controlPoints.count {
            path.addLine(to: controlPoints[i])
        }
        pathNode.path = path

        let vectors = controlPoints.map { RealVector([Double($0.x), Double($0.y)]) }
        let T = Integrator.pathIntegral(controlPoints: vectors, timeField: timeField, samples: 400)

        if let label = childNode(withName: "//timeLabel") as? SKLabelNode {
            label.text = String(format: "Zeit: %.3f s  (Optimum ≈ %.3f)", T, problem.analyticOptimumValue ?? 0)
        }
    }

    // MARK: — Interaktion

    override public func mouseDown(with event: NSEvent) {
        let loc = event.location(in: self)
        for node in pointNodes {
            if node.contains(loc) {
                draggingPoint = node
                return
            }
        }
    }

    override public func mouseDragged(with event: NSEvent) {
        guard let drag = draggingPoint else { return }
        let loc = event.location(in: self)
        drag.position = loc
        if let idx = pointNodes.firstIndex(of: drag) {
            controlPoints[idx] = loc
        }
        updatePath()
    }

    override public func mouseUp(with event: NSEvent) {
        draggingPoint = nil
    }

    override public func keyDown(with event: NSEvent) {
        if event.keyCode == 49 || event.keyCode == 36 { // Space / Return
            let vectors = controlPoints.map { RealVector([Double($0.x), Double($0.y)]) }
            let result = OptimizationResult(problem: problem, solution: RealVector(vectors.flatMap(\.components)))
            onComplete?(result)
        }
    }
}

// MARK: — Problem-Definition

struct PathOptimizationProblem: OptimizationProblem {
    let field: (RealVector) -> Double
    let points: [CGPoint]

    var dimension: Int { points.count * 2 }
    var name: String { "Pfad-Optimierung im Zeitkostenfeld" }
    var analyticOptimumValue: Double? { 480.0 } // approx für dieses Feld

    func objective(at x: RealVector) -> Double {
        var vecs: [RealVector] = []
        for i in stride(from: 0, to: x.dim, by: 2) {
            vecs.append(RealVector([x[i], x[i+1]]))
        }
        return Integrator.pathIntegral(controlPoints: vecs, timeField: field, samples: 400)
    }

    func constraints(at x: RealVector) -> [Double] {
        return [] // unbeschränkt innerhalb des Feldes
    }
}
