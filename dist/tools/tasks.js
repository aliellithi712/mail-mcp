import { z } from "zod";
const tasks = [];
function requireScope(authInfo, scope) {
    if (!authInfo?.scopes?.includes(scope)) {
        throw new Error(`Forbidden: missing required scope "${scope}"`);
    }
}
export function registerTaskTools(server) {
    server.registerTool("list_tasks", {
        title: "List tasks",
        description: "List tasks owned by the authenticated user.",
        inputSchema: { includeDone: z.boolean().optional().default(false) },
    }, async ({ includeDone }, { authInfo }) => {
        requireScope(authInfo, "tasks:read");
        const sub = authInfo?.extra?.sub ?? "";
        const mine = tasks.filter((t) => t.ownerSub === sub && (includeDone || !t.done));
        return {
            content: [{ type: "text", text: JSON.stringify(mine, null, 2) }],
        };
    });
    server.registerTool("create_task", {
        title: "Create task",
        description: "Create a new task owned by the authenticated user.",
        inputSchema: { title: z.string().min(1).max(140) },
    }, async ({ title }, { authInfo }) => {
        requireScope(authInfo, "tasks:write");
        const sub = authInfo?.extra?.sub ?? "";
        const task = {
            id: crypto.randomUUID(),
            title,
            done: false,
            ownerSub: sub,
        };
        tasks.push(task);
        return { content: [{ type: "text", text: JSON.stringify(task) }] };
    });
    server.registerTool("complete_task", {
        title: "Mark task complete",
        description: "Mark a task complete by id.",
        inputSchema: { id: z.string().uuid() },
    }, async ({ id }, { authInfo }) => {
        requireScope(authInfo, "tasks:write");
        const sub = authInfo?.extra?.sub ?? "";
        const task = tasks.find((t) => t.id === id && t.ownerSub === sub);
        if (!task)
            throw new Error("Task not found");
        task.done = true;
        return { content: [{ type: "text", text: JSON.stringify(task) }] };
    });
}
