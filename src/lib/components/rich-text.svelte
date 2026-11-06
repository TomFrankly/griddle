<!--
  A small rich-text field (bold, italic, underline, strikethrough) built on ProseMirror. A
  formatting bar appears above the selection.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Schema, type Node as PMNode, type MarkType } from 'prosemirror-model';
	import { EditorState, type Transaction } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import { keymap } from 'prosemirror-keymap';
	import { baseKeymap, toggleMark } from 'prosemirror-commands';
	import { history, redo, undo } from 'prosemirror-history';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import UnderlineIcon from '@lucide/svelte/icons/underline';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import type { RichText, Run } from '$lib/captions';

	let {
		value = $bindable([]),
		placeholder = '',
		label,
		testid
	}: { value?: RichText; placeholder?: string; label: string; testid?: string } = $props();

	const schema = new Schema({
		nodes: {
			doc: { content: 'paragraph+' },
			paragraph: { content: 'text*', toDOM: () => ['p', 0], parseDOM: [{ tag: 'p' }, { tag: 'div' }] },
			text: {}
		},
		marks: {
			bold: { toDOM: () => ['strong', 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }, { style: 'font-weight=700' }] },
			italic: { toDOM: () => ['em', 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }, { style: 'font-style=italic' }] },
			underline: { toDOM: () => ['u', 0], parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }] },
			strike: { toDOM: () => ['s', 0], parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }] }
		}
	});
	const MARKS = ['bold', 'italic', 'underline', 'strike'] as const;
	type MarkName = (typeof MARKS)[number];

	function toDoc(t: RichText): PMNode {
		const paras = (t.length ? t : [[]]).map((p) =>
			schema.node(
				'paragraph',
				null,
				p.filter((r) => r.text).map((r) => schema.text(r.text, MARKS.filter((m) => r[m]).map((m) => schema.marks[m].create())))
			)
		);
		return schema.node('doc', null, paras);
	}

	function fromDoc(doc: PMNode): RichText {
		const out: RichText = [];
		doc.forEach((p) => {
			const runs: Run[] = [];
			p.forEach((n) => {
				const r: Run = { text: n.text ?? '' };
				for (const m of n.marks) r[m.type.name as MarkName] = true;
				runs.push(r);
			});
			out.push(runs);
		});
		// An empty field is stored as no paragraphs.
		return out.every((p) => !p.length) ? [] : out;
	}

	let host: HTMLDivElement;
	let wrap: HTMLDivElement;
	let view: EditorView | undefined;
	let bar = $state<{ x: number; y: number } | null>(null);
	let active = $state<Record<MarkName, boolean>>({ bold: false, italic: false, underline: false, strike: false });
	let empty = $state(true);
	let lastEmitted = '';

	function markActive(state: EditorState, type: MarkType) {
		const sel = state.selection;
		if (sel.empty) return !!type.isInSet(state.storedMarks || sel.$from.marks());
		return state.doc.rangeHasMark(sel.from, sel.to, type);
	}

	function sync(state: EditorState) {
		for (const m of MARKS) active[m] = markActive(state, schema.marks[m]);
		empty = state.doc.textContent.length === 0;
		const sel = state.selection;
		if (!view || sel.empty || !view.hasFocus()) {
			bar = null;
			return;
		}
		const a = view.coordsAtPos(sel.from);
		const b = view.coordsAtPos(sel.to);
		const box = wrap.getBoundingClientRect();
		bar = { x: (a.left + b.right) / 2 - box.left, y: Math.min(a.top, b.top) - box.top };
	}

	function command(name: MarkName) {
		if (!view) return;
		toggleMark(schema.marks[name])(view.state, view.dispatch);
		view.focus();
	}

	onMount(() => {
		const state = EditorState.create({
			doc: toDoc(value),
			plugins: [
				history(),
				keymap({
					'Mod-z': undo,
					'Mod-Shift-z': redo,
					'Mod-y': redo,
					'Mod-b': toggleMark(schema.marks.bold),
					'Mod-i': toggleMark(schema.marks.italic),
					'Mod-u': toggleMark(schema.marks.underline),
					'Mod-Shift-x': toggleMark(schema.marks.strike)
				}),
				keymap(baseKeymap)
			]
		});
		lastEmitted = JSON.stringify(value);
		view = new EditorView(host, {
			state,
			attributes: {
				class: 'outline-none',
				role: 'textbox',
				'aria-multiline': 'true',
				'aria-label': label,
				...(testid ? { 'data-testid': testid } : {})
			},
			dispatchTransaction(tr: Transaction) {
				if (!view) return;
				const next = view.state.apply(tr);
				view.updateState(next);
				if (tr.docChanged) {
					const v = fromDoc(next.doc);
					lastEmitted = JSON.stringify(v);
					value = v;
				}
				sync(next);
			},
			handleDOMEvents: {
				blur: () => {
					setTimeout(() => view && !view.hasFocus() && (bar = null), 120);
					return false;
				},
				focus: () => {
					if (view) sync(view.state);
					return false;
				}
			}
		});
		sync(state);
	});

	// Outside changes (undo in the app, switching images) replace the document.
	$effect(() => {
		const key = JSON.stringify(value);
		if (!view || key === lastEmitted) return;
		lastEmitted = key;
		view.updateState(EditorState.create({ doc: toDoc(value), plugins: view.state.plugins }));
		sync(view.state);
	});

	onDestroy(() => view?.destroy());
</script>

<div class="relative" bind:this={wrap}>
	<div
		bind:this={host}
		class="rich border-input focus-within:border-ring focus-within:ring-ring/50 min-h-9 w-full border bg-transparent px-2.5 py-1.5 text-sm focus-within:ring-3"
	></div>
	{#if empty && placeholder}
		<span class="text-muted-foreground pointer-events-none absolute top-1.5 left-2.5 text-sm">{placeholder}</span>
	{/if}
	{#if bar}
		<div
			class="bg-popover text-popover-foreground absolute z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 border p-0.5 shadow-md"
			style:left="{bar.x}px"
			style:top="{bar.y - 6}px"
			role="toolbar"
			aria-label="Text formatting"
			data-testid="format-bar"
		>
			{#each [['bold', BoldIcon, 'Bold'], ['italic', ItalicIcon, 'Italic'], ['underline', UnderlineIcon, 'Underline'], ['strike', StrikethroughIcon, 'Strikethrough']] as const as [name, Icon, title] (name)}
				<button
					type="button"
					class="hover:bg-accent flex size-7 items-center justify-center"
					class:bg-accent={active[name]}
					aria-label={title}
					aria-pressed={active[name]}
					{title}
					onmousedown={(e) => {
						e.preventDefault();
						command(name);
					}}
				>
					<Icon class="size-3.5" />
				</button>
			{/each}
		</div>
	{/if}
</div>



<style>
	.rich :global(p) {
		margin: 0;
	}
	.rich :global(.ProseMirror) {
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>
