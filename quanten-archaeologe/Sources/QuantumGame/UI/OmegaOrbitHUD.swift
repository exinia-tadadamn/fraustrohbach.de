import SpriteKit
import QuantumCore

/// Das futuristische HUD-Interface der Ω-Orbit.
/// Zeigt Chronitonen, verstrichene Zeit und Resonanz-Score an.
public class OmegaOrbitHUD: SKNode {

    private var chronLabel: SKLabelNode!
    private var timeLabel: SKLabelNode!
    private var scoreLabel: SKLabelNode!

    public init(size: CGSize) {
        super.init()

        let bg = SKShapeNode(rectOf: size, cornerRadius: 12)
        bg.fillColor = NSColor(calibratedRed: 0.0, green: 0.0, blue: 0.0, alpha: 0.7)
        bg.strokeColor = .cyan
        bg.lineWidth = 2.0
        addChild(bg)

        chronLabel = SKLabelNode(text: "Chronitonen: 0")
        chronLabel.fontSize = 14
        chronLabel.fontColor = .systemOrange
        chronLabel.position = CGPoint(x: 0, y: 30)
        addChild(chronLabel)

        timeLabel = SKLabelNode(text: "Zeit: 0.0 s")
        timeLabel.fontSize = 14
        timeLabel.fontColor = .systemTeal
        timeLabel.position = CGPoint(x: 0, y: 5)
        addChild(timeLabel)

        scoreLabel = SKLabelNode(text: "Resonanz: 0.00")
        scoreLabel.fontSize = 14
        scoreLabel.fontColor = .white
        scoreLabel.position = CGPoint(x: 0, y: -20)
        addChild(scoreLabel)

        let title = SKLabelNode(text: "Ω-ORBIT")
        title.fontSize = 10
        title.fontColor = .lightGray
        title.position = CGPoint(x: 0, y: 55)
        addChild(title)
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    public func update(bank: ChronitonBank) {
        chronLabel.text = String(format: "Chronitonen: %.0f", bank.chronitonen)
        timeLabel.text = String(format: "Zeit: %.1f s", bank.totalTimeElapsed)
        scoreLabel.text = String(format: "Resonanz: %.2f", bank.resonanceScore)
    }
}
