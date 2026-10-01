export const SIDES = ['north', 'east', 'south', 'west'];
export const TEXT_LETTER_SPACING = 0.7;

export function databaseRadius(height) {
  return Math.min(10, height / 5);
}

export function textInsets(shape, height) {
  if (shape === 'text') return { left: 12, right: 12, top: 12, bottom: 12 };
  if (shape === 'database') return { left: 14, right: 14, top: 2 * databaseRadius(height) + 10, bottom: 10 };
  return { left: 14, right: 14, top: 14, bottom: 14 };
}

export function minimumTextNodeSize(node, label = node.label) {
  const lines = displayLines(label);
  const fontSize = node.fontSize || 19;
  const insets = textInsets(node.shape, 60);
  const longest = Math.max(...lines.map(line => line.length));
  const textWidth = longest * (fontSize * 0.61 + TEXT_LETTER_SPACING);
  const textHeight = fontSize * 0.75 + (lines.length - 1) * fontSize * 1.2;
  return {
    width: Math.ceil(textWidth + insets.left + insets.right),
    height: Math.ceil(textHeight + insets.top + insets.bottom),
  };
}

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

export function portId(nodeId, side) {
  return `${nodeId}-${side}`;
}
