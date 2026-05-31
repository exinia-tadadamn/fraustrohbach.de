import SpriteKit
import QuantumCore

/// Mechanik B: Signal-Dekomposition (Lineare Algebra / Least Squares)
///
/// Ziel: Finde Koeffizienten c so dass  ‖ Σ cᵢ·φᵢ(t) − s(t) ‖ minimal wird.
public class SignalFitNode: SKNode, OptimizableNode {
    public var onComplete: ((OptimizationResult) -> Void)?

    private let canvas = CGSize(width: 700, height: 350)
    private var basisSliders: [(node: SKShapeNode, coeff: Double, basis: (Double) -> Double)] = []
    private var targetSignal: [(t: Double, value: Double)] = []
    private var fitPath: SKShapeNode!
    private var residualPath: SKShapeNode!
    private var coefficients: [Double] = [0, 0, 0]
    private var problem: SignalFitProblem!

    // Zielsignal: 3·sin(2t) + 1.5·cos(5t) + Rauschen
    private let trueA = [3.0, 1.5, 0.8]

    public init(size: CGSize) {
        super.init()
        setupBackground()
        generateSignal()
        setupUI()
        setupProblem()
        updateFit()
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    private func setupBackground() {
        let bg = SKSpriteNode(color: NSColor(calibratedRed: 0.08, green: 0.08, blue: 0.15, alpha: 1), size: canvas)
        bg.position = .zero
        addChild(bg)
    }

    private func generateSignal() {
        let n = 100
        for i in 0..<n {
            let t = Double(i) / Double(n - 1) * 2 * .pi
            let noise = Double.random(in: -0.3...0.3)
            let val = trueA[0] * sin(2*t) + trueA[1] * cos(5*t) + trueA[2] * sin(8*t) + noise
            targetSignal.append((t, val))
        }
    }

    private func setupUI() {
        // Zeichne Zielsignal
        let targetPath = signalPath(points: targetSignal.map { ($0.t, $0.value) }, color: .systemRed)
        addChild(targetPath)

        fitPath = SKShapeNode()
        fitPath.strokeColor = .cyan
        fitPath.lineWidth = 2.5
        addChild(fitPath)

        residualPath = SKShapeNode()
        residualPath.strokeColor = .yellow
        residualPath.lineWidth = 1.0
        residualPath.alpha = 0.5
        addChild(residualPath)

        // Slider-Regler für 3 Basisfunktionen
        let labels = ["3·sin(2t)", "1.5·cos(5t)", "0.8·sin(8t)"]
        for i in 0..<3 {
            let yPos = -canvas.height/2 + 40 + CGFloat(i) * 40
            let track = SKShapeNode(rectOf: CGSize(width: 200, height: 6))
            track.fillColor = .darkGray
            track.strokeColor = .clear
            track.position = CGPoint(x: canvas.width/2 - 120, y: yPos)
            addChild(track)

            let knob = SKShapeNode(circleOfRadius: 10)
            knob.fillColor = .magenta
            knob.position = CGPoint(x: track.position.x, y: yPos)
            knob.name = "slider_\(i)"
            addChild(knob)

            let label = SKLabelNode(text: "\(labels[i]): 0.00")
            label.fontSize = 12
            label.fontColor = .white
            label.horizontalAlignmentMode = .left
            label.position = CGPoint(x: track.position.x + 120, y: yPos - 6)
            label.name = "label_\(i)"
            addChild(label)

            let basis = basisFunction(index: i)
            basisSliders.append((knob, 0.0, basis))
        }

        let title = SKLabelNode(text: "Mechanik B: Signal-Dekomposition (Least Squares)")
        title.fontSize = 18
        title.fontColor = .white
        title.position = CGPoint(x: 0, y: canvas.height/2 + 30)
        addChild(title)

        let help = SKLabelNode(text: "Ziehe Regler. Minimiere den Fehler ‖A·c − b‖₂. LEERTASTE = abschließen.")
        help.fontSize = 11
        help.fontColor = .lightGray
        help.position = CGPoint(x: 0, y: -canvas.height/2 - 20)
        addChild(help)

        let errLabel = SKLabelNode(text: "Fehler: --")
        errLabel.fontSize = 13
        errLabel.fontColor = .yellow
        errLabel.position = CGPoint(x: 0, y: -canvas.height/2 - 40)
        errLabel.name = "errorLabel"
        addChild(errLabel)
    }

    private func basisFunction(index: Int) -> (Double) -> Double {
        switch index {
        case 0: return { t in sin(2*t) }
        case 1: return { t in cos(5*t) }
        case 2: return { t in sin(8*t) }
        default: return { _ in 0 }
        }
    }

    private func signalPath(points: [(Double, Double)], color: NSColor) -> SKShapeNode {
        let path = CGMutablePath()
        let xScale = canvas.width / (2 * .pi)
        let yScale = canvas.height / 10.0
        let origin = CGPoint(x: -canvas.width/2, y: 0)

        for (i, pt) in points.enumerated() {
            let px = origin.x + CGFloat(pt.0) * CGFloat(xScale)
            let py = origin.y + CGFloat(pt.1) * CGFloat(yScale)
            if i == 0 { path.move(to: CGPoint(x: px, y: py)) }
            else { path.addLine(to: CGPoint(x: px, y: py)) }
        }
        let node = SKShapeNode(path: path)
        node.strokeColor = color
        node.lineWidth = 2.0
        return node
    }

    private func setupProblem() {
        let m = targetSignal.count
        let n = 3
        var Adata: [Double] = []
        var bdata: [Double] = []
        for pt in targetSignal {
            for i in 0..<n {
                Adata.append(basisFunction(index: i)(pt.t))
            }
            bdata.append(pt.value)
        }
        let A = RealMatrix(rows: m, cols: n, data: Adata)
        let b = RealVector(bdata)
        problem = SignalFitProblem(A: A, b: b)

        // Analytische Lösung als Benchmark
        if let cOpt = LeastSquaresSolver.solve(A: A, b: b) {
            for i in 0..<3 {
                coefficients[i] = cOpt[i]
                updateSlider(index: i, value: cOpt[i])
            }
            // Aber wir starten mit 0, damit der Spieler selbst optimiert
            for i in 0..<3 {
                coefficients[i] = 0
                updateSlider(index: i, value: 0)
            }
        }
    }

    private func updateSlider(index: Int, value: Double) {
        guard index < basisSliders.count else { return }
        let trackX = canvas.width/2 - 120
        let clamped = max(-5, min(5, value))
        basisSliders[index].node.position.x = trackX + CGFloat(clamped) * 20.0
        basisSliders[index].coeff = clamped
        if let label = childNode(withName: "label_\(index)") as? SKLabelNode {
            label.text = String(format: "c\(index+1): %.2f", clamped)
        }
    }

    private func updateFit() {
        var fitPoints: [(Double, Double)] = []
        var residualPoints: [(Double, Double)] = []
        let xScale = canvas.width / (2 * .pi)
        let yScale = canvas.height / 10.0
        let origin = CGPoint(x: -canvas.width/2, y: 0)

        var totalError = 0.0
        for pt in targetSignal {
            var val = 0.0
            for i in 0..<basisSliders.count {
                val += basisSliders[i].coeff * basisSliders[i].basis(pt.t)
            }
            let px = origin.x + CGFloat(pt.0) * CGFloat(xScale)
            let py = origin.y + CGFloat(val) * CGFloat(yScale)
            fitPoints.append((Double(px), Double(py)))

            let res = pt.value - val
            let rpy = origin.y + CGFloat(res) * CGFloat(yScale)
            residualPoints.append((Double(px), Double(rpy)))
            totalError += res * res
        }

        let path = CGMutablePath()
        for (i, pt) in fitPoints.enumerated() {
            let p = CGPoint(x: CGFloat(pt.0), y: CGFloat(pt.1))
            i == 0 ? path.move(to: p) : path.addLine(to: p)
        }
        fitPath.path = path

        let resPath = CGMutablePath()
        for (i, pt) in residualPoints.enumerated() {
            let p = CGPoint(x: CGFloat(pt.0), y: CGFloat(pt.1))
            i == 0 ? resPath.move(to: p) : resPath.addLine(to: p)
        }
        residualPath.path = resPath

        let errorNorm = sqrt(totalError)
        if let label = childNode(withName: "//errorLabel") as? SKLabelNode {
            let opt = LeastSquaresSolver.residual(A: problem.A, b: problem.b, c: problem.analyticOptimum!)
            label.text = String(format: "Fehler: %.3f  (Optimum: %.3f)", errorNorm, opt)
        }
    }

    // MARK: — Interaktion

    private var activeSlider: SKShapeNode?

    override public func mouseDown(with event: NSEvent) {
        let loc = event.location(in: self)
        for slider in basisSliders {
            if slider.node.contains(loc) {
                activeSlider = slider.node
                return
            }
        }
    }

    override public func mouseDragged(with event: NSEvent) {
        guard let active = activeSlider, let idx = basisSliders.firstIndex(where: { $0.node === active }) else { return }
        let trackCenter = canvas.width/2 - 120
        let dx = Double(event.location(in: self).x - trackCenter)
        let newVal = dx / 20.0
        updateSlider(index: idx, value: newVal)
        updateFit()
    }

    override public func mouseUp(with event: NSEvent) {
        activeSlider = nil
    }

    override public func keyDown(with event: NSEvent) {
        if event.keyCode == 49 || event.keyCode == 36 {
            let c = RealVector(coefficients)
            let result = OptimizationResult(problem: problem, solution: c)
            onComplete?(result)
        }
    }
}

// MARK: — Problem

struct SignalFitProblem: OptimizationProblem {
    let A: RealMatrix
    let b: RealVector

    var dimension: Int { A.cols }
    var name: String { "Signal-Least-Squares" }
    var analyticOptimum: RealVector? { LeastSquaresSolver.solve(A: A, b: b) }
    var analyticOptimumValue: Double? {
        guard let c = analyticOptimum else { return nil }
        return LeastSquaresSolver.residual(A: A, b: b, c: c)
    }

    func objective(at x: RealVector) -> Double {
        return LeastSquaresSolver.residual(A: A, b: b, c: x)
    }

    func constraints(at x: RealVector) -> [Double] {
        return []
    }
}
