<!--
  Searchable Google Fonts picker. Popular families come first; more load as you scroll, and
  typing searches the whole catalog. Each name is previewed in its own typeface.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { fontCatalog, type FontEntry } from '$lib/captions';

	let { value = $bindable('Inter'), label }: { value?: string; label: string } = $props();

	const PAGE = 40;
	const CATEGORY: Record<string, string> = { sans: 'Sans serif', serif: 'Serif', display: 'Display', hand: 'Handwriting', mono: 'Monospace' };

	let open = $state(false);
	let query = $state('');
	let fonts = $state<FontEntry[]>([]);
	let shown = $state(PAGE);
	let highlighted = $state(0);
	let list = $state<HTMLDivElement>();

	const matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return fonts;
		const starts = fonts.filter((f) => f.family.toLowerCase().startsWith(q));
		const rest = fonts.filter((f) => !f.family.toLowerCase().startsWith(q) && f.family.toLowerCase().includes(q));
		return [...starts, ...rest];
	});
	const visible = $derived(matches.slice(0, shown));

	$effect(() => {
		if (open && !fonts.length) fontCatalog().then((f) => (fonts = f));
	});
	$effect(() => {
		void query;
		shown = PAGE;
		highlighted = 0;
		list?.scrollTo({ top: 0 });
	});

	const previewed = new Set<string>();
	/** Loads just the letters of a family's name, so the list can show each typeface cheaply. */
	function preview(node: HTMLElement, family: string) {
		const load = () => {
			if (previewed.has(family) || family === 'Inter') return;
			previewed.add(family);
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&text=${encodeURIComponent(family)}&display=swap`;
			document.head.appendChild(link);
		};
		const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (load(), io.disconnect()));
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}

	function onScroll(e: Event) {
		const el = e.currentTarget as HTMLElement;
		if (el.scrollTop + el.clientHeight > el.scrollHeight - 200 && shown < matches.length) shown += PAGE;
	}

	function pick(family: string) {
		value = family;
		open = false;
		query = '';
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = Math.min(matches.length - 1, highlighted + 1);
			if (highlighted >= shown - 5) shown += PAGE;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = Math.max(0, highlighted - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const f = matches[highlighted];
			if (f) pick(f.family);
			return;
		} else return;
		list?.querySelector(`[data-i="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' });
	}

	const familyCss = (f: string) => (f === 'Inter' ? "'Inter Variable', sans-serif" : `'${f}', system-ui`);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="w-40 justify-between font-normal" aria-label={label} data-testid="font-{label}">
				<span class="truncate">{value}</span>
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64 gap-0 p-0" align="end">
		<div class="flex items-center gap-2 border-b px-2.5">
			<SearchIcon class="text-muted-foreground size-4 shrink-0" />
			<input
				class="placeholder:text-muted-foreground h-9 w-full bg-transparent text-sm outline-none"
				placeholder="Search {fonts.length ? fonts.length.toLocaleString() : ''} fonts"
				bind:value={query}
				onkeydown={onKey}
				aria-label="Search fonts"
				data-testid="font-search"
			/>
		</div>
		<div bind:this={list} class="max-h-72 overflow-y-auto p-1" role="listbox" aria-label="Fonts" onscroll={onScroll}>
			{#if !fonts.length}
				<div class="text-muted-foreground px-2 py-6 text-center text-sm">Loading fonts…</div>
			{:else if !matches.length}
				<div class="text-muted-foreground px-2 py-6 text-center text-sm">No fonts match</div>
			{/if}
			{#each visible as f, i (f.family)}
				<button
					type="button"
					role="option"
					aria-selected={f.family === value}
					data-i={i}
					class="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left"
					class:bg-accent={i === highlighted}
					onmouseenter={() => (highlighted = i)}
					onclick={() => pick(f.family)}
				>
					<span use:preview={f.family} class="min-w-0 flex-1 truncate text-[15px]" style:font-family={familyCss(f.family)}>{f.family}</span>
					<span class="text-muted-foreground shrink-0 text-[11px]">{CATEGORY[f.category] ?? ''}</span>
					<CheckIcon class="size-3.5 shrink-0 {f.family === value ? '' : 'invisible'}" />
				</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
