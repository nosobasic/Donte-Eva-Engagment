import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** Local dev: handle POST /api/rsvp using repo-root .env Google credentials */
export function rsvpApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: "rsvp-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (pathname !== "/api/rsvp") return next();

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        const keys = [
          "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          "GOOGLE_PRIVATE_KEY",
          "GOOGLE_SHEET_ID",
          "GOOGLE_SHEET_TAB",
        ] as const;
        for (const key of keys) {
          if (env[key]) process.env[key] = env[key];
        }

        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as Parameters<
            typeof import("../../lib/google-sheets-append.js").appendRsvpRow
          >[0];
          const { appendRsvpRow } = await import(
            "../../lib/google-sheets-append.js"
          );
          await appendRsvpRow(body);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              message: "RSVP received! We can't wait to celebrate with you.",
            }),
          );
        } catch (err) {
          console.error("[rsvp-api-dev]", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Failed to save your RSVP. Please try again.",
            }),
          );
        }
      });
    },
  };
}
