# Griddle

Make a grid of images! Drop in any number of images and get one grid image back. Everything runs in your browser with canvas; your images never leave your device.

- Columns and rows, with a partly filled last row centered
- Cell shapes: square, 4:3, 3:2, 16:9, 5:4, 21:9 and their portrait versions
- Fill (crop) or fit; drag an image in the preview to move it, hover for a zoom slider and reset
- Drop an image on a cell to replace it
- Rounded corners, borders, drop shadows and divider lines
- Undo and redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z or Ctrl+Y)
- Gap and edge padding
- Backgrounds: transparent, white, black, any color, gradient and dot-grid presets, or your own image
- Output size presets (long edge) or a custom size
- Download PNG or JPG, or copy to the clipboard
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
- `src/lib/render.ts`: canvas drawing, preview and full-resolution export
- `src/lib/paint/`: background presets and their WebGL renderer
- `src/lib/examples.ts` and `src/assets/examples/`: the example grid shown before any upload
- `src/lib/components/`: app components; `ui/` holds the shadcn-svelte components
- `src/App.svelte`: the page

## License

MIT. The dark theme is based on [Vesper](https://github.com/raunofreiberg/vesper) by Rauno Freiberg (MIT).
