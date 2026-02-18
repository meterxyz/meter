/* ─── Connector definitions ────────────────────────────────────── */

export interface ConnectorToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ConnectorDef {
  id: string;
  name: string;
  /** SVG path data for the icon (rendered in a 24×24 viewBox) */
  iconPath: string;
  connectionType: "oauth" | "api_key";
  description: string;
  tools: ConnectorToolDef[];
}

export const CONNECTORS: ConnectorDef[] = [
  {
    id: "gmail",
    name: "Gmail",
    connectionType: "oauth",
    description: "Read-only access to emails for invoice tracking",
    iconPath:
      "M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z",
    tools: [
      {
        type: "function",
        function: {
          name: "search_emails",
          description:
            "Search the user's Gmail inbox. Use when they ask about emails, receipts, or messages.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query for Gmail" },
              max_results: {
                type: "number",
                description: "Max results to return (default 5)",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "read_email",
          description: "Read the full content of a specific email by ID.",
          parameters: {
            type: "object",
            properties: {
              email_id: { type: "string", description: "The email message ID" },
            },
            required: ["email_id"],
          },
        },
      },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    connectionType: "oauth",
    description: "Create repos, file issues, and list projects",
    iconPath:
      "M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z",
    tools: [
      {
        type: "function",
        function: {
          name: "github_create_repo",
          description: "Create a new GitHub repository.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Repository name" },
              description: {
                type: "string",
                description: "Repository description",
              },
              private: {
                type: "boolean",
                description: "Whether the repo is private",
              },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "github_list_repos",
          description: "List the user's GitHub repositories.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "github_create_issue",
          description: "Create an issue on a GitHub repository.",
          parameters: {
            type: "object",
            properties: {
              repo: {
                type: "string",
                description: "Repository in owner/name format",
              },
              title: { type: "string", description: "Issue title" },
              body: { type: "string", description: "Issue body (markdown)" },
            },
            required: ["repo", "title"],
          },
        },
      },
    ],
  },
  {
    id: "vercel",
    name: "Vercel",
    connectionType: "oauth",
    description: "Trigger deploys and check deployment status",
    iconPath: "M12 2L2 19.5h20L12 2z",
    tools: [
      {
        type: "function",
        function: {
          name: "vercel_deploy",
          description:
            "Trigger a deployment on Vercel for a project.",
          parameters: {
            type: "object",
            properties: {
              project: {
                type: "string",
                description: "Vercel project name or ID",
              },
            },
            required: ["project"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "vercel_list_deployments",
          description: "List recent deployments for a Vercel project.",
          parameters: {
            type: "object",
            properties: {
              project: {
                type: "string",
                description: "Vercel project name or ID",
              },
            },
            required: ["project"],
          },
        },
      },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    connectionType: "oauth",
    description: "View payments, balances, and active subscriptions",
    iconPath:
      "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.918 3.757 7.11c0 4.46 2.72 5.876 5.664 6.957 1.882.69 2.532 1.187 2.532 1.97 0 .937-.793 1.467-2.212 1.467-1.901 0-4.847-.876-6.838-2.032l-.89 5.572C3.531 22.062 6.283 23 9.59 23c2.605 0 4.735-.636 6.234-1.855 1.649-1.339 2.419-3.225 2.419-5.548.007-4.579-2.755-5.939-5.267-6.947z",
    tools: [
      {
        type: "function",
        function: {
          name: "stripe_list_payments",
          description: "List recent payments and charges from Stripe.",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Max results to return (default 10)",
              },
              status: {
                type: "string",
                description: "Filter by status: succeeded, pending, failed",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "stripe_get_balance",
          description: "Get current Stripe account balance and pending amounts.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "stripe_list_subscriptions",
          description: "List active subscriptions and their billing details.",
          parameters: {
            type: "object",
            properties: {
              status: {
                type: "string",
                description: "Filter by status: active, canceled, past_due, all",
              },
            },
          },
        },
      },
    ],
  },
  {
    id: "mercury",
    name: "Mercury",
    connectionType: "api_key",
    description: "Read-only access to balances and transactions",
    iconPath:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z",
    tools: [
      {
        type: "function",
        function: {
          name: "mercury_get_accounts",
          description: "List Mercury bank accounts with balances.",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "mercury_list_transactions",
          description: "List recent transactions from Mercury bank account.",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Max results to return (default 10)",
              },
              account_id: {
                type: "string",
                description: "Mercury account ID to query",
              },
            },
          },
        },
      },
    ],
  },
  {
    id: "ramp",
    name: "Ramp",
    connectionType: "api_key",
    description: "View card transactions and spending breakdowns",
    iconPath:
      "M3 3h18v18H3V3zm2 2v14h14V5H5zm2 4h10v2H7V9zm0 4h7v2H7v-2z",
    tools: [
      {
        type: "function",
        function: {
          name: "ramp_list_transactions",
          description: "List recent Ramp card transactions and expenses.",
          parameters: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Max results to return (default 10)",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "ramp_get_spending_summary",
          description: "Get spending summary and category breakdown from Ramp.",
          parameters: {
            type: "object",
            properties: {
              period: {
                type: "string",
                description: "Time period: this_month, last_month, this_quarter",
              },
            },
          },
        },
      },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    connectionType: "api_key",
    description: "Run read-only queries against your database",
    iconPath:
      "M17.99 2.2c.46-.53-.03-1.3-.7-1.2l-13.3 1.7c-.52.07-.9.5-.9 1.03v8.27c0 .7.81 1.08 1.3.6l3.2-3.1c.3-.3.77-.3 1.07 0l3.77 3.77c.3.3.77.3 1.07 0L17.99 8.8V2.2zM6.01 21.8c-.46.53.03 1.3.7 1.2l13.3-1.7c.52-.07.9-.5.9-1.03v-8.27c0-.7-.81-1.08-1.3-.6l-3.2 3.1c-.3.3-.77.3-1.07 0l-3.77-3.77c-.3-.3-.77-.3-1.07 0L6.01 15.2v6.6z",
    tools: [
      {
        type: "function",
        function: {
          name: "supabase_query",
          description:
            "Run a read-only SQL query against the user's Supabase database.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "SQL query to execute" },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "supabase_list_tables",
          description: "List all tables in the user's Supabase database.",
          parameters: { type: "object", properties: {} },
        },
      },
    ],
  },
];

/** Get a connector definition by id */
export function getConnector(id: string): ConnectorDef | undefined {
  return CONNECTORS.find((c) => c.id === id);
}
