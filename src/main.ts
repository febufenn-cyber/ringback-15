import type { Env } from "./config.js";
import { dispatchDue, handleRequest } from "./worker.js";

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  scheduled(_controller: unknown, env: Env, context: ExecutionContextLike): void {
    context.waitUntil(dispatchDue(env));
  },
};
