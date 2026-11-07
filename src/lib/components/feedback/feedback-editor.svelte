<!--
  @component
  Send feedback's message box: a small ProseMirror editor. Select text for bold, italic,
  strikethrough or code; paste, drop or add screenshots; "Point to it" picks a part of Griddle
  and adds its picture. ↵ is a new line; ⌘↵ / Ctrl+↵ sends.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState, NodeSelection, TextSelection, type Transaction } from 'prosemirror-state';
	import { EditorView } from 'prosemirror-view';
	import { Node as PMNode, type MarkType } from 'prosemirror-model';
	import { keymap } from 'prosemirror-keymap';
	import { baseKeymap, toggleMark } from 'prosemirror-commands';
	import { history, redo, undo } from 'prosemirror-history';
	import { toast } from 'svelte-sonner';
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import CodeIcon from '@lucide/svelte/icons/code';
	import ImageIcon from '@lucide/svelte/icons/image-plus';
	import PointerIcon from '@lucide/svelte/icons/mouse-pointer-click';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { feedbackBlocks, feedbackHasContent, feedbackMessage, MAX_FEEDBACK_IMAGES, schema, type FeedbackMessage } from '$lib/feedback/schema';
	import { feedback, type Picked } from '$lib/feedback/state.svelte';

	let {
		placeholder = 'What happened, or what would make Griddle better? Paste a screenshot if it helps.',
		onemptychange,
		onsubmit,
		onpick
	}: {
		placeholder?: string;
		onemptychange?: (empty: boolean) => void;
		onsubmit?: () => void;
		onpick?: () => void;
	} = $props();

	const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
	const MARKS = [
		['bold', BoldIcon, 'Bold'],
		['italic', ItalicIcon, 'Italic'],
		['strike', StrikethroughIcon, 'Strikethrough'],
		['code', CodeIcon, 'Code']
	] as const;
	type MarkName = (typeof MARKS)[number][0];

	let host: HTMLDivElement;
	let wrap: HTMLDivElement;
	let fileInput: HTMLInputElement;
	let view: EditorView | null = null;
	let empty = $state(true);
	let imageCount = $state(0);
	let bar = $state<{ x: number; y: number } | null>(null);
	let active = $state<Record<MarkName, boolean>>({ bold: false, italic: false, strike: false, code: false });

	function countImages(doc: PMNode) {
		let n = 0;
		doc.descendants((node) => {
			if (node.type.name === 'image') n += 1;
		});
		return n;
	}

	function startDoc(): PMNode {
		if (feedback.draft) {
			try {
				return PMNode.fromJSON(schema, feedback.draft);
			} catch {
				// A draft from an older schema: start empty.
			}
		}
		return schema.node('doc', null, [schema.node('paragraph')]);
	}

	export function getMessage(): FeedbackMessage {
		return view ? feedbackMessage(view.state.doc) : { text: '', images: [] };
	}
	export function getBlocks(attachmentOf: (number | null)[]) {
		return view ? feedbackBlocks(view.state.doc, attachmentOf) : [];
	}
	export function focus() {
		view?.focus();
	}

	function markActive(state: EditorState, type: MarkType) {
		const sel = state.selection;
		if (sel.empty) return !!type.isInSet(state.storedMarks || sel.$from.marks());
		return state.doc.rangeHasMark(sel.from, sel.to, type);
	}

	function sync(state: EditorState) {
		for (const [m] of MARKS) active[m] = markActive(state, schema.marks[m]);
		const sel = state.selection;
		if (!view || sel.empty || sel instanceof NodeSelection || !view.hasFocus()) {
			bar = null;
			return;
		}
		const a = view.coordsAtPos(sel.from);
		const b = view.coordsAtPos(sel.to);
		const box = wrap.getBoundingClientRect();
		bar = { x: (a.left + b.right) / 2 - box.left, y: Math.min(a.top, b.top) - box.top };
	}

	/** Inserts pictures and puts the caret on a line under the last one, so typing goes on. */
	function insertImages(items: Picked[]) {
		if (!view || !items.length) return;
		const room = MAX_FEEDBACK_IMAGES - imageCount;
		if (items.length > room) toast.error(`Up to ${MAX_FEEDBACK_IMAGES} screenshots`);
		const nodes = items.slice(0, Math.max(0, room)).map(({ shot, about }) => schema.nodes.image.create({ src: shot, about }));
		if (!nodes.length) return;
		const { state } = view;
		const from_ = state.selection.$from;
		// After the current block (or at the end).
		const at = state.selection instanceof NodeSelection ? state.selection.to : from_.depth ? from_.after(1) : state.doc.content.size;
		const tr = state.tr.insert(at, nodes);
		let after = at + nodes.reduce((s, n) => s + n.nodeSize, 0);
		const next = tr.doc.resolve(after).nodeAfter;
		if (!next || next.type.name !== 'paragraph' || next.content.size > 0) tr.insert(after, schema.nodes.paragraph.create());
		// An empty line before the pictures is left over: drop it.
		const before = tr.doc.resolve(at).nodeBefore;
		if (before && before.type.name === 'paragraph' && before.content.size === 0 && at - before.nodeSize >= 0 && tr.doc.childCount > 2) {
			tr.delete(at - before.nodeSize, at);
			after -= before.nodeSize;
		}
		tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
		view.dispatch(tr);
	}

	function readFile(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	async function addFiles(files: Iterable<File> | null) {
		const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
		if (!images.length) return false;
		try {
			const urls = await Promise.all(images.map(readFile));
			insertImages(urls.map((shot) => ({ shot, about: '' })));
			view?.focus();
		} catch {
			toast.error('Couldn’t add that image');
		}
		return true;
	}

	onMount(() => {
		const doc = startDoc();
		const state = EditorState.create({
			doc,
			selection: TextSelection.atEnd(doc),
			plugins: [
				history(),
				keymap({
					'Mod-Enter': () => {
						onsubmit?.();
						return true;
					},
					'Shift-Enter': (s, dispatch) => {
						dispatch?.(s.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
						return true;
					},
					'Mod-z': undo,
					'Mod-Shift-z': redo,
					'Mod-y': redo,
					'Mod-b': toggleMark(schema.marks.bold),
					'Mod-i': toggleMark(schema.marks.italic),
					'Mod-Shift-x': toggleMark(schema.marks.strike),
					'Mod-e': toggleMark(schema.marks.code)
				}),
				keymap(baseKeymap)
			]
		});
		empty = !feedbackHasContent(doc);
		imageCount = countImages(doc);
		onemptychange?.(empty);
		view = new EditorView(host, {
			state,
			attributes: { class: 'feedback-pm', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Feedback message', 'data-testid': 'feedback-editor' },
			dispatchTransaction(tr: Transaction) {
				if (!view) return;
				view.updateState(view.state.apply(tr));
				sync(view.state);
				if (!tr.docChanged) return;
				const next = !feedbackHasContent(view.state.doc);
				imageCount = countImages(view.state.doc);
				if (next !== empty) {
					empty = next;
					onemptychange?.(next);
				}
				feedback.draft = view.state.doc.toJSON();
			},
			handlePaste(_v, event) {
				const files = event.clipboardData?.files;
				if (!files?.length || ![...files].some((f) => f.type.startsWith('image/'))) return false;
				void addFiles(files);
				return true;
			},
			handleDrop(_v, event) {
				const files = (event as DragEvent).dataTransfer?.files;
				if (!files?.length) return false;
				event.preventDefault();
				void addFiles(files);
				return true;
			},
			handleDOMEvents: {
				blur: () => {
					setTimeout(() => view && !view.hasFocus() && (bar = null), 120);
					return false;
				}
			}
		});
		// Parts picked while the form was minimized go in now.
		insertImages(feedback.picked.splice(0));
		requestAnimationFrame(() => view?.focus());
		return () => {
			view?.destroy();
			view = null;
		};
	});
</script>

<!-- Drops here are for the message, not the grid behind the dialog. -->
<div
	bind:this={wrap}
	class="feedback-editor border-input focus-within:border-ring focus-within:ring-ring/50 relative flex flex-col rounded-md border focus-within:ring-3"
	role="group"
	ondragover={(e) => e.stopPropagation()}
	ondrop={(e) => e.stopPropagation()}
>
	{#if empty}
		<span class="text-muted-foreground pointer-events-none absolute top-2 left-3 right-3 text-sm" aria-hidden="true">{placeholder}</span>
	{/if}
	<div bind:this={host} class="feedback-host"></div>
	<div class="flex items-center justify-end gap-1 px-1.5 pb-1.5">
		<span class="text-muted-foreground mr-auto pl-1.5 text-xs">{mod}V pastes a screenshot</span>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="ghost" size="icon-sm" aria-label="Add screenshot" disabled={imageCount >= MAX_FEEDBACK_IMAGES} onclick={() => fileInput.click()} data-testid="feedback-add-image">
						<ImageIcon />
					</Button>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content>Add screenshot</Tooltip.Content>
		</Tooltip.Root>
		{#if onpick}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon-sm" aria-label="Point to it" disabled={imageCount >= MAX_FEEDBACK_IMAGES} onclick={onpick} data-testid="feedback-pick">
							<PointerIcon />
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Point to it: click a part of Griddle to add its picture</Tooltip.Content>
			</Tooltip.Root>
		{/if}
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			hidden
			data-testid="feedback-file"
			onchange={(e) => {
				const input = e.currentTarget;
				void addFiles(input.files).finally(() => (input.value = ''));
			}}
		/>
	</div>
	{#if bar}
		<div
			class="bg-popover text-popover-foreground absolute z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border p-0.5 shadow-md"
			style:left="{bar.x}px"
			style:top="{bar.y - 6}px"
			role="toolbar"
			aria-label="Text formatting"
		>
			{#each MARKS as [name, Icon, title] (name)}
				<button
					type="button"
					class="hover:bg-accent flex size-7 items-center justify-center rounded-sm"
					class:bg-accent={active[name]}
					aria-label={title}
					aria-pressed={active[name]}
					{title}
					onmousedown={(e) => {
						e.preventDefault();
						if (view) toggleMark(schema.marks[name])(view.state, view.dispatch);
					}}
				>
					<Icon class="size-3.5" />
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.feedback-host :global(.feedback-pm) {
		min-height: calc(1.5em * 5 + 1rem);
		max-height: min(320px, 40svh);
		overflow-y: auto;
		padding: 0.5rem 0.75rem 0.25rem;
		font-size: 0.875rem;
		line-height: 1.5;
		outline: none;
		white-space: pre-wrap;
		word-wrap: break-word;
	}
	.feedback-host :global(.feedback-pm p) {
		margin: 0 0 0.25rem;
		min-height: 1.5em;
	}
	.feedback-host :global(.feedback-pm img) {
		display: block;
		max-width: 100%;
		max-height: 220px;
		margin: 0.25rem 0 0.5rem;
		border-radius: 6px;
		box-shadow: 0 0 0 1px var(--border);
	}
	.feedback-host :global(.feedback-pm img.ProseMirror-selectednode) {
		box-shadow: 0 0 0 2px var(--ring);
	}
	.feedback-host :global(.feedback-pm code) {
		padding: 0.1em 0.3em;
		border-radius: 4px;
		background: var(--muted);
		font-size: 0.9em;
	}
	.feedback-host :global(.feedback-pm a) {
		text-decoration: underline;
	}
</style>
