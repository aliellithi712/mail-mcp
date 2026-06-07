const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3333";
const AUTH_SERVER = process.env.OAUTH_ISSUER; // e.g. https://example.auth0.com/
export function protectedResourceMetadata(_req, res) {
    res.json({
        resource: `${PUBLIC_BASE_URL}/mcp`,
        authorization_servers: [AUTH_SERVER],
        bearer_methods_supported: ["header"],
        scopes_supported: ["tasks:read", "tasks:write"],
        resource_documentation: `${PUBLIC_BASE_URL}/docs`,
    });
}
