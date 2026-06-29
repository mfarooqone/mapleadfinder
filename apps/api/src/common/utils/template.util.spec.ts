import {
  buildLeadTemplateVariables,
  renderTemplateContent,
} from './template.util';

describe('template utilities', () => {
  it('renders the stored lead name without truncating it', () => {
    const variables = buildLeadTemplateVariables('Example Rehman Webs');

    expect(renderTemplateContent('Hi {{firstName}}', variables)).toBe(
      'Hi Example Rehman Webs',
    );
    expect(renderTemplateContent('Hi {{name}}', variables)).toBe(
      'Hi Example Rehman Webs',
    );
    expect(renderTemplateContent('Hi {{fullName}}', variables)).toBe(
      'Hi Example Rehman Webs',
    );
  });

  it('falls back to a friendly default when the lead name is missing', () => {
    const variables = buildLeadTemplateVariables('   ');

    expect(renderTemplateContent('Hi {{firstName}}', variables)).toBe(
      'Hi there',
    );
  });
});
