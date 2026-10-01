import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('a customized old sample remains editable when the starter sample changes', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
  document.getElementById('canvas-viewport').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 800 });
  const nodes = Array.from({ length: 20 }, (_, index) => ({
    id: `n${index + 1}`, label: index === 2 ? 'MY CUSTOM API' : `OLD ${index + 1}`,
    baseLabel: `OLD ${index + 1}`, shape: 'box', border: 1, shadow: false,
    fontSize: 15, x: index % 5 * 120, y: Math.floor(index / 5) * 80, width: 80, height: 40,
  }));
  localStorage.setItem('schematic-editor-v2', JSON.stringify({ name: 'My old diagram', preset: true, nodes, edges: [] }));
  try {
    await import('../app.js?legacy-migration');
    const restored = JSON.parse(localStorage.getItem('schematic-editor-v2'));
    assert.equal(restored.name, 'My old diagram');
    assert.equal(restored.preset, false);
    assert.equal(restored.nodes.length, 20);
    assert.equal(restored.nodes[2].label, 'MY CUSTOM API');
  } finally {
    dom.window.close();
  }
});

test('an untouched old sample opens the new receipt splitter sample', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
  document.getElementById('canvas-viewport').getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 800 });
  const shapes = ['box', 'text', 'box', 'box', 'box', 'box', 'box', 'box', 'text', 'box', 'text', 'text', 'box', 'box', 'box', 'box', 'double', 'box', 'text', 'text'];
  const shadows = new Set(['n1', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n10', 'n15']);
  const nodes = shapes.map((shape, index) => ({
    id: `n${index + 1}`, label: `OLD ${index + 1}`, baseLabel: `OLD ${index + 1}`,
    shape, border: 1, shadow: shadows.has(`n${index + 1}`),
  }));
  localStorage.setItem('schematic-editor-v2', JSON.stringify({ preset: true, nodes, edges: Array(16).fill({}) }));
  try {
    await import('../app.js?untouched-legacy-migration');
    const restored = JSON.parse(localStorage.getItem('schematic-editor-v2'));
    assert.equal(restored.sampleId, 'receipt-splitter-v1');
    assert.equal(restored.nodes.length, 8);
    assert.equal(restored.nodes[0].label, 'MOBILE APP');
  } finally {
    dom.window.close();
  }
});
