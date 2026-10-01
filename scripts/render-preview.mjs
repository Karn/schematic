import { readFile, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.XMLSerializer = dom.window.XMLSerializer;
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
let exported;
URL.createObjectURL = blob => { exported = blob; return 'blob:preview'; };
URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = () => {};

await import('../app.js');
for (let attempt = 0; attempt < 100 && document.getElementById('layout-status').textContent !== 'Auto layout on'; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 20));
}
if (document.getElementById('layout-status').textContent !== 'Auto layout on') throw Error('Layout did not finish');
if (process.argv.includes('--edited')) {
  document.querySelector('[data-node-id="n3"]').dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));
  const editor = document.getElementById('inline-editor');
  editor.value = 'A VERY LONG UPDATED JAVASCRIPT LIBRARY';
  editor.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  for (let attempt = 0; attempt < 100 && !(JSON.parse(localStorage.getItem('schematic-editor-v2'))?.nodes.find(node => node.id === 'n3')?.width > 68); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  document.querySelector('[data-border="1"]').click();
  document.querySelector('[data-port-id="n3-south"]').dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
  dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 200, clientY: 200 }));
  document.querySelector('[data-port-id="n10-west"]').dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 200, clientY: 200 }));
  for (let attempt = 0; attempt < 100 && document.querySelectorAll('#edges-layer .edge').length !== 17; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  if (document.querySelectorAll('#edges-layer .edge').length !== 17) throw Error('Edited route did not finish');
}
document.getElementById('export-svg').click();
if (!exported) throw Error('SVG export did not run');
const path = process.argv[2] || '/tmp/schematic-preview.svg';
await writeFile(path, (await exported.text()).replace(/^[\t ]+$/gm, ''));
console.log(path);
dom.window.close();
