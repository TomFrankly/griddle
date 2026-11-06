<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { exampleFiles } from '$lib/examples';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { ModeWatcher, setMode, userPrefersMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
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
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom';
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
		DEFAULT_STYLE,
		type Background,
		type CellStyle,
		type ExportFormat,
		type FitMode,
		type GridImage
	} from '$lib/render';
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
		for (const img of images) img.title = fromPlain(img.name.replace(/\.[^.]+$/, ''));
	}

	const preview = $derived.by(() => {
		const pad = stageW < 640 ? 12 : 32;
		const availW = Math.max(50, stageW - pad * 2);
		const availH = Math.max(50, stageH - pad * 2);
		const k = Math.min(1, availW / layout.width, availH / layout.height);
		return { w: Math.max(1, Math.floor(layout.width * k)), h: Math.max(1, Math.floor(layout.height * k)), k };
	});
	const k = $derived(preview.w / layout.width);
	const displayCells = $derived(
		layout.cells.map((c) => ({ x: c.x * k, y: c.y * k, w: c.w * k, h: c.h * k }))
	);

	$effect(() => {
		if (!canvas || images.length === 0) return;
		const dpr = window.devicePixelRatio || 1;
		const w = Math.round(preview.w * dpr);
		const h = Math.round(preview.h * dpr);
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
			{ background, cellBackground, fit, style: $state.snapshot(style) as CellStyle, scale: w / layout.width }
		);
		void fontTick;
	});

	$effect(() => {
		if (linkPadding) padding = gap;
	});

	let showingExamples = $state(false);
	let welcomeDismissed = $state(false);

	// Undo and redo. Each entry is a snapshot of the composition; images are referenced by id and
	// kept decoded in `pool` until no snapshot uses them.
	type Snapshot = {
		images: { id: string; adjust: GridImage['adjust']; span: GridImage['span']; title: GridImage['title']; desc: GridImage['desc'] }[];
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
				desc: $state.snapshot(i.desc)
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
					return img ? [{ id: i.id, file: img.file }] : [];
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
			if (!snap.images.some((i) => pool.has(i.id))) return false;
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
		images = snap.images.flatMap(({ id, adjust, span, title, desc }) => {
			const img = pool.get(id);
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
		if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, [contenteditable="true"]')) return;
		const key = e.key.toLowerCase();
		if (key === 'z' && !e.shiftKey) undo();
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
		if (!examples) ok.forEach((img) => storeFile(img.id, img.file));
		images = [...images, ...ok];
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

	/** Puts dropped images into the grid starting at cell `index`, replacing what is there. */
	async function replaceAt(index: number, list: FileList | File[] | null | undefined) {
		dragDepth = 0;
		const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		const ok = await loadAll(files);
		if (!ok.length) return;
		ok.forEach((img) => storeFile(img.id, img.file));
		const next = [...images];
		ok.forEach((img, j) => {
			// The new image takes over the cell's size in the layout.
			if (index + j < next.length) next[index + j] = { ...img, span: { ...next[index + j].span } };
			else next.push(img);
		});
		images = next;
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
		img.thumb.close();
		URL.revokeObjectURL(img.thumbUrl);
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
		images = [...images].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
	let lift = $state<{ from: number; x: number; y: number; at: number | null } | null>(null);
	let previewEl = $state<HTMLDivElement>();
	/** The insertion line between cells, in preview pixels. */
	const liftLine = $derived.by(() => {
		if (!lift || lift.at === null || !displayCells.length) return null;
		const g = (gap * k) / 2;
		const at = lift.at;
		const before = displayCells[at];
		const after = displayCells[at - 1];
		// Between two cells in one row, centre the line in the gap; otherwise put it beside the cell.
		if (before && (!after || Math.abs(after.y - before.y) > 1)) return { x: before.x - g, y: before.y, h: before.h };
		if (after) return { x: after.x + after.w + g, y: after.y, h: after.h };
		return null;
	});
	function startLift(e: PointerEvent, from: number) {
		lift = { from, x: e.clientX, y: e.clientY, at: null };
		const move = (ev: PointerEvent) => {
			if (!lift || !previewEl) return;
			const box = previewEl.getBoundingClientRect();
			const px = ev.clientX - box.left;
			const py = ev.clientY - box.top;
			let at = lift.at;
			displayCells.forEach((c, i) => {
				if (px >= c.x - gap * k && px <= c.x + c.w + gap * k && py >= c.y && py <= c.y + c.h)
					at = px < c.x + c.w / 2 ? i : i + 1;
			});
			lift = { ...lift, x: ev.clientX, y: ev.clientY, at };
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
			const l = lift;
			lift = null;
			if (!l || l.at === null) return;
			const to = l.at > l.from ? l.at - 1 : l.at;
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
		ok.forEach((img) => storeFile(img.id, img.file));
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
		return () => {
			document.removeEventListener('visibilitychange', saveOnLeave);
			window.removeEventListener('pagehide', hide);
		};
	});

	async function loadSamples() {
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
		if (!resumed && !images.length) await addFiles(await exampleFiles(), true);
		resetHistory();
	});

	$effect(() => {
		void welcomeDismissed;
		untrack(() => current && persist());
	});

	const labelOf = (list: { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
</script>

<svelte:window ondragenter={onDragEnter} ondragleave={onDragLeave} ondragover={onDragOver} ondrop={onDrop} onpaste={onPaste} onkeydown={onKeydown} />

<ModeWatcher />
<Toaster position="bottom-center" />

{#snippet dockHeader()}
	<div class="flex h-9 items-center gap-1 border-b px-3">
		<span class="text-muted-foreground text-xs tabular-nums">
			{#if showingExamples}Example images ·
				<button type="button" class="text-foreground underline-offset-2 hover:underline" onclick={() => fileInput.click()}>Add your own</button>
			{:else}{images.length} image{images.length === 1 ? '' : 's'}{/if}{#if unused && !showingExamples}<span> · {unused} not used</span>{/if}
		</span>
		<div class="ml-auto flex items-center">
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
					<img src={img.thumbUrl} alt={img.name} class="size-full object-cover" draggable="false" />
					<span class="bg-background/90 absolute bottom-0 left-0 px-1 text-[10px] tabular-nums">{i + 1}</span>
					<button
						type="button"
						class="bg-background/90 absolute top-0 right-0 hidden size-5 items-center justify-center group-hover:flex focus-visible:flex"
						aria-label="Remove {img.name}"
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


	<div class="flex min-h-dvh flex-col md:h-dvh">
		<header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
			<div class="flex items-center gap-2">
				<span class="font-logo text-[22px] leading-none italic">Griddle</span>
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
								<DropdownMenu.Item onclick={downloadCells} data-testid="download-cells">Download {images.length} PNG{images.length === 1 ? '' : 's'}</DropdownMenu.Item>
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
			</div>
		</header>

		<div class="flex flex-col-reverse md:min-h-0 md:flex-1 md:flex-row">
			<aside class="shrink-0 border-t md:w-80 md:overflow-y-auto md:border-t-0 md:border-r">
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
									<Tooltip.Content>{linkPadding ? 'Matches the gap. Click to set it separately.' : 'Match the gap'}</Tooltip.Content>
								</Tooltip.Root>
							</div>
							<span class="text-muted-foreground text-sm tabular-nums">{linkPadding ? gap : padding} px</span>
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
							<span class="font-medium">Welcome to <span class="font-logo text-lg leading-none italic">Griddle!</span></span>
							<span class="text-muted-foreground">Drag in images to replace these samples, or start from scratch.</span>
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
					class="bg-accent relative flex h-[62svh] items-center justify-center overflow-hidden md:h-auto md:min-h-72 md:flex-1"
				>
					{#if images.length}
						<div bind:this={previewEl} class="relative shadow-sm" style="width:{preview.w}px;height:{preview.h}px">
							<canvas bind:this={canvas} class="checker absolute inset-0 size-full" data-testid="preview"></canvas>
							{#each displayCells as rect, i (images[i]?.id ?? i)}
								{#if images[i]}
									<CellOverlay
										{rect}
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
										radius={style.corners.on ? (style.corners.radius / 100) * (Math.min(rect.w, rect.h) / 2) : 0}
									/>
								{/if}
							{/each}
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
						{#if lift && images[lift.from]}
							<img
								src={images[lift.from].thumbUrl}
								alt=""
								class="pointer-events-none fixed z-50 size-20 -translate-x-1/2 -translate-y-1/2 object-cover opacity-80 shadow-lg"
								style:left="{lift.x}px"
								style:top="{lift.y}px"
							/>
						{/if}
					{:else}
						<div class="flex flex-col items-center gap-3">
							<button
								type="button"
								class="hover:bg-background/60 flex flex-col items-center gap-3 border px-16 py-14 text-center transition-colors"
								onclick={() => fileInput.click()}
							>
								<ImagePlusIcon class="text-muted-foreground size-6" />
								<span class="text-sm font-medium">Drop images here</span>
								<span class="text-muted-foreground text-xs">or click to choose</span>
							</button>
							<div class="flex gap-1">
								<Button variant="ghost" size="sm" onclick={loadSamples} disabled={loading > 0} data-testid="load-samples">Load samples</Button>
								{#if DEV}
									<Button variant="ghost" size="sm" onclick={loadPokemon} disabled={loading > 0} data-testid="load-pokemon">Load 25 Pokémon</Button>
								{/if}
							</div>
						</div>
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
								{images.length ? 'Drop on an image to replace it, or anywhere else to add' : 'Drop to add'}
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
					<div class="min-h-0 flex-1 overflow-y-auto">{@render imageList('y')}</div>
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
