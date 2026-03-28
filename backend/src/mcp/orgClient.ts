import { config } from '../config.js';

type OrgToolResult = { content: { type: string; text: string }[]; isError?: boolean };

let _requestId = 1;

export async function callOrgTool(
  tool: string,
  args: Record<string, unknown> = {},
): Promise<OrgToolResult> {
  const { url, secret } = config.mcpOrg;
  if (!secret) {
    return { content: [{ type: 'text', text: 'MCP_ORG_SECRET not configured' }], isError: true };
  }

  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: tool, arguments: args },
    id: _requestId++,
  });

  try {
    const res = await fetch(`${url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body,
    });

    if (!res.ok) {
      return {
        content: [{ type: 'text', text: `mcp-org returned ${res.status}: ${await res.text()}` }],
        isError: true,
      };
    }

    const envelope = await res.json() as { result?: OrgToolResult; error?: { message: string } };
    if (envelope.error) {
      return { content: [{ type: 'text', text: `mcp-org error: ${envelope.error.message}` }], isError: true };
    }
    return envelope.result ?? { content: [{ type: 'text', text: 'empty response' }], isError: true };
  } catch (err) {
    return { content: [{ type: 'text', text: `Failed to reach mcp-org: ${String(err)}` }], isError: true };
  }
}
