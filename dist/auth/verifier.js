import { createRemoteJWKSet, jwtVerify } from "jose";
const OAUTH_ISSUER = process.env.OAUTH_ISSUER;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3333";
const RESOURCE_URL = `${PUBLIC_BASE_URL}/mcp`;
const JWKS = createRemoteJWKSet(new URL(`${OAUTH_ISSUER}.well-known/jwks.json`));
export async function requireBearerToken(req, res, next) {
    const header = req.header("authorization") ?? "";
    if (!header.toLowerCase().startsWith("bearer ")) {
        return unauthorized(res, "missing_bearer_token");
    }
    const token = header.slice("bearer ".length);
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: OAUTH_ISSUER,
            audience: RESOURCE_URL,
        });
        const scopes = typeof payload.scope === "string" ? payload.scope.split(" ") : [];
        req.auth = {
            token,
            clientId: typeof payload.azp === "string"
                ? payload.azp
                : typeof payload.client_id === "string"
                    ? payload.client_id
                    : undefined,
            scopes,
            expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
            extra: {
                sub: typeof payload.sub === "string" ? payload.sub : undefined,
                iss: typeof payload.iss === "string" ? payload.iss : undefined,
            },
        };
        next();
    }
    catch (err) {
        return unauthorized(res, "invalid_token", err.message);
    }
}
function unauthorized(res, code, description) {
    // RFC 9728 requires the WWW-Authenticate challenge to point at the PRM.
    res
        .status(401)
        .set("WWW-Authenticate", `Bearer realm="mcp", error="${code}", resource_metadata="${process.env.PUBLIC_BASE_URL ?? "http://localhost:3333"}/.well-known/oauth-protected-resource"${description ? `, error_description="${description}"` : ""}`)
        .json({ error: code, error_description: description });
}
