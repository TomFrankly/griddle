<!--
  @component
  Send feedback's "Point to it": the form steps aside, a cover outlines the part of Griddle under
  the pointer, and a click draws that part (dom-shot.ts, no screen-capture permission) into the
  message and brings the form back. Esc or Cancel goes back without one.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { renderElement } from '$lib/feedback/dom-shot';
	import { pickedElementText } from '$lib/feedback/picked-element';
	import { feedback, openFeedback } from '$lib/feedback/state.svelte';

	let { root }: { root: HTMLElement } = $props();

	/** Parts smaller than this give way to their parent, so a click gets a useful picture. */
	const MIN_W = 40;
	const MIN_H = 20;

	let cover = $state<HTMLDivElement | null>(null);
	let target: HTMLElement | null = null;
	let box = $state<{ left: number; top: number; width: number; height: number } | null>(null);
	let busy = $state(false);

	function partAt(x: number, y: number): HTMLElement | null {
		if (!cover) return null;
		cover.style.pointerEvents = 'none';
		let el = document.elementFromPoint(x, y) as HTMLElement | null;
		// The closing dialog leaves pointer-events: none on the body for a moment.
		cover.style.pointerEvents = 'auto';
		if (!el || !root.contains(el) || el.closest('[data-feedback-picker], [role=dialog]')) return null;
		while (el && el !== root) {
			const r = el.getBoundingClientRect();
			if (r.width >= MIN_W && r.height >= MIN_H) break;
			el = el.parentElement;
		}
		return el && el !== root ? el : null;
	}

	function outline(el: HTMLElement | null) {
		target = el;
		if (!el) return (box = null);
		const r = el.getBoundingClientRect();
		box = { left: r.left, top: r.top, width: r.width, height: r.height };
	}

	/** The nearest background that isn't see-through, to fill behind the picture. */
	function backgroundOf(el: HTMLElement): string {
		for (let node: HTMLElement | null = el; node; node = node.parentElement) {
			const bg = getComputedStyle(node).backgroundColor;
			if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
		}
		return getComputedStyle(document.body).backgroundColor || '#fff';
	}

	function back() {
		openFeedback();
	}

	async function pick(el: HTMLElement) {
		busy = true;
		box = null;
		const r = el.getBoundingClientRect();
		const visible = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, innerWidth), bottom: Math.min(r.bottom, innerHeight) };
		try {
			const shot = await renderElement(el, visible, backgroundOf(el));
			feedback.picked.push({ shot, about: pickedElementText(el, root, 'Griddle') });
		} catch (error) {
			console.warn('Point to it failed:', error);
			toast.error('Couldn’t take a picture of that part');
		}
		back();
	}

	onMount(() => {
		// The dialog that just closed still blocks the page for its closing animation.
		if (document.body.style.pointerEvents === 'none') document.body.style.pointerEvents = '';
		const onkey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			back();
		};
		addEventListener('keydown', onkey, true);
		return () => removeEventListener('keydown', onkey, true);
	});
</script>

<div
	bind:this={cover}
	class="pointer-events-auto fixed inset-0 z-[60] cursor-crosshair"
	role="presentation"
	data-testid="feedback-pick-cover"
	onpointermove={(e) => !busy && outline(partAt(e.clientX, e.clientY))}
	onpointerleave={() => outline(null)}
	onclick={(e) => {
		e.preventDefault();
		e.stopPropagation();
		if (busy) return;
		const el = partAt(e.clientX, e.clientY) ?? target;
		if (el) void pick(el);
	}}
></div>
{#if box}
	<div
		class="pick-box pointer-events-none fixed z-[61] rounded-sm"
		aria-hidden="true"
		style="left: {box.left}px; top: {box.top}px; width: {box.width}px; height: {box.height}px"
	></div>
{/if}
<div
	class="bg-popover text-popover-foreground pointer-events-auto fixed bottom-4 left-1/2 z-[62] flex -translate-x-1/2 items-center gap-2 rounded-full border py-1 pr-1 pl-4 text-sm whitespace-nowrap shadow-lg"
	role="status"
	data-feedback-picker
>
	{busy ? 'Taking a picture…' : 'Click the part you mean'}
	<Button variant="ghost" size="sm" class="rounded-full" onclick={back}>Cancel <kbd class="text-muted-foreground text-xs">Esc</kbd></Button>
</div>

<style>
	.pick-box {
		box-shadow:
			0 0 0 2px var(--ring),
			0 0 0 9999px color-mix(in oklab, var(--background) 35%, transparent);
	}
</style>
