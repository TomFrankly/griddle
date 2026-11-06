<script lang="ts">
	import ColorPicker from './color-picker.svelte';

	let { label, value = $bindable('#000000') }: { label: string; value: string } = $props();
</script>

<div class="flex items-center justify-between">
	<span class="text-sm">{label}</span>
	<ColorPicker {value} {label} onpick={(hex) => (value = hex)}>
		{#snippet trigger(props)}
			<button
				{...props}
				type="button"
				class="border-input hover:bg-muted flex h-8 items-center gap-2 rounded-md border px-2 text-sm"
				aria-label="{label}: {value.toUpperCase()}"
			>
				<span class="size-4 border" style:background={value}></span>
				<span class="font-mono text-xs uppercase">{value}</span>
			</button>
		{/snippet}
	</ColorPicker>
</div>
