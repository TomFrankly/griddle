<script lang="ts">
	import { Slider } from '$lib/components/ui/slider/index.js';

	let {
		label,
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		unit = 'px'
	}: { label: string; value: number; min?: number; max?: number; step?: number; unit?: string } = $props();
</script>

<div class="space-y-2.5">
	<div class="flex items-center justify-between">
		<span class="text-sm">{label}</span>
		<span class="text-muted-foreground text-sm tabular-nums">{value}{unit === '%' ? '%' : ` ${unit}`}</span>
	</div>
	<Slider type="single" bind:value {min} {max} {step} aria-label={label} />
</div>
