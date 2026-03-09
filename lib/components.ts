export function parseComponentParams(paramString: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!paramString) return params;

  // Match key="value" or key='value' patterns
  const regex = /(\w+)=["']([^"']*)["']/g;
  let match;
  while ((match = regex.exec(paramString)) !== null) {
    params[match[1]] = match[2];
  }
  return params;
}

export function embedComponents(
  template: string,
  components: Record<string, string>,
): string {
  // Match {{component-name}} or {{component-name param1="value1" param2="value2"}}
  return template.replace(/\{\{([\w-]+)(\s+[^}]+)?\}\}/g, (match, name, paramsStr) => {
    const component = components[name];
    if (!component) return match;

    const params = parseComponentParams(paramsStr || "");

    // Replace {{param:key}} placeholders in component content
    return component.replace(/\{\{param:(\w+)\}\}/g, (paramMatch, paramName) => {
      return params[paramName] !== undefined ? params[paramName] : paramMatch;
    });
  });
}
