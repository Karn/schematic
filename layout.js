export const SIDES = ['north', 'east', 'south', 'west'];

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
