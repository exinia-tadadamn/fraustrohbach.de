import SpriteKit

/// Anzeige nach Abschluss eines Optimierungsproblems.
public class ResultPanel: SKNode {

    private var bg: SKShapeNode!
    private var title: SKLabelNode!
    private var detail: SKLabelNode!
    private var stars: [SKShapeNode] = []

    public override init() {
        super.init()
        bg = SKShapeNode(rectOf: CGSize(width: 360, height: 200), cornerRadius: 16)
        bg.fillColor = NSColor(calibratedRed: 0.05, green: 0.05, blue: 0.1, alpha: 0.95)
        bg.strokeColor = .cyan
        bg.lineWidth = 2.0
        addChild(bg)

        title = SKLabelNode(text: "Artefakt dekodiert")
        title.fontSize = 20
        title.fontColor = .white
        title.position = CGPoint(x: 0, y: 50)
        addChild(title)

        detail = SKLabelNode(text: "")
        detail.fontSize = 14
        detail.fontColor = .lightGray
        detail.position = CGPoint(x: 0, y: -10)
        addChild(detail)

        for i in 0..<3 {
            let star = SKShapeNode(rectOf: CGSize(width: 30, height: 30))
            star.position = CGPoint(x: CGFloat(i - 1) * 40, y: -60)
            star.fillColor = .darkGray
            addChild(star)
            stars.append(star)
        }
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    public func show(chronitonen: Double, stars earned: Int, optimalityGap: Double) {
        isHidden = false
        title.text = earned == 3 ? "PERFEKTE OPTIMIERUNG" : "Artefakt dekodiert"
        detail.text = String(format: "Chronitonen: %.0f  |  Lücke: %.2f%%", chronitonen, optimalityGap * 100)

        for (i, star) in stars.enumerated() {
            star.fillColor = i < earned ? .systemYellow : .darkGray
        }

        let wait = SKAction.wait(forDuration: 3.0)
        let hide = SKAction.run { [weak self] in self?.isHidden = true }
        run(SKAction.sequence([wait, hide]))
    }
}
