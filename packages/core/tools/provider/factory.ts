import type { Shell, ToolExecutionContext } from "../shared.ts";
import { createGitHubProvider } from "./github.ts";
import { createJiraProvider } from "./jira.ts";
import { TicketProviderName } from "./interface.ts";
import type {
  TicketLoadArgs,
  TicketProvider,
  TicketSyncArgs,
} from "./interface.ts";

class TicketProviderChain implements TicketProvider {
  readonly name: TicketProviderName;
  private readonly providers: TicketProvider[];

  constructor(providers: TicketProvider[], preferred: TicketProviderName) {
    this.providers = providers;
    this.name = preferred;
  }

  canLoad(source: string) {
    return this.providers.some((provider) => provider.canLoad(source));
  }

  canSync(refUrl?: string) {
    return this.providers.some((provider) => provider.canSync(refUrl));
  }

  async load(args: TicketLoadArgs, context: ToolExecutionContext) {
    const provider = this.providers.find((candidate) => candidate.canLoad(args.source))
      ?? this.providers.find((candidate) => candidate.name === TicketProviderName.GitHub);
    if (!provider) throw new Error(`No ticket provider can load source: ${args.source}`);
    return provider.load(args, context);
  }

  async sync(args: TicketSyncArgs, context: ToolExecutionContext) {
    const provider = this.providers.find((candidate) => candidate.canSync(args.refUrl));
    if (!provider) throw new Error(`No ticket provider can sync reference: ${args.refUrl}`);
    return provider.sync(args, context);
  }
}

export function createTicketProviderChain($: Shell, preferred: TicketProviderName): TicketProvider {
  const github = createGitHubProvider($);
  const jira = createJiraProvider();
  const providers = preferred === TicketProviderName.Jira ? [jira, github] : [github, jira];
  return new TicketProviderChain(providers, preferred);
}
