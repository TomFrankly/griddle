/**
 * Send feedback's state, shared by the dialog, the orb it minimizes to, and the picker
 * that lets someone point to a part of Griddle.
 */
export type Picked = { shot: string; about: string };

export const feedback = $state({
	/** The dialog is showing. */
	open: false,
	/** Minimized to the orb; the draft is kept. */
	minimized: false,
	/** Pointing to a part of Griddle (the form is minimized meanwhile). */
	picking: false,
	/** Where the orb was dragged to (left, top in px); null: the start spot. */
	pos: null as { x: number; y: number } | null,
	/** Parts picked while the form was away; the message box adds each when it opens. */
	picked: [] as Picked[],
	/** The message as last edited (ProseMirror JSON), kept while minimized. */
	draft: null as Record<string, unknown> | null
});

export function openFeedback() {
	feedback.picking = false;
	feedback.minimized = false;
	feedback.open = true;
}

export function minimizeFeedback() {
	feedback.open = false;
	feedback.minimized = true;
}

export function pickPart() {
	minimizeFeedback();
	feedback.picking = true;
}

/** Closed for good (sent, or cancelled): the draft goes. */
export function discardFeedback() {
	feedback.open = false;
	feedback.minimized = false;
	feedback.picking = false;
	feedback.picked = [];
	feedback.draft = null;
}
