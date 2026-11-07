<!--
  @component
  Send feedback, minimized: a small round button at the bottom right that drags anywhere in
  the window. A click (or ↵) brings the form back as it was left; arrow keys move it.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import MessageIcon from '@lucide/svelte/icons/message-square-more';
	import { feedback, openFeedback } from '$lib/feedback/state.svelte';

	const SIZE = 44;
	const EDGE = 16;
	/** Below this many pixels a press is a click, not a drag. */
	const DRAG_SLOP = 4;

	let orb = $state<HTMLButtonElement | null>(null);
	let pos = $state({ x: 0, y: 0 });
	let dragging = $state(false);

	const clamp = (p: { x: number; y: number }) => ({
		x: Math.min(Math.max(EDGE, p.x), Math.max(EDGE, innerWidth - SIZE - EDGE)),
		y: Math.min(Math.max(EDGE, p.y), Math.max(EDGE, innerHeight - SIZE - EDGE))
	});

	onMount(() => {
		pos = clamp(feedback.pos ?? { x: innerWidth - SIZE - EDGE, y: innerHeight - SIZE - EDGE });
		const onresize = () => (pos = clamp(pos));
		addEventListener('resize', onresize);
		return () => removeEventListener('resize', onresize);
	});

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || !orb) return;
		const el = orb;
		const start = { x: event.clientX, y: event.clientY };
		const from = { ...pos };
		let moved = false;
		el.setPointerCapture(event.pointerId);
		const move = (e: PointerEvent) => {
			const dx = e.clientX - start.x;
			const dy = e.clientY - start.y;
			if (!moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
			moved = true;
			dragging = true;
			pos = clamp({ x: from.x + dx, y: from.y + dy });
		};
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
			dragging = false;
			if (moved) feedback.pos = { ...pos };
			else openFeedback();
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openFeedback();
			return;
		}
		const step = event.shiftKey ? 40 : 10;
		const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[event.key];
		if (!d) return;
		event.preventDefault();
		pos = clamp({ x: pos.x + d[0], y: pos.y + d[1] });
		feedback.pos = { ...pos };
	}
</script>

<button
	bind:this={orb}
	type="button"
	class="bg-primary text-primary-foreground fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
	class:cursor-grab={!dragging}
	class:cursor-grabbing={dragging}
	style="left: {pos.x}px; top: {pos.y}px; width: {SIZE}px; height: {SIZE}px; touch-action: none"
	aria-label="Send feedback (minimized). Drag to move."
	title="Send feedback: click to open, drag to move"
	data-testid="feedback-orb"
	{onpointerdown}
	{onkeydown}
>
	<MessageIcon class="size-5" />
</button>
