import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerTaskTools } from "./tools/tasks.js"; 
import { logger, requestIdMiddleware } from "./observability/logger.js";
import { protectedResourceMetadata } from "./auth/prm.js";
import { requireBearerToken } from "./auth/verifier.js";
import "dotenv/config";

const PORT = Number(process.env.PORT ?? 3333);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(requestIdMiddleware);

// This handles BOTH GET and HEAD methods instantly
app.use("/", (req, res, next) => {
  if (req.path !== '/') return next(); // Only handle the exact root path
  res.status(200).send("MCP server is running");
});

// RFC 9728 — Protected Resource Metadata. Anonymous, must be reachable.
app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);

// Map of sessionId → transport. Streamable HTTP is stateful by default.
const transports = new Map<string, StreamableHTTPServerTransport>();

app.all("/mcp", requireBearerToken, async (req, res) => {
  const sessionHeader = req.header("mcp-session-id");
  let transport = sessionHeader ? transports.get(sessionHeader) : undefined;

  if (!transport && req.method === "POST" && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      // onsessioninitialized: (sid) => transports.set(sid, transport!),
      onsessioninitialized: (sid) => { transports.set(sid, transport!); },
      enableDnsRebindingProtection: false,
      allowedHosts: [`localhost:${PORT}`, `127.0.0.1:${PORT}`, 'onrender.com' , 'test-nodejs-app-1.onrender.com'],
      allowedOrigins: ["https://claude.ai", "https://app.cursor.com", "*.salesforce.com"],
    });
    transport.onclose = () => {
      if (transport!.sessionId) transports.delete(transport!.sessionId);
    };
    const server = new McpServer({ name: "tasks", version: "0.1.0" });
    registerTaskTools(server);
    await server.connect(transport);
  }

  if (!transport) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "No active session for this request" },
      id: null,
    });
    return;
  }

  // await transport.handleRequest(req, res, req.body);
  await transport.handleRequest(req as any, res, req.body);
});

app.listen(PORT, () => {
    logger.info({ port: PORT, baseUrl: PUBLIC_BASE_URL }, "TEST mcp server listening TEST");
});