// Mystira JWT verification config.
// Set exactly one of MYSTIRA_JWT_SECRET (HS256) or MYSTIRA_JWT_PUBLIC_KEY (RS256 PEM).
// Falls back to the well-known dev secret when neither is set — never use in production.

const DEV_SECRET = 'DevSecret-StableKey-ForLocalDevelopmentOnly-2024';

export const config = {
  mystira: {
    jwtSecret: process.env.MYSTIRA_JWT_SECRET || (process.env.NODE_ENV !== 'production' ? DEV_SECRET : undefined),
    jwtPublicKey: process.env.MYSTIRA_JWT_PUBLIC_KEY || undefined,
    issuer: process.env.MYSTIRA_JWT_ISSUER || 'mystira-identity-api',
    audience: process.env.MYSTIRA_JWT_AUDIENCE || 'mystira-platform',
  },
  mcpOrg: {
    url: process.env.MCP_ORG_URL ?? 'https://mcp-org-production.up.railway.app',
    secret: process.env.MCP_ORG_SECRET,
  },
} as const;

if (process.env.NODE_ENV === 'production') {
  if (!config.mystira.jwtSecret && !config.mystira.jwtPublicKey) {
    console.error('[config] MYSTIRA_JWT_SECRET or MYSTIRA_JWT_PUBLIC_KEY must be set in production');
    process.exit(1);
  }
}
