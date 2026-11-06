export type Rect = { x: number; y: number; w: number; h: number };

export type LayoutInput = {
	count: number;
	cols: number;
	rows: number;
	/** Cell width divided by cell height. */
	aspect: number;
	/** Length in pixels of the output's longer side. */
	longEdge: number;
	/** Space between cells, in output pixels. */
	gutter: number;
	/** Space around the outside of the grid, in output pixels. */
	padding: number;
};

export type Layout = {
	width: number;
	height: number;
	cols: number;
	rows: number;
	/** How many images are placed (extra images beyond cols × rows are left out). */
	used: number;
	cells: Rect[];
};

const clampInt = (n: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

/**
 * Lays out `count` equal cells in a grid of at most `cols` × `rows`.
 * Rows with no images are dropped, and a partly filled last row is centered.
 */
export function computeLayout(input: LayoutInput): Layout {
	const cols = clampInt(input.cols, 1, 100);
	const maxRows = clampInt(input.rows, 1, 100);
	const used = Math.min(Math.max(0, Math.floor(input.count)), cols * maxRows);
	const rows = Math.max(1, Math.ceil(used / cols));
	const aspect = input.aspect > 0 && Number.isFinite(input.aspect) ? input.aspect : 1;
	const longEdge = clampInt(input.longEdge, 16, 20000);
	const gutter = Math.max(0, Number.isFinite(input.gutter) ? input.gutter : 0);
	const edge = Math.max(0, Number.isFinite(input.padding) ? input.padding : 0);

	// Decide which side is longer from the cells alone, then solve for the cell size.
	const landscape = cols * aspect >= rows;
	let cellW: number;
	let cellH: number;
	if (landscape) {
		cellW = Math.max(1, (longEdge - 2 * edge - (cols - 1) * gutter) / cols);
		cellH = cellW / aspect;
	} else {
		cellH = Math.max(1, (longEdge - 2 * edge - (rows - 1) * gutter) / rows);
		cellW = cellH * aspect;
	}

	const width = Math.round(2 * edge + cols * cellW + (cols - 1) * gutter);
	const height = Math.round(2 * edge + rows * cellH + (rows - 1) * gutter);

	const cells: Rect[] = [];
	for (let i = 0; i < used; i++) {
		const row = Math.floor(i / cols);
		const col = i % cols;
		const inRow = row === rows - 1 ? used - row * cols : cols;
		const offset = ((cols - inRow) * (cellW + gutter)) / 2;
		const x0 = edge + offset + col * (cellW + gutter);
		const y0 = edge + row * (cellH + gutter);
		const x = Math.round(x0);
		const y = Math.round(y0);
		cells.push({ x, y, w: Math.round(x0 + cellW) - x, h: Math.round(y0 + cellH) - y });
	}

	return { width, height, cols, rows, used, cells };
}

export type Adjust = {
	/** 1 is the default size (cover for fill, contain for fit). */
	zoom: number;
	/** -1 to 1: which part of the overflow shows (0 is centered, 1 shows the right / bottom edge). */
	ox: number;
	oy: number;
};

export const DEFAULT_ADJUST: Adjust = { zoom: 1, ox: 0, oy: 0 };

export const ZOOM_MAX = 5;

/** Where an image is drawn so it covers (fill) or fits inside (fit) a cell, after zoom and pan. */
export function placeImage(
	imgW: number,
	imgH: number,
	cell: Rect,
	mode: 'fill' | 'fit',
	adjust: Adjust = DEFAULT_ADJUST
): Rect & { slackX: number; slackY: number } {
	const base = mode === 'fill' ? Math.max(cell.w / imgW, cell.h / imgH) : Math.min(cell.w / imgW, cell.h / imgH);
	const zoom = Math.min(ZOOM_MAX, Math.max(1, adjust.zoom || 1));
	const k = base * zoom;
	const w = imgW * k;
	const h = imgH * k;
	const slackX = Math.max(0, w - cell.w);
	const slackY = Math.max(0, h - cell.h);
	const ox = Math.min(1, Math.max(-1, adjust.ox || 0));
	const oy = Math.min(1, Math.max(-1, adjust.oy || 0));
	return {
		x: cell.x + (cell.w - w) / 2 - (ox * slackX) / 2,
		y: cell.y + (cell.h - h) / 2 - (oy * slackY) / 2,
		w,
		h,
		slackX,
		slackY
	};
}
