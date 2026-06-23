import { useMemo, useState, useCallback } from 'react';
import type { Edge, Node } from '@xyflow/react';

export interface EdgeHighlightResult {
  highlightedNodes: Node[];
  highlightedEdges: Edge[];
  onNodeMouseEnter: (_event: React.MouseEvent, node: Node) => void;
  onNodeMouseLeave: (_event: React.MouseEvent, node: Node) => void;
}

export function useEdgeHighlighting(
  nodes: Node[],
  edges: Edge[],
): EdgeHighlightResult {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setHoveredId(node.id);
    },
    [],
  );

  const onNodeMouseLeave = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      setHoveredId(null);
    },
    [],
  );

  const { highlightedNodes, highlightedEdges } = useMemo(() => {
    if (!hoveredId) {
      return { highlightedNodes: nodes, highlightedEdges: edges };
    }

    const connectedEdgeIds = new Set<string>();
    const connectedNodeIds = new Set<string>();
    connectedNodeIds.add(hoveredId);

    for (const edge of edges) {
      if (edge.source === hoveredId || edge.target === hoveredId) {
        connectedEdgeIds.add(edge.id);
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      }
    }

    const highlightedEdgesOut = edges.map((edge) => {
      if (connectedEdgeIds.has(edge.id)) {
        return {
          ...edge,
          style: { ...edge.style, stroke: '#a855f7', strokeWidth: 2.5 },
          animated: true,
        };
      }
      return {
        ...edge,
        style: { ...edge.style, stroke: '#52525b', strokeWidth: 1 },
        animated: false,
      };
    });

    const highlightedNodesOut = nodes.map((node) => {
      if (connectedNodeIds.has(node.id)) {
        return { ...node, style: { ...node.style, opacity: 1 } };
      }
      return { ...node, style: { ...node.style, opacity: 0.35 } };
    });

    return { highlightedNodes: highlightedNodesOut, highlightedEdges: highlightedEdgesOut };
  }, [hoveredId, nodes, edges]);

  return { highlightedNodes, highlightedEdges, onNodeMouseEnter, onNodeMouseLeave };
}
