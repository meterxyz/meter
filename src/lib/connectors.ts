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
  tools: ConnectorToolDef[];
}

export const CONNECTORS: ConnectorDef[] = [
  {
    id: "gmail",
    name: "Gmail",
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
    id: "porkbun",
    name: "Porkbun",
    iconPath:
      "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
    tools: [
      {
        type: "function",
        function: {
          name: "porkbun_search_domains",
          description: "Search for available domain names.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Domain name to search for",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "porkbun_register_domain",
          description: "Register a domain name through Porkbun.",
          parameters: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "Full domain name to register (e.g. example.com)",
              },
            },
            required: ["domain"],
          },
        },
      },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
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
