import Foundation
import SpriteKit

/// Zentrale Asset-Lader für die Nano-Banana/Gemini-Bilder.
/// Alle Assets liegen im Projekt-Ordner `abbildungen/`.
public enum AssetPath {
    public static let base = "/Users/kseniastrohbach/Dokumentelokal/website/quanten-archaeologe/abbildungen/"

    public static var archaeologist: String { base + "quantumArchaeologist.png" }
    public static var ruins: String { base + "stylizedRuins.png" }
    public static var artefactPath: String { base + "ArtefaktVerschraenkungsstein.png" }
    public static var artefactSignal: String { base + "artefaktResonanzFossil.png" }
    public static var artefactEnergy: String { base + "ArtifaktEnergieKapsel.png" }
    public static var artefactMemory: String { base + "ArtifaktGedächtnisKristall.png" }
    public static var artefactEverett: String { base + "artefaktEverettNode.png" }
    public static var hudFrame: String { base + "UIElementOrbitHUDRahmen.png" }
    public static var chroniton: String { base + "ChronitonenSterne.png" }
    public static var enemyDecoherence: String { base + "ersterGegner.png" }

    public static func texture(named name: String) -> SKTexture? {
        guard let image = NSImage(contentsOfFile: name) else { return nil }
        return SKTexture(image: image)
    }
}
