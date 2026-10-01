# Sample and style review

![Receipt splitter sample](docs/editor-preview.png)

The starter uses eight editable nodes and eight directional routes to show a receipt splitting app. Mobile and web clients connect to an API server. The server connects to receipt parsing, receipt storage, and split calculation; the calculated splits are stored separately. The two stores use the Database entity shape.

The [original print reference](https://usgraphics.com/static/products/TX-02/images/TX-02-box-drawing.541f94d73270.svg) informed the monochrome artwork: Berkeley Mono labels, square and double borders, right-angle arrows, halftone shadows, and white clearance around nodes and routes. Database nodes use SVG masks so their white backing and optional shadow follow the cylinder silhouette.

The [edited preview](docs/editor-edited-preview.png) shows a longer API label and an added route. The local router preserves placed nodes and routes around unrelated nodes. `npm test` checks route clearance, inline editing, shape controls, connections, and SVG export. The previews above come from the app's actual SVG export, rasterized at 600 × 600.
