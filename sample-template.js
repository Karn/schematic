// Editable 600 × 600 example of a small receipt splitting service.
const blocks = [
  ['n1', 'MOBILE APP', 'box', 40, 160, 128, 58, false],
  ['n2', 'WEB APP', 'box', 40, 300, 125, 58, false],
  ['n3', 'API SERVER', 'double', 235, 230, 130, 64, true],
  ['n4', 'RECEIPT\nPARSER', 'box', 425, 120, 135, 58, true],
  ['n5', 'SPLIT\nENGINE', 'box', 425, 330, 135, 58, true],
  ['n6', 'RECEIPTS', 'database', 425, 220, 135, 66, false],
  ['n7', 'SPLITS', 'database', 425, 430, 135, 66, false],
  ['n8', 'RECEIPT SPLITTER', 'text', 130, 40, 340, 40, false],
];

const lines = [
  ['e1', 'n1', 'east', 'n3', 'north', [[168, 189], [300, 189], [300, 230]]],
  ['e2', 'n2', 'east', 'n3', 'west', [[165, 329], [200, 329], [200, 262], [235, 262]]],
  ['e3', 'n3', 'east', 'n4', 'west', [[365, 262], [390, 262], [390, 149], [425, 149]]],
  ['e4', 'n4', 'south', 'n6', 'north', [[492.5, 178], [492.5, 220]]],
  ['e5', 'n3', 'east', 'n6', 'west', [[365, 262], [395, 262], [395, 253], [425, 253]]],
  ['e6', 'n3', 'south', 'n5', 'west', [[300, 294], [300, 359], [425, 359]]],
  ['e7', 'n6', 'south', 'n5', 'north', [[492.5, 286], [492.5, 330]]],
  ['e8', 'n5', 'south', 'n7', 'north', [[492.5, 388], [492.5, 430]]],
];

export function sampleTemplate() {
  return {
    name: 'Receipt splitter',
    sampleId: 'receipt-splitter-v1',
    preset: true,
    nodes: blocks.map(([id, label, shape, x, y, width, height, shadow]) => ({
      id, label, baseLabel: label, shape, x, y, width, height, border: 1, shadow, fontSize: id === 'n8' ? 20 : 15,
      fontWeight: id === 'n8' ? 700 : 500,
    })),
    edges: lines.map(([id, from, fromSide, to, toSide, points]) => ({
      id, from, fromSide, to, toSide, points, arrowhead: 'filled',
    })),
  };
}

export function sampleLayout(documentState) {
  return {
    id: 'sample', width: 600, height: 600, isSample: true,
    children: documentState.nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
    edges: documentState.edges.map(({ id, points }) => ({
      id,
      sections: [{
        startPoint: { x: points[0][0], y: points[0][1] },
        bendPoints: points.slice(1, -1).map(([x, y]) => ({ x, y })),
        endPoint: { x: points.at(-1)[0], y: points.at(-1)[1] },
      }],
    })),
  };
}
