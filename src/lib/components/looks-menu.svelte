<!--
  Apply a built-in or saved look, save the current one, or delete saved ones.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import XIcon from '@lucide/svelte/icons/x';
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
	<div class="group hover:bg-accent flex items-center">
		<button type="button" class="flex-1 px-2 py-1.5 text-left text-sm" onclick={() => apply(l)} data-testid="look-{l.id}">{l.name}</button>
		{#if deletable}
			<button
				type="button"
				class="text-muted-foreground hover:text-foreground mr-1 hidden size-6 items-center justify-center group-hover:flex focus-visible:flex"
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
			<Button {...props} variant="ghost" size="sm" data-testid="looks">
				<PaletteIcon />
				<span class="hidden sm:inline">Looks</span>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-60 p-0" align="end">
		<div class="text-muted-foreground px-3 pt-2.5 pb-1 text-[11px]">Built in</div>
		<div class="px-1">
			{#each BUILT_IN_LOOKS as l (l.id)}{@render item(l, false)}{/each}
		</div>
		{#if saved.length}
			<div class="text-muted-foreground px-3 pt-2.5 pb-1 text-[11px]">Saved</div>
			<div class="px-1">
				{#each saved as l (l.id)}{@render item(l, true)}{/each}
			</div>
		{/if}
		<form class="mt-2 flex gap-1.5 border-t p-2" onsubmit={save}>
			<input
				class="border-input placeholder:text-muted-foreground h-8 min-w-0 flex-1 border bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
				placeholder="Name this look"
				bind:value={name}
				aria-label="Look name"
				data-testid="look-name"
			/>
			<Button type="submit" size="sm" data-testid="look-save">Save</Button>
		</form>
	</Popover.Content>
</Popover.Root>
