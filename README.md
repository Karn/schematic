# Schematic

A small system diagram editor built with the same plain HTML, CSS, and JavaScript app structure as `../side-by-side`. Its local orthogonal router adjusts arrows around placed nodes.

## Run

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. There is no build step or runtime dependency. To run the route and editor tests, use `npm install` followed by `npm test`.

## GitHub Pages

In the repository's **Settings → Pages**, set **Source** to **Deploy from a branch**, select `main` and `/ (root)`. GitHub Pages can serve the files directly at `https://karn.github.io/schematic/`. Diagrams stay in each browser's local storage.

The starter diagram shows a receipt splitting app: mobile and web clients reach an API server, which works with a receipt parser, split engine, and two databases. It uses a white background, uppercase monospaced text, black right-angle arrows, and optional offset halftone shadows. Double click the canvas to add a text node; choose None, Single, Double, or Database under Entity shape in the inspector. Edits preserve the existing arrangement, fit changed text, and reroute affected arrows. **Sample** restores the starter diagram.

The app and exported SVG use the locally installed **Berkeley Mono** font. On another machine, the SVG falls back to Menlo or the system monospace font.

The editor controls use the same monochrome, square-cornered style, with compact panels to keep more room for the artboard.

Double click empty canvas to add a text node at that point. Click a node to select its Entity shape; double click it (or press Enter) to edit its text inline. Drag a node to move it and reroute its arrows. Side dots appear when the pointer is over a connection point and disappear while editing text. Drag from a side dot onto another block to make a directional connection. Dropping on a destination dot uses that exact side; dropping on the block uses its nearest side. Click an arrow to delete it. The diagram saves in this browser's local storage; **Export SVG** downloads a standalone vector image. White backing around shapes, arrow shafts, and arrowheads keeps routes clear of the dotted shadows.

The canvas tiles continue beyond the diagram. Drag empty space to pan, or hold Space and drag anywhere; the middle mouse button also pans. Use the wheel or the compact `−`, `Fit`, and `+` controls to zoom. Export frames the diagram and omits the canvas grid.
