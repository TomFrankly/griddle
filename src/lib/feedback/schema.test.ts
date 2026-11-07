import { describe, expect, it } from 'vitest';
import { feedbackBlocks, feedbackHasContent, feedbackMessage, schema } from './schema';

const doc = schema.node('doc', null, [
	schema.node('paragraph', null, [schema.text('The '), schema.text('export', [schema.marks.bold.create()]), schema.text(' is blank')]),
	schema.nodes.image.create({ src: 'data:image/png;base64,AAA', about: 'Picked: <button> · "Download"' }),
	schema.node('paragraph'),
	schema.nodes.image.create({ src: 'data:image/png;base64,BBB' })
]);

describe('feedback message', () => {
	it('turns the box into text with numbered screenshots', () => {
		expect(feedbackMessage(doc)).toEqual({
			text: 'The **export** is blank\n[Screenshot 1]\nPicked: <button> · "Download"\n\n[Screenshot 2]',
			images: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB']
		});
	});

	it('makes Notion blocks with pictures pointing at their attachments', () => {
		const blocks = feedbackBlocks(doc, [0, null]);
		expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'image', 'code']);
		expect(blocks[0]).toEqual({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{ type: 'text', text: { content: 'The ' } },
					{ type: 'text', text: { content: 'export' }, annotations: { bold: true } },
					{ type: 'text', text: { content: ' is blank' } }
				]
			}
		});
		expect(blocks[1]).toEqual({ type: 'image', image: { type: 'file_upload', file_upload: { id: 'attachment:0' } } });
	});

	it('counts a picture alone as content', () => {
		expect(feedbackHasContent(schema.node('doc', null, [schema.node('paragraph')]))).toBe(false);
		expect(feedbackHasContent(schema.node('doc', null, [schema.nodes.image.create({ src: 'data:x' })]))).toBe(true);
	});
});
