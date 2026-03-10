export function getOpenCodeToolName(toolName: string) {
  return toolName.startsWith("kompass_") ? toolName : `kompass_${toolName}`;
}

export function getConfiguredOpenCodeToolName(
  toolName: string,
  configuredName?: string,
) {
  return configuredName ?? getOpenCodeToolName(toolName);
}

export function prefixKompassToolReferences(
  input: string,
  toolNames: Record<string, string>,
) {
  let output = input;

  for (const [toolName, resolvedToolName] of Object.entries(toolNames)) {
    const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replaceAll(
      new RegExp(`(?<![A-Za-z0-9_])${escapedToolName}(?![A-Za-z0-9_])`, "g"),
      resolvedToolName,
    );
  }

  return output;
}
