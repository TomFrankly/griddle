<!--
  Apply a built-in or saved look, save the current one, or delete saved ones.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { BUILT_IN_LOOKS, loadLooks, saveLooks, type Look, type NamedLook } from '$lib/looks';

	let { current, onapply }: { current: () => Look; onapply: (look: Look) => void } = $props();

	let open = $state(false);
	let saved = $state<NamedLook[]>(loadLooks());
	let name = $state('');

	function save(e: SubmitEvent) {
		e.preventDefault();
		const n = name.trim() || `Look ${saved.length + 1}`;
		const look = current();
		const existing = saved.findIndex((l) => l.name.toLowerCase() === n.toLowerCase());
		const entry = { id: existing >= 0 ? saved[existing].id : `look-${Date.now()}`, name: n, look };
		saved = existing >= 0 ? saved.map((l, i) => (i === existing ? entry : l)) : [...saved, entry];
		saveLooks($state.snapshot(saved));
		name = '';
	}

	function remove(id: string) {
		saved = saved.filter((l) => l.id !== id);
		saveLooks($state.snapshot(saved));
	}

	function apply(l: NamedLook) {
		onapply(structuredClone($state.snapshot(l.look)) as Look);
		open = false;
	}
</script>

{#snippet item(l: NamedLook, deletable: boolean)}
	<div class="group hover:bg-accent focus-within:bg-accent flex items-center rounded-sm">
		<button
			type="button"
			class="flex-1 rounded-sm px-2 py-1.5 text-left text-sm outline-none"
			onclick={() => apply(l)}
			data-testid="look-{l.id}">{l.name}</button
		>
		{#if deletable}
			<button
				type="button"
				class="text-muted-foreground hover:text-foreground mr-1 hidden size-6 items-center justify-center rounded-sm group-hover:flex focus-visible:flex"
				aria-label="Delete {l.name}"
				onclick={() => remove(l.id)}
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}
	</div>
{/snippet}

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" data-testid="looks">
				<PaletteIcon />
				Looks
				<ChevronDownIcon class="opacity-60" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-60 gap-0 p-0" align="end">
		<div class="p-1">
			<div class="text-muted-foreground px-2 py-1.5 text-xs font-medium">Built in</div>
			{#each BUILT_IN_LOOKS as l (l.id)}{@render item(l, false)}{/each}
			{#if saved.length}
				<div class="text-muted-foreground mt-1 px-2 py-1.5 text-xs font-medium">Saved</div>
				{#each saved as l (l.id)}{@render item(l, true)}{/each}
			{/if}
		</div>
		<form class="flex gap-1.5 border-t p-2" onsubmit={save}>
			<input
				class="border-input placeholder:text-muted-foreground focus-visible:border-ring h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm outline-none"
				placeholder="Name this look"
				bind:value={name}
				aria-label="Look name"
				data-testid="look-name"
			/>
			<Button type="submit" size="sm" data-testid="look-save">Save</Button>
		</form>
	</Popover.Content>
</Popover.Root>
