export function getOpenCodeToolName(toolName: string) {
  return toolName.startsWith("kompass_") ? toolName : `kompass_${toolName}`;
}

export function prefixKompassToolReferences(input: string, toolNames: string[]) {
  let output = input;

  for (const toolName of toolNames) {
    const prefixedToolName = getOpenCodeToolName(toolName);
    const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replaceAll(
      new RegExp(`(?<![A-Za-z0-9_])${escapedToolName}(?![A-Za-z0-9_])`, "g"),
      prefixedToolName,
    );
  }

  return output;
}
