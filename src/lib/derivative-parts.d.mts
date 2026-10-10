export function parseThreadParts(content?: string): Array<{ label: string; text: string }>;
export function parseIgParts(content?: string): { caption: string; tags: string[] };
export function igCaptionWithTags(content?: string): string;
