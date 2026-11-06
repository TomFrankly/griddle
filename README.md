# Griddle

Make a grid of images! Drop in any number of images and get one grid image back. Everything runs in your browser with canvas; your images never leave your device. (Caption fonts other than Inter are loaded from Google Fonts when you pick them.)

- Columns and rows (or automatic), with a partly filled last row centered
- Images can span several cells, for bento layouts, and Random mixes spans and order
- Cell shapes: square, 4:3, 3:2, 16:9, 5:4, 21:9 and their portrait versions
- Fill (crop) or fit; drag an image in the preview to move it, hover for a zoom slider and reset
- Drop an image on a cell to replace it, or on the image list to insert it
- Small cells fold their controls into one menu; right-click any cell for the same menu
- Zoom the preview with the buttons, Cmd/Ctrl+scroll or Cmd/Ctrl +, - and 0
- Rounded corners, borders, drop shadows and cell backgrounds (any background option), for transparent images
- Divider lines in many types (dotted, double, wavy, stitched, beaded, hand-drawn and more), with crossing marks, ornaments, floating ends, fades and gradients
- Captions: a title and description per image, with rich text, any Google Font, size, color, shadow and position above, below or inside the cell, plus a side panel to edit them all
- Looks: built-in and saved combinations of spacing, style and background
- Undo and redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z or Ctrl+Y)
- Gap and edge padding
- Backgrounds: transparent, white, black, any color, gradient and dot-grid presets, or your own image
- Output size presets (long edge), social post sizes, or a custom size
- Download PNG, JPG or WebP (with quality), a layered PSD, or each cell as its own PNG in a ZIP, or copy to the clipboard
- Paste an image while hovering a cell to replace it
- Your grid and settings are kept in this browser between visits
- Light and dark themes

## Develop

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

```bash
npm test          # unit tests (grid layout and crop math)
npm run check     # type check
npm run build     # production build into dist/
```

## Deploy

The app is a static site. `wrangler.jsonc` deploys `dist/` to Cloudflare Workers static assets:

```bash
npx wrangler login
npm run deploy
```

## Project layout

- `src/lib/grid.ts`: grid layout and per-image placement (pure, unit tested)
- `src/lib/render.ts`: canvas drawing, preview and full-resolution, PSD and per-cell export
- `src/lib/lines.ts`: divider line types, crossings and ornaments
- `src/lib/captions/`: caption layout, drawing and Google Fonts loading
- `src/lib/paint/`: background presets and their WebGL renderer
- `src/lib/examples.ts` and `src/assets/examples/`: the example grid shown before any upload
- `src/lib/components/`: app components; `ui/` holds the shadcn-svelte components
- `src/App.svelte`: the page

## License

MIT. The dark theme is based on [Vesper](https://github.com/raunofreiberg/vesper) by Rauno Freiberg (MIT).
