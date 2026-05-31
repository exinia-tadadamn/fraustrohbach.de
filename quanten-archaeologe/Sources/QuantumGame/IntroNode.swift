import SpriteKit

/// Story-Intro für α-Prime.
/// Zeigt die Lore der Aethel und erklärt die Ω-Orbit.
public class IntroNode: SKNode {

    public var onComplete: (() -> Void)?

    public init(size: CGSize) {
        super.init()

        // Halbtransparenter Overlay
        let overlay = SKSpriteNode(color: .black, size: size)
        overlay.alpha = 0.75
        overlay.position = .zero
        overlay.zPosition = 0
        addChild(overlay)

        // Ruinen-Hintergrund (gedimmt)
        if let ruinsTex = AssetPath.texture(named: AssetPath.ruins) {
            let ruins = SKSpriteNode(texture: ruinsTex, size: CGSize(width: size.width * 0.6, height: size.height * 0.4))
            ruins.position = CGPoint(x: 0, y: size.height * 0.15)
            ruins.alpha = 0.4
            ruins.zPosition = 1
            addChild(ruins)
        }

        // Titel
        let title = SKLabelNode(text: "QUANTEN-ARCHÄOLOGE")
        title.fontName = "HelveticaNeue-Bold"
        title.fontSize = 32
        title.fontColor = .cyan
        title.position = CGPoint(x: 0, y: size.height * 0.25)
        title.zPosition = 10
        addChild(title)

        // Untertitel
        let sub = SKLabelNode(text: "Optimales Multiversum")
        sub.fontName = "HelveticaNeue-Light"
        sub.fontSize = 18
        sub.fontColor = .lightGray
        sub.position = CGPoint(x: 0, y: size.height * 0.18)
        sub.zPosition = 10
        addChild(sub)

        // Story-Text (mehrzeilig via mehrere LabelNodes)
        let lines = [
            "Jahr 2847. Die Aethel-Zivilisation – makroskopische",
            "Bose-Einstein-Kondensate – hinterließ keine Knochen.",
            "Sie hinterließ Optima: minimierte Energiefunktionale,",
            "verschränkte Zustände, komprimierte Gedächtnisse.",
            "",
            "Deine Ω-Orbit ist kein Spaten. Sie ist ein Optimierer.",
            "Jede Sekunde zählt. Jede Messung kostet Zeit.",
            "Dekodiere ihre Mathematik, bevor der Nebel dich findet.",
            "",
            "WASD = Bewegen   |   LEERTASTE = Interagieren"
        ]

        for (i, line) in lines.enumerated() {
            let label = SKLabelNode(text: line)
            label.fontName = "HelveticaNeue"
            label.fontSize = 14
            label.fontColor = line.isEmpty ? .clear : .white
            label.position = CGPoint(x: 0, y: size.height * 0.08 - CGFloat(i) * 22)
            label.zPosition = 10
            addChild(label)
        }

        // Prompt
        let prompt = SKLabelNode(text: "[ LEERTASTE zum Starten ]")
        prompt.fontName = "HelveticaNeue-Bold"
        prompt.fontSize = 16
        prompt.fontColor = .systemOrange
        prompt.position = CGPoint(x: 0, y: -size.height * 0.25)
        prompt.zPosition = 10

        // Blink-Animation
        let fadeOut = SKAction.fadeAlpha(to: 0.3, duration: 0.6)
        let fadeIn = SKAction.fadeAlpha(to: 1.0, duration: 0.6)
        prompt.run(SKAction.repeatForever(SKAction.sequence([fadeOut, fadeIn])))
        addChild(prompt)
    }

    required init?(coder aDecoder: NSCoder) { fatalError() }

    public func handleKeyDown(_ event: NSEvent) {
        if event.keyCode == 49 || event.keyCode == 36 {
            let fade = SKAction.fadeOut(withDuration: 0.5)
            run(fade) { [weak self] in
                self?.removeFromParent()
                self?.onComplete?()
            }
        }
    }
}
