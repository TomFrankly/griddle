<!--
  @component
  A tone curve editor for the selected images: one curve for all three channels plus one per
  channel. Click the line to add a point, drag points to shape it, and double-click a point (or
  drag it out of the box) to remove it.
-->
<script lang="ts">
	import { formatCurve, IDENTITY_CURVE, parseCurve, sampleCurve, type CurvePoint } from '$lib/edits/curves';
	import { sharedEdit, valueOf, type CurveParam, type ImageEdits, type ParamValue } from '$lib/edits';

	let {
		params,
		edits,
		onset
	}: {
		params: CurveParam[];
		edits: ImageEdits[];
		onset: (id: string, value: ParamValue) => void;
	} = $props();

	let channel = $state(0);
	const p = $derived(params[channel]);
	const text = $derived(String(sharedEdit(edits, p.id) ?? valueOf(edits[0], p.id)));
	const mixed = $derived(edits.length > 1 && sharedEdit(edits, p.id) === null);
	const points = $derived(parseCurve(text) ?? parseCurve(IDENTITY_CURVE)!);
	const COLORS = ['var(--foreground)', '#e5484d', '#30a46c', '#3e63dd'];
	const changed = (id: string) => edits.some((e) => e[id] !== undefined);

	const S = 240;
	const path = $derived.by(() => {
		const s = sampleCurve(points, 97);
		return Array.from(s, (y, i) => `${i ? 'L' : 'M'}${((i / 96) * S).toFixed(1)},${((1 - y) * S).toFixed(1)}`).join('');
	});

	let svg: SVGSVGElement | undefined = $state();
	function toCurve(e: PointerEvent | MouseEvent): CurvePoint {
		const r = svg!.getBoundingClientRect();
		return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
	}
	const set = (pts: CurvePoint[]) => onset(p.id, formatCurve(pts));

	function drag(e: PointerEvent, index: number) {
		e.preventDefault();
		e.stopPropagation();
		const el = e.currentTarget as Element;
		try {
			el.setPointerCapture(e.pointerId);
		} catch {
			// A point added mid-press may not own the pointer yet; dragging still follows it.
		}
		const start = points.map((q) => [...q] as CurvePoint);
		const last = index === start.length - 1;
		const move = (ev: PointerEvent) => {
			const [x, y] = toCurve(ev);
			const pts = start.map((q) => [...q] as CurvePoint);
			// Dragging an inner point well outside the box removes it.
			if (index > 0 && !last && (y < -0.15 || y > 1.15)) {
				pts.splice(index, 1);
				set(pts);
				return;
			}
			// Points keep their order; end points move along their own edge too.
			const lo = index > 0 ? pts[index - 1][0] + 0.01 : 0;
			const hi = !last ? pts[index + 1][0] - 0.01 : 1;
			pts[index] = [Math.min(hi, Math.max(lo, x)), Math.min(1, Math.max(0, y))];
			set(pts);
		};
		const up = () => {
			el.removeEventListener('pointermove', move as EventListener);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
		};
		el.addEventListener('pointermove', move as EventListener);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	function add(e: PointerEvent) {
		if (points.length >= 16) return;
		const [x] = toCurve(e);
		if (points.some((q) => Math.abs(q[0] - x) < 0.02)) return;
		const y = sampleCurve(points, 1001)[Math.round(x * 1000)];
		const pts = [...points, [x, y] as CurvePoint].sort((a, b) => a[0] - b[0]);
		set(pts);
		// Keep dragging the new point while the button is down.
		const i = pts.findIndex((q) => q[0] === x);
		requestAnimationFrame(() => {
			const dot = svg?.querySelectorAll('[data-point]')[i];
			if (dot) dot.dispatchEvent(new PointerEvent('pointerdown', e));
		});
	}

	function remove(index: number) {
		if (index === 0 || index === points.length - 1) return;
		set(points.filter((_, i) => i !== index));
	}
</script>

<div class="space-y-2" data-testid="curves">
	<div class="flex items-center justify-between">
		<div class="flex border" role="tablist" aria-label="Curve channel">
			{#each params as c, i (c.id)}
				<button
					type="button"
					role="tab"
					aria-selected={channel === i}
					class="hover:bg-muted relative h-7 px-2.5 text-xs aria-selected:bg-accent aria-selected:font-medium"
					onclick={() => (channel = i)}
				>
					{c.label}{#if changed(c.id)}<span class="absolute top-1 right-0.5 size-1 rounded-full" style:background={COLORS[i]}></span>{/if}
				</button>
			{/each}
		</div>
		<button
			type="button"
			class="text-muted-foreground hover:text-foreground h-7 px-2 text-sm disabled:opacity-40"
			disabled={text === IDENTITY_CURVE && !mixed}
			onclick={() => onset(p.id, IDENTITY_CURVE)}>Reset curve</button
		>
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svg
		bind:this={svg}
		viewBox="-7 -7 {S + 14} {S + 14}"
		class="w-full touch-none select-none"
		class:opacity-60={mixed}
		role="img"
		aria-label="{p.label} curve"
		onpointerdown={add}
	>
		<rect x="0" y="0" width={S} height={S} fill="none" stroke="var(--border)" />
		{#each [1, 2, 3] as q (q)}
			<line x1={(q * S) / 4} y1="0" x2={(q * S) / 4} y2={S} stroke="var(--border)" stroke-width="0.75" />
			<line x1="0" y1={(q * S) / 4} x2={S} y2={(q * S) / 4} stroke="var(--border)" stroke-width="0.75" />
		{/each}
		<line x1="0" y1={S} x2={S} y2="0" stroke="var(--border)" stroke-width="0.75" />
		<path d={path} fill="none" stroke={COLORS[channel]} stroke-width="1.75" />
		{#each points as [x, y], i (i)}
			<circle
				data-point
				cx={x * S}
				cy={(1 - y) * S}
				r="5"
				fill="var(--background)"
				stroke={COLORS[channel]}
				stroke-width="1.75"
				class="cursor-grab"
				role="presentation"
				onpointerdown={(e) => drag(e, i)}
				ondblclick={() => remove(i)}
			/>
		{/each}
	</svg>
</div>
