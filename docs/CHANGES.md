# Bug-fix release notes

Every item from the code review, what was changed, and the regression test that covers it.
Nothing in the API shape, UI flow or sample-data results was removed; analysis output on all four sample
environments is identical to before except the corrected MITRE labels (item 7).

## High
| # | Problem | Fix | Test |
|---|---|---|---|
| 1 | Migration did not match `schema.prisma` | New migration `20261004120000_sync_schema_and_scan_summary` adds `teams`, `team_members`, `audit_logs`, `projects.team_id`, plus the two new columns below | verified by applying both migrations to a real Postgres engine |
| 2 | What-if, remediation ranking and scan diff matched paths by node sequence, so parallel edges (read/write/admin on one target) were confused | Paths are matched by their ordered edge keys (`pathKey`) | `fixes.test.ts` what-if, `api.test.ts` diff |
| 3 | One shared truncation flag starved later entry points (e.g. a leaked identity) | The 500-path cap is split fairly between entry points and `truncated` is tracked per entry | `fixes.test.ts` path cap |
| 4 | DFS could run for minutes on dense graphs | 200,000 node-expansion budget per entry; Yen's only for targets that have a path; limits of 500 resources and 100 links per resource; remediation ranking capped at 400 candidates and memoized; rate limit on heavy endpoints | `fixes.test.ts` budget, size limits |
| 5 | Account pre-hijack: a password set on a never-verified account survived Google sign-in | Google sign-in discards the password (and bumps `tokenVersion`) of an unverified account; it also refuses to relink an email to a different Google account and looks accounts up by Google id first | `api.test.ts` auth |
| 6 | Malformed `properties` (`ingress: [null]`, missing port, non-security-group ids) passed import then crashed scans | Zod-level validation at import (422 with details); the engine itself ignores malformed entries, so data stored earlier cannot crash a scan | `fixes.test.ts` validation, `api.test.ts` |

## Medium
| # | Problem | Fix |
|---|---|---|
| 7 | MITRE label of every step came from the path's final target | Each step is labelled from its own target |
| 8 | Stale results after re-import | `projects.environment_updated_at`; project and result endpoints return `stale`; the UI shows a banner; the assistant answers 409 until a new scan |
| 9 | `GET /projects` loaded every scan's full JSON | `scans.summary` column; lists read only the summary. Older scans are summarized once and backfilled |
| 10 | Placeholder secret / weak limits | Production refuses the placeholder or a secret under 32 chars; `TRUST_PROXY`; per-account login limiter, per-address mail limiter, per-user limiter on import/scan/what-if/remediations |
| 11 | Account enumeration | `forgot`/`resend` return the same shape for known and unknown addresses; login does a dummy bcrypt compare for unknown emails |
| 12 | Backend blip logged users out | `/auth/me` is retried and the token is dropped only on 401/403/404 |
| 13 | Unbounded AI cache, eager remediation ranking | LRU cache (200 entries); ranking computed lazily and memoized |
| 14 | Audit Log was a stub | `GET /projects/:id/audit-logs`; entries written for project create/update/delete, import, scan and finding-status changes; the page now shows them |

## Low
- Choke points count each distinct route once, so parallel permission levels no longer inflate them.
- `PATCH /projects/:id` can clear the description (`null` or empty string).
- Finding-state `ruleId` and `resourceId` are length-limited and checked against known rules and the project's resources.
- A race on `/register` returns 409 instead of 500.
- Duplicate React keys for parallel-edge paths fixed.
- `.env.example` and README brought up to date; ER diagram, OpenAPI table and benchmark note regenerated.

## Deliberately left as is
- Parallel edges still produce separate paths (read, write and admin have different risk scores); only the places that
  matched them wrongly were fixed.
- Login still tells a Google-only account to use Google (a usability feature; the timing difference is closed).
- A password chosen when re-registering over an unverified account still replaces the stored one. Telling the real owner
  from an attacker there needs an extra proof step (for example setting the password after verification), which would
  change the sign-up flow. The Google path, which is the practical hijack, is closed.
- The session token stays in `localStorage`, and deleting a Google-only account still needs no re-authentication.

# Interface release

| Area | Change |
|---|---|
| Landing page | Opening the site never forces the login page. The API client no longer navigates on a 401; it signs the user out in memory (`ct:unauthorized` event) and only private routes redirect to `/login`. Signed-in users still go straight to Home (or Projects, see settings). |
| Attack graph | New layered layout (`frontend/src/lib/graphLayout.ts`): longest-path layering so every line points forward, lane nodes so long lines never cross other resources, barycenter ordering and neighbour-averaging placement. Lines are drawn by a custom `RoutedEdge` (smooth curves with straight entry and exit, parallel edges fanned out). Measured on all samples in both directions: 0 backward edges, 0 edge/node collisions, 0 overlaps. |
| Legend | One icon; opens on hover (mouse), tap or click, closes with Escape. |
| Themes | Dark (unchanged) and a new light theme (sage, powder blue, sand, terracotta on warm paper). Every colour is a CSS variable, including graph, charts and the 3D scene, so both themes cover the whole app. Applied before first paint (no flash). |
| Account settings | New Preferences card: theme (dark, light, match device), table density, reduce motion, default graph direction, page after sign-in. Stored per device. A sun/moon button is also in the top bar, landing page and sign-in page. |
| Mobile | Off-canvas navigation drawer with search and project picker, compact top bar, Explorer stacks (graph first, then collapsible Paths and Details sections), icon-only graph toolbar, bottom-sheet dialogs, responsive landing page, 16px page padding. |
| Typography | Source Sans 3 for text, Fraunces (serif) for page titles and marketing headings, JetBrains Mono for ids. Flat panels replace the glow gradients. |
| Samples | Five real-world style environments added (SSRF with over-privileged role plus its fixed twin, public storage and leaked key, CI/CD supply chain, serverless SaaS) with tests. |

# Graph clarity, hover details and light-theme contrast

| Area | Change |
|---|---|
| Graph structure | The layout (`graphLayout.ts`) now bundles long edges of the same kind into the same target onto one shared trunk (four lateral-movement lines into one database became one line), minimises crossings with barycenter sweeps plus adjacent swaps from two starting orders, and places lanes on the straight line between their neighbours. Crossing counting is O(E log V); a 500-node graph lays out in about 0.2 s. Enterprise sample: 12 crossings reduced to 9, every long line now merges instead of fanning out. |
| Labels | Node labels sit on a background pill so lines passing behind never cut through the text. |
| Hover details | Hovering a resource or a line shows a tooltip: type, exposure, criticality, network, findings, attack paths through it (with the worst severity), choke point count; for lines the relationship, permission, confidence, MITRE ATT&CK technique, how many paths use it and the evidence in plain words. Everything unconnected to the hovered element dims. Works on the attack-path explorer, the Home graph and the landing page graph. |
| Light theme | Higher contrast with three distinct surface levels (sand page, sage chrome for sidebar and top bar, white cards), darker borders (2.8:1 against cards), near-black text, card shadows, and darker status and graph colours. Checked against WCAG: body and muted text 6.2:1 to 17:1, accent text 4.6:1 to 6.6:1, white on the accent button 6.5:1, status colours 4.7:1 or more on cards. |
| Tests | `layout.test.ts` checks all nine samples in both directions: every edge points forward, no node overlaps, no line crosses a node, and bundled lines merge. |

# Hover fix, search, cleaner pages, auto-fit and polish

| Area | Change |
|---|---|
| Vanishing branches | Hovering a line raised its `zIndex`; React Flow draws each `zIndex` in its own layer, so the line under the pointer was re-created and the browser never reported "mouse left", leaving everything dimmed. The hover highlight no longer touches `zIndex`, and moving over empty canvas or panning clears it as a safety net. |
| Search | Works with or without a project. It always searches pages and projects, and adds resources, findings and attack paths when a project is open. Arrow keys and Enter navigate, Escape closes. |
| Instructions removed | No more messages about missing Google client id, email setup, API keys, backend console or "Demo mode" badges. Google sign-in appears only when it is available. If a verification email cannot be sent the page says so briefly and offers Resend. |
| Graph auto-fit | The graph refits itself whenever its space changes: side panels opened, closed or dragged, window resized, phone rotated (waits for the size to settle; keeps the selected path in view). |
| Polish | Rounder cards and dialogs, pill severity badges with a dot, uppercase table headers with row hover, KPI cards with larger numbers, icon empty states, taller top bar, clearer sidebar groups and active item, larger sign-in titles, softer buttons with press feedback, focus rings on inputs. |

# Hover fix and a light theme that mirrors the dark one

| Area | Change |
|---|---|
| Hover on the graph | The previous fix added a "clear on empty canvas" safety net, but in this React Flow version pointer movement over nodes and lines bubbles up to the canvas, so every mouse move cancelled the hover. The handler now only reacts when the pointer is on the empty canvas itself. Regression tests (`GraphHover.test.tsx`, run with `npm test` in `frontend/`) reproduce real hovering with constant move events: the tooltip stays while moving over a node or line, hovered lines are highlighted and the rest dimmed, and everything is restored on leave. |
| Light theme | Redesigned as the mirror of the dark theme (Oxford navy `#14213D`, orange `#FCA311`, platinum): white cards on a cool platinum page, near-navy text, the sidebar and top bar stay navy with the dark theme's colours, buttons keep the bright orange with navy text, accent text is a deep burnt orange (6.3:1 on white). All status and graph colours were re-picked for 4.3:1 or better on white. New `--color-brand` tokens separate "orange fill" from "accent text". |

# Lines disappearing while hovering (root cause fixed)

| Area | Change |
|---|---|
| Cause | The hover highlight rebuilt every node and edge object it handed to React Flow. When node objects are replaced React Flow throws away their measurements, so lines attached to them were dropped (a regression test showed 28 lines shrinking to 1 right after hovering) and in the browser only some came back. |
| Fix | React Flow's nodes and edges are never touched while hovering. The highlight is a tiny stylesheet scoped to that graph: unrelated nodes drop to 60% and unrelated lines to 50% (nothing is ever hidden), and the hovered element's lines become thicker and fully opaque. The tooltip is unchanged. |
| Tests | `GraphHover.test.tsx` now asserts that the very same DOM elements for every line and node exist right after hovering and after leaving, that the CSS never makes anything near-invisible, that the generated selectors match the graph, and that the highlight is removed on leave. |

# Landing hero with the 3D graph behind it, new headings, warm light theme

| Area | Change |
|---|---|
| Hero | The animated 3D graph is now the hero's full-width background instead of a boxed card. On wide screens it is larger and sits on the right, with a soft fade on the left to keep the headline readable; on phones it sits behind the text at reduced strength. It follows the pointer anywhere on the page. |
| Headings | Navigation is now Workflow, Live graph, Capabilities (medium weight, orange underline on hover) and each section has a matching small label and a new heading: "Four steps from a file to a fix list", "See every route in one graph", "Everything you need to investigate and fix", "Find the route before someone else does." |
| Light theme | Reworked as warm cream paper with white cards, a navy header, hero, sidebar and call-to-action band, orange accents (brand orange fills with navy text, burnt-orange accent text), warm card headers and an orange top edge on KPI cards. Text is 5.8 to 18:1, status colours 5.2:1 or better. The 3D scene reads the colours of the area it sits in, so it stays luminous on the navy hero in both themes. |
| Landing polish | Numbered step cards, orange-edged statistics, feature icons in tinted tiles that fill with orange on hover. |
