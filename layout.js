import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();
export const SIDES = ['north', 'east', 'south', 'west'];
const ELK_SIDES = { north: 'NORTH', east: 'EAST', south: 'SOUTH', west: 'WEST' };

export function displayLines(label) {
  const lines = [];
  for (const raw of (label || 'Untitled block').split('\n')) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    let line = '';
    for (let word of words) {
      while (word.length > 23) {
        if (line) lines.push(line);
        line = '';
        lines.push(word.slice(0, 23));
        word = word.slice(23);
      }
      if (line && `${line} ${word}`.length > 23) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line || ' ');
  }
  return lines;
}

export function nodeSize(node) {
  const lines = displayLines(node.label);
  const fontSize = node.fontSize || 19;
  const lineHeight = fontSize * 1.2;
  return {
    width: Math.max(120, Math.min(320, Math.max(...lines.map(line => line.length)) * fontSize * 0.61 + 32)),
    height: Math.max(66, 28 + lines.length * lineHeight),
  };
}

export function portId(nodeId, side) {
  return `${nodeId}-${side}`;
}

export async function layoutDiagram(nodes, edges) {
  const children = nodes.map(node => ({
    id: node.id,
    ...nodeSize(node),
    layoutOptions: { 'elk.portConstraints': 'FIXED_SIDE' },
    ports: SIDES.map(side => ({
      id: portId(node.id, side),
      width: 8,
      height: 8,
      layoutOptions: { 'elk.port.side': ELK_SIDES[side] },
    })),
  }));
  const graph = {
    id: 'diagram',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '72',
      'elk.layered.spacing.nodeNodeBetweenLayers': '94',
      'elk.padding': '[top=26,left=26,bottom=26,right=26]',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children,
    edges: edges.map(edge => ({
      id: edge.id,
      sources: [portId(edge.from, edge.fromSide)],
      targets: [portId(edge.to, edge.toSide)],
    })),
  };
  return elk.layout(graph);
}
