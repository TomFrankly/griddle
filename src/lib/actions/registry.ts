/**
 * The action registry: every command Griddle can run, described once with an id, a label, its
 * keyboard shortcuts and when it is available. The keyboard handler runs actions through it, and
 * menus, a command bar or an outside controller (such as an AI assistant) can list and run the
 * same actions without knowing how each one works.
 *
 * Image edits themselves are described in edits/registry.ts; actions are the verbs around them.
 */

export type ActionGroup = 'selection' | 'image' | 'view' | 'history';

export type Action = {
	/** Dotted and stable, such as `image.rotateRight`. */
	id: string;
	label: string;
	group: ActionGroup;
	/**
	 * Shortcuts such as `Mod+Alt+C`, `Shift+1` or `Escape`. `Mod` is ⌘ on a Mac and Ctrl
	 * elsewhere; `Ctrl` means the Control key itself.
	 */
	keys?: string[];
	/** Whether the action can run now. Defaults to always. */
	enabled?: () => boolean;
	run: () => void;
};

/** Keys whose `KeyboardEvent.code` doesn't follow from their character. */
const CODES: Record<string, string> = {
	'=': 'Equal',
	'-': 'Minus',
	'[': 'BracketLeft',
	']': 'BracketRight',
	'/': 'Slash',
	',': 'Comma',
	'.': 'Period'
};

function codeFor(key: string): string | null {
	if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
	if (/^[0-9]$/.test(key)) return `Digit${key}`;
	return CODES[key] ?? null;
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/** True when the event is this shortcut. Letters and digits match by physical key, so Alt
 * combinations work on a Mac (where Alt changes the character typed). */
export function matchesKey(binding: string, e: KeyEventLike): boolean {
	const parts = binding.split('+');
	// A binding for the plus key itself ends in an empty part: `Mod++`.
	const key = parts.at(-1) === '' ? '+' : parts.at(-1)!;
	const mods = new Set(parts.slice(0, parts.at(-1) === '' ? -2 : -1));
	const wantMod = mods.has('Mod');
	const wantCtrl = mods.has('Ctrl');
	const mod = e.metaKey || e.ctrlKey;
	if (wantCtrl ? !e.ctrlKey || e.metaKey : wantMod !== mod) return false;
	if (mods.has('Alt') !== e.altKey || mods.has('Shift') !== e.shiftKey) return false;
	const code = codeFor(key);
	return (code !== null && e.code === code) || e.key.toLowerCase() === key.toLowerCase();
}

/** A shortcut written for people: ⌥⌘C on a Mac, Ctrl+Alt+C elsewhere. */
export function formatKey(binding: string, mac: boolean): string {
	const parts = binding.split('+');
	const key = parts.at(-1) === '' ? '+' : parts.at(-1)!;
	const mods = parts.slice(0, parts.at(-1) === '' ? -2 : -1);
	if (mac) {
		const sym: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' };
		const order = ['Ctrl', 'Alt', 'Shift', 'Mod'];
		return mods.sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((m) => sym[m] ?? m).join('') + key.toUpperCase();
	}
	return [...mods.map((m) => (m === 'Mod' ? 'Ctrl' : m)), key.length === 1 ? key.toUpperCase() : key].join('+');
}

export class ActionRegistry {
	private readonly byId = new Map<string, Action>();

	register(...actions: Action[]) {
		for (const a of actions) {
			if (this.byId.has(a.id)) throw new Error(`Action ${a.id} is registered twice`);
			this.byId.set(a.id, a);
		}
		return this;
	}

	get(id: string) {
		return this.byId.get(id);
	}

	list(): Action[] {
		return [...this.byId.values()];
	}

	isEnabled(a: Action) {
		return a.enabled ? a.enabled() : true;
	}

	/** Runs an action by id. Returns false when there is no such action or it can't run now. */
	run(id: string): boolean {
		const a = this.byId.get(id);
		if (!a || !this.isEnabled(a)) return false;
		a.run();
		return true;
	}

	/** The enabled action a key press triggers, if any. */
	forKey(e: KeyEventLike): Action | undefined {
		return this.list().find((a) => a.keys?.some((k) => matchesKey(k, e)) && this.isEnabled(a));
	}

	/** Runs the action for a key press and stops the browser's own handling of it. */
	handleKey(e: KeyboardEvent): boolean {
		const a = this.forKey(e);
		if (!a) return false;
		e.preventDefault();
		a.run();
		return true;
	}
}
