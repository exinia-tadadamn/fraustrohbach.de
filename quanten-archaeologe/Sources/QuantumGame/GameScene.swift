import SpriteKit
import QuantumCore

/// Hauptszene: Isometrische Ruinen + WASD + Interaktion mit Artefakten.
/// Nutzt echte Nano-Banana/Gemini-Assets aus dem `abbildungen/`-Ordner.
public class GameScene: SKScene {
    public var chronitonBank = ChronitonBank()
    public var player: SKSpriteNode!
    public var currentProblemNode: SKNode?
    public var hud: OmegaOrbitHUD!
    public var resultPanel: ResultPanel!
    public var introNode: IntroNode?

    private var lastUpdateTime: TimeInterval = 0
    private let playerSpeed: CGFloat = 200.0
    private var keysPressed: Set<UInt16> = []

    override public func didMove(to view: SKView) {
        backgroundColor = NSColor(calibratedRed: 0.04, green: 0.04, blue: 0.10, alpha: 1.0)
        setupBackground()
        setupPlayer()
        setupHUD()
        setupArtefactZones()
        physicsWorld.gravity = .zero

        showIntro()
    }

    // MARK: — Intro

    private func showIntro() {
        let intro = IntroNode(size: size)
        intro.position = CGPoint(x: size.width / 2, y: size.height / 2)
        intro.zPosition = 500
        intro.onComplete = { [weak self] in self?.introNode = nil }
        addChild(intro)
        introNode = intro
    }

    // MARK: — Background

    private func setupBackground() {
        if let ruinsTex = AssetPath.texture(named: AssetPath.ruins) {
            let ruins = SKSpriteNode(texture: ruinsTex, size: size)
            ruins.position = CGPoint(x: size.width / 2, y: size.height / 2)
            ruins.zPosition = -10
            ruins.alpha = 0.6
            addChild(ruins)
        }
    }

    // MARK: — Setup

    private func setupPlayer() {
        if let tex = AssetPath.texture(named: AssetPath.archaeologist) {
            player = SKSpriteNode(texture: tex, size: CGSize(width: 64, height: 64))
        } else {
            player = SKSpriteNode(color: .cyan, size: CGSize(width: 32, height: 32))
        }
        player.position = CGPoint(x: size.width / 2, y: size.height / 2)
        player.name = "archaeologist"
        player.physicsBody = SKPhysicsBody(rectangleOf: player.size)
        player.physicsBody?.allowsRotation = false
        player.physicsBody?.affectedByGravity = false
        player.physicsBody?.categoryBitMask = 1
        player.physicsBody?.contactTestBitMask = 2
        addChild(player)
    }

    private func setupHUD() {
        hud = OmegaOrbitHUD(size: CGSize(width: 280, height: 160))
        hud.position = CGPoint(x: size.width - 160, y: size.height - 100)
        hud.zPosition = 100
        addChild(hud)

        // HUD-Rahmen-Textur
        if let frameTex = AssetPath.texture(named: AssetPath.hudFrame) {
            let frame = SKSpriteNode(texture: frameTex, size: CGSize(width: 300, height: 180))
            frame.position = CGPoint(x: 0, y: 0)
            frame.zPosition = -1
            hud.addChild(frame)
        }

        resultPanel = ResultPanel()
        resultPanel.position = CGPoint(x: size.width / 2, y: size.height / 2)
        resultPanel.zPosition = 200
        resultPanel.isHidden = true
        addChild(resultPanel)
    }

    private func setupArtefactZones() {
        let configs: [(mechanic: MechanicType, asset: String, color: NSColor, offset: CGPoint)] = [
            (.pathOptimization, AssetPath.artefactPath, .systemTeal, CGPoint(x: -300, y: 200)),
            (.signalFit, AssetPath.artefactSignal, .systemPurple, CGPoint(x: 300, y: 200)),
            (.allocation, AssetPath.artefactEnergy, .systemOrange, CGPoint(x: -300, y: -200)),
            (.compression, AssetPath.artefactMemory, .systemPink, CGPoint(x: 300, y: -200)),
            (.sync, AssetPath.artefactEverett, .systemGreen, CGPoint(x: 0, y: 0)),
        ]

        for cfg in configs {
            let zone: SKSpriteNode
            if let tex = AssetPath.texture(named: cfg.asset) {
                zone = SKSpriteNode(texture: tex, size: CGSize(width: 80, height: 80))
            } else {
                zone = SKSpriteNode(color: cfg.color, size: CGSize(width: 80, height: 80))
            }
            zone.position = CGPoint(x: size.width / 2 + cfg.offset.x, y: size.height / 2 + cfg.offset.y)
            zone.name = "artefact_\(cfg.mechanic.rawValue)"
            zone.alpha = 0.85

            zone.physicsBody = SKPhysicsBody(rectangleOf: zone.size)
            zone.physicsBody?.isDynamic = false
            zone.physicsBody?.categoryBitMask = 2
            zone.physicsBody?.collisionBitMask = 0

            let label = SKLabelNode(text: cfg.mechanic.rawValue)
            label.fontSize = 12
            label.fontColor = .white
            label.position = CGPoint(x: 0, y: -55)
            label.numberOfLines = 0
            label.preferredMaxLayoutWidth = 120
            zone.addChild(label)

            // Langsames Schweben
            let hover = SKAction.sequence([
                SKAction.moveBy(x: 0, y: 8, duration: 1.5),
                SKAction.moveBy(x: 0, y: -8, duration: 1.5),
            ])
            zone.run(SKAction.repeatForever(hover))

            addChild(zone)
        }
    }

    // MARK: — Input

    override public func keyDown(with event: NSEvent) {
        if let intro = introNode {
            intro.handleKeyDown(event)
            return
        }

        keysPressed.insert(event.keyCode)
        if event.keyCode == 49 || event.keyCode == 36 {
            tryInteract()
        }
    }

    override public func keyUp(with event: NSEvent) {
        keysPressed.remove(event.keyCode)
    }

    private func tryInteract() {
        guard currentProblemNode == nil else { return }
        enumerateChildNodes(withName: "artefact_*") { [weak self] node, _ in
            guard let self = self else { return }
            let dx = node.position.x - self.player.position.x
            let dy = node.position.y - self.player.position.y
            if sqrt(dx*dx + dy*dy) < 100 {
                self.launchProblem(node: node)
            }
        }
    }

    private func launchProblem(node: SKNode) {
        let name = node.name ?? ""
        var problemNode: SKNode?

        if name.contains(MechanicType.pathOptimization.rawValue) {
            problemNode = PathOptimizationNode(size: CGSize(width: 900, height: 600))
        } else if name.contains(MechanicType.signalFit.rawValue) {
            problemNode = SignalFitNode(size: CGSize(width: 900, height: 600))
        } else if name.contains(MechanicType.allocation.rawValue) {
            problemNode = AllocationNode(size: CGSize(width: 900, height: 600))
        } else if name.contains(MechanicType.compression.rawValue) {
            problemNode = CompressionNode(size: CGSize(width: 900, height: 600))
        } else if name.contains(MechanicType.sync.rawValue) {
            problemNode = SyncNode(size: CGSize(width: 900, height: 600))
        }

        guard let pn = problemNode else { return }
        pn.position = CGPoint(x: size.width / 2, y: size.height / 2)
        pn.zPosition = 150
        pn.name = "activeProblem"
        addChild(pn)
        currentProblemNode = pn
        hud.isHidden = true

        if let optimizable = pn as? OptimizableNode {
            optimizable.onComplete = { [weak self] result in
                self?.finishProblem(result: result)
            }
        }
    }

    private func finishProblem(result: OptimizationResult) {
        currentProblemNode?.removeFromParent()
        currentProblemNode = nil
        hud.isHidden = false

        let stars = chronitonBank.awardStars(
            forProblem: result.problem,
            solution: result.solution
        )
        resultPanel.show(
            chronitonen: chronitonBank.chronitonen,
            stars: stars,
            optimalityGap: result.problem.optimalityGap(at: result.solution)
        )
        hud.update(bank: chronitonBank)
    }

    // MARK: — Loop

    override public func update(_ currentTime: TimeInterval) {
        if lastUpdateTime == 0 { lastUpdateTime = currentTime }
        let dt = currentTime - lastUpdateTime
        lastUpdateTime = currentTime

        if introNode != nil { return }

        if currentProblemNode == nil {
            handleMovement(dt: dt)
            chronitonBank.tickTime(dt)
            hud.update(bank: chronitonBank)
        }
    }

    private func handleMovement(dt: TimeInterval) {
        var dx: CGFloat = 0
        var dy: CGFloat = 0
        // macOS keycodes: W=13, A=0, S=1, D=2
        if keysPressed.contains(13) { dy += 1 } // W
        if keysPressed.contains(0)  { dx -= 1 } // A
        if keysPressed.contains(1)  { dy -= 1 } // S
        if keysPressed.contains(2)  { dx += 1 } // D

        let len = sqrt(dx*dx + dy*dy)
        if len > 0 {
            dx /= len; dy /= len
            player.position.x += dx * playerSpeed * CGFloat(dt)
            player.position.y += dy * playerSpeed * CGFloat(dt)
        }
    }
}

// MARK: — Protokolle für Minispiele

public struct OptimizationResult {
    public let problem: OptimizationProblem
    public let solution: RealVector
}

public protocol OptimizableNode: SKNode {
    var onComplete: ((OptimizationResult) -> Void)? { get set }
}
