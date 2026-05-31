import AppKit
import SpriteKit
import QuantumGame

class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let size = CGSize(width: 1280, height: 800)
        let scene = GameScene(size: size)
        scene.scaleMode = .aspectFit

        let skView = SKView(frame: NSRect(origin: .zero, size: size))
        skView.presentScene(scene)
        skView.ignoresSiblingOrder = true
        skView.showsFPS = true
        skView.showsNodeCount = true

        window = NSWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Quanten-Archäologe: Optimales Multiversum"
        window.contentView = skView
        window.makeKeyAndOrderFront(nil)
    }
}

let app = NSApplication.shared
app.delegate = AppDelegate()
app.run()
