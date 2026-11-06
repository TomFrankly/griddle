<!--
  A small number box that sits beside a slider: type a value, or use the arrow keys
  (Shift for steps of 10). Out-of-range values are clamped when you leave the box.
-->
<script lang="ts">
	let {
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		unit = 'px',
		label,
		disabled = false
	}: { value: number; min?: number; max?: number; step?: number; unit?: string; label: string; disabled?: boolean } = $props();

	let draft = $state<string | null>(null);

	const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));

	function commit() {
		if (draft === null) return;
		const n = Number.parseFloat(draft);
		if (Number.isFinite(n)) value = clamp(n);
		draft = null;
	}

	function onkeydown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') {
			commit();
			e.currentTarget.blur();
		} else if (e.key === 'Escape') {
			draft = null;
			e.currentTarget.blur();
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			e.preventDefault();
			const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
			value = clamp(value + d);
			draft = null;
		}
	}
</script>

<label
	class="hover:border-input focus-within:border-input focus-within:ring-ring/15 flex h-7 w-[3.75rem] shrink-0 items-center gap-0.5 rounded-md border border-transparent px-1.5 text-sm tabular-nums focus-within:ring-3"
	class:opacity-40={disabled}
>
	<input
		class="w-full min-w-0 bg-transparent text-right outline-none"
		inputmode="decimal"
		aria-label={label}
		{disabled}
		value={draft ?? String(value)}
		oninput={(e) => (draft = e.currentTarget.value)}
		onblur={commit}
		{onkeydown}
	/>
	<span class="text-muted-foreground shrink-0 text-xs">{unit}</span>
</label>
