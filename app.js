import { databaseRadius, displayLines, minimumTextNodeSize, portId, SIDES, textInsets, TEXT_LETTER_SPACING } from './layout.js';
import { sampleLayout, sampleTemplate } from './sample-template.js';
import { layoutPositioned } from './positioned-layout.js';

const STORAGE_KEY = 'schematic-editor-v2';
const svgNS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const svg = $('diagram');
const canvasTiles = $('canvas-tiles');
const shapeMasks = $('shape-masks');
const inlineEditor = $('inline-editor');
const viewport = $('canvas-viewport');
const shadowsLayer = $('shadows-layer');
const backingsLayer = $('backings-layer');
const edgeKnockoutsLayer = $('edge-knockouts-layer');
const nodesLayer = $('nodes-layer');
const edgesLayer = $('edges-layer');
const inspector = document.querySelector('.inspector');
const defaultDiagram = sampleTemplate;
const ENTITY_SHAPES = ['box', 'double', 'text', 'database'];
const LEGACY_SHAPES = ['box', 'text', 'box', 'box', 'box', 'box', 'box', 'box', 'text', 'box', 'text', 'text', 'box', 'box', 'box', 'box', 'double', 'box', 'text', 'text'];
const LEGACY_SHADOWS = new Set(['n1', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n10', 'n15']);

function isUntouchedLegacySample(saved) {
  return saved.nodes.length === 20 && saved.edges.length === 16 && saved.nodes.every((node, index) =>
    node.id === `n${index + 1}` && node.label === node.baseLabel && node.shape === LEGACY_SHAPES[index] &&
    node.border === 1 && Boolean(node.shadow) === LEGACY_SHADOWS.has(node.id));
}

function fitsPresetNode(node, label) {
  if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) return false;
  const minimum = minimumTextNodeSize(node, label);
  return minimum.width <= node.width && minimum.height <= node.height;
}

function loadDocument() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges)) {
      if (saved.preset) {
        const template = sampleTemplate();
        const editedRemovedTitle = saved.sampleId === template.sampleId && saved.nodes.some(node =>
          node.id === 'n8' && (node.label !== 'RECEIPT SPLITTER' || node.shape !== 'text' ||
            Boolean(node.shadow) || node.border !== 1));
        if (saved.sampleId !== template.sampleId) {
          if (isUntouchedLegacySample(saved)) return template;
          saved.preset = false;
          saved.positioned = true;
        } else if (editedRemovedTitle) {
          saved.preset = false;
          saved.positioned = true;
        } else {
          const savedNodes = new Map(saved.nodes.map(node => [node.id, node]));
          template.nodes.forEach(node => {
            const previous = savedNodes.get(node.id);
            if (previous) {
              if (ENTITY_SHAPES.includes(previous.shape)) node.shape = previous.shape;
              node.border = [1, 2, 3].includes(previous.border) ? previous.border : node.border;
              node.shadow = Boolean(previous.shadow);
              if (typeof previous.label === 'string' && fitsPresetNode(node, previous.label)) node.label = previous.label;
            }
          });
          return template;
        }
      }
      const ids = new Set(saved.nodes.map(node => node.id));
      const positioned = Boolean(saved.positioned) || (!saved.preset && saved.nodes.some(node => Number.isFinite(node.x) && Number.isFinite(node.y)));
      return {
        name: typeof saved.name === 'string' ? saved.name : 'Untitled diagram',
        preset: Boolean(saved.preset),
        positioned,
        canvasWidth: saved.canvasWidth,
        canvasHeight: saved.canvasHeight,
        canvasMinX: saved.canvasMinX,
        canvasMinY: saved.canvasMinY,
        nodes: saved.nodes.filter(node => typeof node.id === 'string').map(node => ({
          id: node.id,
          label: String(node.label ?? 'Untitled block').slice(0, 240),
          baseLabel: typeof node.baseLabel === 'string' ? node.baseLabel : String(node.label ?? 'Untitled block').slice(0, 240),
          shape: ENTITY_SHAPES.includes(node.shape) ? node.shape : 'box',
          border: [1, 2, 3].includes(node.border) ? node.border : 1,
          shadow: Boolean(node.shadow),
          fontSize: Number.isFinite(node.fontSize) ? node.fontSize : 19,
          fontWeight: node.fontWeight === 700 ? 700 : 500,
          ...(positioned ? { x: node.x, y: node.y, width: node.width, height: node.height, baseWidth: node.baseWidth, baseHeight: node.baseHeight } : {}),
        })),
        edges: saved.edges.filter(edge => ids.has(edge.from) && ids.has(edge.to) && SIDES.includes(edge.fromSide) && SIDES.includes(edge.toSide)),
      };
    }
  } catch { /* Fall back to the sample diagram. */ }
  return defaultDiagram();
}

let documentState = loadDocument();
let selected = null;
let editingNodeId = null;
let connectionDrag = null;
let keyboardConnection = null;
let layout = null;
let layoutSerial = 0;
let layoutTimer = null;
let dragState = null;
let suppressNodeClick = null;
let camera = null;
let panState = null;
let spacePan = false;
let suppressCanvasClick = false;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
  $('empty-state').hidden = documentState.nodes.length !== 0;
}

function element(name, attrs = {}) {
  const el = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
}

function endpoint(node, side) {
  const x = node.x + node.width / 2;
  const y = node.y + node.height / 2;
  if (side === 'north') return { x, y: node.y };
  if (side === 'south') return { x, y: node.y + node.height };
  if (side === 'east') return { x: node.x + node.width, y };
  return { x: node.x, y };
}

function databaseBodyPath(x, y, width, height) {
  const radius = databaseRadius(height);
  return `M ${x} ${y + radius} L ${x} ${y + height - radius} A ${width / 2} ${radius} 0 0 0 ${x + width} ${y + height - radius} L ${x + width} ${y + radius} Z`;
}

function databaseOutlinePath(x, y, width, height) {
  const radius = databaseRadius(height);
  return `M ${x} ${y + radius} A ${width / 2} ${radius} 0 0 1 ${x + width} ${y + radius} L ${x + width} ${y + height - radius} A ${width / 2} ${radius} 0 0 1 ${x} ${y + height - radius} Z`;
}

function appendDatabaseMask(placed, maskId, dx, dy, padding = 0) {
  const x = placed.x + dx;
  const y = placed.y + dy;
  const mask = element('mask', {
    id: maskId, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse',
    x: x - padding, y: y - padding,
    width: placed.width + 2 * padding, height: placed.height + 2 * padding,
  });
  mask.append(element('path', {
    d: databaseOutlinePath(x, y, placed.width, placed.height), fill: '#fff',
    ...(padding ? { stroke: '#fff', 'stroke-width': 2 * padding, 'stroke-linejoin': 'round' } : {}),
  }));
  shapeMasks.append(mask);
  return `url(#${maskId})`;
}

function viewportScale() {
  if (!layout) return 1;
  const { width, height } = viewport.getBoundingClientRect();
  const [, , boxWidth, boxHeight] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  return Math.min(width / boxWidth, height / boxHeight) || 1;
}

function artworkViewBox() {
  if (layout.viewBox) return layout.viewBox;
  return layout.isSample ? '0 0 600 600' : `-22 -22 ${Math.max(layout.width + 44, 240)} ${Math.max(layout.height + 44, 160)}`;
}

function applyCamera() {
  if (!camera) return;
  svg.setAttribute('viewBox', `${camera.x} ${camera.y} ${camera.width} ${camera.height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  for (const [key, value] of Object.entries({ x: camera.x, y: camera.y, width: camera.width, height: camera.height })) {
    canvasTiles.setAttribute(key, String(value));
  }
  positionInlineEditor();
}

function fitCameraToLayout() {
  if (!layout) return;
  const [x, y, width, height] = artworkViewBox().split(/\s+/).map(Number);
  const bounds = viewport.getBoundingClientRect();
  const viewportWidth = bounds.width || 800;
  const viewportHeight = bounds.height || 600;
  const aspect = viewportWidth / viewportHeight;
  const paddedWidth = width + 48;
  const paddedHeight = height + 48;
  const cameraWidth = Math.max(paddedWidth, paddedHeight * aspect);
  const cameraHeight = cameraWidth / aspect;
  camera = {
    x: x + width / 2 - cameraWidth / 2,
    y: y + height / 2 - cameraHeight / 2,
    width: cameraWidth, height: cameraHeight,
    viewportWidth, viewportHeight,
  };
  applyCamera();
}

function zoomAt(factor, clientX, clientY) {
  if (!camera) return;
  const bounds = viewport.getBoundingClientRect();
  const viewportWidth = bounds.width || camera.viewportWidth;
  const viewportHeight = bounds.height || camera.viewportHeight;
  const relativeX = Math.min(1, Math.max(0, (clientX - (bounds.left || 0)) / viewportWidth));
  const relativeY = Math.min(1, Math.max(0, (clientY - (bounds.top || 0)) / viewportHeight));
  const width = Math.min(20000, Math.max(80, camera.width * factor));
  const height = width * viewportHeight / viewportWidth;
  camera.x += relativeX * (camera.width - width);
  camera.y += relativeY * (camera.height - height);
  camera.width = width;
  camera.height = height;
  applyCamera();
}

function resizeCamera() {
  if (!camera) { fitCameraToLayout(); return; }
  const bounds = viewport.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const centerX = camera.x + camera.width / 2;
  const centerY = camera.y + camera.height / 2;
  const worldPerPixel = camera.width / camera.viewportWidth;
  camera.width = bounds.width * worldPerPixel;
  camera.height = bounds.height * worldPerPixel;
  camera.x = centerX - camera.width / 2;
  camera.y = centerY - camera.height / 2;
  camera.viewportWidth = bounds.width;
  camera.viewportHeight = bounds.height;
  applyCamera();
}

function beginManualLayout() {
  if (documentState.positioned) return;
  const placed = new Map(layout.children.map(node => [node.id, node]));
  for (const node of documentState.nodes) {
    const position = placed.get(node.id);
    if (!position) continue;
    Object.assign(node, { x: position.x, y: position.y, width: position.width, height: position.height });
  }
  [documentState.canvasMinX, documentState.canvasMinY, documentState.canvasWidth, documentState.canvasHeight] =
    artworkViewBox().split(/\s+/).map(Number);
  documentState.positioned = true;
  documentState.preset = false;
}

function moveDraggedNode(event) {
  if (!dragState || (event.pointerId != null && event.pointerId !== dragState.pointerId)) return;
  const dx = event.clientX - dragState.clientX;
  const dy = event.clientY - dragState.clientY;
  if (!dragState.active && Math.hypot(dx, dy) < 4) return;
  if (!dragState.active) {
    dragState.active = true;
    clearTimeout(layoutTimer);
    layoutSerial++;
    beginManualLayout();
    setSelection({ type: 'node', id: dragState.id });
  }
  const node = documentState.nodes.find(item => item.id === dragState.id);
  if (!node) return;
  node.x = dragState.x + dx / dragState.scale;
  node.y = dragState.y + dy / dragState.scale;
  layout = layoutPositioned(documentState);
  render();
  event.preventDefault();
}

function finishDrag(event) {
  if (!dragState || (event.pointerId != null && event.pointerId !== dragState.pointerId)) return;
  if (dragState.active) {
    suppressNodeClick = dragState.id;
    requestAnimationFrame(() => { suppressNodeClick = null; });
    persist();
  }
  dragState = null;
}

function movePan(event) {
  if (!panState || (event.pointerId != null && event.pointerId !== panState.pointerId)) return;
  const dx = event.clientX - panState.clientX;
  const dy = event.clientY - panState.clientY;
  if (Math.hypot(dx, dy) >= 3) panState.moved = true;
  camera.x = panState.x - dx / panState.scale;
  camera.y = panState.y - dy / panState.scale;
  applyCamera();
  event.preventDefault();
}

function finishPan(event) {
  if (!panState || (event.pointerId != null && event.pointerId !== panState.pointerId)) return;
  if (panState.moved) {
    suppressCanvasClick = true;
    requestAnimationFrame(() => { suppressCanvasClick = false; });
  }
  panState = null;
  svg.classList.remove('panning');
}

function pathFromSections(edge, edgeState, byId) {
  if (edge.sections?.length) {
    return edge.sections.map(section => {
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
      return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
    }).join(' ');
  }
  const from = byId.get(edgeState.from);
  const to = byId.get(edgeState.to);
  if (!from || !to) return '';
  const a = endpoint(from, edgeState.fromSide);
  const b = endpoint(to, edgeState.toSide);
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

function positionInlineEditor() {
  if (!editingNodeId || !layout || inlineEditor.hidden) return;
  const placed = layout.children.find(node => node.id === editingNodeId);
  const node = documentState.nodes.find(item => item.id === editingNodeId);
  if (!placed || !node) return;
  const { width, height } = viewport.getBoundingClientRect();
  if (!width || !height) return;
  const [minX, minY, boxWidth, boxHeight] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const scale = Math.min(width / boxWidth, height / boxHeight);
  const insetX = (width - boxWidth * scale) / 2;
  const insetY = (height - boxHeight * scale) / 2;
  const insets = textInsets(node.shape, placed.height);
  const editorWidth = Math.max(24, (placed.width - insets.left - insets.right) * scale);
  const editorHeight = Math.max(24, (placed.height - insets.top - insets.bottom) * scale);
  const fontSize = (node.fontSize || 19) * scale;
  const lineHeight = fontSize * 1.2;
  const lineCount = displayLines(node.label).length;
  inlineEditor.style.left = `${insetX + (placed.x + insets.left - minX) * scale}px`;
  inlineEditor.style.top = `${insetY + (placed.y + insets.top - minY) * scale}px`;
  inlineEditor.style.width = `${editorWidth}px`;
  inlineEditor.style.height = `${editorHeight}px`;
  inlineEditor.style.fontSize = `${fontSize}px`;
  inlineEditor.style.lineHeight = `${lineHeight}px`;
  inlineEditor.style.fontWeight = String(node.fontWeight || 500);
  inlineEditor.style.paddingTop = `${Math.max(0, (editorHeight - lineCount * lineHeight) / 2)}px`;
}

function stopInlineEdit() {
  editingNodeId = null;
  inlineEditor.hidden = true;
}

function startInlineEdit(node) {
  editingNodeId = node.id;
  inlineEditor.value = node.label;
  inlineEditor.hidden = false;
  render();
  requestAnimationFrame(() => {
    if (editingNodeId !== node.id) return;
    positionInlineEditor();
    inlineEditor.focus();
    inlineEditor.select();
  });
}

function render() {
  svg.classList.toggle('editing', !!editingNodeId);
  shapeMasks.replaceChildren();
  shadowsLayer.replaceChildren();
  backingsLayer.replaceChildren();
  edgeKnockoutsLayer.replaceChildren();
  edgesLayer.replaceChildren();
  nodesLayer.replaceChildren();
  if (!layout) return;
  const byId = new Map(layout.children.map(node => [node.id, node]));
  const edgeById = new Map(documentState.edges.map(edge => [edge.id, edge]));
  if (!camera) fitCameraToLayout();
  else applyCamera();

  for (const edge of layout.edges || []) {
    const edgeState = edgeById.get(edge.id);
    if (!edgeState) continue;
    const pathData = pathFromSections(edge, edgeState, byId);
    const group = element('g', { class: `edge${selected?.type === 'edge' && selected.id === edge.id ? ' selected' : ''}`, 'data-edge-id': edge.id });
    const marker = edgeState.arrowhead === 'open' ? 'url(#open-arrowhead)' : edgeState.arrowhead === 'none' ? 'none' : 'url(#arrowhead)';
    const knockoutMarker = edgeState.arrowhead === 'open' ? 'url(#open-arrowhead-knockout)' : edgeState.arrowhead === 'none' ? 'none' : 'url(#arrowhead-knockout)';
    edgeKnockoutsLayer.append(element('path', { class: 'edge-knockout', d: pathData, stroke: '#fff', 'stroke-width': 18, fill: 'none', 'marker-end': knockoutMarker }));
    group.append(element('path', { class: 'edge-line', d: pathData, stroke: '#000', 'stroke-width': 1.5, fill: 'none', 'marker-end': marker }));
    const hit = element('path', { class: 'edge-hit', d: pathData });
    hit.addEventListener('click', event => { event.stopPropagation(); selectEdge(edge.id); });
    group.append(hit);
    edgesLayer.append(group);
  }

  layout.children.forEach((placed, index) => {
    const node = documentState.nodes.find(item => item.id === placed.id);
    if (!node) return;
    const isSelected = selected?.type === 'node' && selected.id === node.id;
    const group = element('g', { class: `node shape-${node.shape}${isSelected ? ' selected' : ''}${editingNodeId === node.id ? ' editing' : ''}`, 'data-node-id': node.id, tabindex: 0, role: 'button', 'aria-label': `Select ${node.label || 'untitled block'}; press Enter to edit` });
    group.addEventListener('click', event => {
      event.stopPropagation();
      if (suppressNodeClick === node.id) return;
      if (event.detail > 1) setSelection({ type: 'node', id: node.id }, true);
      else selectNode(node.id);
    });
    group.addEventListener('dblclick', event => {
      event.stopPropagation();
      setSelection({ type: 'node', id: node.id }, true);
    });
    group.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      dragState = { id: node.id, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: placed.x, y: placed.y, scale: viewportScale(), active: false };
    });
    group.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (keyboardConnection) commitConnection(keyboardConnection.nodeId, keyboardConnection.side, node.id);
      else setSelection({ type: 'node', id: node.id }, event.key === 'Enter');
    });
    if (node.shadow && node.shape !== 'text') {
      if (node.shape === 'database') {
        const shadowX = placed.x + 14;
        const shadowY = placed.y + 27;
        shadowsLayer.append(element('rect', {
          class: 'node-shadow', x: shadowX, y: shadowY, width: placed.width, height: placed.height,
          fill: 'url(#halftone)', mask: appendDatabaseMask(placed, `shadow-mask-${index}`, 14, 27),
        }));
      } else {
        shadowsLayer.append(element('rect', {
          class: 'node-shadow', x: placed.x + 14, y: placed.y + 27, width: placed.width + 9, height: placed.height + 1,
          fill: 'url(#halftone)',
        }));
      }
    }
    if (node.shape === 'database') {
      backingsLayer.append(element('rect', {
        class: 'node-backing', x: placed.x - 9, y: placed.y - 9,
        width: placed.width + 18, height: placed.height + 18, fill: '#fff',
        mask: appendDatabaseMask(placed, `backing-mask-${index}`, 0, 0, 9),
      }));
    } else {
      backingsLayer.append(element('rect', {
        class: 'node-backing', x: placed.x - 9, y: placed.y - 9,
        width: placed.width + 18, height: placed.height + 18, fill: '#fff',
      }));
    }
    if (node.shape === 'database') {
      const radius = databaseRadius(placed.height);
      group.append(element('path', {
        class: 'node-shape', d: databaseBodyPath(placed.x, placed.y, placed.width, placed.height),
        fill: '#fff', stroke: '#000', 'stroke-width': node.border,
      }));
      group.append(element('ellipse', {
        class: 'node-database-top', cx: placed.x + placed.width / 2, cy: placed.y + radius,
        rx: placed.width / 2, ry: radius, fill: '#fff', stroke: '#000', 'stroke-width': node.border,
      }));
    } else {
      group.append(element('rect', {
        class: 'node-shape', x: placed.x, y: placed.y, width: placed.width, height: placed.height,
        fill: node.shape === 'text' ? 'transparent' : '#fff',
        stroke: node.shape === 'text' ? 'none' : '#000', 'stroke-width': node.border,
      }));
    }
    if (node.shape === 'box' || node.shape === 'double') {
      group.append(element('rect', {
        class: 'node-inner-border', x: placed.x + 4, y: placed.y + 4,
        width: Math.max(0, placed.width - 8), height: Math.max(0, placed.height - 8),
        fill: 'none', stroke: node.shape === 'double' ? '#000' : '#fff', 'stroke-width': node.border,
      }));
    }
    const lines = displayLines(node.label);
    const fontSize = node.fontSize || 19;
    const lineHeight = fontSize * 1.2;
    const insets = textInsets(node.shape, placed.height);
    const textStart = placed.y + insets.top + (placed.height - insets.top - insets.bottom) / 2 -
      ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.32;
    const text = element('text', { class: 'node-label', x: placed.x + placed.width / 2, y: textStart, 'text-anchor': 'middle', 'font-size': fontSize, fill: '#000', stroke: '#000', 'stroke-width': node.fontWeight === 700 ? 0.65 : 0.2, 'paint-order': 'stroke fill', 'font-family': 'Berkeley Mono, Menlo, monospace', 'font-weight': node.fontWeight || 500, 'letter-spacing': TEXT_LETTER_SPACING });
    lines.forEach((line, lineIndex) => {
      const span = element('tspan', { x: placed.x + placed.width / 2, dy: lineIndex ? lineHeight : 0 });
      span.textContent = line.toUpperCase();
      text.append(span);
    });
    group.append(text);
    if (node.shape === 'database') {
      group.append(element('path', {
        class: 'node-hover-outline', d: databaseOutlinePath(placed.x + 3, placed.y + 3, placed.width - 6, placed.height - 6),
      }));
    } else {
      group.append(element('rect', {
        class: 'node-hover-outline', x: placed.x + 3, y: placed.y + 3,
        width: Math.max(0, placed.width - 6), height: Math.max(0, placed.height - 6),
      }));
    }
    for (const side of SIDES) {
      const point = endpoint(placed, side);
      const port = element('g', { class: `port${connectionDrag?.nodeId === node.id && connectionDrag.side === side ? ' active' : ''}`, 'data-port-id': portId(node.id, side), 'data-side': side, role: 'button', tabindex: editingNodeId ? -1 : 0, 'aria-label': `Drag from ${side} side of ${node.label} to another block` });
      port.append(element('circle', { class: 'port-halo', cx: point.x, cy: point.y, r: 9 }));
      port.append(element('circle', { class: 'port-dot', cx: point.x, cy: point.y, r: 3.5 }));
      port.addEventListener('click', event => event.stopPropagation());
      port.addEventListener('pointerdown', event => startConnectionDrag(event, node.id, side));
      port.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        cancelConnection();
        keyboardConnection = { nodeId: node.id, side };
        port.classList.add('active');
        svg.classList.add('connecting');
        $('connection-status').textContent = 'Choose a destination block';
        $('canvas-hint').textContent = 'Focus another block and press Enter · Esc to cancel';
        $('canvas-hint').hidden = false;
      });
      group.append(port);
    }
    nodesLayer.append(group);
  });
  positionInlineEditor();
}

async function updateLayout() {
  const serial = ++layoutSerial;
  clearTimeout(layoutTimer);
  $('layout-status').textContent = 'Routing arrows…';
  try {
    const result = documentState.preset ? sampleLayout(documentState) : layoutPositioned(documentState);
    if (serial !== layoutSerial) return;
    layout = result;
    render();
    if (documentState.positioned) persist();
    $('layout-status').textContent = 'Auto layout on';
  } catch (error) {
    if (serial !== layoutSerial) return;
    console.error('Layout failed', error);
    $('layout-status').textContent = 'Layout unavailable';
  }
}

function scheduleLayout() {
  clearTimeout(layoutTimer);
  layoutSerial++;
  layoutTimer = setTimeout(updateLayout, 160);
}

function setSelection(selection, focusText = false) {
  stopInlineEdit();
  selected = selection;
  render();
  const node = selection?.type === 'node' ? documentState.nodes.find(item => item.id === selection.id) : null;
  const edge = selection?.type === 'edge' ? documentState.edges.find(item => item.id === selection.id) : null;
  $('inspector-empty').hidden = !!selection;
  $('inspector-content').hidden = !node;
  $('edge-inspector').hidden = !edge;
  $('close-inspector').hidden = !selection;
  inspector.classList.toggle('open', !!selection);
  if (node) {
    $('node-shadow-toggle').checked = node.shadow;
    $('shadow-control').hidden = node.shape === 'text';
    document.querySelectorAll('[data-border-style]').forEach(button => {
      const active = button.dataset.borderStyle === node.shape;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (focusText) startInlineEdit(node);
  }
  if (edge) {
    const from = documentState.nodes.find(item => item.id === edge.from)?.label || 'Block';
    const to = documentState.nodes.find(item => item.id === edge.to)?.label || 'Block';
    $('edge-description').textContent = `${from} → ${to}`;
  }
}

function selectNode(id) { setSelection({ type: 'node', id }); }
function selectEdge(id) { cancelConnection(); setSelection({ type: 'edge', id }); }

function destinationSide(from, to) {
  const dx = from.x + from.width / 2 - (to.x + to.width / 2);
  const dy = from.y + from.height / 2 - (to.y + to.height / 2);
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south');
}

function nearestSide(node, point) {
  return [
    ['north', Math.abs(point.y - node.y)],
    ['east', Math.abs(point.x - node.x - node.width)],
    ['south', Math.abs(point.y - node.y - node.height)],
    ['west', Math.abs(point.x - node.x)],
  ].sort((a, b) => a[1] - b[1])[0][0];
}

function connectionTarget(event) {
  const hit = document.elementFromPoint?.(event.clientX, event.clientY) || event.target;
  const targetId = hit?.closest?.('[data-node-id]')?.getAttribute('data-node-id');
  const node = layout?.children.find(item => item.id === targetId);
  if (!node || targetId === connectionDrag?.nodeId) return null;
  const port = hit.closest?.('[data-port-id]');
  return { node, side: port?.getAttribute('data-side') || nearestSide(node, clientToDiagram(event.clientX, event.clientY)) };
}

function commitConnection(nodeId, side, targetId, toSide) {
  const from = layout?.children.find(node => node.id === nodeId);
  const to = layout?.children.find(node => node.id === targetId);
  cancelConnection();
  if (!from || !to || nodeId === targetId) return;
  suppressNodeClick = targetId;
  requestAnimationFrame(() => { suppressNodeClick = null; });
  documentState.edges.push({ id: crypto.randomUUID(), from: nodeId, fromSide: side, to: targetId, toSide: toSide || destinationSide(from, to) });
  if (documentState.preset) documentState.positioned = true;
  documentState.preset = false;
  persist();
  updateLayout();
}

function clientToDiagram(clientX, clientY) {
  const bounds = viewport.getBoundingClientRect();
  return {
    x: camera.x + (clientX - bounds.left) * camera.width / bounds.width,
    y: camera.y + (clientY - bounds.top) * camera.height / bounds.height,
  };
}

function startConnectionDrag(event, nodeId, side) {
  if (event.button !== 0 || editingNodeId || spacePan || !layout) return;
  event.preventDefault();
  event.stopPropagation();
  cancelConnection();
  connectionDrag = { nodeId, side, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, moved: false };
  svg.classList.add('connecting');
  $('connection-status').textContent = 'Drag to another block';
  $('canvas-hint').textContent = 'Release on another block · Esc to cancel';
  $('canvas-hint').hidden = false;
  const port = document.querySelector(`[data-port-id="${portId(nodeId, side)}"]`);
  port?.classList.add('active');
}

function moveConnectionDrag(event) {
  if (!connectionDrag || (event.pointerId != null && event.pointerId !== connectionDrag.pointerId)) return;
  if (!connectionDrag.moved && Math.hypot(event.clientX - connectionDrag.clientX, event.clientY - connectionDrag.clientY) < 4) return;
  connectionDrag.moved = true;
  const from = layout.children.find(node => node.id === connectionDrag.nodeId);
  if (!from) return;
  const start = endpoint(from, connectionDrag.side);
  const target = connectionTarget(event);
  const end = target ? endpoint(target.node, target.side) : clientToDiagram(event.clientX, event.clientY);
  if (!connectionDrag.preview) {
    connectionDrag.previewKnockout = element('path', { class: 'connection-preview-knockout', fill: 'none', stroke: '#fff', 'stroke-width': 18, 'marker-end': 'url(#arrowhead-knockout)' });
    connectionDrag.preview = element('path', { class: 'connection-preview', fill: 'none', stroke: '#000', 'stroke-width': 1.5, 'marker-end': 'url(#arrowhead)' });
    edgeKnockoutsLayer.append(connectionDrag.previewKnockout);
    edgesLayer.append(connectionDrag.preview);
  }
  const path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  connectionDrag.previewKnockout.setAttribute('d', path);
  connectionDrag.preview.setAttribute('d', path);
  event.preventDefault();
}

function finishConnectionDrag(event) {
  if (!connectionDrag || (event.pointerId != null && event.pointerId !== connectionDrag.pointerId)) return;
  const { nodeId, side, moved } = connectionDrag;
  const target = connectionTarget(event);
  if (!moved || event.type === 'pointercancel') { cancelConnection(); return; }
  commitConnection(nodeId, side, target?.node.id, target?.side);
}

function cancelConnection() {
  connectionDrag?.preview?.remove();
  connectionDrag?.previewKnockout?.remove();
  connectionDrag = null;
  keyboardConnection = null;
  svg.classList.remove('connecting');
  $('connection-status').textContent = 'Ready to connect';
  $('canvas-hint').hidden = true;
  document.querySelectorAll('.port.active').forEach(port => port.classList.remove('active'));
}

function addTextNodeAt(clientX, clientY) {
  if (!layout || !camera) return;
  const center = clientToDiagram(clientX, clientY);
  beginManualLayout();
  const width = 90;
  const height = 40;
  const desiredX = center.x - width / 2;
  const desiredY = center.y - height / 2;
  const overlaps = (left, top) => documentState.nodes.some(node =>
    left < node.x + node.width + 16 && left + width + 16 > node.x &&
    top < node.y + node.height + 16 && top + height + 16 > node.y);
  let x = desiredX;
  let y = desiredY;
  for (let radius = 12; overlaps(x, y); radius += 12) {
    const offsets = [[radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius, radius], [-radius, radius], [radius, -radius], [-radius, -radius]];
    const free = offsets.find(([dx, dy]) => !overlaps(desiredX + dx, desiredY + dy));
    if (free) { x = desiredX + free[0]; y = desiredY + free[1]; break; }
  }
  const node = { id: crypto.randomUUID(), label: 'Text', baseLabel: 'Text', shape: 'text', border: 1, shadow: false, fontSize: 19, x, y, width, height, baseWidth: width, baseHeight: height };
  documentState.nodes.push(node);
  documentState.positioned = true;
  documentState.preset = false;
  persist();
  updateLayout();
  setSelection({ type: 'node', id: node.id }, true);
}

function deleteSelection() {
  if (!selected) return;
  if (documentState.preset) documentState.positioned = true;
  documentState.preset = false;
  if (selected.type === 'node') {
    documentState.nodes = documentState.nodes.filter(node => node.id !== selected.id);
    documentState.edges = documentState.edges.filter(edge => edge.from !== selected.id && edge.to !== selected.id);
  } else {
    documentState.edges = documentState.edges.filter(edge => edge.id !== selected.id);
  }
  selected = null;
  cancelConnection();
  setSelection(null);
  persist();
  updateLayout();
}

function exportSvg() {
  if (!layout || !documentState.nodes.length) return;
  const copy = svg.cloneNode(true);
  copy.querySelector('#canvas-tiles')?.remove();
  copy.querySelector('#canvas-tile')?.remove();
  copy.querySelectorAll('.port,.edge-hit,.node-hover-outline').forEach(node => node.remove());
  copy.querySelectorAll('.selected,.editing').forEach(node => node.classList.remove('selected', 'editing'));
  copy.querySelectorAll('[tabindex],[role],[aria-label],[data-node-id],[data-edge-id]').forEach(node => {
    for (const attr of ['tabindex', 'role', 'aria-label', 'data-node-id', 'data-edge-id']) node.removeAttribute(attr);
  });
  const artworkBox = artworkViewBox();
  const [minX, minY, boxWidth, boxHeight] = artworkBox.split(/\s+/).map(Number);
  copy.setAttribute('viewBox', artworkBox);
  const background = element('rect', { x: minX, y: minY, width: boxWidth, height: boxHeight, fill: '#fff' });
  copy.insertBefore(background, copy.querySelector('#shadows-layer'));
  copy.setAttribute('width', Math.ceil(boxWidth));
  copy.setAttribute('height', Math.ceil(boxHeight));
  copy.removeAttribute('class');
  copy.removeAttribute('id');
  const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${documentState.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'diagram'}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll('[data-border-style]').forEach(button => button.addEventListener('click', () => {
  const node = documentState.nodes.find(item => selected?.type === 'node' && item.id === selected.id);
  if (!node) return;
  node.shape = button.dataset.borderStyle;
  const minimum = minimumTextNodeSize(node);
  const needsResize = node.width < minimum.width || node.height < minimum.height;
  if (needsResize) beginManualLayout();
  persist();
  if (needsResize) {
    updateLayout();
    node.baseWidth = Math.max(node.baseWidth || 0, node.width);
    node.baseHeight = Math.max(node.baseHeight || 0, node.height);
    persist();
  }
  setSelection(selected);
}));
inlineEditor.addEventListener('input', event => {
  const node = documentState.nodes.find(item => item.id === editingNodeId);
  if (!node) return;
  node.label = event.target.value.slice(0, 240);
  if (event.target.value !== node.label) event.target.value = node.label;
  if (documentState.preset && !fitsPresetNode(node, node.label)) {
    documentState.preset = false;
    documentState.positioned = true;
  }
  persist();
  scheduleLayout();
  positionInlineEditor();
});
inlineEditor.addEventListener('blur', () => {
  if (!editingNodeId) return;
  stopInlineEdit();
  render();
});
$('node-shadow-toggle').addEventListener('change', event => {
  const node = documentState.nodes.find(item => selected?.type === 'node' && item.id === selected.id);
  if (!node) return;
  node.shadow = event.target.checked;
  persist();
  render();
});
$('delete-node').addEventListener('click', deleteSelection);
$('delete-edge').addEventListener('click', deleteSelection);
$('close-inspector').addEventListener('click', () => setSelection(null));
$('export-svg').addEventListener('click', exportSvg);
$('load-sample').addEventListener('click', () => {
  if (documentState.nodes.length && !window.confirm('Replace the current diagram with the receipt splitter sample?')) return;
  documentState = sampleTemplate();
  selected = null;
  cancelConnection();
  setSelection(null);
  camera = null;
  persist();
  updateLayout();
});
$('new-diagram').addEventListener('click', () => {
  if (documentState.nodes.length && !window.confirm('Start a new diagram? The current local diagram will be replaced.')) return;
  documentState = { name: 'Untitled diagram', preset: false, nodes: [], edges: [] };
  selected = null;
  cancelConnection();
  setSelection(null);
  camera = null;
  persist();
  updateLayout();
});
svg.addEventListener('pointerdown', event => {
  const background = event.target === svg || event.target === canvasTiles;
  if (!camera || !(event.button === 1 || (event.button === 0 && (spacePan || background)))) return;
  panState = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: camera.x, y: camera.y, scale: viewportScale(), moved: false };
  svg.classList.add('panning');
  event.preventDefault();
  event.stopPropagation();
}, true);
svg.addEventListener('click', event => {
  if (suppressNodeClick || suppressCanvasClick) { event.stopPropagation(); return; }
  if (event.target === svg || event.target === canvasTiles || event.target === edgesLayer || event.target === nodesLayer) { cancelConnection(); setSelection(null); }
});
svg.addEventListener('dblclick', event => {
  if (spacePan || event.target !== canvasTiles) return;
  event.preventDefault();
  addTextNodeAt(event.clientX, event.clientY);
});
viewport.addEventListener('wheel', event => {
  if (event.target === inlineEditor || event.target.closest?.('.canvas-controls')) return;
  event.preventDefault();
  zoomAt(Math.exp(Math.max(-600, Math.min(600, event.deltaY)) * 0.0015), event.clientX, event.clientY);
}, { passive: false });
$('zoom-in').addEventListener('click', () => {
  const bounds = viewport.getBoundingClientRect();
  zoomAt(0.8, (bounds.left || 0) + bounds.width / 2, (bounds.top || 0) + bounds.height / 2);
});
$('zoom-out').addEventListener('click', () => {
  const bounds = viewport.getBoundingClientRect();
  zoomAt(1.25, (bounds.left || 0) + bounds.width / 2, (bounds.top || 0) + bounds.height / 2);
});
$('zoom-fit').addEventListener('click', fitCameraToLayout);
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !['TEXTAREA', 'INPUT', 'BUTTON'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    event.stopPropagation();
    spacePan = true;
    svg.classList.add('space-pan');
    return;
  }
  if (event.key === 'Escape') { cancelConnection(); if (document.activeElement === inlineEditor) inlineEditor.blur(); else setSelection(null); }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected && !['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) { event.preventDefault(); deleteSelection(); }
}, true);
document.addEventListener('keyup', event => {
  if (event.code === 'Space') { spacePan = false; svg.classList.remove('space-pan'); }
});
window.addEventListener('blur', () => { spacePan = false; svg.classList.remove('space-pan'); });
window.addEventListener('pointermove', movePan);
window.addEventListener('pointerup', finishPan);
window.addEventListener('pointercancel', finishPan);
window.addEventListener('resize', resizeCamera);
window.addEventListener('pointermove', moveDraggedNode);
window.addEventListener('pointerup', finishDrag);
window.addEventListener('pointercancel', finishDrag);
window.addEventListener('pointermove', moveConnectionDrag);
window.addEventListener('pointerup', finishConnectionDrag);
window.addEventListener('pointercancel', finishConnectionDrag);

persist();
updateLayout();
