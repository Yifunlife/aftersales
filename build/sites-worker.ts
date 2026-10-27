import {captureAnalysisReviews} from '../lib/problem-analysis.mjs';
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async scheduled(_event: ScheduledController, env: Cloudflare.Env, _ctx: ExecutionContext) { await captureAnalysisReviews(env.DB); },
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Public Workers must never trust identity headers supplied by a client.
    if ((env as any).STANDALONE_CLOUDFLARE === "true") {
      const headers = new Headers(request.headers);
      for (const name of [...headers.keys()]) {
        if (name.toLowerCase().startsWith("oai-authenticated-user-")) headers.delete(name);
      }
      request = new Request(request, { headers });
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

// Only Workers explicitly bound to this named entrypoint can fetch this projection.
// The public application handler above does not expose this endpoint.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { reportingSnapshot } from '../lib/reporting.mjs';
export class AftersalesReporting extends WorkerEntrypoint<Cloudflare.Env> {
  async fetch(request: Request) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/snapshot') return new Response(null, {status:404});
    const body = JSON.stringify(await reportingSnapshot(this.env.DB));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const etag = '"'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')+'"';
    if (request.headers.get('If-None-Match') === etag) return new Response(null, {status:304,headers:{ETag:etag}});
    return new Response(body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store',ETag:etag}});
  }
}
