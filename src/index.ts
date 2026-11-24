import { enquiryText, validateEnquiry, type Enquiry } from "./enquiry.ts";

const MAX_BODY = 20_000;

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "cache-control": "no-store",
};

function log(outcome: string, extra: Record<string, string | number> = {}): void {
  console.log(JSON.stringify({ event: "enquiry", outcome, ...extra }));
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...SECURITY,
      ...extra,
    },
  });
}

function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function htmlPage(title: string, heading: string, message: string, status: number): Response {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title}</title>
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="stylesheet" href="/site.css" />
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<main id="main" class="page">
  <article class="prose">
    <p class="kicker">Zynlo</p>
    <h1>${heading}</h1>
    <p>${message}</p>
    <p><a class="btn-pill btn-primary" href="/uk#pilot">Back to the UK page</a></p>
    <p>Or email <a href="mailto:hello@zynlo.lk">hello@zynlo.lk</a> or WhatsApp <a href="https://wa.me/94723589231">+94 72 358 9231</a>.</p>
  </article>
</main>
</body>
</html>`;
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...SECURITY,
    },
  });
}

function fail(request: Request, status: number, error: string, heading: string): Response {
  if (wantsJson(request)) return json({ ok: false, error }, status);
  return htmlPage(`${heading} | Zynlo`, heading, error, status);
}

async function readFields(request: Request): Promise<Record<string, string> | Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return fail(request, 413, "That message is too long. Please shorten it and try again.", "Message too long");
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return fail(request, 413, "That message is too long. Please shorten it and try again.", "Message too long");
  }
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (type.includes("application/json")) {
      const data: unknown = JSON.parse(raw || "{}");
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return fail(request, 400, "We couldn't read that submission.", "Check the form");
      }
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") fields[key] = value;
      }
      return fields;
    }
    if (type.includes("application/x-www-form-urlencoded") || type === "") {
      const fields: Record<string, string> = {};
      for (const [key, value] of new URLSearchParams(raw)) fields[key] = value;
      return fields;
    }
  } catch {
    return fail(request, 400, "We couldn't read that submission.", "Check the form");
  }
  return fail(request, 415, "We couldn't read that submission.", "Check the form");
}

async function sendEnquiry(env: Env, value: Enquiry): Promise<"sent" | "missing" | "failed"> {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return "missing";
  const { subject, text } = enquiryText(value);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.ENQUIRY_FROM,
        to: [env.ENQUIRY_TO],
        reply_to: value.email,
        subject,
        text,
      }),
    });
    if (!response.ok) {
      let errorName = "unknown";
      try {
        const payload: unknown = await response.json();
        if (payload && typeof payload === "object" && "name" in payload && typeof payload.name === "string") {
          errorName = payload.name.slice(0, 80);
        }
      } catch {
        errorName = "unreadable";
      }
      log("resend_error", { status: response.status, errorName });
      return "failed";
    }
    await response.body?.cancel();
    return "sent";
  } catch {
    log("resend_error", { status: 0, errorName: "network" });
    return "failed";
  }
}

async function handleEnquiry(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "POST, OPTIONS", ...SECURITY } });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, OPTIONS" });
  }
  if (!sameOrigin(request)) {
    log("rejected_origin");
    return fail(request, 403, "We couldn't accept that submission.", "Submission blocked");
  }

  const fields = await readFields(request);
  if (fields instanceof Response) return fields;

  const result = validateEnquiry(fields);
  if (!result.ok) {
    log("validation");
    return fail(request, result.status, result.error, "Check the form");
  }
  if (result.honeypot) {
    log("honeypot");
    if (wantsJson(request)) return json({ ok: true }, 200);
    return htmlPage("Enquiry sent | Zynlo", "Thanks. We've got it.", "We've passed your note to the Zynlo team.", 200);
  }

  const delivery = await sendEnquiry(env, result.value);
  if (delivery === "sent") {
    log("sent");
    if (wantsJson(request)) return json({ ok: true }, 200);
    return htmlPage(
      "Enquiry sent | Zynlo",
      "Thanks. We've got it.",
      "We've sent this to the Zynlo team. We'll reply to the work email you entered.",
      200,
    );
  }

  const unavailable = delivery === "missing";
  log(unavailable ? "missing_secret" : "delivery_failed");
  const message = "We couldn't send this from the site just now. Email hello@zynlo.lk or WhatsApp +94 72 358 9231 and include your name, company, and whether you want a 2-week pilot or a 15-minute call.";
  return fail(request, unavailable ? 503 : 502, message, "Please email us directly");
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/enquiry") return handleEnquiry(request, env);
    return json({ ok: false, error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
