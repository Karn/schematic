import { minimumTextNodeSize } from './layout.js';

const SIDES = {
  north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0],
};

function port(node, side) {
  const x = node.x + node.width / 2;
  const y = node.y + node.height / 2;
  if (side === 'north') return { x, y: node.y };
  if (side === 'south') return { x, y: node.y + node.height };
  if (side === 'east') return { x: node.x + node.width, y };
  return { x: node.x, y };
}

function overlaps(a, b, gap = 16) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

function fitNode(node, others) {
  const existing = Number.isFinite(node.width) && Number.isFinite(node.height);
  node.baseWidth ??= existing ? node.width : 120;
  node.baseHeight ??= existing ? node.height : 66;
  node.baseLabel ??= node.label;
  const minimum = minimumTextNodeSize(node);
  const width = Math.max(node.baseWidth, minimum.width);
  const height = Math.max(node.baseHeight, minimum.height);
  if (width === node.width && height === node.height) return;
  const x = node.x + ((node.width || width) - width) / 2;
  const y = node.y + ((node.height || height) - height) / 2;
  const fits = (left, top) => others.every(other => !overlaps({ x: left, y: top, width, height }, other));
  let placement = null;
  for (let radius = 0; radius <= 900 && !placement; radius += 4) {
    for (let dx = -radius; dx <= radius && !placement; dx += 4) {
      for (const dy of radius ? [-radius, radius] : [0]) {
        if (fits(x + dx, y + dy)) { placement = [x + dx, y + dy]; break; }
      }
    }
    for (let dy = -radius + 4; dy < radius && !placement; dy += 4) {
      for (const dx of [-radius, radius]) {
        if (fits(x + dx, y + dy)) { placement = [x + dx, y + dy]; break; }
      }
    }
  }
  node.x = placement?.[0] ?? x;
  node.y = placement?.[1] ?? y;
  node.width = width;
  node.height = height;
}

function crosses(a, b, node, pad = 5) {
  const left = node.x - pad;
  const right = node.x + node.width + pad;
  const top = node.y - pad;
  const bottom = node.y + node.height + pad;
  if (a.x === b.x) return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
  if (a.y === b.y) return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
  return true;
}

function clean(points) {
  const result = [];
  for (const point of points) {
    if (result.length && point.x === result.at(-1).x && point.y === result.at(-1).y) continue;
    result.push(point);
    while (result.length >= 3) {
      const [a, b, c] = result.slice(-3);
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) result.splice(-2, 1);
      else break;
    }
  }
  return result;
}

function route(edge, byId, nodes) {
  const from = byId.get(edge.from);
  const to = byId.get(edge.to);
  const start = port(from, edge.fromSide);
  const end = port(to, edge.toSide);
  const obstacles = nodes.filter(node => node.id !== from.id && node.id !== to.id);
  if (edge.points?.length >= 2) {
    const old = edge.points.map(([x, y]) => ({ x, y }));
    if (old[0].x === start.x && old[0].y === start.y && old.at(-1).x === end.x && old.at(-1).y === end.y &&
      old.slice(1).every((point, index) => obstacles.every(node => !crosses(old[index], point, node)))) return old;
  }
  const [sx, sy] = SIDES[edge.fromSide];
  const [tx, ty] = SIDES[edge.toSide];
  const source = { x: start.x + sx * 11, y: start.y + sy * 11 };
  const target = { x: end.x + tx * 11, y: end.y + ty * 11 };
  const xs = new Set([source.x, target.x, ...nodes.flatMap(node => [node.x - 11, node.x + node.width + 11])]);
  const ys = new Set([source.y, target.y, ...nodes.flatMap(node => [node.y - 11, node.y + node.height + 11])]);
  const bounds = nodes.reduce((value, node) => ({
    minX: Math.min(value.minX, node.x), minY: Math.min(value.minY, node.y),
    maxX: Math.max(value.maxX, node.x + node.width), maxY: Math.max(value.maxY, node.y + node.height),
  }), { minX: source.x, minY: source.y, maxX: target.x, maxY: target.y });
  xs.add(bounds.minX - 30); xs.add(bounds.maxX + 30);
  ys.add(bounds.minY - 30); ys.add(bounds.maxY + 30);
  const xValues = [...xs].sort((a, b) => a - b);
  const yValues = [...ys].sort((a, b) => a - b);
  const width = xValues.length;
  const height = yValues.length;
  const index = (x, y) => y * width + x;
  const sourceIndex = index(xValues.indexOf(source.x), yValues.indexOf(source.y));
  const targetIndex = index(xValues.indexOf(target.x), yValues.indexOf(target.y));
  const nodesCount = width * height;
  const scores = new Float64Array(nodesCount * 3).fill(Infinity);
  const previous = new Int32Array(nodesCount * 3).fill(-1);
  const queue = [];
  function push(item) {
    queue.push(item);
    let child = queue.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (queue[parent].priority <= item.priority) break;
      queue[child] = queue[parent]; child = parent;
    }
    queue[child] = item;
  }
  function pop() {
    const first = queue[0];
    const last = queue.pop();
    if (queue.length) {
      let parent = 0;
      while (parent * 2 + 1 < queue.length) {
        let child = parent * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1].priority < queue[child].priority) child++;
        if (last.priority <= queue[child].priority) break;
        queue[parent] = queue[child]; parent = child;
      }
      queue[parent] = last;
    }
    return first;
  }
  const startState = sourceIndex * 3;
  scores[startState] = 0;
  push({ state: startState, priority: Math.abs(source.x - target.x) + Math.abs(source.y - target.y) });
  let finish = -1;
  while (queue.length) {
    const { state, priority } = pop();
    const cell = Math.floor(state / 3);
    const direction = state % 3;
    const x = cell % width;
    const y = Math.floor(cell / width);
    const estimate = Math.abs(xValues[x] - target.x) + Math.abs(yValues[y] - target.y);
    if (priority > scores[state] + estimate + 0.001) continue;
    if (cell === targetIndex) { finish = state; break; }
    for (const [nextX, nextY, nextDirection] of [[x - 1, y, 1], [x + 1, y, 1], [x, y - 1, 2], [x, y + 1, 2]]) {
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const a = { x: xValues[x], y: yValues[y] };
      const b = { x: xValues[nextX], y: yValues[nextY] };
      if (nodes.some(node => crosses(a, b, node))) continue;
      const nextState = index(nextX, nextY) * 3 + nextDirection;
      const cost = scores[state] + Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + (direction && direction !== nextDirection ? 14 : 0);
      if (cost >= scores[nextState]) continue;
      scores[nextState] = cost;
      previous[nextState] = state;
      push({ state: nextState, priority: cost + Math.abs(b.x - target.x) + Math.abs(b.y - target.y) });
    }
  }
  if (finish < 0) return clean([start, source, { x: target.x, y: source.y }, target, end]);
  const middle = [];
  for (let state = finish; state >= 0; state = previous[state]) {
    const cell = Math.floor(state / 3);
    middle.push({ x: xValues[cell % width], y: yValues[Math.floor(cell / width)] });
  }
  middle.reverse();
  return clean([start, ...middle, end]);
}

export function layoutPositioned(documentState) {
  const nodes = documentState.nodes;
  for (const node of nodes) {
    if (!Number.isFinite(node.x)) node.x = Math.max(12, ...nodes.map(item => (item.x || 0) + (item.width || 0))) + 40;
    if (!Number.isFinite(node.y)) node.y = 200;
    fitNode(node, nodes.filter(other => other !== node));
  }
  const byId = new Map(nodes.map(node => [node.id, node]));
  const edges = documentState.edges.filter(edge => byId.has(edge.from) && byId.has(edge.to)).map(edge => {
    const points = route(edge, byId, nodes);
    edge.points = points.map(point => [point.x, point.y]);
    return { id: edge.id, sections: [{ startPoint: points[0], bendPoints: points.slice(1, -1), endPoint: points.at(-1) }] };
  });
  const baseMinX = documentState.canvasMinX ?? 0;
  const baseMinY = documentState.canvasMinY ?? 0;
  const baseWidth = documentState.canvasWidth || 600;
  const baseHeight = documentState.canvasHeight || 600;
  const routedPoints = edges.flatMap(edge => edge.sections.flatMap(section => [section.startPoint, ...section.bendPoints, section.endPoint]));
  const minX = Math.min(baseMinX, ...nodes.map(node => node.x - 9), ...routedPoints.map(point => point.x - 12));
  const minY = Math.min(baseMinY, ...nodes.map(node => node.y - 9), ...routedPoints.map(point => point.y - 12));
  const right = Math.max(baseMinX + baseWidth, ...nodes.map(node => node.x + node.width + 30), ...routedPoints.map(point => point.x + 12));
  const bottom = Math.max(baseMinY + baseHeight, ...nodes.map(node => node.y + node.height + 30), ...routedPoints.map(point => point.y + 12));
  const width = right - minX;
  const height = bottom - minY;
  return {
    id: 'positioned', width, height, viewBox: `${minX} ${minY} ${width} ${height}`,
    children: nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
    edges,
  };
}
