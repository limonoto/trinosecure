# 10 — Design Brief & Screen Inventory

This doc holds (a) the inventory of UI screens the app needs and (b) the prompt to give a
design tool (e.g. Claude) to generate HTML mockups. The generated mockups will be reviewed to
lock the visual direction **before** Phase 0 scaffolding.

Status: **LOCKED (2026-06-16)** — the mockups in `designs/` were reviewed and adopted as the
project's UI foundation. `designs/` is local-only (gitignored).

Language: the application UI is in **Turkish** (except well-established technical terms) — see
[09-conventions.md](09-conventions.md). Mockups should render visible on-screen text in Turkish,
even though this brief is written in English for the design tool.

## Locked design system (source: `designs/`)

The delivered mockups (`designs/*.html` + shared `designs/assets/`) are adopted as-is. Key facts
a future session needs **without** re-reading the HTML:

- **Token model (`designs/assets/theme.css`):** shadcn/ui-aligned HSL CSS variables, light + dark.
  Primary accent is **teal** (`--primary: 174 78% 30%` light / `173 68% 44%` dark); semantic
  `success` / `warning` / `destructive` / `info`; `--radius: 0.625rem`.
- **Tailwind config (`designs/assets/tw.js`):** `darkMode: 'class'`, colors mapped to the CSS
  vars with `<alpha-value>`, font **Geist** (+ Geist Mono), shadow/animation scale. Names mirror
  shadcn so markup ports cleanly.
- **Shell (`designs/assets/shell.js`):** layout = 64px **icon rail** (one icon per section) +
  232px **context column** (pages in the active section + an env status card) + sticky **topbar**
  (environment switcher, search ⌘K, theme toggle, notifications, account) + mobile nav drawer.
- **Component library (`Shell.*`):** `ui.button/field/stat/pageHeader`, `drawer`, `modal`,
  `confirm`, `toast`, `dragOrder` (drag-to-reorder), `badge`, and a tiny observable `store`
  (theme + env, localStorage-persisted). The file documents the 1:1 React/shadcn port targets
  (`<Button>`, `<Sheet>`, `<Dialog>`, `<Toaster>`, Zustand / React-context store).
- **Status badges:** Draft · Valid · Invalid · Published · Drift detected · Enabled · Disabled ·
  Active · Expired.
- **Nav sections:** Overview · Authorization (Rules Workspace, Import & Diff, Version History) ·
  Identity (Groups, Mapping) · Authentication (Auth Methods, Password Users) · Cluster Security
  (TLS, Certificates, Secrets) · Access Control (Backend Selector) · Audit & Insight (Audit Log,
  Effective Permissions) · Settings (Environments, App Settings).

## Porting deltas (address during Phase 0–1)

The mockups are static and were generated in English; when porting to Next.js + shadcn:

1. **Turkish UI** — move all visible strings into `tr.json` in Turkish (keep data such as group/
   catalog names as-is). See [09-conventions.md](09-conventions.md).
2. **Full rule-type coverage** — the demo wired only the **Table** rule editor and 7 tabs. Build
   editors for all needed types from [04-rules-json-reference.md](04-rules-json-reference.md):
   Table, Schema, Catalog, Query, System/Catalog Session Properties, Impersonation, Function,
   **Procedure, Authorization, System Information** (Column + Row Filter live inside the Table
   editor; Principal is deprecated → skip).
3. **Real build, no runtime CDN** — replace `cdn.tailwindcss.com` with a proper Tailwind build and
   **self-host Geist** (internal security tool → no external CDN at runtime).
4. **Real behavior** — implement validate / import-diff / publish against the backend; define the
   **HTTP-served contract** (the mock assumes Trino polls `/v1/security/rules` ~30s) — resolves
   the open question in [02-architecture.md](02-architecture.md).

## Screen inventory (grouped; [MVP] = first batch)

- **Shell** — left sidebar nav + top bar (environment switcher, search, theme toggle, user menu).
- **Dashboard** [MVP] — summaries, counts, recent activity, validation/drift warnings.

> **No in-app Login screen** — authentication is delegated to Keycloak's hosted login page
> (OIDC redirect). The app's first screen after sign-in is the Dashboard.
- **Authorization / Rules Workspace** [MVP] — rules table per type, ordered + drag-to-reorder.
- **Rule Editor** [MVP] — per-rule-type form with live validation.
- **Import & Diff** — paste/upload `rules.json`, diff vs current, confirm.
- **Version History & Rollback** — versions, diff, rollback.
- **Publish dialog** — choose delivery mode (HTTP/file), preview, confirm.
- **Groups** [MVP] — list + members.
- **Group Detail** — members + referencing rules.
- **User & Group Mapping** — principal/group → Trino name.
- **Auth Methods Overview** — password file, LDAP, OAuth2, JWT, Kerberos, certificate, Salesforce.
- **Auth Method Config** — per-method form.
- **Password File Users** — manage local users.
- **TLS / HTTPS** — enable HTTPS, select cert.
- **Certificates** — upload/inspect PEM/JKS.
- **Secrets** — env-reference manager.
- **Access Control Backend Selector** — file / OPA / Ranger.
- **Audit Log** [MVP] — filterable log + before/after diff.
- **Effective Permissions** — "what can user X access?" resolved tree.
- **Environments** — manage Trino clusters (delivery mode, target, refresh period).
- **App Settings / Profile** — theme, language, account.

## Prompt for the design tool (copy-paste)

```
You are designing the UI for "Trino-Secure UI", a web admin console that lets
platform/security administrators manage ALL of a Trino cluster's security configuration
(authorization rules, authentication, groups, TLS, secrets) from one visual interface —
replacing hand-edited config files.

AUDIENCE & TONE
Primary users are platform/security admins; some operators are less technical. The product
controls access to sensitive data, so the design must feel trustworthy, precise, calm, and
professional — never playful. Clarity and safety over flashiness. Dangerous actions (publish,
rollback, delete) must feel deliberate.

LANGUAGE
- All visible on-screen UI text/labels must be in TURKISH (this is a Turkish-language product).
- Keep well-established technical terms in English where natural: catalog, schema, table,
  column, connector, rules.json, OAuth, LDAP, JWT, TLS, OPA, Ranger.
- NOTE: this brief is written in English for you, the designer — but render the mockups' actual
  visible text in Turkish.

VISUAL DIRECTION
- Modern admin SaaS / dashboard aesthetic, in the spirit of shadcn/ui + Tailwind.
- Neutral gray base palette; ONE restrained accent color (a confident blue or teal). Use color
  semantically: valid=green, warning/drift=amber, error/invalid=red, info=accent.
- Typography: clean sans-serif (Inter or Geist); clear type scale; comfortable line-height.
- Rounded-md corners, subtle 1px borders, soft shadows, efficient spacing.
- Provide BOTH light and dark themes.
- Data-dense where needed (rule tables) but always legible, with strong visual hierarchy.

LAYOUT
- Persistent left sidebar nav, grouped: Overview, Authorization, Identity, Authentication,
  Cluster Security, Audit, Settings.
- Top bar: environment switcher (prod/staging), global search, theme toggle, user menu.
- Main area: page title, action toolbar, content. Responsive (sidebar collapses on tablet).

SHARED COMPONENTS
- Data tables with sorting, search, status badges, and drag-to-reorder handles where noted.
- Right-side drawers and modals for create/edit and confirmations.
- Side-by-side diff viewer for import and version comparison.
- Form fields with clear validation states (valid / warning / error + helper text).
- Toasts; empty states; loading skeletons; error states.
- Status badges: Draft, Valid, Invalid, Published, Drift detected.

TECH CONSTRAINTS
- Output ONE self-contained HTML file per screen, styled with Tailwind CSS via CDN (no build
  step), using realistic placeholder data.
- Semantic, accessible HTML (labels, roles, focus states). Will be ported to Next.js + React +
  Tailwind + shadcn/ui, so keep markup component-friendly and class-driven.
- Include light + dark where feasible.

DELIVERABLES
1) First, a short design-system spec: color tokens (light+dark), type scale, spacing, and the
   shared shell (sidebar + top bar) as a reusable layout.
2) Then the screens below. Prioritize [MVP].

SCREENS
Note: there is NO in-app login screen — authentication is handled by Keycloak's own hosted
login page (OIDC redirect). The first screen after sign-in is the Dashboard.

Shell & core [MVP]:
- Dashboard — environment summary cards; counts (groups, rules, artifacts); recent activity
  feed; validation/drift warnings; quick actions.

Authorization (rules.json) — the heart [MVP]:
- Rules Workspace — sections/tabs per rule type; table of rules in EVALUATION ORDER with drag
  handles (first-match-wins); match summary (user/group/catalog/…); allow/privileges badges;
  validity status; toolbar: Add rule, Import, Validate, Publish, History.
- Rule Editor (drawer) — form for a Table rule (user/role/group regex; catalog/schema/table;
  privileges checkboxes; per-column access + mask; row filter) with live validation.
- Import & Diff — paste/upload a rules.json; side-by-side diff vs current; confirm/merge.
- Version History & Rollback — versions list; diff between two versions; rollback.
- Publish dialog — choose delivery mode (HTTP-served / file-write); preview changes; confirm.

Identity:
- Groups [MVP] — table of groups with member counts + search; add group.
- Group Detail (drawer) — members add/remove; rules that reference this group.
- User & Group Mapping — editor mapping external principal/group → Trino name.

Authentication:
- Auth Methods Overview — cards/list (Password file, LDAP, OAuth 2.0, JWT, Kerberos,
  Certificate, Salesforce) with enabled/disabled status.
- Auth Method Config (drawer) — example: LDAP config form.
- Password File Users — manage local users (add/remove, set password).

Cluster security:
- TLS / HTTPS — enable HTTPS; select certificate.
- Certificates — upload PEM/JKS; list with subject/expiry; inspect.
- Secrets — env-reference manager.

Access control backend:
- Backend Selector — choose File / OPA / Ranger with config.

Audit & insight:
- Audit Log [MVP] — filterable table (actor, action, entity, time) + detail drawer with
  before/after diff.
- Effective Permissions — input a username → resolved access tree (catalogs/schemas/tables
  reachable; filters/masks applied).

Settings:
- Environments — list/add/edit Trino environments (delivery mode, target, refresh period).
- App Settings / Profile — theme, language, account.

DESIGNER NOTES
- Make rule ORDERING (first-match-wins) visually obvious and reorderable.
- Surface validation and drift prominently — this is a safety tool.
- Keep tables scannable; use badges and subtle color, not heavy chrome.
```

## After mockups are received

1. Review against this brief; note what to keep/change.
2. Extract the design system (tokens, components) for shadcn/ui theming.
3. Record the locked direction here and proceed to Phase 0 ([07-roadmap.md](07-roadmap.md)).
