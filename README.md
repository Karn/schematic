# Schematic

A small system diagram editor built with the same plain HTML, CSS, and JavaScript app structure as `../side-by-side`. It uses `elkjs` for new diagrams and a fixed-position orthogonal router when editing the traced starter composition.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` for a production build and `npm test` for the route geometry check.

The starter diagram recreates the supplied 600 × 600 print with editable labels and boxes. It uses a white background, uppercase monospaced text, square or double boxes, black right-angle arrows, and optional offset halftone shadows. Double click the canvas to add a text node; choose no border, a single border, or a double border in the inspector. Edits preserve the existing arrangement, fit changed text, and reroute affected arrows. **Reference sample** restores the traced composition.

For the closest match, the app and exported SVG use the locally installed **Berkeley Mono** font. On another machine, the SVG falls back to Menlo or the system monospace font.

The editor controls use the same monochrome, square-cornered style, with compact panels to keep more room for the artboard.

Double click empty canvas to add a text node at that point. Click a node to select it and choose None, Single, or Double in the inspector; double click it (or press Enter) to edit its text inline. Drag a node to move it and reroute its arrows. Side dots appear when the pointer is over a connection point and disappear while editing text. Drag from a side dot onto another block to make a directional connection. Dropping on a destination dot uses that exact side; dropping on the block uses its nearest side. Click an arrow to delete it. The diagram saves in this browser's local storage; **Export SVG** downloads a standalone vector image. White backing around shapes, arrow shafts, and arrowheads keeps routes clear of the dotted shadows.

The canvas tiles continue beyond the diagram. Drag empty space to pan, or hold Space and drag anywhere; the middle mouse button also pans. Use the wheel or the compact `−`, `Fit`, and `+` controls to zoom. Export frames the diagram and omits the canvas grid.
