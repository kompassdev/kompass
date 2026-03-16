import { Eta } from "eta";

type TemplateData = Record<string, unknown>;

export function renderTemplate(
  template: string,
  components: Record<string, string>,
  data: TemplateData = {},
): string {
  const eta = new Eta({ autoEscape: false, autoTrim: false });

  for (const [name, content] of Object.entries(components)) {
    eta.loadTemplate(`@${name}`, content);
  }

  return eta.renderString(template, data) ?? "";
}
