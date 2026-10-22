# TBC. — partnerships for tech communities

Two-sided platform connecting hackathon organisers, university societies and builder clubs with sponsors and hosts.

Pitch: *TBC helps tech communities and sponsors find each other, propose partnerships and agree on terms—starting with our own challenge of organising Impact Hack Bristol.*

## Run the hackathon MVP

Terminal 1 — matching API (structured graph + optional Cognee Cloud HTTP):

```bash
cd api
uv sync
.venv/bin/uvicorn main:app --reload --port 8000
```

Terminal 2 — UI:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional Cognee Cloud (`POST /api/v1/remember` or add+cognify, then `/api/v1/recall`) on dataset `tbc_partnerships`. The Vercel API uses a thin **httpx** client — not the full `cognee` Python package.

```bash
cp .env.example .env
```

Fill `.env` (never commit it). Same names go in Vercel env for the hosted API.

- **Cognee Cloud HTTP:** `COGNEE_SERVICE_URL` + `COGNEE_API_KEY` from the [API Keys](https://docs.cognee.ai/cognee-cloud/ui/api-keys) Connection Details card. Optional `COGNEE_TENANT_ID` for the `X-Tenant-Id` header. Docs: [HTTP API](https://docs.cognee.ai/cognee-cloud/http-api).
- **`COGNEE_CREDIT_CODE`:** Cognee Cloud Billing coupon (hackathon voucher, e.g. GROKBOT35). Redeem in Cognee Cloud → profile → Billing → Have a code? It is **not** an API key. After redeeming, create a key, then `vercel env add COGNEE_SERVICE_URL` and `vercel env add COGNEE_API_KEY` (Production + Preview) and redeploy. Hosted Grok Bot MCP at `https://mcp.aws.cognee.ai/mcp` uses Cognee account sign-in.

Without Cloud credentials (or if Cloud errors), TBC still matches from the local partnership graph and labels the source as `graph`. When Cloud recall succeeds, suggestions are labelled `hybrid`.

## Demo script

1. Organiser: **File Impact Hack** → **Load Impact Hack prospectus** → fill any missing fields → submit.
2. Browse Grok Bot partner profiles (Cognee, Cursor, Supabase, Zero, SpaceXAI, Expedite). Open suggested matches; each card explains why, aligned requirements, and gaps.
3. Send a tailored request with proposed benefits and support.
4. Switch the header to **Sponsor**, open available events, find Impact Hack.
5. Propose revised conditions; switch back to organiser and **Confirm**.

Partner **names** come from the public Grok Bot Community Engineering London Hackathon list. Invented emails, ratings, inventory and commercial terms are labelled demo. Participation in that hackathon does not establish availability for Impact Hack.

## Architecture

- `web/` Next.js app (organiser and sponsor journeys, negotiation thread).
- `api/` FastAPI: prospectus parse → event record, rating-aware matches, request state.
- `data/seed.json` demo graph: events, sponsors, communities, past appearances.
- Thin Cognee Cloud HTTP client (`api/cognee_bridge.py`) for dataset `tbc_partnerships` when `COGNEE_SERVICE_URL` and `COGNEE_API_KEY` are set.
