import assert from 'node:assert/strict';
import test from 'node:test';
import { displayLines } from '../layout.js';
import { sampleLayout, sampleTemplate } from '../sample-template.js';
import { layoutPositioned } from '../positioned-layout.js';

function crossesInterior(a, b, node) {
  const left = node.x + 1;
  const right = node.x + node.width - 1;
  const top = node.y + 1;
  const bottom = node.y + node.height - 1;
  if (Math.abs(a.y - b.y) < 0.01) {
    return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
  }
  if (Math.abs(a.x - b.x) < 0.01) {
    return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
  }
  return true;
}

test('orthogonal routes avoid unrelated blocks in a branched diagram', () => {
  const nodes = ['Input source', 'Signal processor', 'Output stage', 'Control unit', 'Status monitor']
    .map((label, index) => ({
      id: `n${index + 1}`, label,
      x: [0, 200, 400, 100, 300][index],
      y: [100, 100, 100, 250, -50][index],
      width: 120, height: 66,
    }));
  const edges = [
    { id: 'e1', from: 'n1', fromSide: 'east', to: 'n2', toSide: 'west' },
    { id: 'e2', from: 'n2', fromSide: 'east', to: 'n3', toSide: 'west' },
    { id: 'e3', from: 'n4', fromSide: 'east', to: 'n2', toSide: 'south' },
    { id: 'e4', from: 'n2', fromSide: 'north', to: 'n5', toSide: 'west' },
  ];
  const result = layoutPositioned({ nodes, edges, positioned: true });
  assert.equal(result.edges.length, edges.length);
  for (const routed of result.edges) {
    const original = edges.find(edge => edge.id === routed.id);
    assert.ok(routed.sections?.length, `${routed.id} has a route`);
    for (const section of routed.sections) {
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
      for (let i = 1; i < points.length; i++) {
        for (const node of result.children) {
          if (node.id !== original.from && node.id !== original.to) {
            assert.equal(crossesInterior(points[i - 1], points[i], node), false, `${routed.id} crosses ${node.id}`);
          }
        }
      }
    }
  }
});

test('long labels remain inside their node instead of being clipped', () => {
  const label = 'A_SINGLE_LONG_COMPONENT_NAME_THAT_WOULD_OTHERWISE_OVERFLOW';
  const lines = displayLines(label);
  assert.equal(lines.join(''), label);
  assert.ok(lines.every(line => line.length <= 23));
  const node = { id: 'long', label, baseLabel: 'Text', x: 0, y: 0, width: 90, height: 40, baseWidth: 90, baseHeight: 40, fontSize: 19 };
  const size = layoutPositioned({ nodes: [node], edges: [], positioned: true }).children[0];
  assert.ok(size.width >= Math.max(...lines.map(line => line.length)) * 19 * 0.61 + 12);
  assert.ok(size.height >= lines.length * 19 * 1.2 + 12);
});

test('receipt splitter sample routes avoid unrelated blocks', () => {
  const document = sampleTemplate();
  const result = sampleLayout(document);
  assert.equal(result.width, 600);
  assert.equal(result.height, 600);
  assert.deepEqual(document.nodes.filter(node => node.shape === 'database').map(node => node.label), ['RECEIPTS', 'SPLITS']);
  for (const edge of result.edges) {
    const original = document.edges.find(item => item.id === edge.id);
    for (const section of edge.sections) {
      const points = [section.startPoint, ...section.bendPoints, section.endPoint];
      for (let i = 1; i < points.length; i++) {
        for (const node of result.children) {
          if (node.id !== original.from && node.id !== original.to) {
            assert.equal(crossesInterior(points[i - 1], points[i], node), false, `${edge.id} crosses ${node.id}`);
          }
        }
      }
    }
  }
});

test('editing and linking the sample keeps placed blocks while fitting changed text', () => {
  const document = sampleTemplate();
  const original = sampleLayout(document);
  const edited = document.nodes.find(node => node.id === 'n3');
  edited.label = 'UPDATED LABEL WITH MORE TEXT';
  document.edges.push({ id: 'new-edge', from: 'n3', fromSide: 'south', to: 'n7', toSide: 'north' });
  const result = layoutPositioned(document);
  const placed = new Map(result.children.map(node => [node.id, node]));
  assert.ok(placed.get('n3').width > 130);
  for (const node of original.children.filter(node => node.id !== 'n3')) {
    assert.deepEqual([placed.get(node.id).x, placed.get(node.id).y, placed.get(node.id).width, placed.get(node.id).height],
      [node.x, node.y, node.width, node.height], `${node.id} stays in place`);
  }
  assert.deepEqual(result.edges.find(edge => edge.id === 'e4').sections, original.edges.find(edge => edge.id === 'e4').sections);
  edited.label = 'API SERVER';
  const shrunk = layoutPositioned(document);
  assert.equal(shrunk.children.find(node => node.id === 'n3').width, 130);
  assert.equal(shrunk.children.find(node => node.id === 'n3').height, 64);
  edited.label = 'UPDATED LABEL WITH MORE TEXT';
  layoutPositioned(document);
  for (const edge of result.edges) {
    const originalEdge = document.edges.find(item => item.id === edge.id);
    for (const section of edge.sections) {
      const points = [section.startPoint, ...section.bendPoints, section.endPoint];
      for (let i = 1; i < points.length; i++) {
        for (const node of result.children) {
          if (node.id !== originalEdge.from && node.id !== originalEdge.to) {
            assert.equal(crossesInterior(points[i - 1], points[i], node), false, `${edge.id} crosses ${node.id}`);
          }
        }
      }
    }
  }
});

test('several adjacent label expansions keep boxes and routes separate', () => {
  const document = sampleTemplate();
  for (const [id, label] of [
    ['n3', 'API SERVER WITH A MUCH LONGER LABEL'],
    ['n5', 'CALCULATE EACH PERSONS SHARE'],
    ['n6', 'RECEIPT STORAGE WITH HISTORY'],
  ]) document.nodes.find(node => node.id === id).label = label;
  document.edges.push({ id: 'extra', from: 'n3', fromSide: 'south', to: 'n6', toSide: 'west' });
  const result = layoutPositioned(document);
  for (let i = 0; i < result.children.length; i++) {
    for (let j = i + 1; j < result.children.length; j++) {
      const a = result.children[i];
      const b = result.children[j];
      assert.equal(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y, false, `${a.id} overlaps ${b.id}`);
    }
  }
  for (const edge of result.edges) {
    const original = document.edges.find(item => item.id === edge.id);
    for (const section of edge.sections) {
      const points = [section.startPoint, ...section.bendPoints, section.endPoint];
      for (let i = 1; i < points.length; i++) {
        for (const node of result.children) {
          if (node.id !== original.from && node.id !== original.to) {
            assert.equal(crossesInterior(points[i - 1], points[i], node), false, `${edge.id} crosses ${node.id}`);
          }
        }
      }
    }
  }
});
