import SpriteKit
import QuantumCore

/// Mechanik D: Dimensionale Kompression (SVD / PCA)
///
/// Ziel: Wähle k sodass ‖X − Xₖ‖ minimal und Speicher minimal.
public class CompressionNode: SKNode, OptimizableNode {
    public var onComplete: ((OptimizationResult) -> Void)?

    private let panel = CGSize(width: 700, height: 450)
    private var singularValues: [Double] = []
    private var selectedK: Int = 1
    private var barNodes: [SKSpriteNode] = []
    private var selectionLine: SKShapeNode!
    private var problem: CompressionProblem!

    public init(size: CGSize) {
        super.init()
        setupBackground()
        generateDataAndSVD()
        setupUI()
        setupProblem()
        updateSelection()
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    private func setupBackground() {
        let bg = SKSpriteNode(color: NSColor(calibratedRed: 0.06, green: 0.06, blue: 0.14, alpha: 1), size: panel)
        bg.position = .zero
        addChild(bg)

        let title = SKLabelNode(text: "Mechanik D: Dimensionale Kompression (SVD)")
        title.fontSize = 18
        title.fontColor = .white
        title.position = CGPoint(x: 0, y: panel.height/2 + 30)
        addChild(title)

        let sub = SKLabelNode(text: "Wähle k. Erhalte maximale Varianz bei minimalem Speicher. Klicke Balken. LEERTASTE = abschließen.")
        sub.fontSize = 11
        sub.fontColor = .lightGray
        sub.position = CGPoint(x: 0, y: panel.height/2 + 10)
        addChild(sub)
    }

    private func generateDataAndSVD() {
        // Erzeuge eine 10×8-Matrix mit abfallender Varianz (simulierte Aethel-Daten)
        var data: [Double] = []
        for _ in 0..<10 {
            for j in 0..<8 {
                let v = Double.random(in: 0...1) * exp(-0.3 * Double(j))
                data.append(v)
            }
        }
        let X = RealMatrix(rows: 10, cols: 8, data: data)
        let (_, sigma, _) = X.svd()
        singularValues = sigma
    }

    private func setupUI() {
        let chartW: CGFloat = 500
        let chartH: CGFloat = 200
        let startX = -chartW / 2
        let startY: CGFloat = -50
        let barW = chartW / CGFloat(singularValues.count)

        let maxSigma = singularValues.max() ?? 1
        for (i, sigma) in singularValues.enumerated() {
            let h = CGFloat(sigma / maxSigma) * chartH
            let bar = SKSpriteNode(color: .systemPink, size: CGSize(width: barW - 4, height: h))
            bar.anchorPoint = CGPoint(x: 0.5, y: 0)
            let barX = startX + CGFloat(i) * barW + barW / 2
            bar.position = CGPoint(x: barX, y: startY)
            bar.name = "bar_\(i)"
            addChild(bar)
            barNodes.append(bar)
        }

        // Summenlinie (kumulative Varianz)
        let totalVar = singularValues.map { $0 * $0 }.reduce(0, +)
        let cumsum = singularValues.reduce(into: [0.0]) { acc, s in acc.append((acc.last ?? 0) + s * s) }
        let path = CGMutablePath()
        for i in 0..<singularValues.count {
            let px = startX + CGFloat(i) * barW + barW / 2
            let varRatio = cumsum[i+1] / totalVar
            let py = startY + CGFloat(varRatio) * chartH
            if i == 0 {
                path.move(to: CGPoint(x: px, y: py))
            } else {
                path.addLine(to: CGPoint(x: px, y: py))
            }
        }
        let line = SKShapeNode(path: path)
        line.strokeColor = .systemTeal
        line.lineWidth = 2.0
        addChild(line)

        selectionLine = SKShapeNode()
        selectionLine.strokeColor = .yellow
        selectionLine.lineWidth = 3.0
        addChild(selectionLine)

        let info = SKLabelNode(text: "k=1, Varianz=--%, Speicher=--%")
        info.fontSize = 13
        info.fontColor = .white
        info.position = CGPoint(x: 0, y: -panel.height/2 + 50)
        info.name = "infoLabel"
        addChild(info)
    }

    private func setupProblem() {
        problem = CompressionProblem(singularValues: singularValues, totalDimensions: singularValues.count)
    }

    private func updateSelection() {
        let chartW: CGFloat = 500
        let startX = -chartW / 2
        let barW = chartW / CGFloat(singularValues.count)
        let cutX = startX + CGFloat(selectedK) * barW

        let path = CGMutablePath()
        path.move(to: CGPoint(x: cutX, y: -50))
        path.addLine(to: CGPoint(x: cutX, y: 180))
        selectionLine.path = path

        let keptVar = singularValues.prefix(selectedK).map { $0 * $0 }.reduce(0, +)
        let totalVar = singularValues.map { $0 * $0 }.reduce(0, +)
        let pctVar = totalVar > 0 ? (keptVar / totalVar) * 100 : 0
        let pctStorage = (Double(selectedK) / Double(singularValues.count)) * 100

        if let label = childNode(withName: "//infoLabel") as? SKLabelNode {
            label.text = String(format: "k=%d, Varianz=%.1f%%, Speicher=%.1f%%", selectedK, pctVar, pctStorage)
        }

        // Highlight
        for (i, bar) in barNodes.enumerated() {
            bar.color = i < selectedK ? .systemPink : .darkGray
        }
    }

    // MARK: — Interaktion

    override public func mouseDown(with event: NSEvent) {
        let loc = event.location(in: self)
        for bar in barNodes {
            if bar.contains(loc) {
                if let name = bar.name, let idx = Int(name.split(separator: "_").last ?? "") {
                    selectedK = idx + 1
                    updateSelection()
                }
            }
        }
    }

    override public func keyDown(with event: NSEvent) {
        if event.keyCode == 49 || event.keyCode == 36 {
            let vec = RealVector([Double(selectedK)])
            let result = OptimizationResult(problem: problem, solution: vec)
            onComplete?(result)
        }
    }
}

// MARK: — Problem

struct CompressionProblem: OptimizationProblem {
    let singularValues: [Double]
    let totalDimensions: Int

    var dimension: Int { 1 }
    var name: String { "SVD-Dimensionale Kompression" }
    var analyticOptimum: RealVector? { nil } // Subjektiver Trade-off
    var analyticOptimumValue: Double? { nil }

    func objective(at x: RealVector) -> Double {
        let k = max(1, min(totalDimensions, Int(round(x[0]))))
        let keptVar = singularValues.prefix(k).map { $0 * $0 }.reduce(0, +)
        let totalVar = singularValues.map { $0 * $0 }.reduce(0, +)
        let infoRatio = totalVar > 0 ? keptVar / totalVar : 0
        let storageRatio = Double(k) / Double(totalDimensions)
        // Multi-Objektiv: maximiere Info bei wenig Speicher
        // Normalisierte Zielfunktion: InfoRatio / (1 + StorageRatio)
        return -(infoRatio / (1.0 + 2.0 * storageRatio))
    }

    func constraints(at x: RealVector) -> [Double] {
        let k = x[0]
        return [1 - k, k - Double(totalDimensions)] // 1 ≤ k ≤ n
    }
}
