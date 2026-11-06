import type { ExportFormat } from './render';

export const FILE_EXT: Record<ExportFormat | 'psd', string> = { png: 'png', jpeg: 'jpg', webp: 'webp', psd: 'psd' };

/**
 * Turns what someone typed into a safe download name without an extension.
 * Drops characters that file systems reject, a typed export extension, and
 * leading or trailing dots and spaces. Returns '' when nothing usable is left.
 */
export function safeFileName(input: string): string {
	return input
		.normalize('NFC')
		.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '-')
		.replace(/\.(png|jpe?g|webp|psd|zip)$/i, '')
		.replace(/^[\s.]+|[\s.]+$/g, '')
		.slice(0, 120)
		.trim();
}
