# Repliq - Customer Support SaaS Platform

## Project Overview
Repliq is a multi-channel customer support SaaS platform, live at **repliqsupport.com**.
Originally named "analytiq" (repo name kept). Primary brand using it: **lessandromance**.

## Tech Stack
- **Backend:** Go + Gin framework, PostgreSQL + Redis (both on Railway)
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **AI Bot:** Claude Haiku 4.5 (claude-haiku-4-5-20251001) via Anthropic API
- **Deploy:** Vercel (frontend), Railway (backend)
- **Automation:** n8n cloud (fatihselman10.app.n8n.cloud) for Instagram webhooks

## Live URLs
- Frontend: https://repliqsupport.com (Vercel, custom domain)
- Backend: https://repliq-production-e4aa.up.railway.app (Railway)
- GitHub: https://github.com/fatihselman10-max/analytiq

## Architecture
- Multi-tenant: Organizations > Users > Channels > Conversations > Messages
- Channels: WhatsApp, Instagram, Telegram, Facebook, Twitter, VK, Email, LiveChat
- Real-time: WebSocket hub (currently broken, using polling fallback: 3s messages, 5s conversations)
- Dual bot system: Keyword bot (free, rule-based) -> AI Bot (Claude API, token-based)

## Key Integrations
- **Instagram:** n8n webhook -> Repliq webhook + Notion. Instagram Graph API v21.0 for replies. Page ID: 17841463378386414
- **Email:** destek@lessandromance.com via Hostnet (SMTP: smtp.hostnet.nl:587, IMAP: imap.hostnet.nl:993). Polls INBOX every 30s.
- **Oplog:** Order status queries via Oplog API (backend/internal/services/bot/oplog.go). AI bot can look up shipment status for customers.

## Features
- Multi-channel inbox with channel/status filters, search, bulk actions
- AI Bot with brand survey config, token tracking, conversation logs
- Keyword bot with rule-based auto-responses
- Business hours with auto-away messages
- SLA policies with breach indicators
- CSAT surveys with dashboard
- Automation workflows (trigger-condition-action)
- Knowledge base (7 categories, 18 pre-seeded articles)
- Reports (overview, agents, channels, messages with period/channel filters)
- Landing page (dark theme, hero, features, pricing, FAQ)
- Onboarding wizard (5-step post-registration flow)
- Dark mode with localStorage persistence
- PWA support (manifest, service worker, app icons)
- Mobile responsive (bottom nav, swipe panels, overlay contact)

## Database
- **Host:** autorack.proxy.rlwy.net:41372, User: postgres, DB: railway
- **Core tables:** organizations, users, org_members, channels, contacts, conversations, messages, attachments
- **Bot tables:** bot_rules, bot_logs, ai_bot_config, ai_bot_logs
- **Feature tables:** canned_responses, tags, conversation_tags, business_hours, sla_policies, csat_config, csat_responses, automations, kb_categories, kb_articles
- **System org:** org_id=1 (lessandromance), org_id=2 (Repliq System - global KB articles)

## Deploy Commands (CRITICAL)
- **Backend:** `railway up` from project ROOT (~/analytiq), NOT from backend/. Dockerfile is at root.
- **Frontend:** `npx vercel --prod --yes` from frontend/
- **NEVER** use `railway service redeploy` - it redeploys OLD code, not your latest changes.
- Railway CLI linked to project "repliq", service "repliq"
- Vercel CLI linked to project "repliq" (fatihselman10-maxs-projects)

## Go/pgx Gotchas (IMPORTANT)
- NULL string columns: `rows.Scan()` silently fails on NULL -> string. Always use `COALESCE(column, '')` in SQL.
- JSONB columns: Scan into Go `string`, not `[]byte`. Always cast: `COALESCE(column::text, '{}')` then `json.Unmarshal`.
- JSONB comparison: Use `credentials::text != '{}'` not `credentials != '{}'`.

## Environment Variables (Railway)
- ANTHROPIC_API_KEY (for AI bot)
- OPLOG_TENANT_ID, OPLOG_TOKEN (for order status queries)
- Standard DB vars: DATABASE_URL, REDIS_URL

## User Preferences
- Turkish speaker - all UI text uses Turkish (ı, o, u, s, c, g, I)
- Prefers hands-on collaboration, step by step
- Comfortable giving full authority for code changes
- Wants vibrant, aesthetic, easy-to-use designs

## Known Issues / Next Steps
- WebSocket connection failing (400) - using polling workaround
- AI Bot test mode needed (preview responses without sending to real channels)
- E-commerce integration planned (Shopify/WooCommerce for order status)
- Stripe payment integration (last priority)
