<script lang="ts">
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let {
		value = $bindable(1),
		min = 1,
		max = 20,
		label
	}: { value: number; min?: number; max?: number; label: string } = $props();

	const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

	function onInput(e: Event) {
		const n = Number((e.currentTarget as HTMLInputElement).value);
		if (Number.isFinite(n) && n >= min) value = clamp(n);
	}
	function onBlur(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		value = clamp(Number(el.value) || min);
		el.value = String(value);
	}
</script>

<div
	class="border-input dark:bg-input/30 flex h-8 items-stretch rounded-md border shadow-xs focus-within:ring-3 focus-within:ring-ring/50"
>
	<button
		type="button"
		class="text-muted-foreground hover:text-foreground hover:bg-muted flex w-8 items-center justify-center disabled:opacity-40"
		aria-label="Decrease {label}"
		disabled={value <= min}
		onclick={() => (value = clamp(value - 1))}
	>
		<MinusIcon class="size-3.5" />
	</button>
	<input
		type="number"
		inputmode="numeric"
		class="border-input w-10 border-x bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
		aria-label={label}
		{min}
		{max}
		{value}
		oninput={onInput}
		onblur={onBlur}
	/>
	<button
		type="button"
		class="text-muted-foreground hover:text-foreground hover:bg-muted flex w-8 items-center justify-center disabled:opacity-40"
		aria-label="Increase {label}"
		disabled={value >= max}
		onclick={() => (value = clamp(value + 1))}
	>
		<PlusIcon class="size-3.5" />
	</button>
</div>
