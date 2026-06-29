export function renderTemplateContent(
  content: string,
  variables?: Record<string, string>,
): string {
  if (!variables) {
    return content;
  }

  return content.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}

export function buildLeadTemplateVariables(
  leadName?: string | null,
): Record<string, string> {
  const fullName = leadName?.trim() || 'there';

  return {
    firstName: fullName,
    fullName,
    name: fullName,
  };
}
