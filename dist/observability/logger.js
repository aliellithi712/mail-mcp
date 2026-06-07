import pino from "pino";
import { randomUUID } from "node:crypto";
export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    transport: process.env.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss.l" } },
    base: { service: "mcp-tasks-server" },
});
export function requestIdMiddleware(req, res, next) {
    const requestId = req.header("x-request-id") ?? randomUUID();
    req.requestId = requestId;
    req.log = logger.child({ requestId });
    res.setHeader("x-request-id", requestId);
    const started = process.hrtime.bigint();
    res.on("finish", () => {
        const latencyMs = Number(process.hrtime.bigint() - started) / 1_000_000;
        req.log.info({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            latencyMs: Math.round(latencyMs * 100) / 100,
            clientId: req.auth?.clientId,
            userSub: req.auth?.extra?.sub,
        }, "request");
    });
    next();
}
