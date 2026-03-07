import { createChangesLoadTool } from "./changes-load.ts";
import { createPrLoadTool } from "./pr-load.ts";
import { createTicketCreateTool } from "./ticket-create.ts";
import { createTicketLoadTool } from "./ticket-load.ts";
import type { Shell } from "./shared.ts";

export function createTools($: Shell) {
  return {
    changes_load: createChangesLoadTool($),
    pr_load: createPrLoadTool($),
    ticket_load: createTicketLoadTool($),
    ticket_create: createTicketCreateTool($),
  };
}
