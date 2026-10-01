// Editable starter composition traced from the supplied 600 × 600 print.
// Geometry is used only while the starter keeps its reference arrangement.
const blocks = [
  ['n1', 'NO\nSQL', 'box', 39, 203, 58, 58, true],
  ['n2', 'WEB\n3.0', 'text', 146, 241, 52, 55, false],
  ['n3', 'JS LIB', 'box', 192, 338, 68, 39, true],
  ['n4', 'WEBSCALE™\nMICROSERVICE', 'box', 278, 165, 145, 58, true],
  ['n5', 'OOP\nFACTORY', 'box', 307, 318, 78, 58, true],
  ['n6', 'PAAS', 'box', 39, 318, 49, 39, true],
  ['n7', 'GIF', 'box', 115, 491, 58, 39, true],
  ['n8', 'JIF', 'box', 230, 491, 59, 39, true],
  ['n9', 'FERMION UI', 'text', 210, 421, 102, 33, false],
  ['n10', 'DATA SEWAGE', 'box', 403, 260, 135, 39, true],
  ['n11', 'KUBERPODS', 'text', 420, 362, 105, 30, false],
  ['n12', 'LOG4J', 'text', 475, 187, 63, 30, false],
  ['n13', 'ERR', 'box', 442, 395, 58, 39, false],
  ['n14', 'NOP', 'box', 442, 434, 58, 38, false],
  ['n15', 'SOE', 'box', 442, 472, 58, 38, true],
  ['n16', 'UWORK® INC\nRFC 9000\nJAN 2026', 'box', 29, 49, 125, 77, false],
  ['n17', 'CONTAINERIZATION\nARCHITECTURE OF\nSCALABLE TECHNOLOGIES', 'double', 182, 48, 232, 80, false],
  ['n18', '*~~~~~~~~*\nDEEP DIVE\n*~~~~~~~~*', 'box', 451, 49, 116, 77, false],
  ['n19', 'AI ENGINE', 'text', 100, 457, 102, 30, false],
  ['n20', 'DISTRIBUTED', 'text', 409, 552, 102, 30, false],
];

const lines = [
  ['e1', 'n1', 'east', 'n2', 'west', [[97, 232], [125, 232], [125, 268.5], [146, 268.5]]],
  ['e2', 'n2', 'west', 'n6', 'east', [[146, 268.5], [125, 268.5], [125, 337.5], [88, 337.5]]],
  ['e3', 'n2', 'south', 'n9', 'west', [[172, 296], [172, 437.5], [210, 437.5]]],
  ['e4', 'n6', 'south', 'n7', 'west', [[63.5, 357], [63.5, 510.5], [115, 510.5]]],
  ['e5', 'n7', 'east', 'n8', 'west', [[173, 510.5], [230, 510.5]]],
  ['e6', 'n8', 'north', 'n9', 'south', [[259.5, 491], [259.5, 454]]],
  ['e7', 'n4', 'west', 'n3', 'north', [[278, 194], [226, 194], [226, 338]]],
  ['e8', 'n3', 'east', 'n5', 'west', [[260, 357.5], [307, 357.5]]],
  ['e9', 'n5', 'east', 'n13', 'west', [[385, 347], [413, 347], [413, 414.5], [442, 414.5]]],
  ['e10', 'n5', 'east', 'n14', 'west', [[385, 347], [413, 347], [413, 453], [442, 453]]],
  ['e11', 'n5', 'east', 'n15', 'west', [[385, 347], [413, 347], [413, 491], [442, 491]]],
  ['e12', 'n11', 'north', 'n10', 'south', [[472.5, 362], [472.5, 299]]],
  ['e13', 'n12', 'west', 'n4', 'east', [[475, 202], [423, 202]]],
  ['e14', 'n5', 'south', 'n20', 'north', [[346, 376], [346, 548], [460, 548], [460, 552]]],
  ['e15', 'n12', 'east', 'n20', 'north', [[538, 202], [577, 202], [577, 548], [460, 548], [460, 552]]],
  ['e16', 'n5', 'north', 'n4', 'south', [[346, 318], [346, 250], [350.5, 250], [350.5, 223]]],
];

export function referenceTemplate() {
  return {
    name: 'Containerization architecture',
    preset: true,
    nodes: blocks.map(([id, label, shape, x, y, width, height, shadow]) => ({
      id, label, baseLabel: label, shape, x, y, width, height, border: 1, shadow, fontSize: 15,
      fontWeight: ['n16', 'n17', 'n18'].includes(id) ? 700 : 500,
    })),
    edges: lines.map(([id, from, fromSide, to, toSide, points]) => ({
      id, from, fromSide, to, toSide, points,
      arrowhead: ['e9', 'e10', 'e11'].includes(id) ? 'open' : ['e14', 'e15'].includes(id) ? 'none' : 'filled',
    })),
  };
}

export function referenceLayout(documentState) {
  return {
    id: 'reference', width: 600, height: 600, isReference: true,
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
