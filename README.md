# zynlo-website

Public site for [www.zynlo.lk](https://www.zynlo.lk), served as Cloudflare Workers static assets from the `public/` directory. The Worker name is `zynlo-lk`.

The custom domain is attached in the Cloudflare dashboard. `wrangler.jsonc` does not declare routes or custom domains.

```bash
npm install
npm run dev
```

Local checks worth making: `/`, `/privacy`, `/terms`, and an unknown path (custom 404 with status 404).
