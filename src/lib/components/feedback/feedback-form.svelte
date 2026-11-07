<!--
  @component
  Send feedback, inside the help chip's panel: a kind, a message box with screenshots, and
  optional diagnostics, saved to the Griddle Feedback database in Notion.
-->
<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import FeedbackEditor from './feedback-editor.svelte';
	import { discardFeedback, pickPart } from '$lib/feedback/state.svelte';
	import { feedbackAttachments } from '$lib/feedback/attachments';
	import { browserName, sendFeedback, type FeedbackKind } from '$lib/feedback/send';

	let { diagnostics }: { diagnostics: () => string } = $props();

	const ISSUES = 'https://github.com/TomFrankly/griddle/issues';
	const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

	let editor = $state<FeedbackEditor | null>(null);
	let empty = $state(true);
	let kind = $state<FeedbackKind>('bug');
	let includeDiagnostics = $state(true);
	let sending = $state(false);
	let sent = $state(false);
	let picturesMissing = $state(false);
	let error = $state<string | null>(null);

	const ERRORS: Record<string, string> = {
		'not-configured': 'Feedback isn’t set up on this copy of Griddle yet.',
		'rate-limited': 'You’ve sent a lot of feedback in the last hour. Try again later.',
		offline: 'You’re offline, so it couldn’t be sent. Try again when you’re back online.',
		'too-large': 'The screenshots are too large to send. Remove one and try again.'
	};

	async function submit() {
		if (!editor || empty || sending) return;
		const { text, images } = editor.getMessage();
		sending = true;
		error = null;
		const { attachments, skipped, attachmentOf } = await feedbackAttachments(images);
		const result = await sendFeedback({
			message: text || '(Screenshots only)',
			kind,
			blocks: editor.getBlocks(attachmentOf),
			...(attachments.length ? { attachments } : {}),
			...(includeDiagnostics ? { diagnostics: diagnostics() } : {}),
			browser: includeDiagnostics ? browserName() : '',
			version: String(import.meta.env.VITE_BUILD_ID ?? 'dev')
		});
		sending = false;
		if (!result.ok) {
			error = result.error ?? 'send-failed';
			return;
		}
		picturesMissing = skipped > 0 || result.attachments === 'dropped';
		sent = true;
		setTimeout(discardFeedback, picturesMissing ? 4000 : 1600);
	}
</script>

{#if sent}
	<p class="px-4 py-8 text-center text-sm" data-testid="feedback-sent">
		{picturesMissing ? 'Thanks, your feedback was sent, but some screenshots couldn’t be attached.' : 'Thanks, your feedback was sent.'}
	</p>
{:else}
	<div class="flex flex-col gap-3 px-4 pb-4" data-testid="feedback-form">
		<p class="text-muted-foreground text-sm">Report a bug, ask a question or suggest an idea. It goes straight to Thomas, who makes Griddle. Screenshots you add are sent with it.</p>
		<ToggleGroup.Root type="single" variant="outline" size="sm" value={kind} onValueChange={(v) => v && (kind = v as FeedbackKind)} class="w-full" aria-label="Kind of feedback">
			<ToggleGroup.Item value="bug" class="flex-1" data-testid="feedback-kind-bug">Bug</ToggleGroup.Item>
			<ToggleGroup.Item value="idea" class="flex-1" data-testid="feedback-kind-idea">Idea</ToggleGroup.Item>
			<ToggleGroup.Item value="question" class="flex-1" data-testid="feedback-kind-question">Question</ToggleGroup.Item>
			<ToggleGroup.Item value="other" class="flex-1" data-testid="feedback-kind-other">Other</ToggleGroup.Item>
		</ToggleGroup.Root>
		<FeedbackEditor bind:this={editor} onemptychange={(e) => (empty = e)} onsubmit={submit} onpick={pickPart} />
		{#if error}
			<p class="text-sm" role="alert" data-testid="feedback-error">
				{ERRORS[error] ?? 'Couldn’t send your feedback.'}
				You can also
				<a class="underline underline-offset-2" href={ISSUES} target="_blank" rel="noreferrer">open an issue on GitHub</a>.
			</p>
		{/if}
		<div class="flex flex-wrap items-center justify-end gap-2">
			<label class="text-muted-foreground mr-auto flex cursor-pointer items-center gap-2 text-sm" for="feedback-diagnostics" title="Griddle's version, your browser, window size and grid settings. Never your images.">
				<Switch id="feedback-diagnostics" size="sm" bind:checked={includeDiagnostics} />
				Include diagnostic info
			</label>
			<Button variant="ghost" size="sm" onclick={discardFeedback} data-testid="feedback-discard">Discard</Button>
			<Button size="sm" onclick={submit} disabled={empty || sending} title="Send ({mod}↵)" data-testid="feedback-send">
				{#if sending}<LoaderIcon class="animate-spin" />Sending…{:else}Send{/if}
			</Button>
		</div>
	</div>
{/if}
