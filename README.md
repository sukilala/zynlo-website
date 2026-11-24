# zynlo-website

Public site for [www.zynlo.lk](https://www.zynlo.lk). Static pages live in `public/` and are served by the `zynlo-lk` Worker. `POST /api/enquiry` is handled in the Worker and forwards UK pilot enquiries to `hello@zynlo.lk` through [Resend](https://resend.com).

The custom domain is attached in the Cloudflare dashboard. `wrangler.jsonc` does not declare routes or custom domains.

## Pages

- `/` brand hub, with routes to the two offers
- `/uk` UK B2B appointment setting (pricing on request)
- `/sl` Sri Lanka 24/7 WhatsApp and call support
- `/privacy`, `/terms`
- `/signature-logo.png` logo for an email signature (`https://www.zynlo.lk/signature-logo.png`)

## Local development

```bash
npm install
npm test
npm run dev
```

Local checks worth making: `/`, `/uk`, `/sl`, `/privacy`, `/terms`, `/signature-logo.png`, an unknown path (custom 404 with status 404), and `POST /api/enquiry`.

Copy `.dev.vars.example` to `.dev.vars` if you want local sends to reach Resend. Without `RESEND_API_KEY`, the enquiry route returns a clear error and the form tells the visitor to email or WhatsApp instead.

## Enquiry email

`ENQUIRY_TO` and `ENQUIRY_FROM` are plain vars in `wrangler.jsonc`. The API key is a secret:

```bash
npx wrangler secret put RESEND_API_KEY
```

In Resend, verify the `zynlo.lk` domain so `Zynlo Website <hello@zynlo.lk>` is allowed to send. Until that secret is set, the site still deploys and the form falls back to `hello@zynlo.lk` and WhatsApp.

Point the apex `zynlo.lk` at `https://www.zynlo.lk` with a 301 in the Cloudflare dashboard (Bulk Redirects or a redirect rule). Do not add that redirect as a route in `wrangler.jsonc`.
