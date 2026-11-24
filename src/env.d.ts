interface Env {
  /** Set with `npx wrangler secret put RESEND_API_KEY`. Absent until that secret exists. */
  RESEND_API_KEY?: string;
}
