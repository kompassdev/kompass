import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { stringifyJson, type ToolExecutionContext } from "../shared.ts";
import {
  renderTicketBody,
  type TicketLoadArgs,
  type TicketProvider,
  type TicketSyncArgs,
} from "./interface.ts";
import { TicketProviderName } from "./interface.ts";

type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey?: string;
};

type JiraContext = Pick<ToolExecutionContext, "directory">;

async function loadEnv(filePath: string): Promise<Record<string, string>> {
  try {
    const content = await readFile(filePath, "utf8");
    return Object.fromEntries(
      content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          return separator < 0
            ? [line, ""]
            : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

async function getJiraConfig(context: JiraContext): Promise<JiraConfig> {
  const env = await loadEnv(path.join(context.directory, ".opencode/tools/jira/.env"));
  const baseUrl = process.env.JIRA_BASE_URL || env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL || env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN || env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY || env.JIRA_PROJECT_KEY;

  if (!baseUrl || !email || !apiToken) {
    throw new Error(
      "Missing JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN. Configure them in .opencode/tools/jira/.env or the environment.",
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), email, apiToken, projectKey };
}

function authHeader(config: JiraConfig) {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
}

async function requestJira(
  config: JiraConfig,
  endpoint: string,
  options: RequestInit = {},
) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", authHeader(config));
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${config.baseUrl}/rest/api/3${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Jira API ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export function isJiraIssueInput(input: string) {
  try {
    const url = new URL(input);
    return /\/browse\/[^/]+-\d+/.test(url.pathname);
  } catch {
    return /^[A-Z][A-Z0-9_]*-\d+$/i.test(input.trim());
  }
}

export function parseJiraIssueKey(input: string) {
  try {
    const parts = new URL(input).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? "";
  } catch {
    return input.trim();
  }
}

export function textFromAdf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === "string") return node.text;
  const content = node.content;
  if (!Array.isArray(content)) return null;
  return content.map((item) => textFromAdf(item)).filter(Boolean).join("") || null;
}

function toAdf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

async function saveAttachments(
  config: JiraConfig,
  attachments: Array<{ id?: string; filename?: string; content?: string }>,
  context: JiraContext,
) {
  const directory = path.resolve(context.directory, ".opencode/files");
  await mkdir(directory, { recursive: true });

  return Promise.all(attachments.map(async (attachment) => {
    if (!attachment.content || !attachment.id) return { ...attachment, skipped: true };
    const response = await fetch(attachment.content, {
      headers: { Authorization: authHeader(config) },
    });
    if (!response.ok) return { ...attachment, skipped: true, reason: `download failed ${response.status}` };

    const filename = (attachment.filename ?? attachment.id).replace(/[^A-Za-z0-9._-]+/g, "-");
    const storedName = `jira-${attachment.id}-${filename}`;
    await writeFile(path.join(directory, storedName), Buffer.from(await response.arrayBuffer()));
    return { ...attachment, relativePath: path.join(".opencode/files", storedName) };
  }));
}

async function loadJiraTicket(source: string, context: JiraContext, includeComments = false) {
  if (!isJiraIssueInput(source)) {
    throw new Error("Unsupported Jira ticket source. Pass a full Jira issue URL or an issue key like PROJ-123.");
  }

  const config = await getJiraConfig(context);
  const key = parseJiraIssueKey(source);
  const issue = await requestJira(
    config,
    `/issue/${encodeURIComponent(key)}?fields=summary,description,labels,assignee,reporter,attachment,comment,created,updated,issuetype,status,priority`,
  );
  const fields = issue.fields ?? {};

  return stringifyJson({
    kind: "jira-issue",
    source: "jira",
    key,
    url: `${config.baseUrl}/browse/${key}`,
    title: fields.summary ?? null,
    description: textFromAdf(fields.description),
    issueType: fields.issuetype?.name ?? null,
    status: fields.status?.name ?? null,
    priority: fields.priority?.name ?? null,
    labels: fields.labels ?? [],
    assignee: fields.assignee ?? null,
    reporter: fields.reporter ?? null,
    attachments: await saveAttachments(config, fields.attachment ?? [], context),
    comments: includeComments ? fields.comment?.comments ?? [] : undefined,
    createdAt: fields.created ?? null,
    updatedAt: fields.updated ?? null,
  });
}

async function syncJiraTicket(args: TicketSyncArgs, context: JiraContext) {
  const config = await getJiraConfig(context);
  const body = renderTicketBody(args);
  const labels = (args.labels ?? []).map((label) => label.trim()).filter(Boolean);
  const assignees = (args.assignees ?? []).map((assignee) => assignee.trim()).filter(Boolean);

  if (assignees.length > 1) {
    throw new Error("Jira supports one assignee per issue; pass a single Jira account ID");
  }

  if (args.refUrl) {
    if (!isJiraIssueInput(args.refUrl)) {
      throw new Error("Unsupported Jira ticket reference. Pass a full Jira issue URL or an issue key.");
    }

    const key = parseJiraIssueKey(args.refUrl);
    const fields: Record<string, unknown> = {};
    if (args.title?.trim()) fields.summary = args.title.trim();
    if (body) fields.description = toAdf(body);
    if (args.labels) fields.labels = labels;
    if (assignees[0]) fields.assignee = { accountId: assignees[0] };
    if (!Object.keys(fields).length && !args.comments?.some((comment) => comment.trim())) {
      throw new Error("ticket_sync requires title, body, description, labels, or comments when updating a Jira issue");
    }
    if (Object.keys(fields).length) {
      await requestJira(config, `/issue/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ fields }),
      });
    }
    for (const comment of args.comments ?? []) {
      if (comment.trim()) {
        await requestJira(config, `/issue/${encodeURIComponent(key)}/comment`, {
          method: "POST",
          body: JSON.stringify({ body: toAdf(comment.trim()) }),
        });
      }
    }
    return stringifyJson({ source: "jira", key, url: `${config.baseUrl}/browse/${key}` });
  }

  if (!args.title?.trim()) throw new Error("ticket_sync requires title when creating a Jira issue");
  if (!body) throw new Error("ticket_sync requires body or description when creating a Jira issue");
  const projectKey = args.projectKey ?? config.projectKey;
  if (!projectKey) throw new Error("Missing Jira project key. Set JIRA_PROJECT_KEY or pass projectKey.");

  const issue = await requestJira(config, "/issue", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary: args.title.trim(),
        description: toAdf(body),
        issuetype: { name: "Task" },
        ...(args.labels ? { labels } : {}),
        ...(assignees[0] ? { assignee: { accountId: assignees[0] } } : {}),
      },
    }),
  });
  const key = issue.key;
  for (const comment of args.comments ?? []) {
    if (comment.trim()) {
      await requestJira(config, `/issue/${encodeURIComponent(key)}/comment`, {
        method: "POST",
        body: JSON.stringify({ body: toAdf(comment.trim()) }),
      });
    }
  }
  return stringifyJson({ source: "jira", key, id: issue.id, url: `${config.baseUrl}/browse/${key}` });
}

export function createJiraProvider(): TicketProvider {
  return {
    name: TicketProviderName.Jira,
    canLoad: isJiraIssueInput,
    canSync: (refUrl) => !refUrl || isJiraIssueInput(refUrl),
    load: (args: TicketLoadArgs, context) => loadJiraTicket(args.source, context, args.comments),
    sync: syncJiraTicket,
  };
}
