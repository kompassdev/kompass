import {
  stringifyJson,
  type Shell,
  type ToolDefinition,
  type ToolExecutionContext,
} from "./shared.ts";

export function createWorktreeLoadTool($: Shell) {
  return {
    description: "Load local git worktree state",
    args: {},
    async execute(_args: Record<string, never>, ctx: ToolExecutionContext) {
      const branchProc = await $`git branch --show-current`.cwd(ctx.worktree).quiet().nothrow();
      const headProc = await $`git rev-parse HEAD`.cwd(ctx.worktree).quiet().nothrow();
      const branch = branchProc.exitCode === 0 ? branchProc.text().trim() : "";
      const headOid = headProc.exitCode === 0 ? headProc.text().trim() : "";

      return stringifyJson({
        ...(branch ? { branch } : {}),
        ...(headOid ? { headOid } : {}),
        ...(headOid ? { isDetached: !branch } : {}),
      });
    },
  } satisfies ToolDefinition<Record<string, never>>;
}
