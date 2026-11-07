<!--
  @component
  The help chip: a small round button in a corner of the window (drag it anywhere). A click
  grows its panel out of the corner with the info menu; Send feedback morphs the panel into
  the feedback form. The panel isn't modal, so people can keep using Griddle while it's open.
  Minimize tucks it back into the chip and keeps the draft; a dot on the chip says one waits.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { scale, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import InfoIcon from '@lucide/svelte/icons/info';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import MailIcon from '@lucide/svelte/icons/mail-open';
	import LifeBuoyIcon from '@lucide/svelte/icons/life-buoy';
	import ShieldIcon from '@lucide/svelte/icons/shield-check';
	import MessageIcon from '@lucide/svelte/icons/message-square-more';
	import FeedbackForm from './feedback-form.svelte';
	import { feedback, minimizePanel, openFeedback } from '$lib/feedback/state.svelte';

	let {
		diagnostics,
		onwelcome,
		onhelp,
		onprivacy
	}: { diagnostics: () => string; onwelcome: () => void; onhelp: () => void; onprivacy: () => void } = $props();

	const SIZE = 40;
	const EDGE = 16;
	/** Below this many pixels a press is a click, not a drag. */
	const DRAG_SLOP = 4;
	const MENU_W = 232;
	const FORM_W = 440;

	let root = $state<HTMLDivElement | null>(null);
	let chip = $state<HTMLButtonElement | null>(null);
	let pos = $state({ x: EDGE, y: 600 });
	let dragging = $state(false);
	let vw = $state(1200);
	let vh = $state(800);
	let innerH = $state(0);

	const clamp = (p: { x: number; y: number }) => ({
		x: Math.min(Math.max(EDGE, p.x), Math.max(EDGE, vw - SIZE - EDGE)),
		y: Math.min(Math.max(EDGE, p.y), Math.max(EDGE, vh - SIZE - EDGE))
	});

	// The panel opens away from the window edge the chip sits near.
	const right = $derived(pos.x + SIZE / 2 > vw / 2);
	const below = $derived(pos.y + SIZE / 2 < vh / 2);
	const width = $derived(Math.min(feedback.panel === 'feedback' ? FORM_W : MENU_W, vw - 2 * EDGE));
	const maxH = $derived(Math.max(240, (below ? vh - pos.y - SIZE : pos.y) - EDGE - 8));
	const origin = $derived(`${below ? 'top' : 'bottom'} ${right ? 'right' : 'left'}`);
	// Where the panel sits against the chip, in px from the chip's own box.
	const panelStyle = $derived(
		[
			right ? `right: 0` : `left: 0`,
			below ? `top: ${SIZE + 8}px` : `bottom: ${SIZE + 8}px`,
			`width: ${width}px`,
			`height: ${Math.min(innerH, maxH)}px`,
			`transform-origin: ${origin}`
		].join('; ')
	);

	onMount(() => {
		const measure = () => {
			vw = innerWidth;
			vh = innerHeight;
			pos = clamp(pos);
		};
		vw = innerWidth;
		vh = innerHeight;
		pos = clamp(feedback.pos ?? { x: EDGE, y: innerHeight - SIZE - EDGE });
		addEventListener('resize', measure);
		// The menu closes on a click elsewhere; the form stays, so people can look around.
		const outside = (e: PointerEvent) => {
			if (feedback.panel === 'menu' && root && !root.contains(e.target as Node)) feedback.panel = 'closed';
		};
		addEventListener('pointerdown', outside, true);
		const onkey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || feedback.panel === 'closed' || feedback.picking) return;
			// Dialogs over the panel handle their own Escape.
			if (document.querySelector('[role=dialog][data-state=open]')) return;
			e.preventDefault();
			minimizePanel();
			chip?.focus();
		};
		addEventListener('keydown', onkey);
		return () => {
			removeEventListener('resize', measure);
			removeEventListener('pointerdown', outside, true);
			removeEventListener('keydown', onkey);
		};
	});

	function toggle() {
		if (feedback.panel !== 'closed') return minimizePanel();
		feedback.panel = feedback.hasDraft ? 'feedback' : 'menu';
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || !chip) return;
		const el = chip;
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
			else toggle();
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggle();
			return;
		}
		const step = event.shiftKey ? 40 : 10;
		const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[event.key];
		if (!d) return;
		event.preventDefault();
		pos = clamp({ x: pos.x + d[0], y: pos.y + d[1] });
		feedback.pos = { ...pos };
	}

	async function choose(fn: () => void) {
		minimizePanel();
		await tick();
		fn();
	}
</script>

<Tooltip.Provider delayDuration={300}>
	<div bind:this={root} class="fixed z-40" style="left: {pos.x}px; top: {pos.y}px; width: {SIZE}px; height: {SIZE}px" data-feedback-picker>
		{#if feedback.panel !== 'closed' && !feedback.picking}
			<div
				class="panel bg-popover text-popover-foreground absolute overflow-hidden rounded-xl border shadow-xl"
				style={panelStyle}
				role="dialog"
				aria-modal="false"
				aria-label={feedback.panel === 'feedback' ? 'Send feedback' : 'Help and info'}
				data-testid="help-panel"
				transition:scale={{ start: 0.4, duration: 260, easing: cubicOut, opacity: 0 }}
			>
				<div class="absolute {right ? 'right-0' : 'left-0'} {below ? 'top-0' : 'bottom-0'} overflow-y-auto" style="width: {width}px; max-height: {maxH}px" bind:clientHeight={innerH}>
					{#key feedback.panel}
						<div in:fade={{ duration: 160, delay: 90 }}>
							{#if feedback.panel === 'menu'}
								<nav class="flex flex-col p-1.5" aria-label="Help and info">
									<button type="button" class="item" onclick={() => choose(onwelcome)} data-testid="info-welcome"><MailIcon />Welcome letter</button>
									<button type="button" class="item" onclick={() => choose(onhelp)} data-testid="info-help"><LifeBuoyIcon />Help</button>
									<button type="button" class="item" onclick={() => choose(onprivacy)} data-testid="info-privacy"><ShieldIcon />Privacy</button>
									<div class="bg-border mx-2 my-1 h-px"></div>
									<button type="button" class="item" onclick={openFeedback} data-testid="info-feedback">
										<MessageIcon />Send feedback
										{#if feedback.hasDraft}<span class="text-muted-foreground ml-auto text-xs">Draft</span>{/if}
									</button>
								</nav>
							{:else}
								<div class="flex items-center gap-1 px-2 pt-2 pb-2">
									<Button variant="ghost" size="icon-sm" aria-label="Back to the menu" title="Back to the menu" onclick={() => (feedback.panel = 'menu')} data-testid="feedback-back">
										<ChevronLeftIcon />
									</Button>
									<h2 class="flex-1 text-sm font-semibold">Send feedback</h2>
									<Button variant="ghost" size="icon-sm" aria-label="Minimize" title="Minimize: keep your draft and look around" onclick={minimizePanel} data-testid="feedback-minimize">
										<MinusIcon />
									</Button>
								</div>
								<FeedbackForm {diagnostics} />
							{/if}
						</div>
					{/key}
				</div>
			</div>
		{/if}
		<button
			bind:this={chip}
			type="button"
			class="chip bg-background text-foreground hover:bg-muted relative flex size-full items-center justify-center rounded-full border shadow-md transition-[background-color,transform] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
			class:cursor-grab={!dragging}
			class:cursor-grabbing={dragging}
			class:open={feedback.panel !== 'closed'}
			style="touch-action: none"
			aria-label="Help, privacy and feedback. Drag to move."
			aria-expanded={feedback.panel !== 'closed'}
			title="Help, privacy and feedback (drag to move)"
			data-testid="info"
			{onpointerdown}
			{onkeydown}
		>
			<InfoIcon class="size-[18px]" />
			{#if feedback.hasDraft && feedback.panel === 'closed'}
				<span class="bg-primary ring-background absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2" aria-label="Feedback draft waiting" data-testid="feedback-draft-dot"></span>
			{/if}
		</button>
	</div>
</Tooltip.Provider>

<style>
	.panel {
		transition:
			width 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
			height 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.chip.open {
		transform: scale(0.94);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 2.1rem;
		padding: 0 0.6rem;
		border-radius: calc(var(--radius) + 2px);
		font-size: 0.875rem;
		text-align: left;
	}
	.item:hover,
	.item:focus-visible {
		background: var(--accent);
		outline: none;
	}
	.item :global(svg) {
		width: 1rem;
		height: 1rem;
		color: var(--muted-foreground);
	}
	@media (prefers-reduced-motion: reduce) {
		.panel {
			transition: none;
		}
	}
</style>
