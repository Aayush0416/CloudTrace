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
    npx prisma migrate dev               # applies the committed migrations and generates the client
    npm run dev                          # http://localhost:4000  (API docs: /api/docs)

    cd frontend                          # second terminal
    npm install
    npm run dev                          # http://localhost:5173

Create a project, choose **Import environment**, and pick a sample. Start with **enterprise**: it has two entry points
(the internet and a leaked CI user), a load balancer, bastion host, API gateway, role chains and four sensitive targets.

### Upgrading from the previous build
    cd backend && npm install && npx prisma migrate deploy
    cd ../frontend && npm install
The repository now ships a migration for everything in `schema.prisma` (teams, audit log, scan summaries, stale-scan
detection). In production use `migrate deploy`. If your development database already contains a migration you generated
yourself for these tables, delete that migration folder and run `npx prisma migrate reset` (development only: it wipes data).
Sessions are invalidated once (sign in again). If you never verified your own development account, run:
`psql -U postgres -d cloudtrace -c "UPDATE users SET email_verified = true WHERE email = 'you@example.com';"`

### Production notes
- `JWT_SECRET` must be 32+ random characters; the server refuses to start in production with the example placeholder.
- Behind a reverse proxy set `TRUST_PROXY=1` (hop count) so per-IP rate limits see real client addresses.
- Limits: environments may have up to 500 resources and 100 permissions plus relationships per resource.
  Sign-in is limited to 10 attempts per 15 minutes per IP and account, verification and reset emails to 5 per hour per
  address, and import, scan, what-if and remediation requests to 30 per 10 minutes per user.

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
| attack-path | DFS enumerates every route (depth 8, capped at 500 shared fairly between entry points, 200,000 node expansions per entry point, truncation reported). BFS flags fewest hops. Dijkstra (binary heap) and Yen's K=5 rank routes by likelihood. |
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

## Appearance and mobile
Dark and light themes (top bar toggle or Account settings, which also has density, reduced motion, default graph direction and start page). The layout adapts to phones and tablets: the navigation becomes a drawer and the attack graph stacks above its panels.

## Tests
    cd backend && npm test      # engine, enterprise fixture, what-if, demo and mocked OpenAI provider, regression tests, Supertest API tests (in-memory DB)

## Not included yet
AWS collector, scheduled scans and drift detection, teams and roles, Slack/Jira alerts, CIS tagging.

## UI notes
- **Upgrading the frontend:** run `npm install` in `frontend/` (adds three.js and the Source Sans 3, Fraunces and JetBrains Mono fonts, bundled locally, no CDN).
- **Theme:** black `#000000`, navy `#14213d`, orange `#fca311`, light grey `#e5e5e5`, white. Tokens live in `frontend/src/index.css`.
- **Type scale:** Source Sans 3, 15px body, 13px small, Fraunces serif for page titles and marketing headings, 28px metrics. JetBrains Mono for IDs.
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
- The Import dialog lists nine samples. **enterprise** (multi-tier, two entry points, many branches) shows the full graph; the **ssrf-over-privileged-role** pair demonstrates the scan diff (import one, scan, import its `-fixed` twin, scan again).
