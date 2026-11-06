<!--
  One setting row: label, slider and a typeable value. `extra` sits after the value (such as a link
  toggle); `reserve` keeps that space empty so a row lines up with one that has an extra.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import NumberInput from './number-input.svelte';

	let {
		label,
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		unit = 'px',
		disabled = false,
		shown,
		extra,
		reserve = false
	}: {
		label: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
		disabled?: boolean;
		/** A value to show in the box instead of `value`, such as a linked value. */
		shown?: number;
		extra?: Snippet;
		reserve?: boolean;
	} = $props();
</script>

<div class="flex min-h-8 items-center gap-2.5">
	<span class="w-[6.5rem] shrink-0 truncate text-sm" class:text-muted-foreground={disabled}>{label}</span>
	<Slider type="single" bind:value {min} {max} {step} {disabled} class="min-w-0 flex-1 {disabled ? 'opacity-40' : ''}" aria-label={label} />
	{#if shown === undefined}
		<NumberInput bind:value {min} {max} {step} {unit} {disabled} label="{label} value" />
	{:else}
		<NumberInput value={shown} {unit} disabled label="{label} value" />
	{/if}
	{#if extra}{@render extra()}{:else if reserve}<span class="w-6 shrink-0"></span>{/if}
</div>
