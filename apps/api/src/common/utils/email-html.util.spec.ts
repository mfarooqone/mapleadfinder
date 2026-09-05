import {
  htmlToPlainText,
  isHtmlEmailBody,
  summarizeEmailBody,
} from './email-html.util';

describe('email-html.util', () => {
  it('detects full HTML email documents', () => {
    expect(
      isHtmlEmailBody(
        '<!DOCTYPE html><html><body><table><tr><td>Hello</td></tr></table></body></html>',
      ),
    ).toBe(true);
  });

  it('detects table-based marketing markup without doctype', () => {
    expect(
      isHtmlEmailBody(
        '<table role="presentation"><tr><td style="color:#fff">Hi</td></tr></table>',
      ),
    ).toBe(true);
  });

  it('treats plain outreach copy as non-html', () => {
    expect(
      isHtmlEmailBody('Hi {{firstName}},\n\nQuick question about {{website}}.'),
    ).toBe(false);
  });

  it('strips tags for plain-text fallback', () => {
    const plain = htmlToPlainText(
      '<div>Hello <strong>{{name}}</strong></div><p>See you soon.</p>',
    );
    expect(plain).toContain('Hello {{name}}');
    expect(plain).toContain('See you soon.');
    expect(plain).not.toContain('<div>');
  });

  it('summarizes html without dumping markup', () => {
    const summary = summarizeEmailBody(
      '<html><body><h1>Supplier sourcing</h1><p>GCC procurement teams</p></body></html>',
      80,
    );
    expect(summary.toLowerCase()).toContain('supplier sourcing');
    expect(summary).not.toContain('<h1>');
  });
});
