# CloudTrace

Cloud attack path analyzer. Models resources, identities, permissions and network access as a graph, finds the routes
from exposed entry points to sensitive assets, scores each path with a transparent formula, and presents it in a security
dashboard with an interactive attack graph, what-if simulation, remediation ranking and an AI assistant.
Prototype build: no Docker, no CI, no Terraform import.

## Run locally
Requirements: Node 20+, PostgreSQL with an empty `cloudtrace` database.

    cd backend
    npm install
    cp .env.example .env                 # set DATABASE_URL and JWT_SECRET
    npx prisma migrate dev --name init   # creates tables and generates the client
    npm run dev                          # http://localhost:4000  (API docs: /api/docs)

    cd frontend                          # second terminal
    npm install
    npm run dev                          # http://localhost:5173

Create a project, choose **Import environment**, and pick a sample. Start with **enterprise**: it has two entry points
(the internet and a leaked CI user), a load balancer, bastion host, API gateway, role chains and four sensitive targets.

### Upgrading from the previous build
    cd backend && npm install && npx prisma migrate dev --name platform_upgrade
    cd ../frontend && npm install
Sessions are invalidated once (sign in again). If you never verified your old account, run:
`psql -U postgres -d cloudtrace -c "UPDATE users SET email_verified = true;"`

## Sign-in
- **Email verification:** new accounts must open an emailed link before signing in. Configure `SMTP_*` in `backend/.env`
  (Gmail: app password, `smtp.gmail.com`, port 465). Without SMTP the link is printed in the backend console.
  For local testing only, `DEV_AUTO_VERIFY=true` skips verification (ignored when `NODE_ENV=production`).
- **Google:** create an OAuth client (type *Web application*) in Google Cloud Console, add `http://localhost:5173` as an
  authorized JavaScript origin, put the client ID in `GOOGLE_CLIENT_ID`, restart the backend.
- **Forgot password**, change password, sign out other sessions and delete account are on the Account page (avatar menu).

## Graph engine (`backend/src/services`)
| Part | What it does |
|---|---|
| graph | Edges carry type, confidence and evidence. Security-group ingress becomes `connects_to` lateral movement. A public resource is only reachable if a security group allows it. Placement edges (`runs_on`) are never attacker steps. |
| attack-path | DFS enumerates every route (depth 8, capped at 500, truncation reported). BFS flags fewest hops. Dijkstra (binary heap) and Yen's K=5 rank routes by likelihood. |
| entry points | The internet, plus any identity flagged `compromised`. |
| analyze | Choke points (resources many paths share) and MITRE ATT&CK technique per step. |
| risk | Risk = 100 x Exposure x Exploitability x Privilege x Criticality x Confidence. Project-specific, not CVSS. |
| security-rules | 12 rules. Catalog: `docs/rule-catalog.md`. |
Benchmarks: `npm run bench` (results in `docs/benchmark.md`). ER diagram: `docs/ER.md`.

## AI assistant
`services/ai` defines an `AiProvider` interface with two implementations:
- **Demo** (default): template-based, built only from scan data. No key needed.
- **OpenAI**: set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in `backend/.env` (key stays on the server). Path explanations use JSON output
  validated with Zod, and the step count must match the path. Chat uses tool calls that read the deterministic scan result.
  Any failure falls back to the demo engine. Requests are rate limited per user and cached per scan and path.

## Tests
    cd backend && npm test      # 21 tests: engine, enterprise fixture, what-if, demo and mocked OpenAI provider

## Not included yet
AWS collector, scheduled scans and drift detection, teams and roles, audit log, Slack/Jira alerts, CIS tagging, Supertest API tests.

## UI notes
- **Upgrading the frontend:** run `npm install` in `frontend/` (adds three.js and the IBM Plex fonts, which are bundled locally, no CDN).
- **Theme:** black `#000000`, navy `#14213d`, orange `#fca311`, light grey `#e5e5e5`, white. Tokens live in `frontend/src/index.css`.
- **Type scale:** IBM Plex Sans, 14px body, 12px small, 24px page titles, 28px metrics. IBM Plex Mono for IDs.
- **Landing page (`/`):** public page with a three.js attack graph and the real graph component running on the bundled enterprise sample.
  Regenerate that sample with `cd backend && npm run landing-data`. Signed-in users are redirected to Home.
- **Home (`/home`):** dashboard for your active project: KPI tiles with change since the last scan, attack path overview, risk distribution,
  recent activity, top risk resources, highest-risk paths, AI prompts and a setup checklist.
- **Reading the graph:** every branch is drawn.
  Line style is the relationship type (red dotted internet exposure, orange dotted lateral movement, cyan access, grey identity).
  Ring colour is the highest risk of any path through a resource; heavier lines are critical or high branches.
  A star marks a sensitive resource, a warning marks internet exposure, and `×N` marks a choke point.
  Use **Critical and high** to dim everything else, or select a path to trace it in white.
- **Search shortcut:** press `/` anywhere to focus the top-bar search.
- The Import dialog lists the **enterprise** sample (multi-tier, two entry points, many branches). Use it to see the full graph.
