/**
 * The help chip's state: its panel (closed, the menu, or Send feedback), where the chip sits,
 * and the feedback draft, which survives closing the panel until it's sent or discarded.
 */
export type Picked = { shot: string; about: string };

export const feedback = $state({
	/** What the chip's panel shows; closed leaves just the chip. */
	panel: 'closed' as 'closed' | 'menu' | 'feedback',
	/** Pointing to a part of Griddle (the panel steps aside meanwhile). */
	picking: false,
	/** Where the chip was dragged to (left, top in px); null: the start spot. */
	pos: null as { x: number; y: number } | null,
	/** Parts picked while the form was away; the message box adds each when it opens. */
	picked: [] as Picked[],
	/** The message as last edited (ProseMirror JSON), kept while the panel is closed. */
	draft: null as Record<string, unknown> | null,
	/** The draft has words or pictures, so the chip shows a dot. */
	hasDraft: false
});

export function openFeedback() {
	feedback.picking = false;
	feedback.panel = 'feedback';
}

/** Tuck the panel into the chip, keeping any draft. */
export function minimizePanel() {
	feedback.panel = 'closed';
}

export function pickPart() {
	feedback.panel = 'closed';
	feedback.picking = true;
}

/** Sent, or thrown away: the draft goes. */
export function discardFeedback() {
	feedback.panel = 'closed';
	feedback.picking = false;
	feedback.picked = [];
	feedback.draft = null;
	feedback.hasDraft = false;
}
