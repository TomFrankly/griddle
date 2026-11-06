<!--
  @component
  A looping animation of what Griddle does, using the example poses: a pile of images is dragged
  onto a drop target, becomes a grid, turns into a few bento layouts (cropped to keep faces in
  view) and gets captions. Shows the captioned state, still, when reduced motion is preferred.
-->
<script lang="ts">
	import ImagePlusIcon from '@lucide/svelte/icons/image-plus';
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import { exampleUrls } from '$lib/examples';

	let { playing = true }: { playing?: boolean } = $props();

	const urls = exampleUrls().slice(0, 9);
	/** Where each pose's face is, as a fraction of the (square) image. */
	const FACES: [number, number][] = [
		[0.62, 0.27],
		[0.5, 0.15],
		[0.35, 0.47],
		[0.57, 0.27],
		[0.5, 0.28],
		[0.57, 0.25],
		[0.48, 0.27],
		[0.52, 0.28],
		[0.45, 0.26]
	];
	const CAPTIONS = [
		'Mars pose',
		'Not like this',
		'Strange combo',
		'What does this button do?',
		'Unc thumbnail pose',
		'My reaction to that information',
		'Noice',
		"Not Kevin's chili!",
		'…Donut?'
	];

	type Cell = [c: number, r: number, w?: number, h?: number];
	type Layout = { cols: number; rows: number; cells: Cell[]; bg: string; radius: number };
	const GRID: Layout = {
		cols: 3,
		rows: 3,
		cells: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [i % 3, Math.floor(i / 3)]),
		bg: '#ffffff',
		radius: 0
	};
	const BENTO_A: Layout = {
		cols: 4,
		rows: 3,
		cells: [[0, 0], [3, 0], [0, 1], [3, 1], [1, 0, 2, 2], [0, 2], [1, 2], [2, 2], [3, 2]],
		bg: '#18181b',
		radius: 6
	};
	const BENTO_B: Layout = {
		cols: 3,
		rows: 4,
		cells: [[0, 1], [0, 0, 2, 1], [2, 0, 1, 2], [0, 3, 2, 1], [1, 1], [0, 2], [1, 2], [2, 2], [2, 3]],
		bg: '#efe9df',
		radius: 3
	};
	const BENTO_C: Layout = {
		cols: 4,
		rows: 3,
		cells: [[3, 1, 1, 2], [3, 0], [1, 2], [1, 0, 2, 1], [1, 1], [2, 1], [0, 2], [2, 2], [0, 0, 1, 2]],
		bg: '#ffffff',
		radius: 0
	};

	type Step = 'ready' | 'drag' | 'drop' | 'grid' | 'bentoA' | 'bentoB' | 'bentoC' | 'captions' | 'out';
	const STEPS: { step: Step; hold: number }[] = [
		{ step: 'ready', hold: 700 },
		{ step: 'drag', hold: 1250 },
		{ step: 'drop', hold: 450 },
		{ step: 'grid', hold: 1900 },
		{ step: 'bentoA', hold: 2000 },
		{ step: 'bentoB', hold: 2000 },
		{ step: 'bentoC', hold: 2000 },
		{ step: 'captions', hold: 3200 },
		{ step: 'out', hold: 700 }
	];
	const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	let at = $state(reduceMotion ? 7 : 0);
	let instant = $state(false);
	const step = $derived(STEPS[at].step);

	$effect(() => {
		if (!playing || reduceMotion) return;
		const t = setTimeout(() => {
			if (at === STEPS.length - 1) {
				// Jump back to the start without animating, then carry on.
				instant = true;
				at = 0;
				requestAnimationFrame(() => requestAnimationFrame(() => (instant = false)));
			} else at += 1;
		}, STEPS[at].hold);
		return () => clearTimeout(t);
	});

	type Box = { x: number; y: number; w: number; h: number };
	const PAD = 4;
	const GAP = 2;
	function place(l: Layout) {
		const cell = Math.min((100 - 2 * PAD - (l.cols - 1) * GAP) / l.cols, (100 - 2 * PAD - (l.rows - 1) * GAP) / l.rows);
		const W = l.cols * cell + (l.cols - 1) * GAP;
		const H = l.rows * cell + (l.rows - 1) * GAP;
		const ox = (100 - W) / 2;
		const oy = (100 - H) / 2;
		const boxes: Box[] = l.cells.map(([c, r, w = 1, h = 1]) => ({
			x: ox + c * (cell + GAP),
			y: oy + r * (cell + GAP),
			w: w * cell + (w - 1) * GAP,
			h: h * cell + (h - 1) * GAP
		}));
		return { boxes, canvas: { x: ox - PAD / 1.5, y: oy - PAD / 1.5, w: W + (PAD / 1.5) * 2, h: H + (PAD / 1.5) * 2 } };
	}

	// A loose pile, as if picked up together, with a little tilt on each image.
	const PILE = [
		[-5, -3, -10],
		[4, -5, 7],
		[-2, 3, -4],
		[6, 2, 12],
		[0, 0, -1],
		[-6, 5, 5],
		[3, 6, -8],
		[-3, -6, 9],
		[1, -1, 3]
	];
	const PILE_SIZE = 24;
	function pile(cx: number, cy: number, spread = 1): (Box & { rot: number })[] {
		return PILE.map(([dx, dy, rot]) => ({
			x: cx - PILE_SIZE / 2 + dx * spread,
			y: cy - PILE_SIZE / 2 + dy * spread,
			w: PILE_SIZE,
			h: PILE_SIZE,
			rot: rot * spread
		}));
	}

	/** Crops a square image into a box so the face stays in view (as background-position %). */
	function focus(i: number, b: Box) {
		const [fx, fy] = FACES[i];
		const a = Math.max(b.w, b.h);
		const px = b.w < a ? Math.min(1, Math.max(0, (fx * a - b.w / 2) / (a - b.w))) : 0.5;
		const py = b.h < a ? Math.min(1, Math.max(0, (fy * a - b.h / 2) / (a - b.h))) : 0.5;
		return `${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%`;
	}

	const LAYOUTS: Partial<Record<Step, Layout>> = {
		grid: GRID,
		bentoA: BENTO_A,
		bentoB: BENTO_B,
		bentoC: BENTO_C,
		captions: BENTO_A,
		out: BENTO_A
	};
	const layout = $derived(LAYOUTS[step] ?? null);
	const placed = $derived(layout ? place(layout) : null);
	const tiles = $derived.by(() => {
		if (placed && layout)
			return placed.boxes.map((b, i) => ({ ...b, rot: 0, pos: focus(i, b), radius: layout.radius, frame: 0 }));
		const p = step === 'ready' ? pile(150, -80) : step === 'drag' ? pile(50, 46) : pile(50, 50, 0.6);
		return p.map((b) => ({ ...b, pos: '50% 50%', radius: 2, frame: 1 }));
	});
	const cursor = $derived(
		step === 'ready' ? { x: 160, y: -60 } : step === 'drag' ? { x: 58, y: 56 } : { x: 60, y: 60 }
	);
</script>

<div class="story" class:instant data-step={step} aria-hidden="true" data-testid="showcase-story">
	<div class="target" class:show={step === 'ready' || step === 'drag' || step === 'drop'} class:hot={step === 'drop'}>
		<ImagePlusIcon class="size-6 opacity-60" />
		<span>Drop images here</span>
	</div>

	<div
		class="canvas"
		class:show={!!placed && step !== 'out'}
		style:left="{placed?.canvas.x ?? 30}%"
		style:top="{placed?.canvas.y ?? 30}%"
		style:width="{placed?.canvas.w ?? 40}%"
		style:height="{placed?.canvas.h ?? 40}%"
		style:background={layout?.bg ?? '#ffffff'}
	></div>

	{#each tiles as t, i (i)}
		<div
			class="tile"
			class:gone={step === 'out'}
			style:left="{t.x}%"
			style:top="{t.y}%"
			style:width="{t.w}%"
			style:height="{t.h}%"
			style:transform="rotate({t.rot}deg)"
			style:border-radius="{t.radius}px"
			style:border-width="{t.frame * 3}px"
			style:background-image="url({urls[i]})"
			style:background-position={t.pos}
			style:transition-delay="{step === 'grid' || step === 'drag' ? i * 30 : i * 18}ms"
		>
			<span class="caption" class:show={step === 'captions'} style:transition-delay="{step === 'captions' ? 150 + i * 90 : 0}ms">
				<span class="clamp">{CAPTIONS[i]}</span>
			</span>
		</div>
	{/each}

	<div class="cursor" class:show={step === 'ready' || step === 'drag'} style:left="{cursor.x}%" style:top="{cursor.y}%">
		<MousePointer2Icon class="size-5" fill="currentColor" />
	</div>
</div>

<style>
	.story {
		--ease: cubic-bezier(0.65, 0, 0.35, 1);
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		max-width: 100%;
	}
	.story.instant,
	.story.instant * {
		transition: none !important;
	}
	.target {
		position: absolute;
		inset: 14%;
		border: 1.5px solid color-mix(in srgb, var(--foreground) 18%, transparent);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		padding-bottom: 9%;
		font-size: 12px;
		color: var(--muted-foreground);
		opacity: 0;
		transform: scale(0.97);
		transition:
			opacity 0.5s var(--ease),
			transform 0.5s var(--ease),
			border-color 0.3s,
			background 0.3s;
	}
	.target.show {
		opacity: 1;
		transform: none;
	}
	.target.hot {
		border-color: var(--foreground);
		background: color-mix(in srgb, var(--foreground) 5%, transparent);
	}
	.canvas {
		position: absolute;
		opacity: 0;
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.14),
			0 1px 3px rgba(0, 0, 0, 0.08);
		transition:
			left 0.9s var(--ease),
			top 0.9s var(--ease),
			width 0.9s var(--ease),
			height 0.9s var(--ease),
			background-color 0.9s var(--ease),
			opacity 0.6s var(--ease);
	}
	.canvas.show {
		opacity: 1;
	}
	.tile {
		position: absolute;
		overflow: hidden;
		background-color: #1ccd50;
		background-size: cover;
		border: 0 solid #ffffff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
		transition-property: left, top, width, height, transform, border-radius, border-width, background-position, opacity;
		transition-duration: 0.9s;
		transition-timing-function: var(--ease);
	}
	[data-step='grid'] .tile,
	[data-step^='bento'] .tile,
	[data-step='captions'] .tile {
		box-shadow: none;
	}
	[data-step='drop'] .tile {
		transition-duration: 0.4s;
	}
	.tile.gone {
		opacity: 0;
		transition-duration: 0.6s;
	}
	.caption {
		position: absolute;
		inset: auto 0 0 0;
		padding: 18% 6% 5%;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
		color: #fff;
		font-size: 10.5px;
		font-weight: 500;
		line-height: 1.2;
		opacity: 0;
		transform: translateY(6px);
		transition:
			opacity 0.5s var(--ease),
			transform 0.5s var(--ease);
	}
	.clamp {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.caption.show {
		opacity: 1;
		transform: none;
	}
	.cursor {
		position: absolute;
		color: var(--foreground);
		opacity: 0;
		transition:
			left 1.1s var(--ease),
			top 1.1s var(--ease),
			opacity 0.3s;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
	}
	.cursor.show {
		opacity: 1;
	}
	[data-step='drag'] .tile {
		transition-duration: 1.1s;
	}
</style>
