<!--
  A color well that opens a picker: a saturation/brightness field, a hue bar, the hex code and
  the screen eyedropper where the browser has one.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import PipetteIcon from '@lucide/svelte/icons/pipette';
	import { hexToHsv, hsvToHex, parseHex, type Hsv } from '$lib/color';

	let {
		value,
		label,
		onpick,
		trigger
	}: {
		value: string;
		label: string;
		onpick: (hex: string) => void;
		trigger: Snippet<[Record<string, unknown>]>;
	} = $props();

	let open = $state(false);
	let hsv = $state<Hsv>({ h: 0, s: 0, v: 0 });
	$effect.pre(() => {
		const v = value;
		// Keep the hue while the color is grey, so dragging to the corner doesn't reset it.
		const next = hexToHsv(v);
		if (hsvToHex(hsv) !== parseHex(v)) hsv = next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next;
	});
	let typed = $state('');
	$effect.pre(() => {
		typed = value.replace(/^#/, '').toUpperCase();
	});

	const hueHex = $derived(hsvToHex({ h: hsv.h, s: 1, v: 1 }));
	const hasDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

	function send(next: Hsv) {
		hsv = next;
		onpick(hsvToHex(next));
	}

	function drag(e: PointerEvent, at: (x: number, y: number) => Hsv) {
		if (e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		el.setPointerCapture(e.pointerId);
		el.focus();
		const move = (ev: PointerEvent) => {
			const r = el.getBoundingClientRect();
			const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
			const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
			send(at(x, y));
		};
		move(e);
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', () => el.removeEventListener('pointermove', move), { once: true });
	}
	const fieldAt = (x: number, y: number): Hsv => ({ h: hsv.h, s: x, v: 1 - y });
	const hueAt = (x: number): Hsv => ({ ...hsv, h: Math.min(359.9, x * 360) });

	function fieldKey(e: KeyboardEvent) {
		const d: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, 1],
			ArrowDown: [0, -1]
		};
		const m = d[e.key];
		if (!m) return;
		e.preventDefault();
		const step = e.shiftKey ? 0.1 : 0.01;
		const c = (n: number) => Math.min(1, Math.max(0, n));
		send({ ...hsv, s: c(hsv.s + m[0] * step), v: c(hsv.v + m[1] * step) });
	}
	function hueKey(e: KeyboardEvent) {
		const dir =
			e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
		if (!dir) return;
		e.preventDefault();
		send({ ...hsv, h: (hsv.h + dir * (e.shiftKey ? 15 : 1) + 360) % 360 });
	}

	function commitTyped() {
		const hex = parseHex(typed);
		if (hex) onpick(hex);
		else typed = value.replace(/^#/, '').toUpperCase();
	}

	async function eyedrop() {
		try {
			const Dropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } })
				.EyeDropper;
			const { sRGBHex } = await new Dropper().open();
			const hex = parseHex(sRGBHex);
			if (hex) onpick(hex);
		} catch {
			// Escape: nothing picked.
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			{@render trigger(props)}
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-60 gap-2 p-2" align="start" collisionPadding={8}>
		<div
			class="cp-field relative aspect-[4/3] cursor-crosshair touch-none"
			style:background-color={hueHex}
			role="slider"
			tabindex="0"
			aria-label="{label}: saturation and brightness"
			aria-valuenow={Math.round(hsv.s * 100)}
			aria-valuetext="Saturation {Math.round(hsv.s * 100)}%, brightness {Math.round(hsv.v * 100)}%"
			onpointerdown={(e) => drag(e, fieldAt)}
			onkeydown={fieldKey}
		>
			<span class="cp-thumb" style:left="{hsv.s * 100}%" style:top="{(1 - hsv.v) * 100}%" style:background={value}
			></span>
		</div>
		<div
			class="cp-hue relative h-3 cursor-pointer touch-none"
			role="slider"
			tabindex="0"
			aria-label="{label}: hue"
			aria-valuemin={0}
			aria-valuemax={360}
			aria-valuenow={Math.round(hsv.h)}
			onpointerdown={(e) => drag(e, (x) => hueAt(x))}
			onkeydown={hueKey}
		>
			<span class="cp-thumb top-1/2" style:left="{(hsv.h / 360) * 100}%" style:background={hueHex}></span>
		</div>
		<div class="flex items-center gap-1">
			{#if hasDropper}
				<Button variant="ghost" size="icon-sm" class="shrink-0" aria-label="Pick from screen" onclick={eyedrop}>
					<PipetteIcon />
				</Button>
			{/if}
			<label class="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 text-xs">
				<span aria-hidden="true">#</span>
				<Input
					bind:value={typed}
					class="h-7 px-1.5 font-mono text-xs uppercase"
					maxlength={7}
					spellcheck={false}
					autocomplete="off"
					aria-label="{label}: hex code"
					onblur={commitTyped}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							commitTyped();
						}
					}}
				/>
			</label>
		</div>
	</Popover.Content>
</Popover.Root>

<style>
	.cp-field {
		background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--foreground) 12%, transparent);
	}
	.cp-hue {
		background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--foreground) 12%, transparent);
	}
	.cp-thumb {
		position: absolute;
		width: 14px;
		height: 14px;
		border-radius: 9999px;
		transform: translate(-50%, -50%);
		box-shadow:
			0 0 0 2px #fff,
			0 1px 4px rgb(0 0 0 / 45%);
		pointer-events: none;
	}
</style>
