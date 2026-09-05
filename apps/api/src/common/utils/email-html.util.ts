export function isHtmlEmailBody(content: string): boolean {
  const sample = content.slice(0, 4000).toLowerCase();
  if (
    sample.includes('<!doctype html') ||
    sample.includes('<html') ||
    sample.includes('<body')
  ) {
    return true;
  }

  return /<(table|div|td|tr|style|center|img|h[1-6]|p|a)\b/.test(sample);
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function summarizeEmailBody(content: string, maxLength = 180): string {
  const plain = isHtmlEmailBody(content)
    ? htmlToPlainText(content)
    : content.trim();
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength - 1)}…`;
}
