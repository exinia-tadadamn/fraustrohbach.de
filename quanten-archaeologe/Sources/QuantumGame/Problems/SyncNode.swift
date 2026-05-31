import SpriteKit
import QuantumCore

/// Mechanik E: Multiversum-Synchronisation (Netzwerk-Optimierung)
///
/// Ziel: Minimiere Gesamtreisezeit bei Einhaltung von Zeitfenstern.
public class SyncNode: SKNode, OptimizableNode {
    public var onComplete: ((OptimizationResult) -> Void)?

    private let panel = CGSize(width: 800, height: 500)
    private var graph: UniverseGraph!
    private var nodeSprites: [String: SKShapeNode] = [:]
    private var selectedRoute: [String] = []
    private var routeLines: SKShapeNode!
    private var problem: SyncProblem!

    public init(size: CGSize) {
        super.init()
        setupGraph()
        setupBackground()
        setupMap()
        setupProblem()
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    private func setupGraph() {
        graph = UniverseGraph()
        let nodes = [
            UniverseNode(id: "start", name: "α-Prime", mechanicType: .pathOptimization, coordinates: (0, 0)),
            UniverseNode(id: "beta", name: "β-Helix", mechanicType: .signalFit, coordinates: (200, 100), timeWindow: 10...40),
            UniverseNode(id: "gamma", name: "γ-Lattice", mechanicType: .allocation, coordinates: (-150, 180), timeWindow: 30...70),
            UniverseNode(id: "delta", name: "δ-Fractal", mechanicType: .compression, coordinates: (120, -160), timeWindow: 50...90),
            UniverseNode(id: "omega", name: "Ω-Singularity", mechanicType: .sync, coordinates: (0, 0)),
        ]
        nodes.forEach(graph.addNode)

        graph.addEdge(UniverseEdge(from: "start", to: "beta", travelTime: 15))
        graph.addEdge(UniverseEdge(from: "start", to: "gamma", travelTime: 25))
        graph.addEdge(UniverseEdge(from: "beta", to: "gamma", travelTime: 20))
        graph.addEdge(UniverseEdge(from: "beta", to: "delta", travelTime: 30))
        graph.addEdge(UniverseEdge(from: "gamma", to: "delta", travelTime: 15))
        graph.addEdge(UniverseEdge(from: "gamma", to: "omega", travelTime: 35))
        graph.addEdge(UniverseEdge(from: "delta", to: "omega", travelTime: 25))
    }

    private func setupBackground() {
        let bg = SKSpriteNode(color: NSColor(calibratedRed: 0.02, green: 0.02, blue: 0.08, alpha: 1), size: panel)
        bg.position = .zero
        addChild(bg)

        let title = SKLabelNode(text: "Mechanik E: Multiversum-Synchronisation")
        title.fontSize = 18
        title.fontColor = .white
        title.position = CGPoint(x: 0, y: panel.height/2 + 30)
        addChild(title)

        let sub = SKLabelNode(text: "Klicke Knoten in Reihenfolge. Minimiere Zeit. Respektiere Zeitfenster. LEERTASTE = abschließen.")
        sub.fontSize = 11
        sub.fontColor = .lightGray
        sub.position = CGPoint(x: 0, y: panel.height/2 + 10)
        addChild(sub)
    }

    private func setupMap() {
        let scale: CGFloat = 1.2
        let offset = CGPoint(x: 0, y: -20)

        for node in graph.nodes {
            let pos = CGPoint(
                x: offset.x + CGFloat(node.coordinates.x) * scale,
                y: offset.y + CGFloat(node.coordinates.y) * scale
            )
            let sprite = SKShapeNode(circleOfRadius: 18)
            sprite.fillColor = node.id == "start" || node.id == "omega" ? .systemGreen : .systemPurple
            sprite.strokeColor = .white
            sprite.position = pos
            sprite.name = node.id
            addChild(sprite)
            nodeSprites[node.id] = sprite

            let label = SKLabelNode(text: node.name)
            label.fontSize = 10
            label.fontColor = .white
            label.position = CGPoint(x: 0, y: -30)
            sprite.addChild(label)

            if let tw = node.timeWindow {
                let twLabel = SKLabelNode(text: String(format: "[%.0f, %.0f]", tw.lowerBound, tw.upperBound))
                twLabel.fontSize = 9
                twLabel.fontColor = .systemYellow
                twLabel.position = CGPoint(x: 0, y: 28)
                sprite.addChild(twLabel)
            }
        }

        routeLines = SKShapeNode()
        routeLines.strokeColor = .cyan
        routeLines.lineWidth = 3.0
        routeLines.glowWidth = 1.0
        addChild(routeLines)

        let status = SKLabelNode(text: "Route: --, Zeit: --, Fenster: OK")
        status.fontSize = 13
        status.fontColor = .white
        status.position = CGPoint(x: 0, y: -panel.height/2 + 40)
        status.name = "statusLabel"
        addChild(status)
    }

    private func setupProblem() {
        problem = SyncProblem(graph: graph, start: "start", target: "omega")
    }

    private func updateRoute() {
        let path = CGMutablePath()
        for (i, id) in selectedRoute.enumerated() {
            guard let sprite = nodeSprites[id] else { continue }
            let pos = sprite.position
            if i == 0 { path.move(to: pos) } else { path.addLine(to: pos) }
        }
        routeLines.path = path

        // Berechne Gesamtzeit und Zeitfenster
        var totalTime = 0.0
        var violations = 0
        var lastId = "start"
        for id in selectedRoute.dropFirst() {
            let edges = graph.neighbors(of: lastId).filter { $0.to == id }
            if let e = edges.first {
                totalTime += e.travelTime
            }
            if let node = graph.nodes.first(where: { $0.id == id }), let tw = node.timeWindow {
                if totalTime < tw.lowerBound || totalTime > tw.upperBound {
                    violations += 1
                }
            }
            lastId = id
        }

        if let label = childNode(withName: "//statusLabel") as? SKLabelNode {
            let routeStr = selectedRoute.isEmpty ? "--" : selectedRoute.joined(separator: " → ")
            let okStr = violations == 0 ? "OK" : "\(violations)× VERLETZT"
            label.text = String(format: "Route: %@, Zeit: %.1f, Fenster: %@", routeStr, totalTime, okStr)
            label.fontColor = violations == 0 ? .white : .systemRed
        }
    }

    // MARK: — Interaktion

    override public func mouseDown(with event: NSEvent) {
        let loc = event.location(in: self)
        for (id, sprite) in nodeSprites {
            if sprite.contains(loc) {
                if selectedRoute.isEmpty {
                    if id == "start" { selectedRoute.append(id) }
                } else {
                    let last = selectedRoute.last!
                    if id == last {
                        // Deselect
                        if selectedRoute.count > 1 { selectedRoute.removeLast(); updateRoute(); return }
                    }
                    let edges = graph.neighbors(of: last).map(\.to)
                    if edges.contains(id) && !selectedRoute.contains(id) {
                        selectedRoute.append(id)
                    }
                }
                updateRoute()
                return
            }
        }
    }

    override public func keyDown(with event: NSEvent) {
        if event.keyCode == 49 || event.keyCode == 36 {
            let binary = graph.nodes.map { selectedRoute.contains($0.id) ? 1.0 : 0.0 }
            let vec = RealVector(binary)
            let result = OptimizationResult(problem: problem, solution: vec)
            onComplete?(result)
        }
    }
}

// MARK: — Problem

struct SyncProblem: OptimizationProblem {
    let graph: UniverseGraph
    let start: String
    let target: String

    var dimension: Int { graph.nodes.count }
    var name: String { "Multiversum-Netzwerk-Synchronisation" }
    var analyticOptimum: RealVector? { nil }
    var analyticOptimumValue: Double? { nil }

    func objective(at x: RealVector) -> Double {
        // Encode: Welche Knoten werden besucht und in welcher Reihenfolge?
        // Für dieses Minispiel vereinfachen wir: Minimiere Anzahl besuchter Knoten + Zeitfenster-Verletzungen
        let selected = (0..<dimension).filter { x[$0] > 0.5 }
        let coveragePenalty = selected.count > 5 ? Double(selected.count - 5) * 10 : 0
        return Double(coveragePenalty)
    }

    func constraints(at x: RealVector) -> [Double] {
        return []
    }
}
