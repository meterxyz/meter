import { getSupabaseServer } from "@/lib/supabase";
import { CONNECTORS, ConnectorToolDef } from "@/lib/connectors";

/* ─── Tool schemas (OpenAI function-calling format) ─────────────── */

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/** Built-in tools — always available regardless of connectors */
export const BUILTIN_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information. Use when the user asks about current events, recent data, prices, news, documentation, or anything that may have changed recently.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_datetime",
      description:
        "Get the current date and time. Use when the user asks about today's date, what day it is, or needs temporal context.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "save_decision",
      description:
        "Save a decision or recommendation so the user can track it. Use when the user makes a choice, reaches a conclusion, or asks for a recommendation they should remember.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short title for the decision" },
          choice: { type: "string", description: "The chosen option or recommendation" },
          alternatives: {
            type: "array",
            items: { type: "string" },
            description: "Other options that were considered",
          },
          reasoning: { type: "string", description: "Why this choice was made" },
        },
        required: ["title", "choice"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_decisions",
      description:
        "List all saved decisions for the user. Use when they ask about previous decisions or want to review past choices.",
      parameters: { type: "object", properties: {} },
    },
  },
];

/** For backwards compat — all built-in tools */
export const TOOL_DEFINITIONS = BUILTIN_TOOLS;

/**
 * Build the full tool list: built-in tools + tools from connected services.
 */
export function getToolsForConnectors(connectedIds: string[]): ToolDef[] {
  const connectorTools: ToolDef[] = [];
  for (const id of connectedIds) {
    const connector = CONNECTORS.find((c) => c.id === id);
    if (connector) {
      connectorTools.push(...(connector.tools as ToolDef[]));
    }
  }
  return [...BUILTIN_TOOLS, ...connectorTools];
}

/* ─── System prompt ─────────────────────────────────────────────── */

export function buildSystemPrompt(connectedIds: string[]): string {
  const connectorLines = connectedIds
    .map((id) => {
      const c = CONNECTORS.find((conn) => conn.id === id);
      if (!c) return null;
      return c.tools
        .map((t) => `- ${t.function.name}: ${t.function.description}`)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n");

  const connectorSection = connectorLines
    ? `\n\nConnected services:\n${connectorLines}`
    : "";

  return `You are Meter — an AI assistant that can search the web, track decisions, and help users build things.

You have tools. Use them:
- web_search: Search the web for anything current — news, docs, prices, APIs, etc. Use this proactively when questions touch on recent events or data you're unsure about.
- save_decision: Log important decisions when the user makes a choice or asks you to recommend something. This helps them track what was decided and why.
- list_decisions: Recall past decisions when the user asks "what did we decide" or references earlier choices.
- get_current_datetime: Know what day/time it is.${connectorSection}

Be direct and concise. Write in plain prose — avoid bullet lists and bold text unless truly necessary. Use short paragraphs instead of lists. When citing search results, mention the source. Don't apologize for using tools — just use them when they'll help.`;
}

export const SYSTEM_PROMPT = buildSystemPrompt([]);

/* ─── Tool execution ────────────────────────────────────────────── */

interface ToolContext {
  userId?: string;
  projectId?: string;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case "web_search":
      return webSearch(args.query as string);
    case "get_current_datetime":
      return getCurrentDatetime();
    case "save_decision":
      return saveDecision(args, ctx);
    case "list_decisions":
      return listDecisions(ctx);
    // Connector tools — placeholder implementations
    case "search_emails":
    case "read_email":
    case "github_create_repo":
    case "github_list_repos":
    case "github_create_issue":
    case "vercel_deploy":
    case "vercel_list_deployments":
    case "stripe_list_payments":
    case "stripe_get_balance":
    case "stripe_list_subscriptions":
    case "mercury_get_accounts":
    case "mercury_list_transactions":
    case "ramp_list_transactions":
    case "ramp_get_spending_summary":
    case "supabase_query":
    case "supabase_list_tables":
      return `[${name}] This connector tool is not yet implemented. The service needs to be fully connected first.`;
    default:
      return `Unknown tool: ${name}`;
  }
}

/* ── web_search ────────────────────────────────────────────────── */

async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return "Web search is not configured (BRAVE_SEARCH_API_KEY missing). Answer from your training data instead.";
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) return `Search failed (${res.status}). Answer from your training data instead.`;

    const data = await res.json();
    const results = (data.web?.results ?? []) as {
      title: string;
      url: string;
      description: string;
    }[];

    if (results.length === 0) return "No results found.";

    return results
      .map((r) => `**${r.title}**\n${r.url}\n${r.description}`)
      .join("\n\n");
  } catch (err) {
    return `Search error: ${(err as Error).message}. Answer from your training data instead.`;
  }
}

/* ── get_current_datetime ──────────────────────────────────────── */

function getCurrentDatetime(): string {
  const now = new Date();
  return [
    `Date: ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
    `Time: ${now.toLocaleTimeString("en-US")} UTC`,
    `ISO: ${now.toISOString()}`,
  ].join("\n");
}

/* ── save_decision ─────────────────────────────────────────────── */

async function saveDecision(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  try {
    const supabase = getSupabaseServer();
    const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await supabase.from("decisions").insert({
      id,
      user_id: ctx.userId || "anonymous",
      title: args.title as string,
      status: "decided",
      choice: args.choice as string,
      alternatives: args.alternatives || [],
      reasoning: (args.reasoning as string) || null,
      project_id: ctx.projectId || null,
    });

    return `Decision saved: "${args.title}" — ${args.choice}`;
  } catch (err) {
    return `Failed to save decision: ${(err as Error).message}`;
  }
}

/* ── list_decisions ────────────────────────────────────────────── */

async function listDecisions(ctx: ToolContext): Promise<string> {
  try {
    const supabase = getSupabaseServer();
    const { data } = await supabase
      .from("decisions")
      .select("*")
      .eq("user_id", ctx.userId || "anonymous")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data || data.length === 0) return "No decisions saved yet.";

    return data
      .map(
        (d: { title: string; choice?: string; reasoning?: string }) =>
          `- ${d.title}: ${d.choice || "undecided"}${d.reasoning ? ` (${d.reasoning})` : ""}`
      )
      .join("\n");
  } catch (err) {
    return `Failed to list decisions: ${(err as Error).message}`;
  }
}
