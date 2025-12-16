import { createApp } from './app.js';
import type { Bindings } from './types.js';

let cachedApp: Awaited<ReturnType<typeof createApp>> | undefined;
let cachedEnv: Bindings | undefined;

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    if (!cachedApp || cachedEnv !== env) {
      cachedEnv = env;
      cachedApp = await createApp(env);
    }

    return cachedApp.handle(request);
  },
};
