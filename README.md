# ATEMA STUDIO

> Bilingual (Arabic-first / English) luxury photography booking platform for
> a women-only studio in Saudi Arabia (Eastern Province).
>
> **Live:** <https://atemastudio.xyz>

```
React 19 + Vite + TypeScript  →  Supabase (Postgres + Edge Functions)  →  GH Pages
        ↓                              ↓
   HashRouter                      Moyasar (cards) +
   (GH Pages constraint)           Al Rajhi bank transfer
                                          ↓
                                  Meta WhatsApp Cloud API
                                  (lifecycle reminders +
                                   Vision receipt OCR)
                                          ↓
                                  Zoho Mail SMTP
                                  (booking confirmation
                                   from atema@atemastudio.xyz)
```

---

## Quick start

```bash
# 1. Clone + install
git clone https://github.com/farajaay/atema-studio.git
cd atema-studio
npm install

# 2. Copy .env.example → .env and fill in Supabase + Moyasar keys
cp .env.example .env

# 3. Develop
npm run dev               # http://localhost:5173

# 4. Type-check + run tests + build
npm run build             # tsc -b && vite build → dist/
npm test                  # 113 passing
```

---

## Deploy

**Auto-deploy is wired** — every push to `master` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which:

1. Installs deps with `npm ci`
2. Runs the test suite (gates the build — a failing suite blocks deploy)
3. Builds `dist/` via `npm run build`
4. Publishes `dist/` to the `gh-pages` branch via `peaceiris/actions-gh-pages@v4`
5. GitHub Pages serves the new HEAD at <https://atemastudio.xyz> within ~1 min

There is also a manual **Run workflow** button on the Actions tab if you
need to redeploy without a code change.

The legacy `npm run deploy` script (`gh-pages -d dist`) still works for
local emergency deploys but is no longer the day-to-day path.

---

## Where to read what

| If you need to know… | Open |
|---|---|
| Architecture, schema, env vars, build/deploy reference | [`PROJECT.md`](./PROJECT.md) |
| Working-brief for new Claude/dev sessions (60-second mental model) | [`CLAUDE.md`](./CLAUDE.md) |
| Owner operating manual (admin panel, calendar, settings, P&L, mood board, self-service) | [`docs/MANUAL.md`](./docs/MANUAL.md) |
| The two palettes + stationery system + design conventions | [`docs/design.md`](./docs/design.md) |
| Outstanding bugs + security audit + patch tracker | [`docs/bugs.md`](./docs/bugs.md) |
| First-time Supabase + Moyasar + Meta WA + Zoho wiring | [`BACKEND_SETUP.md`](./BACKEND_SETUP.md) |
| Email confirmation (Zoho SMTP setup, DNS, secrets) | [`docs/integrations/email.md`](./docs/integrations/email.md) |
| WhatsApp lifecycle reminders + receipt vision | [`docs/integrations/wa-platform.md`](./docs/integrations/wa-platform.md) |
| Moyasar live activation + transfer-receipt flow | [`docs/integrations/payments.md`](./docs/integrations/payments.md) |
| Investor / client pitch | [`docs/PRESENTATION.md`](./docs/PRESENTATION.md) |
| P&L model + worked numbers | [`docs/PROFITABILITY.md`](./docs/PROFITABILITY.md) |

The doc index lives at [`docs/README.md`](./docs/README.md).

---

## Owner

Fatima Bohassan · Al-Jubail, Eastern Province, Saudi Arabia ·
<atema@atemastudio.xyz> · +966 54 832 3496
