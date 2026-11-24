export const AUDIENCES = {
  "uk-sme": "UK SME",
  agency: "Agency partner",
} as const;

export type Audience = keyof typeof AUDIENCES;

export type Enquiry = {
  name: string;
  email: string;
  company: string;
  audience: Audience;
  message: string;
};

export type ValidationResult =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; value: Enquiry }
  | { ok: false; error: string; status: number };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanLine(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeMessage(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function validateEnquiry(input: Record<string, string>): ValidationResult {
  if ((input.hp ?? "").trim() !== "") {
    return { ok: true, honeypot: true };
  }

  const name = cleanLine(input.name ?? "", 80);
  const email = cleanLine(input.email ?? "", 120).toLowerCase();
  const company = cleanLine(input.company ?? "", 120);
  const audience = cleanLine(input.audience ?? "", 20);
  const message = normalizeMessage(input.message ?? "");

  if (!name || !email || !company || !audience || !message) {
    return { ok: false, status: 400, error: "Please complete every field." };
  }
  if (!EMAIL.test(email)) {
    return { ok: false, status: 400, error: "Enter a work email we can reply to." };
  }
  if (!(audience in AUDIENCES)) {
    return { ok: false, status: 400, error: "Tell us whether you are a UK SME or an agency partner." };
  }
  if (message.length > 2000) {
    return { ok: false, status: 400, error: "Please shorten the message to 2,000 characters." };
  }

  return {
    ok: true,
    honeypot: false,
    value: { name, email, company, audience: audience as Audience, message },
  };
}

export function enquiryText(value: Enquiry): { subject: string; text: string } {
  const audience = AUDIENCES[value.audience];
  const subject = `UK enquiry: ${value.company} — ${value.name}`.slice(0, 150);
  const text = [
    "New UK enquiry from https://www.zynlo.lk/uk",
    "",
    `Audience: ${audience}`,
    `Name: ${value.name}`,
    `Work email: ${value.email}`,
    `Company: ${value.company}`,
    "",
    "Message:",
    value.message,
  ].join("\n");
  return { subject, text };
}
