<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { exampleFiles, exampleUrls } from '$lib/examples';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { ModeWatcher, setMode, userPrefersMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { watchForUpdates } from '$lib/update-check';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import InfoTip from '$lib/components/info-tip.svelte';
	import Stepper from '$lib/components/stepper.svelte';
	import CellOverlay from '$lib/components/cell-overlay.svelte';
	import ToggleSection from '$lib/components/toggle-section.svelte';
	import LineStyleFields from '$lib/components/line-style-fields.svelte';
	import BackgroundPicker from '$lib/components/background-picker.svelte';
	import SliderField from '$lib/components/slider-field.svelte';
	import ColorField from '$lib/components/color-field.svelte';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import ShuffleIcon from '@lucide/svelte/icons/shuffle';
	import ArrowDownAZIcon from '@lucide/svelte/icons/arrow-down-a-z';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import InfoIcon from '@lucide/svelte/icons/info';
	import InfoDialogs from '$lib/components/info-dialogs.svelte';
	import StartPanel from '$lib/components/start-panel.svelte';
	import WelcomeLetter from '$lib/components/welcome-letter.svelte';
	import ArrowLeftRightIcon from '@lucide/svelte/icons/arrow-left-right';
	import LocateFixedIcon from '@lucide/svelte/icons/locate-fixed';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom';
	import LayerOrder from '$lib/components/layer-order.svelte';
	import RichText from '$lib/components/rich-text.svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import Redo2Icon from '@lucide/svelte/icons/redo-2';
	import LinkIcon from '@lucide/svelte/icons/link-2';
	import UnlinkIcon from '@lucide/svelte/icons/unlink-2';
	import { Toggle } from '$lib/components/ui/toggle/index.js';
	import { autoGrid, computeLayout, randomSpans } from '$lib/grid';
	import DicesIcon from '@lucide/svelte/icons/dices';
	import { captionBands, ensureCaptionFonts, fromPlain, plainText } from '$lib/captions';
	import TextStyleFields from '$lib/components/text-style-fields.svelte';
	import LooksMenu from '$lib/components/looks-menu.svelte';
	import AlignLeftIcon from '@lucide/svelte/icons/align-left';
	import AlignCenterIcon from '@lucide/svelte/icons/align-center';
	import AlignRightIcon from '@lucide/svelte/icons/align-right';
	import { applyLook, scaleStyle, withDefaults, type Look } from '$lib/looks';
	import { loadBackground, loadFiles, loadSettings, saveBackground, saveSettings, storeFile, syncFiles } from '$lib/persist';
	import {
		canvasToBlob,
		decode,
		downscale,
		drawGrid,
		loadImage,
		renderFull,
		renderPsd,
		renderCells,
		imageArea,
		DEFAULT_STYLE,
		type Background,
		type CellStyle,
		type ExportFormat,
		type FitMode,
		type GridImage,
		emptySlot,
		hasImage
	} from '$lib/render';
	import { fillSlots } from '$lib/slots';
	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
	import { PAINT_PRESETS } from '$lib/paint/presets';

	const ASPECTS = [
		{ value: '1:1', label: 'Square', ratio: 1 },
		{ value: '4:3', label: '4:3', ratio: 4 / 3 },
		{ value: '3:4', label: '3:4', ratio: 3 / 4 },
		{ value: '3:2', label: '3:2', ratio: 3 / 2 },
		{ value: '2:3', label: '2:3', ratio: 2 / 3 },
		{ value: '16:9', label: '16:9', ratio: 16 / 9 },
		{ value: '9:16', label: '9:16', ratio: 9 / 16 },
		{ value: '5:4', label: '5:4', ratio: 5 / 4 },
		{ value: '4:5', label: '4:5', ratio: 4 / 5 },
		{ value: '21:9', label: '21:9', ratio: 21 / 9 }
	];
	const FILL_FRAME = { value: 'auto', label: 'Fill frame', ratio: 0 };

	const SIZES = [
		{ value: '1080', label: '1080 px' },
		{ value: '1600', label: '1600 px' },
		{ value: '1920', label: '1920 px' },
		{ value: '2560', label: '2560 px' },
		{ value: '3840', label: '3840 px (4K)' },
		{ value: '5120', label: '5120 px (5K)' },
		{ value: 'custom', label: 'Custom' }
	];
	/** Fixed output sizes for social posts; the grid is fitted inside. */
	const FRAMES = [
		{ value: 'ig-square', label: 'Instagram post', short: 'IG post', w: 1080, h: 1080 },
		{ value: 'ig-portrait', label: 'Instagram portrait', short: 'IG portrait', w: 1080, h: 1350 },
		{ value: 'story', label: 'Story or Reel', short: 'Story', w: 1080, h: 1920 },
		{ value: 'x-post', label: 'X post', short: 'X post', w: 1600, h: 900 },
		{ value: 'linkedin', label: 'LinkedIn post', short: 'LinkedIn', w: 1200, h: 627 },
		{ value: 'youtube', label: 'YouTube thumbnail', short: 'YouTube', w: 1280, h: 720 },
		{ value: 'pinterest', label: 'Pinterest pin', short: 'Pinterest', w: 1000, h: 1500 },
		{ value: 'link', label: 'Link preview', short: 'Link preview', w: 1200, h: 630 }
	];


	let images = $state<GridImage[]>([]);
	let cols = $state(3);
	let rows = $state(3);
	let aspect = $state('1:1');
	let fit = $state<FitMode>('fill');
	let gap = $state(24);
	let padding = $state(24);
	let linkPadding = $state(true);
	let bgId = $state('white');
	let customColor = $state('#f4f1ea');
	type Upload = { bitmap: ImageBitmap; url: string; name: string; file: File };
	let bgImage = $state<Upload | null>(null);
	let cellImage = $state<Upload | null>(null);
	// The keyed-out sample photos sit on a green cell background.
	const SAMPLE_FILL = { on: true, bgId: 'custom', color: '#1ccd50' };
	let style = $state<CellStyle>(structuredClone(DEFAULT_STYLE));
	let size = $state('1920');
	let customSize = $state(3000);
	let autoLayout = $state(true);
	let quality = $state(92);
	let fontTick = $state(0);

	let loading = $state(0);
	let busy = $state(false);
	let dragDepth = $state(0);
	let fileInput: HTMLInputElement;
	let slotInput: HTMLInputElement;
	let slotTarget: number | null = null;
	/** Opens the file picker to fill cell `i`. */
	function pickFor(i: number) {
		slotTarget = i;
		slotInput.click();
	}
	let canvas = $state<HTMLCanvasElement>();
	let stageW = $state(0);
	let stageH = $state(0);

	const frame = $derived(FRAMES.find((f) => f.value === size) ?? null);
	const aspectOptions = $derived(frame ? [FILL_FRAME, ...ASPECTS] : ASPECTS);
	const ratio = $derived(aspect === 'auto' ? (frame ? 0 : 1) : (ASPECTS.find((a) => a.value === aspect)?.ratio ?? 1));
	const longEdge = $derived(frame ? Math.max(frame.w, frame.h) : size === 'custom' ? customSize : Number(size));
	const spaceMax = $derived(Math.max(40, Math.round(longEdge / 10)));
	const sizeLabel = $derived(frame ? frame.short : (SIZES.find((x) => x.value === size)?.label ?? size));

	// Pixel settings scale with the output size, so switching sizes keeps the same look.
	let lastLongEdge = 1920;
	$effect(() => {
		const next = longEdge;
		const prev = lastLongEdge;
		lastLongEdge = next;
		if (prev === next) return;
		untrack(() => {
			const k = next / prev;
			gap = Math.round(gap * k);
			padding = Math.round(padding * k);
			style = scaleStyle($state.snapshot(style) as CellStyle, k);
		});
	});

	function pickSize(v: string) {
		const toFrame = FRAMES.some((f) => f.value === v);
		if (toFrame && !frame) aspect = 'auto';
		if (!toFrame && aspect === 'auto') aspect = '1:1';
		size = v;
	}
	function backgroundFor(id: string, custom: string, image: { bitmap: ImageBitmap } | null): Background {
		if (id === 'none') return { kind: 'none' };
		if (id === 'white') return { kind: 'color', color: '#ffffff' };
		if (id === 'black') return { kind: 'color', color: '#000000' };
		if (id === 'custom') return { kind: 'color', color: custom };
		if (id === 'image' && image) return { kind: 'image', image: image.bitmap };
		const preset = PAINT_PRESETS.find((p) => `paint:${p.id}` === id);
		if (preset) return { kind: 'paint', id: preset.id, paint: preset.paint };
		return { kind: 'color', color: '#ffffff' };
	}
	const background = $derived(backgroundFor(bgId, customColor, bgImage));
	const cellBackground = $derived(backgroundFor(style.fill.bgId, style.fill.color, cellImage));
	const spans = $derived(images.map((i) => ({ w: i.span.w, h: i.span.h })));
	const grid = $derived(
		autoLayout && images.length ? autoGrid(spans, ratio || 1, frame ? frame.w / frame.h : 1) : { cols, rows }
	);
	const bands = $derived(captionBands(style.captions));
	const layout = $derived(
		computeLayout({
			count: Math.max(images.length, 1),
			spans,
			cols: grid.cols,
			rows: grid.rows,
			aspect: ratio,
			longEdge,
			frame: frame ? { w: frame.w, h: frame.h } : null,
			gutter: gap,
			padding,
			bandAbove: bands.above,
			bandBelow: bands.below
		})
	);
	const unused = $derived(Math.max(0, images.length - layout.used));
	const filled = $derived(images.filter(hasImage).length);
	const emptyCount = $derived(images.length - filled);

	/** The steppers show the automatic grid; changing one switches to manual. */
	const colsBinding = {
		get: () => grid.cols,
		set: (v: number) => {
			if (autoLayout) rows = grid.rows;
			autoLayout = false;
			cols = v;
		}
	};
	const rowsBinding = {
		get: () => grid.rows,
		set: (v: number) => {
			if (autoLayout) cols = grid.cols;
			autoLayout = false;
			rows = v;
		}
	};

	$effect(() => {
		const c = $state.snapshot(style.captions);
		ensureCaptionFonts(c).then(() => fontTick++);
	});

	function currentLook(): Look {
		return { gap, padding, linkPadding, fit, style: $state.snapshot(style) as CellStyle, bgId, customColor, ref: longEdge };
	}
	function useLook(look: Look) {
		const v = applyLook(look, longEdge);
		gap = v.gap;
		padding = v.padding;
		linkPadding = v.linkPadding;
		fit = v.fit;
		style = v.style;
		if (style.fill.bgId === 'image' && !cellImage) style.fill.bgId = 'custom';
		bgId = v.bgId === 'image' && !bgImage ? 'white' : v.bgId;
		customColor = v.customColor;
	}

	function useFileNames() {
		for (const img of images) if (img.file) img.title = fromPlain(img.name.replace(/\.[^.]+$/, ''));
	}

	const preview = $derived.by(() => {
		const pad = stageW < 640 ? 12 : 32;
		const availW = Math.max(50, stageW - pad * 2);
		const availH = Math.max(50, stageH - pad * 2);
		const k = Math.min(1, availW / layout.width, availH / layout.height) * viewZoom;
		return { w: Math.max(1, Math.floor(layout.width * k)), h: Math.max(1, Math.floor(layout.height * k)), k, pad };
	});

	// Viewing zoom for the preview only: 1 fits the grid in the stage.
	const ZOOM_MIN = 0.25;
	const ZOOM_VIEW_MAX = 4;
	let viewZoom = $state(1);
	let scroller = $state<HTMLDivElement>();
	/** Zooms the view, keeping the point under (x, y) in place when one is given. */
	async function zoomTo(z: number, at?: { x: number; y: number }) {
		const next = Math.min(ZOOM_VIEW_MAX, Math.max(ZOOM_MIN, z));
		const el = scroller;
		if (!el || next === viewZoom) {
			viewZoom = next;
			return;
		}
		const box = el.getBoundingClientRect();
		const ax = at ? at.x - box.left : box.width / 2;
		const ay = at ? at.y - box.top : box.height / 2;
		const r = next / viewZoom;
		const cx = el.scrollLeft + ax;
		const cy = el.scrollTop + ay;
		viewZoom = next;
		await tick();
		el.scrollLeft = cx * r - ax;
		el.scrollTop = cy * r - ay;
	}
	function zoomStep(dir: 1 | -1) {
		const steps = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];
		const next = dir > 0 ? steps.find((s) => s > viewZoom + 0.001) : [...steps].reverse().find((s) => s < viewZoom - 0.001);
		zoomTo(next ?? viewZoom);
	}
	// Hold Space and drag to pan the zoomed preview.
	let spaceHeld = $state(false);
	let panning = $state(false);
	const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
	function onSpace(e: KeyboardEvent) {
		// Leave Space alone in fields and on focused controls, where it types or presses.
		const onControl = !!(e.target as HTMLElement | null)?.closest?.('button, a, [role=switch], [role=slider], [role=menuitem], [role=option], [role=checkbox]');
		if (e.code !== 'Space' || typing(e.target) || (onControl && !spaceHeld)) return;
		e.preventDefault();
		spaceHeld = e.type === 'keydown';
		if (!spaceHeld) panning = false;
	}
	// Panning scrolls the stage first; past the scroll range, or when the whole grid fits, it
	// slides the grid itself, keeping at least KEEP_VISIBLE pixels of it on screen.
	const KEEP_VISIBLE = 80;
	let nudge = $state({ x: 0, y: 0 });
	function startPan(e: PointerEvent) {
		const el = scroller;
		if (!el || !previewEl || (e.button !== 0 && e.button !== 1)) return;
		e.preventDefault();
		const view = el.getBoundingClientRect();
		const box0 = previewEl.getBoundingClientRect();
		const start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, nx: nudge.x, ny: nudge.y };
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		panning = true;
		// One axis: v is the wanted view position (scroll minus nudge).
		const axis = (d: number, scroll0: number, n0: number, max: number, lo0: number, size: number, vlo: number, vsize: number) => {
			const want = scroll0 - n0 - d;
			const scroll = Math.min(max, Math.max(0, want));
			let n = scroll - want;
			// Screen position of the grid's leading edge with this scroll and nudge.
			const lo = lo0 - (scroll - scroll0) + (n - n0);
			const min = vlo + KEEP_VISIBLE - size;
			const maxLo = vlo + vsize - KEEP_VISIBLE;
			if (lo < min) n += min - lo;
			else if (lo > maxLo) n -= lo - maxLo;
			return { scroll, n };
		};
		const move = (ev: PointerEvent) => {
			const h = axis(ev.clientX - start.x, start.left, start.nx, el.scrollWidth - el.clientWidth, box0.left, box0.width, view.left, view.width);
			const v = axis(ev.clientY - start.y, start.top, start.ny, el.scrollHeight - el.clientHeight, box0.top, box0.height, view.top, view.height);
			el.scrollLeft = h.scroll;
			el.scrollTop = v.scroll;
			// Whole device pixels keep the canvas edges crisp instead of blending with what's behind.
			const d = window.devicePixelRatio || 1;
			nudge = { x: Math.round(h.n * d) / d, y: Math.round(v.n * d) / d };
		};
		const up = () => {
			panning = false;
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', up);
			target.removeEventListener('pointercancel', up);
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', up);
		target.addEventListener('pointercancel', up);
	}
	let infoOpen = $state<'help' | 'privacy' | null>(null);
	const WELCOMED = 'griddle:welcomed';
	let letterOpen = $state(false);
	$effect(() => {
		if (!letterOpen) return;
		try {
			localStorage.setItem(WELCOMED, '1');
		} catch {
			// Without storage the letter may show again next time.
		}
	});
	let paneList = $state<HTMLDivElement>();
	/** Scrolls the side panel to an image's row, about 30% down, and flashes it. */
	function revealInPane(id: string) {
		const pane = paneList;
		if (dockSide !== 'right' || !pane) return;
		const row = pane.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`);
		if (!row) return;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const top = pane.scrollTop + row.getBoundingClientRect().top - pane.getBoundingClientRect().top;
		pane.scrollTo({ top: Math.max(0, top - pane.clientHeight * 0.3), behavior: still ? 'auto' : 'smooth' });
		const tint = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || 'gray';
		row.getAnimations().forEach((a) => a.id === 'flash' && a.cancel());
		row.animate([{ backgroundColor: `color-mix(in oklab, ${tint} 22%, transparent)` }, { backgroundColor: 'transparent' }], {
			id: 'flash',
			duration: 1400,
			easing: 'ease-out'
		});
	}

	/** Fits the grid in the stage again and centers it. */
	async function recenter() {
		nudge = { x: 0, y: 0 };
		viewZoom = 1;
		await tick();
		if (scroller) scroller.scrollLeft = scroller.scrollTop = 0;
	}

	/** Mod + scroll (and trackpad pinch, which arrives as Ctrl + scroll) zooms around the pointer. */
	function wheelZoom(node: HTMLElement) {
		const onWheel = (e: WheelEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			e.preventDefault();
			const speed = e.deltaMode === 1 ? 0.05 : 0.0025;
			zoomTo(viewZoom * Math.exp(-e.deltaY * speed * (e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 20 ? 4 : 1)), { x: e.clientX, y: e.clientY });
		};
		node.addEventListener('wheel', onWheel, { passive: false });
		return { destroy: () => node.removeEventListener('wheel', onWheel) };
	}
	const k = $derived(preview.w / layout.width);
	const displayCells = $derived(
		layout.cells.map((c) => ({ x: c.x * k, y: c.y * k, w: c.w * k, h: c.h * k }))
	);
	const displayAreas = $derived(
		layout.cells.map((c) => {
			const a = imageArea(c, style);
			return { x: a.x * k, y: a.y * k, w: a.w * k, h: a.h * k };
		})
	);

	// The preview canvas covers only the part of the grid that is on screen, so zooming in doesn't
	// make every redraw (such as dragging an image in its cell) paint a huge canvas.
	let viewRect = $state({ x: 0, y: 0, w: 1, h: 1 });
	let viewFrame = 0;
	function updateView() {
		cancelAnimationFrame(viewFrame);
		viewFrame = requestAnimationFrame(() => {
			if (!scroller || !previewEl) return;
			const s = scroller.getBoundingClientRect();
			const p = previewEl.getBoundingClientRect();
			// A little extra around the edges hides the redraw while scrolling.
			const m = 96;
			const x0 = Math.max(0, Math.floor(s.left - p.left - m));
			const y0 = Math.max(0, Math.floor(s.top - p.top - m));
			const x1 = Math.min(preview.w, Math.ceil(s.right - p.left + m));
			const y1 = Math.min(preview.h, Math.ceil(s.bottom - p.top + m));
			const next = { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
			if (next.x !== viewRect.x || next.y !== viewRect.y || next.w !== viewRect.w || next.h !== viewRect.h) viewRect = next;
		});
	}
	$effect(() => {
		void [preview.w, preview.h, nudge.x, nudge.y, stageW, stageH, images.length > 0, previewEl, scroller];
		tick().then(updateView);
	});

	$effect(() => {
		if (!canvas || images.length === 0) return;
		const v = viewRect;
		// Very large zooms draw at a lower density to keep the canvas a reasonable size.
		const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(16e6 / (v.w * v.h)));
		const w = Math.round(v.w * dpr);
		const h = Math.round(v.h * dpr);
		if (canvas.width !== w) canvas.width = w;
		if (canvas.height !== h) canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const imgs = images;
		drawGrid(
			ctx,
			layout,
			(i) => {
				const img = imgs[i];
				if (!img) return null;
				// Read each field so changes to it redraw the preview.
				const adjust = { zoom: img.adjust.zoom, ox: img.adjust.ox, oy: img.adjust.oy };
				const title = $state.snapshot(img.title);
				const desc = $state.snapshot(img.desc);
				return { source: img.thumb, width: img.width, height: img.height, adjust, title, desc };
			},
			{ background, cellBackground, fit, style: $state.snapshot(style) as CellStyle, scale: (preview.w * dpr) / layout.width, view: { x: v.x * dpr, y: v.y * dpr } }
		);
		void fontTick;
	});

	// Divider lines sit in the middle of the gap, so with lines on each image gets half the gap on
	// that side; a linked edge padding matches that half so every image has even space around it.
	const linkedPadding = $derived(style.lines.on ? Math.round(gap / 2) : gap);
	$effect(() => {
		if (linkPadding) padding = linkedPadding;
	});

	let showingExamples = $state(false);
	let welcomeDismissed = $state(false);

	// Undo and redo. Each entry is a snapshot of the composition; images are referenced by id and
	// kept decoded in `pool` until no snapshot uses them.
	type Snapshot = {
		images: { id: string; adjust: GridImage['adjust']; span: GridImage['span']; title: GridImage['title']; desc: GridImage['desc']; empty?: true }[];
		autoLayout: boolean;
		quality: number;
		cols: number;
		rows: number;
		aspect: string;
		fit: FitMode;
		gap: number;
		padding: number;
		linkPadding: boolean;
		bgId: string;
		customColor: string;
		style: CellStyle;
		size: string;
		customSize: number;
		showingExamples: boolean;
	};
	const HISTORY_MAX = 100;
	const pool = new Map<string, GridImage>();
	let past = $state.raw<Snapshot[]>([]);
	let future = $state.raw<Snapshot[]>([]);
	let current: { snap: Snapshot; key: string } | null = null;
	let pending: ReturnType<typeof setTimeout> | undefined;

	function capture(): Snapshot {
		return {
			images: images.map((i) => ({
				id: i.id,
				adjust: { zoom: i.adjust.zoom, ox: i.adjust.ox, oy: i.adjust.oy },
				span: { w: i.span.w, h: i.span.h },
				title: $state.snapshot(i.title),
				desc: $state.snapshot(i.desc),
				...(i.file ? {} : { empty: true as const })
			})),
			autoLayout,
			quality,
			cols,
			rows,
			aspect,
			fit,
			gap,
			padding,
			linkPadding,
			bgId,
			customColor,
			style: $state.snapshot(style),
			size,
			customSize,
			showingExamples
		};
	}

	function commit(snap: Snapshot) {
		const key = JSON.stringify(snap);
		if (current?.key === key) return;
		if (current) past = [...past, current.snap].slice(-HISTORY_MAX);
		current = { snap, key };
		future = [];
		prune();
		persist();
	}

	// Keep the grid across reloads (this browser only).
	type Saved = { v: 1; snap: Snapshot; welcomeDismissed: boolean };
	let persistTimer: ReturnType<typeof setTimeout> | undefined;
	function persist() {
		clearTimeout(persistTimer);
		persistTimer = setTimeout(persistNow, 500);
	}
	function persistNow() {
		clearTimeout(persistTimer);
		if (!current) return;
		const snap = current.snap;
		saveSettings({ v: 1, snap, welcomeDismissed } satisfies Saved);
		const files = snap.showingExamples
			? []
			: snap.images.flatMap((i) => {
					const img = pool.get(i.id);
					return img?.file ? [{ id: i.id, file: img.file }] : [];
				});
		syncFiles(files);
		saveBackground(bgImage?.file ?? null, 'canvas');
		saveBackground(cellImage?.file ?? null, 'cell');
	}

	/** Brings back the last session: its images if they were your own, and all its settings. */
	async function resume(): Promise<boolean> {
		const saved = loadSettings<Saved>();
		if (!saved || saved.v !== 1 || !saved.snap) return false;
		welcomeDismissed = !!saved.welcomeDismissed;
		const snap = saved.snap;
		const bg = await loadBackground('canvas');
		if (bg) await setBackgroundImage(bg, false);
		const cellBg = await loadBackground('cell');
		if (cellBg) await setCellImage(cellBg, false);
		if (!snap.showingExamples && !snap.images.length) {
			// The canvas was cleared on purpose; keep it empty.
			restore(snap);
			return true;
		}
		if (!snap.showingExamples) {
			const files = await loadFiles(snap.images.map((i) => i.id));
			loading += files.size;
			for (const [id, file] of files) {
				try {
					const img = await loadImage(file);
					img.id = id;
					pool.set(id, img);
				} catch {
					// A stored file that can't be read is skipped.
				}
			}
			loading -= files.size;
			if (!snap.images.some((i) => pool.has(i.id) || i.empty)) return false;
			restore(snap);
			return true;
		}
		await addFiles(await exampleFiles(), true);
		const live = capture();
		restore({ ...snap, images: live.images, showingExamples: live.showingExamples });
		return true;
	}

	function flush() {
		if (pending === undefined) return;
		clearTimeout(pending);
		pending = undefined;
		commit(capture());
	}

	function resetHistory() {
		clearTimeout(pending);
		pending = undefined;
		const snap = capture();
		current = { snap, key: JSON.stringify(snap) };
		past = [];
		future = [];
		prune();
	}

	// Record changes once they settle, so a slider drag or a zoom gesture is one step.
	$effect(() => {
		const snap = capture();
		clearTimeout(pending);
		pending = setTimeout(() => {
			pending = undefined;
			commit(snap);
		}, 350);
	});

	function restore(snap: Snapshot) {
		images = snap.images.flatMap(({ id, adjust, span, title, desc, empty }) => {
			let img = pool.get(id);
			if (!img && empty) pool.set(id, (img = emptySlot(id)));
			return img ? [{ ...img, adjust: { ...adjust }, span: { ...span }, title: structuredClone(title), desc: structuredClone(desc) }] : [];
		});
		autoLayout = snap.autoLayout;
		quality = snap.quality;
		cols = snap.cols;
		rows = snap.rows;
		aspect = snap.aspect;
		fit = snap.fit;
		gap = snap.gap;
		padding = snap.padding;
		linkPadding = snap.linkPadding;
		bgId = snap.bgId === 'image' && !bgImage ? 'white' : snap.bgId;
		customColor = snap.customColor;
		style = withDefaults(structuredClone(snap.style));
		if (style.fill.bgId === 'image' && !cellImage) style.fill.bgId = 'custom';
		size = snap.size;
		customSize = snap.customSize;
		lastLongEdge = FRAMES.find((f) => f.value === snap.size)
			? Math.max(...[FRAMES.find((f) => f.value === snap.size)!].map((f) => Math.max(f.w, f.h)))
			: snap.size === 'custom'
				? snap.customSize
				: Number(snap.size);
		showingExamples = snap.showingExamples;
		current = { snap, key: JSON.stringify(snap) };
	}

	function undo() {
		flush();
		const prev = past.at(-1);
		if (!prev || !current) return;
		past = past.slice(0, -1);
		future = [...future, current.snap];
		restore(prev);
	}

	function redo() {
		flush();
		const next = future.at(-1);
		if (!next || !current) return;
		future = future.slice(0, -1);
		past = [...past, current.snap];
		restore(next);
	}

	function prune() {
		const keep = new Set(images.map((i) => i.id));
		for (const snap of [...past, ...future, current?.snap]) snap?.images.forEach((i) => keep.add(i.id));
		for (const [id, img] of pool) {
			if (!keep.has(id)) {
				release(img);
				pool.delete(id);
			}
		}
	}

	function onKeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, [contenteditable="true"]')) return;
		if (e.shiftKey && e.code === 'Digit1' && !(e.metaKey || e.ctrlKey || e.altKey) && images.length) {
			e.preventDefault();
			recenter();
			return;
		}
		if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
		const key = e.key.toLowerCase();
		if (key === '=' || key === '+') zoomStep(1);
		else if (key === '-' || key === '_') zoomStep(-1);
		else if (key === '0') zoomTo(1);
		else if (key === 'z' && !e.shiftKey) undo();
		else if ((key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey)) redo();
		else return;
		e.preventDefault();
	}

	const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
	const mod = isMac ? '⌘' : 'Ctrl+';

	async function addFiles(list: FileList | File[] | null | undefined, examples = false) {
		const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		// The first real upload replaces the example grid.
		if (!examples && showingExamples) {
			clearAll();
			showingExamples = false;
		}
		const ok = await loadAll(files);
		if (!examples) ok.forEach((img) => img.file && storeFile(img.id, img.file));
		images = fillSlots(images, ok);
		if (examples) showingExamples = ok.length > 0;
	}

	async function loadAll(files: File[]) {
		loading += files.length;
		const results = await Promise.allSettled(files.map(loadImage));
		loading -= files.length;
		const ok: GridImage[] = [];
		let failed = 0;
		for (const r of results) {
			if (r.status === 'fulfilled') {
				ok.push(r.value);
				pool.set(r.value.id, r.value);
			} else failed++;
		}
		if (failed) toast.error(`${failed} file${failed > 1 ? 's' : ''} couldn't be read`);
		return ok;
	}

	/** Puts dropped images into cell `index`, replacing what is there; more go into later empty slots. */
	async function replaceAt(index: number, list: FileList | File[] | null | undefined) {
		dragDepth = 0;
		const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		const ok = await loadAll(files);
		if (!ok.length) return;
		ok.forEach((img) => img.file && storeFile(img.id, img.file));
		// The first image takes over this cell (and its size); the rest fill empty slots after it.
		images = fillSlots(images, ok, index);
		showingExamples = false;
	}

	async function readUpload(file: File | undefined): Promise<Upload | null> {
		if (!file || !file.type.startsWith('image/')) return null;
		try {
			const bitmap = await downscale(await decode(file), 8192);
			return { bitmap, url: URL.createObjectURL(file), name: file.name, file };
		} catch {
			toast.error("That background image couldn't be read");
			return null;
		}
	}
	const dropUpload = (u: Upload | null) => {
		if (!u) return;
		u.bitmap.close();
		URL.revokeObjectURL(u.url);
	};

	async function setBackgroundImage(file: File | undefined, select = true) {
		const u = await readUpload(file);
		if (!u) return;
		dropUpload(bgImage);
		bgImage = u;
		if (select) {
			bgId = 'image';
			saveBackground(u.file, 'canvas');
			persist();
		}
	}

	async function setCellImage(file: File | undefined, select = true) {
		const u = await readUpload(file);
		if (!u) return;
		dropUpload(cellImage);
		cellImage = u;
		if (select) {
			style.fill.bgId = 'image';
			saveBackground(u.file, 'cell');
			persist();
		}
	}

	function release(img: GridImage) {
		img.thumb?.close();
		if (img.thumbUrl) URL.revokeObjectURL(img.thumbUrl);
	}
	/** Adds empty slots at a position (the end by default), to fill with images later. */
	function addSlots(count = 1, at = images.length) {
		const slots = Array.from({ length: count }, () => emptySlot());
		slots.forEach((s) => pool.set(s.id, s));
		const next = [...images];
		next.splice(Math.min(at, next.length), 0, ...slots);
		images = next;
		showingExamples = false;
	}
	/** A grid of empty slots to plan the layout before adding any images. */
	function startEmpty(c = cols, r = rows) {
		if (showingExamples) clearAll();
		autoLayout = false;
		cols = c;
		rows = r;
		addSlots(Math.max(1, c * r));
	}
	/** Takes the image out of a cell but keeps the cell, with its size and captions. */
	function clearImage(i: number) {
		const img = images[i];
		if (!img?.file) return;
		const slot = { ...emptySlot(), span: { ...img.span }, title: img.title, desc: img.desc };
		pool.set(slot.id, slot);
		images = images.map((x, j) => (j === i ? slot : x));
	}
	// Removed images stay decoded until history no longer refers to them (see prune).
	function remove(id: string) {
		images = images.filter((i) => i.id !== id);
	}
	function clearAll() {
		images = [];
		showingExamples = false;
	}
	function shuffle() {
		const next = [...images];
		for (let i = next.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[next[i], next[j]] = [next[j], next[i]];
		}
		images = next;
	}
	/** Shuffles the images and makes a few of them larger, for a bento layout. */
	function randomBento() {
		if (images.length < 2) return;
		const next = [...images];
		for (let i = next.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[next[i], next[j]] = [next[j], next[i]];
		}
		const spans = randomSpans(next.length, ratio || 1, frame ? frame.w / frame.h : 1);
		next.forEach((img, i) => (img.span = spans[i]));
		autoLayout = true;
		images = next;
	}
	function sortByName() {
		// Empty slots go last.
		images = [...images].sort((a, b) => +!a.file - +!b.file || a.name.localeCompare(b.name, undefined, { numeric: true }));
	}
	function resetAll() {
		for (const img of images) img.adjust = { zoom: 1, ox: 0, oy: 0 };
	}

	const fileName = (ext: string) => `griddle-${layout.cols}x${layout.rows}-${layout.width}x${layout.height}.${ext}`;

	function save(blob: Blob, name: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}

	async function download(format: ExportFormat | 'psd') {
		if (!images.length || busy) return;
		busy = true;
		try {
			if (format === 'psd') {
				const blob = await renderPsd(layout, images, { background, cellBackground, fit, style: $state.snapshot(style) as CellStyle });
				save(blob, fileName('psd'));
				return;
			}
			const full = await renderFull(layout, images, { background, cellBackground, fit, style: $state.snapshot(style), opaque: format === 'jpeg' });
			const blob = await canvasToBlob(full, format, quality / 100);
			save(blob, fileName(format === 'jpeg' ? 'jpg' : format));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Export failed');
		} finally {
			busy = false;
		}
	}

	let cellPick = $state({ corners: true, shadow: true, captions: true });

	/** Each image's cell as its own PNG, zipped. */
	async function downloadCells() {
		if (!images.length || busy) return;
		busy = true;
		try {
			const [{ zipSync }, files] = await Promise.all([
				import('fflate'),
				renderCells(layout, images, { background, cellBackground, fit, style: $state.snapshot(style) as CellStyle }, $state.snapshot(cellPick))
			]);
			const width = String(files.length).length < 2 ? 2 : String(files.length).length;
			const used = new Set<string>();
			const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
			for (const f of files) {
				const img = images[f.index];
				const label = plainText(img.title).trim() || img.name.replace(/\.[^.]+$/, '');
				const slug = label.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';
				let name = `${String(f.index + 1).padStart(width, '0')}-${slug}.png`;
				while (used.has(name)) name = name.replace(/\.png$/, '-1.png');
				used.add(name);
				entries[name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
			}
			save(new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), fileName('zip').replace(/\.zip$/, '-cells.zip'));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Export failed');
		} finally {
			busy = false;
		}
	}

	async function copy() {
		if (!images.length || busy) return;
		if (!('ClipboardItem' in window) || !navigator.clipboard?.write) {
			toast.error("This browser can't copy images. Download instead.");
			return;
		}
		busy = true;
		try {
			// Hand the clipboard a promise so Safari keeps the click's permission while we render.
			const blob = renderFull(layout, images, { background, cellBackground, fit, style: $state.snapshot(style) }).then((c) => canvasToBlob(c, 'png'));
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			toast.success('Copied to clipboard');
		} catch (e) {
			toast.error(e instanceof Error && e.message ? e.message : "Couldn't copy the image");
		} finally {
			busy = false;
		}
	}

	// Reordering thumbnails
	let dragId = $state<string | null>(null);
	/** Where a dragged thumbnail would go: before the image at this index (length means last). */
	let insertAt = $state<number | null>(null);
	// Moving images by dragging them on the grid itself
	/**
	 * `target` is the cell the pointer is nearest; `after` says which side of it the image goes, or
	 * `swap` that it trades places with that cell's image (pointer over the cell's middle).
	 */
	type Hit = { target: number; after: boolean; swap: boolean };
	let lift = $state<({ from: number; x: number; y: number } & Partial<Hit>) | null>(null);
	let previewEl = $state<HTMLDivElement>();
	/** The insertion line beside the target cell, centred in the gap, in preview pixels. */
	const liftLine = $derived.by(() => {
		if (!lift || lift.target === undefined || lift.swap) return null;
		const c = displayCells[lift.target];
		if (!c) return null;
		const g = (gap * k) / 2;
		return { x: lift.after ? c.x + c.w + g : c.x - g, y: c.y, h: c.h };
	});
	/** The cell nearest a point, preferring cells in the same row band, and which side the point is on. */
	function nearestCell(px: number, py: number): Hit | null {
		let best: Hit | null = null;
		let bestD = Infinity;
		for (let i = 0; i < displayCells.length; i++) {
			const c = displayCells[i];
			if (!images[i]) continue;
			const dx = Math.max(c.x - px, 0, px - (c.x + c.w));
			const dy = Math.max(c.y - py, 0, py - (c.y + c.h));
			// Being level with a cell matters more than being close to it diagonally.
			const d = dy * 4 + dx;
			if (d < bestD) {
				bestD = d;
				// The middle of a cell swaps; its outer quarters insert beside it.
				const inside = d === 0 && px > c.x + c.w * 0.25 && px < c.x + c.w * 0.75;
				best = { target: i, after: px > c.x + c.w / 2, swap: inside };
			}
		}
		return best;
	}
	function startLift(e: PointerEvent, from: number) {
		lift = { from, x: e.clientX, y: e.clientY };
		const move = (ev: PointerEvent) => {
			if (!lift || !previewEl) return;
			const box = previewEl.getBoundingClientRect();
			const hit = nearestCell(ev.clientX - box.left, ev.clientY - box.top);
			lift = { from: lift.from, x: ev.clientX, y: ev.clientY, ...hit };
			if (lift.swap && lift.target === lift.from) lift.swap = false;
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
			const l = lift;
			lift = null;
			if (!l || l.target === undefined) return;
			if (l.swap) {
				// The two images trade places; each slot keeps its size.
				const next = [...images];
				const a = next[l.from];
				const b = next[l.target];
				const spanA = { ...a.span };
				a.span = { ...b.span };
				b.span = spanA;
				next[l.from] = b;
				next[l.target] = a;
				images = next;
				return;
			}
			const at = l.after ? l.target + 1 : l.target;
			const to = at > l.from ? at - 1 : at;
			if (to === l.from) return;
			const next = [...images];
			const [moved] = next.splice(l.from, 1);
			next.splice(to, 0, moved);
			images = next;
		};
		const cancel = () => {
			lift = null;
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
	}

	let dockSide = $state<'bottom' | 'right'>(readDock());
	function readDock(): 'bottom' | 'right' {
		try {
			return localStorage.getItem('griddle:dock') === 'right' ? 'right' : 'bottom';
		} catch {
			return 'bottom';
		}
	}
	function toggleDock() {
		dockSide = dockSide === 'bottom' ? 'right' : 'bottom';
		try {
			localStorage.setItem('griddle:dock', dockSide);
		} catch {
			// Remembering the layout is a convenience.
		}
	}

	/** The insertion line shows while reordering or while files are dragged over the list. */
	const showInsert = $derived(insertAt !== null && (dragId !== null || dragDepth > 0));

	/** Tracks where a dragged thumbnail or dropped files would go. `i` null means the list's end. */
	function onListOver(e: DragEvent, i: number | null, axis: 'x' | 'y') {
		if (!dragId && !hasFiles(e)) return;
		e.preventDefault();
		if (i === null) {
			if (e.target === e.currentTarget) insertAt = images.length;
			return;
		}
		e.stopPropagation();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const before = axis === 'x' ? e.clientX < box.left + box.width / 2 : e.clientY < box.top + box.height / 2;
		insertAt = before ? i : i + 1;
	}

	function onListDrop(e: DragEvent) {
		if (dragId) {
			e.preventDefault();
			e.stopPropagation();
			onThumbDrop();
			return;
		}
		if (!hasFiles(e)) return;
		e.preventDefault();
		e.stopPropagation();
		const at = insertAt ?? images.length;
		insertAt = null;
		dragDepth = 0;
		insertFiles(at, e.dataTransfer?.files);
	}

	/** Adds images at a position in the list. Samples already shown are kept. */
	async function insertFiles(at: number, list: FileList | File[] | null | undefined) {
		const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		const ok = await loadAll(files);
		ok.forEach((img) => img.file && storeFile(img.id, img.file));
		const next = [...images];
		next.splice(Math.min(at, next.length), 0, ...ok);
		images = next;
		showingExamples = false;
	}

	function onThumbDrop() {
		const from = images.findIndex((i) => i.id === dragId);
		const at = insertAt;
		dragId = insertAt = null;
		if (from < 0 || at === null) return;
		const to = at > from ? at - 1 : at;
		if (to === from) return;
		const next = [...images];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		images = next;
	}

	// Window-level file drop
	const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
	function onDragEnter(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragDepth++;
	}
	function onDragLeave(e: DragEvent) {
		if (hasFiles(e)) dragDepth = Math.max(0, dragDepth - 1);
	}
	function onDragOver(e: DragEvent) {
		if (hasFiles(e)) e.preventDefault();
	}
	function onDrop(e: DragEvent) {
		if (!hasFiles(e)) return;
		e.preventDefault();
		dragDepth = 0;
		insertAt = null;
		addFiles(e.dataTransfer?.files);
	}
	/** Pasting while the pointer is over a cell replaces that image; anywhere else adds. */
	function onPaste(e: ClipboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, [contenteditable="true"]')) return;
		const files = Array.from(e.clipboardData?.files ?? []);
		if (!files.length) return;
		e.preventDefault();
		const hovered = document.querySelector<HTMLElement>('[data-testid=cell]:hover');
		const index = hovered ? Number(hovered.dataset.index) : NaN;
		if (Number.isInteger(index)) replaceAt(index, files);
		else addFiles(files);
	}

	// Save right away when the tab is hidden or closed, so nothing waits on the timers.
	function saveOnLeave() {
		if (document.visibilityState === 'visible' && !leaving) return;
		flush();
		persistNow();
	}
	let leaving = false;
	onMount(() => {
		const hide = () => {
			leaving = true;
			saveOnLeave();
		};
		document.addEventListener('visibilitychange', saveOnLeave);
		window.addEventListener('pagehide', hide);
		const stopWatching = watchForUpdates(() =>
			toast('A new version of Griddle is ready', {
				description: 'Your grid is saved and will be here after the reload.',
				duration: Infinity,
				action: {
					label: 'Reload',
					onClick: () => {
						flush();
						persistNow();
						// Give IndexedDB a moment to finish writing before the page goes away.
						setTimeout(() => location.reload(), 300);
					}
				}
			})
		);
		return () => {
			stopWatching();
			document.removeEventListener('visibilitychange', saveOnLeave);
			window.removeEventListener('pagehide', hide);
		};
	});

	async function loadSamples() {
		style.fill = { ...style.fill, ...SAMPLE_FILL };
		await addFiles(await exampleFiles(), true);
	}

	const DEV = import.meta.env.DEV;
	async function loadPokemon() {
		loading += 1;
		try {
			const { pokemonFiles } = await import('$lib/dev-samples');
			const files = await pokemonFiles(25);
			if (!files.length) toast.error("Couldn't reach PokeAPI");
			await addFiles(files);
		} finally {
			loading -= 1;
		}
	}

	onDestroy(() => {
		clearTimeout(pending);
		pool.forEach(release);
	});

	onMount(async () => {
		let resumed = false;
		try {
			resumed = await resume();
		} catch {
			resumed = false;
		}
		resetHistory();
		try {
			letterOpen = !localStorage.getItem(WELCOMED);
		} catch {
			letterOpen = false;
		}
	});

	$effect(() => {
		void welcomeDismissed;
		untrack(() => current && persist());
	});

	const labelOf = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
</script>

<svelte:window
	onkeydowncapture={onSpace}
	onkeyupcapture={onSpace}
	onblur={() => (spaceHeld = panning = false)}
	ondragenter={onDragEnter} ondragleave={onDragLeave} ondragover={onDragOver} ondrop={onDrop} onpaste={onPaste} onkeydown={onKeydown} />

<ModeWatcher />
<Toaster position="bottom-center" />
<InfoDialogs bind:open={infoOpen} />
<WelcomeLetter bind:open={letterOpen} />

{#snippet dockHeader()}
	<div class="flex h-9 items-center gap-1 border-b px-3">
		<span class="text-muted-foreground text-xs tabular-nums">
			{#if showingExamples}Example images ·
				<button type="button" class="text-foreground underline-offset-2 hover:underline" onclick={() => fileInput.click()}>Add your own</button>
			{:else}{filled} image{filled === 1 ? '' : 's'}{#if emptyCount}<span>&nbsp;· {emptyCount} empty</span>{/if}{/if}{#if unused && !showingExamples}<span> · {unused} not used</span>{/if}
		</span>
		<div class="ml-auto flex items-center">
			{@render iconAction('Add an empty slot', SquarePlusIcon, () => addSlots())}
			{@render iconAction('Reset all crops', RotateCcwIcon, resetAll)}
			{@render iconAction('Sort by name', ArrowDownAZIcon, sortByName)}
			{@render iconAction('Shuffle', ShuffleIcon, shuffle)}
			{@render iconAction('Remove all', Trash2Icon, clearAll)}
			{@render iconAction(dockSide === 'bottom' ? 'Edit captions in a side panel' : 'Move images to the bottom', dockSide === 'bottom' ? PanelRightIcon : PanelBottomIcon, toggleDock)}
		</div>
	</div>
{/snippet}

{#snippet insertLine(axis: 'x' | 'y', edge: 'start' | 'end')}
	<span
		class="bg-primary pointer-events-none absolute z-10 {axis === 'x'
			? `-top-1 -bottom-1 w-0.5 ${edge === 'start' ? '-left-[6px]' : '-right-[6px]'}`
			: `right-0 left-0 h-0.5 ${edge === 'start' ? '-top-px' : '-bottom-px'}`}"
		data-testid="insert-line"
	></span>
{/snippet}

{#snippet imageList(axis: 'x' | 'y')}
	<ol
		class={axis === 'x' ? 'flex gap-2 overflow-x-auto p-3' : 'flex flex-col'}
		data-testid="thumbs"
		ondragover={(e) => onListOver(e, null, axis)}
		ondrop={onListDrop}
	>
		{#each images as img, i (img.id)}
			<li
				class="group relative shrink-0 {axis === 'x' ? 'size-16 cursor-grab border active:cursor-grabbing' : 'flex gap-3 border-b p-3'} transition-opacity"
				class:opacity-35={i >= layout.used && dragId !== img.id}
				class:opacity-40={dragId === img.id}
				data-row={img.id}
				draggable={axis === 'x' ? 'true' : undefined}
				title={axis === 'x' ? img.name : undefined}
				ondragstart={(e) => {
					if (axis === 'y' && !(e.target as HTMLElement).closest('[data-drag-handle]')) return;
					dragId = img.id;
					e.dataTransfer?.setData('text/plain', img.id);
					if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
				}}
				ondragover={(e) => onListOver(e, i, axis)}
				ondragend={() => (dragId = insertAt = null)}
			>
				{#if showInsert && insertAt === i}{@render insertLine(axis, 'start')}{/if}
				{#if showInsert && insertAt === i + 1 && i === images.length - 1}{@render insertLine(axis, 'end')}{/if}
				<div
					class="relative shrink-0 {axis === 'x' ? 'size-full' : 'size-20 cursor-grab border active:cursor-grabbing'}"
					data-drag-handle
					draggable={axis === 'y' ? 'true' : undefined}
					title={axis === 'y' ? `${img.name} · drag to reorder` : undefined}
				>
					{#if img.file}
						<img src={img.thumbUrl} alt={img.name} class="size-full object-cover" draggable="false" />
					{:else}
						<button
							type="button"
							class="bg-muted text-muted-foreground hover:text-foreground flex size-full items-center justify-center"
							aria-label="Add an image to slot {i + 1}"
							title="Empty slot · click to add an image"
							data-testid="thumb-empty"
							onclick={() => pickFor(i)}
						>
							<ImagePlusIcon class="size-4" />
						</button>
					{/if}
					<span class="bg-background/90 absolute bottom-0 left-0 px-1 text-[10px] tabular-nums">{i + 1}</span>
					<button
						type="button"
						class="bg-background/90 absolute top-0 right-0 hidden size-5 items-center justify-center group-hover:flex focus-visible:flex"
						aria-label={img.file ? `Remove ${img.name}` : `Remove empty slot ${i + 1}`}
						onclick={() => remove(img.id)}
					>
						<XIcon class="size-3" />
					</button>
				</div>
				{#if axis === 'y'}
					<div class="min-w-0 flex-1 space-y-2">
						{#if style.captions.title.on || !style.captions.on}
							<RichText bind:value={img.title} label="Title for image {i + 1}" placeholder="Title" testid="pane-title" />
						{/if}
						{#if style.captions.desc.on || !style.captions.on}
							<RichText bind:value={img.desc} label="Description for image {i + 1}" placeholder="Description" testid="pane-desc" />
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/snippet}

{#snippet iconAction(label: string, Icon: typeof CopyIcon, fn: () => void, disabled = false)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon-sm" aria-label={label} {disabled} onclick={fn}>
					<Icon />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{label}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<Tooltip.Provider delayDuration={300}>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		data-testid="file-input"
		onchange={(e) => {
			addFiles(e.currentTarget.files);
			e.currentTarget.value = '';
		}}
	/>
	<input
		bind:this={slotInput}
		type="file"
		accept="image/*"
		multiple
		class="hidden"
		data-testid="slot-input"
		onchange={(e) => {
			if (slotTarget !== null) replaceAt(slotTarget, e.currentTarget.files);
			slotTarget = null;
			e.currentTarget.value = '';
		}}
	/>


	<div class="flex min-h-dvh flex-col md:h-dvh">
		<header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
			<div class="flex items-center gap-2">
				<!-- The script font keeps room for descenders this word lacks; the nudge centers the letters. -->
				<span class="font-logo translate-y-[0.11em] text-[22px] leading-none italic">Griddle</span>
			</div>
			<div class="ml-auto flex items-center gap-1.5">
				<LooksMenu current={currentLook} onapply={useLook} />
				<div class="flex items-center">
					{@render iconAction(`Undo (${mod}Z)`, Undo2Icon, undo, !past.length)}
					{@render iconAction(isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Y)', Redo2Icon, redo, !future.length)}
				</div>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon-sm" aria-label="Theme" data-testid="theme">
								<SunIcon class="dark:hidden" />
								<MoonIcon class="hidden dark:block" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-36">
						<DropdownMenu.RadioGroup
							value={userPrefersMode.current}
							onValueChange={(v) => setMode(v as 'light' | 'dark' | 'system')}
						>
							<DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
						</DropdownMenu.RadioGroup>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
				<Button variant="ghost" size="sm" onclick={() => fileInput.click()}>
					<ImagePlusIcon />
					<span class="hidden sm:inline">Add images</span>
				</Button>
				<Button variant="outline" size="sm" onclick={copy} disabled={!images.length || busy} data-testid="copy">
					<CopyIcon />
					<span class="hidden sm:inline">Copy</span>
				</Button>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger disabled={!images.length || busy}>
						{#snippet child({ props })}
							<Button {...props} size="sm" data-testid="download">
								{#if busy}<LoaderIcon class="animate-spin" />{:else}<DownloadIcon />{/if}
								Download
								<ChevronDownIcon class="opacity-70" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<DropdownMenu.Item onclick={() => download('png')} data-testid="download-png">PNG</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => download('jpeg')} data-testid="download-jpg">JPG</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => download('webp')} data-testid="download-webp">WebP</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => download('psd')} data-testid="download-psd">
							PSD <span class="text-muted-foreground ml-auto text-xs">layers</span>
						</DropdownMenu.Item>
						<DropdownMenu.Sub>
							<DropdownMenu.SubTrigger data-testid="download-cells-menu">Each cell <span class="text-muted-foreground ml-auto text-xs">ZIP</span></DropdownMenu.SubTrigger>
							<DropdownMenu.SubContent class="w-48">
								<DropdownMenu.CheckboxItem bind:checked={cellPick.corners} closeOnSelect={false}>Rounded corners</DropdownMenu.CheckboxItem>
								<DropdownMenu.CheckboxItem bind:checked={cellPick.shadow} closeOnSelect={false}>Shadow</DropdownMenu.CheckboxItem>
								<DropdownMenu.CheckboxItem bind:checked={cellPick.captions} closeOnSelect={false}>Captions</DropdownMenu.CheckboxItem>
								<DropdownMenu.Separator />
								<DropdownMenu.Item onclick={downloadCells} data-testid="download-cells">Download {filled} PNG{filled === 1 ? '' : 's'}</DropdownMenu.Item>
							</DropdownMenu.SubContent>
						</DropdownMenu.Sub>
						<DropdownMenu.Separator />
						<div class="space-y-2 px-2 py-2">
							<div class="flex items-center justify-between text-xs">
								<span>Quality <span class="text-muted-foreground">· JPG, WebP</span></span>
								<span class="text-muted-foreground tabular-nums">{quality}%</span>
							</div>
							<Slider type="single" bind:value={quality} min={40} max={100} step={1} aria-label="Quality" />
						</div>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon-sm" aria-label="Help and privacy" data-testid="info">
								<InfoIcon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-40">
						<DropdownMenu.Item onclick={() => (letterOpen = true)} data-testid="info-welcome">Welcome letter</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => (infoOpen = 'help')} data-testid="info-help">Help</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => (infoOpen = 'privacy')} data-testid="info-privacy">Privacy</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</header>

		<div class="flex flex-col-reverse md:min-h-0 md:flex-1 md:flex-row">
			<aside class="shrink-0 border-t md:w-80 md:overflow-y-auto md:border-t-0 md:border-r transition-opacity" class:opacity-40={!images.length} inert={!images.length}>
				<section class="space-y-3 border-b p-4">
					<div class="flex items-center justify-between">
						<h2 class="text-muted-foreground text-xs font-medium">Grid</h2>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button {...props} variant="ghost" size="sm" class="ml-auto h-7 px-2" onclick={randomBento} disabled={images.length < 2} data-testid="random-bento">
										<DicesIcon />
										Random
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content>Shuffle the images and make a few of them larger</Tooltip.Content>
						</Tooltip.Root>
						<label class="ml-2 flex cursor-pointer items-center gap-2 text-sm" for="auto-layout">
							<span class="flex items-center gap-1.5">
								Auto
								<InfoTip text="Picks columns and rows to fit your images. Changing either one switches to manual." />
							</span>
							<Switch id="auto-layout" size="sm" bind:checked={autoLayout} data-testid="auto-layout" />
						</label>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm" class:text-muted-foreground={autoLayout}>Columns</span>
						<Stepper bind:value={colsBinding.get, colsBinding.set} label="Columns" />
					</div>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm" class:text-muted-foreground={autoLayout}>
							Rows
							<InfoTip text="Rows without images are left out. A partly filled last row is centered. Hover an image to make it span more cells." />
						</span>
						<Stepper bind:value={rowsBinding.get, rowsBinding.set} label="Rows" />
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm">Cell shape</span>
						<Select.Root type="single" bind:value={aspect}>
							<Select.Trigger size="sm" class="w-32" data-testid="aspect">{labelOf(aspectOptions, aspect)}</Select.Trigger>
							<Select.Content>
								{#each aspectOptions as a (a.value)}
									<Select.Item value={a.value} label={a.label}>{a.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm">
							Images
							<InfoTip text="Fill crops each image to its cell. Fit shows the whole image. Drag an image in the preview to move it, and hover for zoom." />
						</span>
						<ToggleGroup.Root
							type="single"
							variant="outline"
							size="sm"
							value={fit}
							onValueChange={(v) => v && (fit = v as FitMode)}
						>
							<ToggleGroup.Item value="fill" class="px-3">Fill</ToggleGroup.Item>
							<ToggleGroup.Item value="fit" class="px-3">Fit</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
				</section>

				<section class="space-y-4 border-b p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Spacing</h2>
					<div class="space-y-2.5">
						<div class="flex items-center justify-between">
							<span class="text-sm">Gap</span>
							<span class="text-muted-foreground text-sm tabular-nums">{gap} px</span>
						</div>
						<Slider type="single" bind:value={gap} min={0} max={spaceMax} step={1} aria-label="Gap" />
					</div>
					<div class="space-y-2.5">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-1">
								<span class="text-sm" class:text-muted-foreground={linkPadding}>Edge padding</span>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Toggle
												{...props}
												size="sm"
												class="size-6 min-w-6 p-0"
												bind:pressed={linkPadding}
												aria-label="Match edge padding to gap"
												data-testid="link-padding"
											>
												{#if linkPadding}<LinkIcon class="size-3.5" />{:else}<UnlinkIcon class="size-3.5" />{/if}
											</Toggle>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>{linkPadding ? (style.lines.on ? 'Matches the space between images and divider lines. Click to set it separately.' : 'Matches the gap. Click to set it separately.') : 'Match the gap'}</Tooltip.Content>
								</Tooltip.Root>
							</div>
							<span class="text-muted-foreground text-sm tabular-nums">{linkPadding ? linkedPadding : padding} px</span>
						</div>
						<Slider
							type="single"
							bind:value={padding}
							min={0}
							max={spaceMax * 2}
							step={1}
							disabled={linkPadding}
							class={linkPadding ? 'opacity-40' : ''}
							aria-label="Edge padding"
						/>
					</div>
				</section>

				<ToggleSection title="Rounded corners" bind:on={style.corners.on}>
					<SliderField label="Radius" bind:value={style.corners.radius} unit="%" />
				</ToggleSection>
				<ToggleSection title="Cell background" bind:on={style.fill.on}>
					<BackgroundPicker
						bind:value={style.fill.bgId}
						bind:customColor={style.fill.color}
						image={cellImage}
						onimage={(f) => setCellImage(f)}
						allowNone={false}
						testid="cell-bg"
						imageLabel="cell background image"
					/>
					<SliderField label="Opacity" bind:value={style.fill.opacity} unit="%" />
					<SliderField label="Image padding" bind:value={style.fill.padding} max={spaceMax} />
				</ToggleSection>
				<ToggleSection title="Border" bind:on={style.border.on}>
					<SliderField label="Width" bind:value={style.border.width} min={1} max={Math.max(20, Math.round(longEdge / 40))} />
					<ColorField label="Color" bind:value={style.border.color} />
					<SliderField label="Opacity" bind:value={style.border.opacity} unit="%" />
				</ToggleSection>
				<ToggleSection title="Drop shadow" bind:on={style.shadow.on}>
					<SliderField label="Strength" bind:value={style.shadow.strength} unit="%" />
					<SliderField label="Distance" bind:value={style.shadow.distance} max={spaceMax} />
					<SliderField label="Softness" bind:value={style.shadow.softness} max={spaceMax * 2} />
				</ToggleSection>
				<ToggleSection title="Divider lines" bind:on={style.lines.on}>
					<LineStyleFields bind:value={style.lines} maxWidth={Math.max(20, Math.round(longEdge / 60))} {spaceMax} />
				</ToggleSection>
				<ToggleSection title="Captions" bind:on={style.captions.on}>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm">
							Text
							<InfoTip text="Hover an image in the preview and click the text button to write its title and description." />
						</span>
						<Button variant="outline" size="sm" onclick={useFileNames} disabled={!images.length}>Use file names</Button>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm">Align</span>
						<ToggleGroup.Root
							type="single"
							variant="outline"
							size="sm"
							value={style.captions.align}
							onValueChange={(v) => v && (style.captions.align = v as typeof style.captions.align)}
						>
							<ToggleGroup.Item value="left" aria-label="Align left"><AlignLeftIcon /></ToggleGroup.Item>
							<ToggleGroup.Item value="center" aria-label="Align center"><AlignCenterIcon /></ToggleGroup.Item>
							<ToggleGroup.Item value="right" aria-label="Align right"><AlignRightIcon /></ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>
					{#if ['top', 'bottom'].includes(style.captions.title.position) || ['top', 'bottom'].includes(style.captions.desc.position)}
						<div class="space-y-4 border-l pl-3" transition:slide={{ duration: 150 }}>
							<label class="flex cursor-pointer items-center justify-between" for="caption-fade">
								<span class="flex items-center gap-1.5 text-sm">
									Fade behind text
									<InfoTip text="A gradient from the cell's edge that sits behind inside text, so it stays readable over busy images." />
								</span>
								<Switch id="caption-fade" bind:checked={style.captions.fade.on} size="sm" />
							</label>
							{#if style.captions.fade.on}
								<div class="space-y-4" transition:slide={{ duration: 150 }}>
									<ColorField label="Fade color" bind:value={style.captions.fade.color} />
									<SliderField label="Fade opacity" bind:value={style.captions.fade.opacity} unit="%" />
									<SliderField label="Fade length" bind:value={style.captions.fade.length} max={Math.max(200, spaceMax * 2)} />
								</div>
							{/if}
							<div class="space-y-1.5">
								<span class="flex items-center gap-1.5 text-sm">
									Layer order
									<InfoTip text="Top first. Move Text below Image to put a title behind a transparent image." />
								</span>
								<LayerOrder bind:value={style.captions.order} fade={style.captions.fade.on} />
							</div>
						</div>
					{/if}
					<TextStyleFields title="Title" bind:value={style.captions.title} maxSize={Math.max(80, Math.round(longEdge / 12))} />
					<TextStyleFields title="Description" bind:value={style.captions.desc} maxSize={Math.max(60, Math.round(longEdge / 16))} />
				</ToggleSection>

				<section class="space-y-3 border-b p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Background</h2>
					<BackgroundPicker
						bind:value={bgId}
						bind:customColor
						image={bgImage}
						onimage={(f) => {
							dragDepth = 0;
							setBackgroundImage(f);
						}}
					/>
				</section>

				<section class="space-y-3 p-4">
					<h2 class="text-muted-foreground text-xs font-medium">Output</h2>
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 text-sm">
							Size
							<InfoTip text="Long edge sizes set the longer side, and the other follows from the grid. Social sizes are fixed, and the grid is fitted inside." />
						</span>
						<Select.Root type="single" value={size} onValueChange={pickSize}>
							<Select.Trigger size="sm" class="w-36" data-testid="size">{sizeLabel}</Select.Trigger>
							<Select.Content>
								<Select.Group>
									<Select.GroupHeading>Long edge</Select.GroupHeading>
									{#each SIZES as s (s.value)}
										<Select.Item value={s.value} label={s.label}>{s.label}</Select.Item>
									{/each}
								</Select.Group>
								<Select.Separator />
								<Select.Group>
									<Select.GroupHeading>Social</Select.GroupHeading>
									{#each FRAMES as f (f.value)}
										<Select.Item value={f.value} label={f.label}>
											<span class="flex-1">{f.label}</span>
											<span class="text-muted-foreground text-xs tabular-nums">{f.w}×{f.h}</span>
										</Select.Item>
									{/each}
								</Select.Group>
							</Select.Content>
						</Select.Root>
					</div>
					{#if size === 'custom'}
						<div class="space-y-2.5">
							<div class="flex items-center justify-between">
								<span class="text-sm">Long edge</span>
								<span class="text-muted-foreground text-sm tabular-nums">{customSize} px</span>
							</div>
							<Slider type="single" bind:value={customSize} min={480} max={8000} step={20} aria-label="Long edge" />
						</div>
					{/if}
					<div class="text-muted-foreground flex items-center justify-between pt-1 text-sm tabular-nums" data-testid="dims">
						<span>{layout.width} × {layout.height} px</span>
						<span>{layout.used} / {images.length}</span>
					</div>
				</section>
			</aside>

			<main class="flex min-w-0 flex-col md:min-h-0 md:flex-1">
				{#if showingExamples && !welcomeDismissed}
					<div class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5" data-testid="welcome">
						<p class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-sm">
							<span class="font-medium">This is the sample grid.</span>
							<span class="text-muted-foreground">Drag in images to replace it, or start from scratch.</span>
						</p>
						<div class="flex items-center gap-1">
							<Button size="sm" variant="outline" onclick={clearAll} data-testid="start-scratch">Start from scratch</Button>
							{@render iconAction('Dismiss', XIcon, () => (welcomeDismissed = true))}
						</div>
					</div>
				{/if}
				<div
					bind:clientWidth={stageW}
					bind:clientHeight={stageH}
					class="bg-accent relative flex {images.length ? 'h-[62svh]' : 'h-[calc(100svh-49px)]'} items-center justify-center overflow-hidden md:h-auto md:min-h-72 md:flex-1"
				>
					{#if images.length}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							bind:this={scroller}
							use:wheelZoom
							class="absolute inset-0 overflow-auto"
							data-testid="stage-scroll"
							onscroll={updateView}
							onpointerdown={(e) => e.button === 1 && startPan(e)}
							ondblclick={(e) => !(e.target as Element).closest('[data-testid=preview-box]') && recenter()}
						>
						<div class="flex min-h-full min-w-full w-max items-center justify-center" style:padding="{preview.pad}px">
						<div
							bind:this={previewEl}
							class="relative shrink-0 shadow-sm"
							style="width:{preview.w}px;height:{preview.h}px"
							style:translate="{nudge.x}px {nudge.y}px"
							data-testid="preview-box"
						>
							<canvas
								bind:this={canvas}
								class="absolute"
								class:checker={background.kind === 'none'}
								style:left="{viewRect.x}px"
								style:top="{viewRect.y}px"
								style:width="{viewRect.w}px"
								style:height="{viewRect.h}px"
								data-testid="preview"
							></canvas>
							{#each displayCells as rect, i (images[i]?.id ?? i)}
								{#if images[i]}
									<CellOverlay
										{rect}
										area={displayAreas[i]}
										free={style.fill.on}
										onselect={() => revealInPane(images[i].id)}
										image={images[i]}
										{fit}
										index={i}
										onfiles={(files) => replaceAt(i, files)}
										cols={layout.cols}
										rows={Math.max(layout.rows, grid.rows)}
										captions={style.captions}
										onreorder={images.length > 1 ? (e) => startLift(e, i) : undefined}
										lifted={lift?.from === i}
										onremove={() => remove(images[i].id)}
										onclear={() => clearImage(i)}
										onaddslot={() => addSlots(1, i + 1)}
										radius={style.corners.on ? (style.corners.radius / 100) * (Math.min(rect.w, rect.h) / 2) : 0}
									/>
								{/if}
							{/each}
							{#if lift?.swap && lift.target !== undefined && displayCells[lift.target]}
								{@const c = displayCells[lift.target]}
								<div
									class="ring-primary bg-primary/15 pointer-events-none absolute z-20 flex items-end justify-center pb-3 ring-2 ring-inset"
									style:left="{c.x}px"
									style:top="{c.y}px"
									style:width="{c.w}px"
									style:height="{c.h}px"
									data-testid="grid-swap-target"
								>
									<span class="bg-primary text-primary-foreground flex items-center gap-1 px-2 py-0.5 text-xs font-medium"><ArrowLeftRightIcon class="size-3.5" />Swap</span>
								</div>
							{/if}
							{#if liftLine}
								<div
									class="bg-primary ring-background pointer-events-none absolute z-20 w-1 -translate-x-1/2 ring-2"
									style:left="{liftLine.x}px"
									style:top="{liftLine.y}px"
									style:height="{liftLine.h}px"
									data-testid="grid-insert-line"
								></div>
							{/if}
						</div>
						</div>
						</div>
						{#if spaceHeld}
							<div
								class="absolute inset-0 z-30 {panning ? 'cursor-grabbing' : 'cursor-grab'}"
								role="presentation"
								data-testid="pan-surface"
								onpointerdown={startPan}
							></div>
						{/if}
						<!-- Clicking these keeps focus where it was, so Space still pans right after. -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="bg-background/90 absolute right-3 bottom-3 z-20 flex items-center rounded-md border shadow-sm backdrop-blur-sm"
							data-testid="zoom-controls"
							onmousedown={(e) => e.preventDefault()}
						>
							<button type="button" class="hover:bg-accent flex size-7 items-center justify-center rounded-l-md disabled:opacity-40" aria-label="Zoom out" title="Zoom out ({mod}−)" disabled={viewZoom <= ZOOM_MIN} onclick={() => zoomStep(-1)}>
								<MinusIcon class="size-3.5" />
							</button>
							<button type="button" class="hover:bg-accent h-7 min-w-12 px-1 text-xs tabular-nums" title="Fit to window ({mod}0)" data-testid="zoom-level" onclick={() => zoomTo(1)}>
								{viewZoom === 1 ? 'Fit' : `${Math.round(viewZoom * 100)}%`}
							</button>
							<button type="button" class="hover:bg-accent flex size-7 items-center justify-center disabled:opacity-40" aria-label="Zoom in" title="Zoom in ({mod}+)" disabled={viewZoom >= ZOOM_VIEW_MAX} onclick={() => zoomStep(1)}>
								<PlusIcon class="size-3.5" />
							</button>
							<button
								type="button"
								class="hover:bg-accent flex size-7 items-center justify-center rounded-r-md border-l disabled:opacity-40"
								aria-label="Recenter"
								title="Fit and center (Shift+1, or double-click the empty stage)"
								disabled={viewZoom === 1 && nudge.x === 0 && nudge.y === 0}
								data-testid="recenter"
								onclick={recenter}
							>
								<LocateFixedIcon class="size-3.5" />
							</button>
						</div>
						{#if lift && images[lift.from]}
							{#if images[lift.from].file}
								<img
									src={images[lift.from].thumbUrl}
									alt=""
									class="pointer-events-none fixed z-50 size-20 -translate-x-1/2 -translate-y-1/2 object-cover opacity-80 shadow-lg"
									style:left="{lift.x}px"
									style:top="{lift.y}px"
								/>
							{:else}
								<div
									class="bg-muted border-border pointer-events-none fixed z-50 size-20 -translate-x-1/2 -translate-y-1/2 border opacity-80 shadow-lg"
									style:left="{lift.x}px"
									style:top="{lift.y}px"
								></div>
							{/if}
						{/if}
					{:else}
						<StartPanel
							{cols}
							{rows}
							previews={exampleUrls()}
							disabled={loading > 0}
							onchoose={() => fileInput.click()}
							onempty={startEmpty}
							onsample={loadSamples}
						>
							{#snippet extra()}
								{#if DEV}
									<Button variant="ghost" size="sm" onclick={loadPokemon} disabled={loading > 0} data-testid="load-pokemon">Load 25 Pokémon</Button>
								{/if}
							{/snippet}
						</StartPanel>
					{/if}
					{#if loading}
						<div class="bg-background absolute top-3 right-3 flex items-center gap-2 border px-2.5 py-1 text-xs">
							<LoaderIcon class="size-3.5 animate-spin" /> Loading {loading}
						</div>
					{/if}
					{#if dragDepth > 0}
						<div
							class="border-primary pointer-events-none absolute inset-2 flex justify-center border-2 {images.length ? 'items-start' : 'bg-background/80 items-center'}"
						>
							<span class="bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium">
								{images.length ? 'Drop on a cell to fill or replace it, or anywhere else to add' : 'Drop to add'}
							</span>
						</div>
					{/if}
				</div>

				{#if images.length && dockSide === 'bottom'}
					<div class="shrink-0 border-t">
						{@render dockHeader()}
						{@render imageList('x')}
					</div>
				{/if}
			</main>
			{#if images.length && dockSide === 'right'}
				<aside class="flex shrink-0 flex-col border-t md:min-h-0 md:w-96 md:border-t-0 md:border-l" data-testid="caption-pane">
					{@render dockHeader()}
					{#if !style.captions.on}
						<div class="text-muted-foreground flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
							Captions are off.
							<Button size="sm" variant="outline" onclick={() => (style.captions.on = true)}>Turn on</Button>
						</div>
					{/if}
					<div bind:this={paneList} class="min-h-0 flex-1 overflow-y-auto">{@render imageList('y')}</div>
				</aside>
			{/if}
		</div>
	</div>
</Tooltip.Provider>

<style>
	:global(.checker) {
		background-color: #fff;
		background-image:
			linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
			linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
			linear-gradient(-45deg, transparent 75%, #e5e5e5 75%);
		background-size: 12px 12px;
		background-position:
			0 0,
			0 6px,
			6px -6px,
			-6px 0;
	}
	:global(.swatch) {
		aspect-ratio: 1;
		width: 100%;
		border: 1px solid var(--border);
		cursor: pointer;
		outline-offset: 2px;
	}
	:global(.swatch:hover) {
		border-color: color-mix(in srgb, var(--foreground) 40%, transparent);
	}
	:global(.swatch.selected) {
		outline: 2px solid var(--foreground);
	}
	:global(.swatch:focus-visible) {
		outline: 2px solid var(--ring);
	}
	:global(.swatch.spectrum) {
		background: conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
		padding: 5px;
	}
	:global(.swatch.spectrum span) {
		display: block;
		width: 100%;
		height: 100%;
		border: 1px solid rgb(255 255 255 / 70%);
	}
</style>
