import Foundation

/// Knoten des Everett-Multiversums
public struct UniverseNode: Identifiable {
    public let id: String
    public let name: String
    public let mechanicType: MechanicType
    public let coordinates: (x: Double, y: Double)
    public let timeWindow: ClosedRange<Double>?

    public init(id: String, name: String, mechanicType: MechanicType, coordinates: (Double, Double), timeWindow: ClosedRange<Double>? = nil) {
        self.id = id
        self.name = name
        self.mechanicType = mechanicType
        self.coordinates = coordinates
        self.timeWindow = timeWindow
    }
}

/// Hyperraum-Kante zwischen Universen
public struct UniverseEdge {
    public let from: String
    public let to: String
    public let travelTime: Double
    public let energyCost: Double

    public init(from: String, to: String, travelTime: Double, energyCost: Double = 0) {
        self.from = from
        self.to = to
        self.travelTime = travelTime
        self.energyCost = energyCost
    }
}

/// Gerichteter Graph des Multiversums für Mechanik E
public class UniverseGraph {
    public var nodes: [UniverseNode] = []
    public var edges: [UniverseEdge] = []
    private var adjacency: [String: [UniverseEdge]] = [:]

    public init() {}

    public func addNode(_ node: UniverseNode) {
        nodes.append(node)
    }

    public func addEdge(_ edge: UniverseEdge) {
        edges.append(edge)
        adjacency[edge.from, default: []].append(edge)
    }

    public func neighbors(of nodeId: String) -> [UniverseEdge] {
        adjacency[nodeId] ?? []
    }

    /// Kürzester Weg (Dijkstra) bezüglich Reisezeit — Basis für Synchronisation
    public func shortestPath(from start: String, to target: String) -> ([String], Double)? {
        var dist: [String: Double] = [start: 0]
        var prev: [String: String] = [:]
        var unvisited = Set(nodes.map(\.id))

        while !unvisited.isEmpty {
            let current = unvisited.min { (dist[$0] ?? .infinity) < (dist[$1] ?? .infinity) }!
            unvisited.remove(current)
            if current == target { break }

            for edge in neighbors(of: current) {
                let alt = (dist[current] ?? .infinity) + edge.travelTime
                if alt < (dist[edge.to] ?? .infinity) {
                    dist[edge.to] = alt
                    prev[edge.to] = current
                }
            }
        }

        guard prev[target] != nil || start == target else { return nil }
        var path: [String] = [target]
        var cur = target
        while let p = prev[cur] {
            path.insert(p, at: 0)
            cur = p
        }
        return (path, dist[target] ?? .infinity)
    }
}
