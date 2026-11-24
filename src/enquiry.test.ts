import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { enquiryText, validateEnquiry } from "./enquiry.ts";
import worker from "./index.ts";

const valid = {
  name: "Amelia Clarke",
  email: "amelia@northshore.example",
  company: "Northshore Solar",
  audience: "uk-sme",
  message: "We want a 2-week pilot for homeowner survey bookings.",
  hp: "",
};

describe("validateEnquiry", () => {
  it("accepts a complete UK SME enquiry", () => {
    const result = validateEnquiry(valid);
    assert.equal(result.ok, true);
    if (result.ok && !result.honeypot) {
      assert.equal(result.value.email, "amelia@northshore.example");
      assert.equal(result.value.audience, "uk-sme");
    }
  });

  it("accepts an agency partner", () => {
    const result = validateEnquiry({ ...valid, audience: "agency" });
    assert.equal(result.ok, true);
    if (result.ok && !result.honeypot) assert.equal(result.value.audience, "agency");
  });

  it("rejects a missing message", () => {
    const result = validateEnquiry({ ...valid, message: "   " });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  });

  it("rejects an email without a domain", () => {
    const result = validateEnquiry({ ...valid, email: "amelia@" });
    assert.equal(result.ok, false);
  });

  it("rejects an unknown audience", () => {
    const result = validateEnquiry({ ...valid, audience: "founder" });
    assert.equal(result.ok, false);
  });

  it("treats a filled honeypot as a silent success", () => {
    const result = validateEnquiry({ ...valid, hp: "https://spam.example", message: "" });
    assert.deepEqual(result, { ok: true, honeypot: true });
  });

  it("strips line breaks from the name used in the subject", () => {
    const result = validateEnquiry({ ...valid, name: "Amelia\r\nBcc: evil@example.com" });
    assert.equal(result.ok, true);
    if (result.ok && !result.honeypot) {
      assert.equal(result.value.name.includes("\n"), false);
      assert.equal(enquiryText(result.value).subject.includes("\n"), false);
    }
  });

  it("rejects a message over 2,000 characters", () => {
    const result = validateEnquiry({ ...valid, message: "a".repeat(2001) });
    assert.equal(result.ok, false);
  });

  it("accepts a 2,000-character message after form posts turn newlines into CRLF", () => {
    const typed = Array.from({ length: 11 }, (_, index) => (index === 10 ? "b".repeat(190) : "a".repeat(180))).join("\n");
    assert.equal(typed.length, 2000);
    const posted = typed.replace(/\n/g, "\r\n");
    assert.equal(posted.length, 2010);
    const result = validateEnquiry({ ...valid, message: posted });
    assert.equal(result.ok, true);
    if (result.ok && !result.honeypot) {
      assert.equal(result.value.message, typed);
      assert.equal(result.value.message.includes("\r"), false);
    }
  });
});

describe("Content-Security-Policy", () => {
  it("allows Cloudflare Web Analytics while keeping strict directives in sync", async () => {
    const headersPath = path.resolve(import.meta.dirname, "../public/_headers");
    const headersText = fs.readFileSync(headersPath, "utf8");
    const match = headersText.match(/Content-Security-Policy:\s*(.+)/);
    assert.ok(match, "public/_headers should define Content-Security-Policy");
    const csp = match[1].trim();
    assert.match(csp, /script-src 'self' https:\/\/static\.cloudflareinsights\.com;/);
    assert.match(csp, /connect-src 'self' https:\/\/cloudflareinsights\.com;/);
    assert.match(csp, /default-src 'self';/);
    assert.match(csp, /frame-ancestors 'none';/);

    const response = await worker.fetch(
      new Request("https://www.zynlo.lk/api/enquiry", { method: "OPTIONS" }),
      {} as Env,
    );
    assert.equal(response.headers.get("content-security-policy"), csp);
  });
});
