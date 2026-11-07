/**
 * Characters a reader never sees, taken out of feedback text before it goes into Notion
 * (where Notion AI, or an agent, may read it).
 *
 * Always removed:
 *   - tag characters U+E0000–E007F ("ASCII smuggling": each one is an invisible copy of a
 *     letter, so a whole sentence can hide in text that shows as nothing), except in a
 *     subdivision flag: 🏴 then up to six tag letters or digits and a cancel tag;
 *   - bidi embeddings, overrides and isolates U+202A–202E, U+2066–2069;
 *   - supplementary variation selectors U+E0100–E01EF;
 *   - invisible operators and fillers: U+2061–2064, U+115F, U+1160, U+17B4, U+17B5, U+180E,
 *     U+3164, U+FFA0, and the interlinear annotation marks U+FFF9–FFFB;
 *   - control characters (C0, DEL and C1), except tab and newline;
 *   - runs of four or more zero-width characters (U+200B, 200C, 200D, 2060, FEFF);
 *   - a variation selector (U+FE00–FE0F) that follows another one.
 * Changed:
 *   - CR LF and CR become LF; U+2028 and U+2029 become LF;
 *   - chat-template tokens lose their brackets: `<|im_start|>` becomes `|im_start|`,
 *     `[INST]` becomes `INST`.
 */
const TAGS = /(\u{1F3F4}[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]{1,6}\u{E007F})|[\u{E0000}-\u{E007F}]/gu;
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
const VARIATION_SUPPLEMENT = /[\u{E0100}-\u{E01EF}]/gu;
const INVISIBLE = /[\u2061-\u2064ᅟᅠ឴឵\u180Eㅤﾠ\uFFF9-\uFFFB]/g;
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const ZERO_WIDTH_RUN = /[\u200B-\u200D\u2060\uFEFF]{4,}/g;
const VARIATION_REPEAT = /([︀-️])[︀-️]+/g;
const TEMPLATE_TOKENS = [
	/<\s*([|｜][^<>\n]{1,40}?[|｜])\s*>/g,
	/\[\s*(\/?INST)\s*\]/g,
	/<<\s*(\/?SYS)\s*>>/g,
	/<\s*((?:start|end)_of_turn)\s*>/g
];

export function cleanText(input: string): string {
	let text = input.replace(TAGS, (_ch, flag?: string) => flag ?? '');
	text = text.replace(BIDI, '').replace(VARIATION_SUPPLEMENT, '').replace(VARIATION_REPEAT, '$1').replace(INVISIBLE, '');
	text = text.replace(/\r\n?|[\u2028\u2029]/g, '\n');
	text = text.replace(CONTROLS, '').replace(ZERO_WIDTH_RUN, '');
	for (const re of TEMPLATE_TOKENS) text = text.replace(re, '$1');
	return text;
}
