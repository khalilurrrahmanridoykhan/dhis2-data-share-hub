# Data Share Hub

A native DHIS2 App that lets an admin define a data slice once (dataset + data elements + org units + a date range) and either **export it as CSV immediately**, or **provision a scoped, revocable external API account** for it -- with every share tracked in one registry.

This is the third sibling app in this repo, alongside [OneHealth Data Trust](../dhis2-app) and [Data Quality Auditor](../dhis2-data-quality-auditor). It reuses the metadata-picker and dataStore patterns already proven in the Auditor and does not touch either sibling app.

## The problem this solves

DHIS2 admins have no single, guided way to safely share a specific slice of their data with an external consumer -- a dashboard, a partner org, a one-off file request. The pieces exist in DHIS2 core but are disconnected: Personal Access Tokens live under a user's own profile with no link to any dataset; CSV export means hand-constructing API URLs; there's no cross-cutting view of "who has an active share, of what, since when."

## A critical constraint this app is built around, not against

**DHIS2 Personal Access Tokens are self-service only.** Confirmed against DHIS2's own documentation: *"Personal access tokens are created using the User Profile app. Log in with your username and password and go to your profile page."* `POST /api/apiToken` only ever creates a token for whichever account is authenticated in that request -- there is no API for an admin to mint a token on behalf of a different user.

That means this app **cannot** fully automate "create a new restricted account and hand you back a ready-to-use API token for it." What it does automate: creating the scoped service account, setting its read-only data-view org units, and granting it read access to the dataset. The one thing it cannot do -- and does not pretend to do -- is mint that account's token. After a share is created, whoever administers the new account has to log in **once**, with a temporary password shown to them a single time, and generate their own token from Profile → API tokens. The app tells you this explicitly at every relevant point rather than hiding it.

## What it checks/does

Two independent sharing methods:

| Method | What happens | New credential created? |
|---|---|---|
| **CSV export** | Queries the slice using your own already-authenticated session, filters and builds the file entirely client-side, downloads it immediately. | No -- zero new security surface. |
| **API account** | Creates a new read-only service account (`POST /api/users`), scopes both `organisationUnits` (capture) and `dataViewOrganisationUnits` to the slice's org units, grants it read access to the dataset via the Sharing API, and shows a one-time temporary password (or sends an email invite if SMTP is configured). | Yes -- a new, minimal-permission account, not your own credentials. |

**Why capture org units, not just data-view:** confirmed live against a real DHIS2 instance that `GET /api/dataValueSets` rejects a read with *"User is not allowed to view org unit(s)"* when the org unit is only in `dataViewOrganisationUnits` -- that field alone isn't enough even for a pure read. Also confirmed live that this is still safe: the shared "Data Share Hub - Read Only" role has an empty `authorities` array, so a data-value write attempt from an account like this still returns `403`, regardless of its capture org units.

**Access scope is dataset-level, not data-element-level.** The "data elements to include" picker only filters what appears in a CSV export or the recipient's data table -- DHIS2's Sharing API grants access at the whole-dataset level, so a service account can technically read *any* data element in the shared dataset for its granted org units, not just the ones originally selected. Don't rely on the data-element picker as a real access restriction for API shares.

## What the recipient sees -- and a real DHIS2 platform limitation this ran into

The app has a dedicated `RecipientView`: when a logged-in account matches a `ShareRecord.serviceAccountUsername`, it shows a read-only page (not the admin's share registry, which would leak other recipients' labels/notes) with what they have access to, a live data table proving their access works, and token-generation instructions.

**Confirmed live, this view is unreachable for the recipient in practice, and there's no safe fix for that specific problem.** A newly-created, minimal-permission service account (`authorities: []`) authenticates fine and its data access works correctly (`GET /api/dataValueSets` returns real data), but DHIS2's own app-menu/search (`GET /api/apps.json`) excludes custom apps -- including this one, and including Data Share Hub itself -- for such an account, **even though the app declares no restriction** (`authorities: []` in `d2.config.js`, which per DHIS2's own convention should mean "visible to everyone"). This isn't a bug in this app's config: tested live with four different authorities on the shared role -- a core app's own specific authority (unlocked only that one core app), a guessed `M_<app-key>` pattern (no effect), an unrelated harmless authority (no effect), and `M_dhis-web-app-management` (which *did* unlock every custom app, including this one -- but that authority also grants the ability to install/manage/uninstall every app on the instance, which is completely inappropriate for a read-only recipient and was not used). This is a real DHIS2 platform behavior, not something fixable from an app's manifest.

**Part one of the fix: grant DHIS2-native data-viewing apps instead of trying to open this one.** The shared "Data Share Hub - Read Only" role's `authorities` (see `lib/serviceAccount.ts`'s `buildUserRolePayload`) are `M_dhis-web-dashboard` and `M_dhis-web-data-visualizer` -- confirmed live that each individually unlocks only that one app, nothing broader. (`M_dhis-web-pivot` was tried first and does nothing on modern DHIS2 -- the standalone Pivot Table app was merged into Data Visualizer, which has its own separate authority.)

**Part two, the more important one: granting those apps alone isn't enough.** DHIS2's Dashboard/Data Visualizer apps list every dashboard already visible to the account per each dashboard's *own* sharing settings -- confirmed live this means a recipient sees whatever else happens to be public on the instance (on a busy shared demo, that's a lot of unrelated content), not a filtered view of just their data. So every `api_account` share also creates a **dedicated, private pivot-table dashboard** scoped to exactly that share's dataset/data-elements/org-units (`lib/dashboard.ts`: `POST /api/visualizations` then `POST /api/dashboards`), and shares *only that one dashboard* with the recipient's account. Confirmed live that a freshly-created dashboard defaults to fully private (`publicAccess: "--------"`, no group/user access) until explicitly shared, so nothing is exposed by default. The direct link (`ShareRecord.dashboardUrl`) is included in the credential handoff and kept visible later in `ShareDetail`. Dashboard creation is wrapped in its own try/catch and never fails the share itself -- it's a visualization convenience, not the security-relevant part (the account and its actual data access already work without it).

**The dashboard also carries the token-generation instructions directly on the page** (`buildInstructionsText` -> a real, confirmed-live DHIS2 `TEXT` dashboard item type, not something bolted on externally), so the recipient still has the steps even if the admin's copy-pasted message never reaches them.

**Verified live exactly how locked-down this is, not just assumed:** fetching a real created dashboard's sharing state back showed `publicAccess: "--------"`, `userGroupAccesses: []`, and exactly one `userAccesses` entry -- the recipient's own service account. No other regular user, and no other API account created for a different share, can open that link or query that data. The one honest exception, true on every DHIS2 instance and not something any app can or should override: a superuser (`ALL` authority) can always see everything regardless of sharing settings.

**A second real bug caught by the user's own live testing, on a real "Project Management" dataset:** its file-upload data elements (`FILE_RESOURCE` value type) broke the pivot table with DHIS2's own error, *"Data elements must be of a value and aggregation type that allow aggregation."* The dataset's `aggregationType` field was not a reliable signal for this -- those elements reported `aggregationType: "SUM"` from the API despite being file uploads. Fixed by filtering to a real numeric-value-type allowlist (`VISUALIZABLE_VALUE_TYPES` in `lib/dashboard.ts`) specifically for what goes into the pivot table's `dx` dimension. **This filter only narrows what gets visualized -- it does not narrow what the recipient is granted read access to**, which stays dataset-wide as designed; a share made entirely of non-numeric data elements still grants full read access, it just won't get a dashboard chart (the credential handoff and `ShareDetail` already handle `dashboardUrl: null` gracefully for this case).

**A real bug this caught mid-testing, from the user's own live test:** the first version of `buildVisualizationPayload` set the top-level `relativePeriods` field but left the `pe` dimension's `items` empty, which is what DHIS2 actually reads to resolve the date range -- producing a real error on the recipient's dashboard ("A end date was not specified in periods, dimensions, filters"). Fixed by including the relative period as an item there too (`{ id: 'LAST_12_MONTHS' }`), verified live before shipping. Shares created before this fix have the broken visualization baked in and won't self-heal -- they'd need to be recreated.

`RecipientView` (the in-app page) still exists and still works for any account that *can* reach it (e.g. if a future DHIS2 version changes the app-menu behavior), but nothing in this app depends on the recipient reaching it -- the dashboard link and copy-paste instructions are the real path.

**A related self-healing fix worth knowing about:** `hooks/useCreateServiceAccount.ts`'s `findOrCreateRole` doesn't just create the shared role once and cache its id forever -- every share creation re-checks the existing role's authorities against `buildUserRolePayload()` and updates them if they've drifted. This matters because the role's required authorities changed twice after this app had already been used to create real shares -- without this sync, any role created before those changes would have silently kept its stale, more-restrictive authorities.

**Because of this, the credential handoff (`CredentialHandoff.tsx`) is written to be self-sufficient** -- it includes the dataset/org unit/date-range summary, a "Copy full instructions" button producing one paste-ready block (login steps, the token-generation steps, and a working example API URL), and an explicit note that the recipient may not be able to open this app from DHIS2's menu but can always reach the login page and their own Profile, which is all they actually need. Don't rely on the recipient successfully opening Data Share Hub itself -- relay the copied instructions directly (email, chat, however).

## Category option combos are NOT summed here

Unlike Data Quality Auditor's `useAuditDataTrust.ts`, CSV export does **not** sum values across category option combinations. That summing is correct there because it feeds quality-check arithmetic; here it would corrupt the fidelity of a raw export handed to a third party. Every category option combo is its own row.

## `dataStore` schema

Namespace `dataShareHub`, two keys:

```
GET /api/dataStore/dataShareHub/shares
{ "schemaVersion": 1, "shares": [ { "id": "...", "label": "...", "method": "csv_export" | "api_account", "...": "..." } ] }

GET /api/dataStore/dataShareHub/settings
{ "schemaVersion": 1, "minimalRoleId": "..." }
```

`settings.minimalRoleId` caches the id of the shared **"Data Share Hub - Read Only"** `userRole`, looked up or created once rather than on every share.

Same known v1 limitation as the Auditor, not solved: classic `dataStore` `PUT` has no ETag/If-Match, so concurrent-admin edits are last-write-wins.

## Revocation

The only v1 revoke mechanism is **disabling the service account** (`PATCH /api/users/{id}`, `disabled: true`) -- well-documented, reliable, cuts off all access regardless of token specifics. Whether an admin can delete a *specific PAT* belonging to another user via API is unconfirmed, so per-token deletion is not attempted. Revoking a share always disables the whole account.

## Authority gate -- and why it's different from the Auditor's

The Auditor's own gate is documented as *"a UI convenience gate, not a real security boundary"* -- because dataStore has no per-namespace ACL at all. **This app is different.** Creating users (`F_USER_ADD`) and editing a dataset's sharing are real, DHIS2-server-enforced privileged operations -- the server checks independently regardless of what this UI shows. So:

- The "Create API share" and "Revoke" entry points are shown only to users with `ALL` or `F_USER_ADD`.
- That check is a fail-fast UX convenience, not a guarantee -- per-dataset "manage sharing" access can't be fully pre-validated with one global boolean (an admin might have `F_USER_ADD` generally but not manage rights on *this specific* dataset). Every real `POST`/`PATCH` still surfaces a genuine 403 from the server if one occurs.
- **CSV export needs no gate at all** -- it runs entirely on the admin's own existing session with no elevated action requested.

## v1 scope

**In:** CSV export (own-session, aggregate datasets only), service-account creation with data-view scoping, dataset sharing grant, invite-email or one-time temp-password handoff, dataStore-backed share registry, account-disable revoke, authority-gated create/revoke.

**Deferred, not half-built:**
- **XLSX export** -- unconfirmed whether DHIS2 reliably supports Excel export on raw data endpoints (CSV/JSON/XML are confirmed; Excel is confirmed only for some resources like `reportTable`). Since CSV export is built from JSON already in hand, a client-side conversion (e.g. SheetJS) is the natural v1.1 path -- not attempted now.
- **Tracker/program data slices** -- a structurally different API and sharing model than aggregate datasets. The dataset picker only offers aggregate `dataSets` in v1; programs are out of scope, not half-supported.
- **Per-token deletion/revocation** -- unconfirmed whether an admin can delete another user's PAT via API. Account-disable is the only revoke path.
- **Verifying a recipient actually minted their token** -- `status: active` stays a manual, self-reported admin toggle. This app has no way to check whether a token exists for another account, and says so in the UI rather than faking confidence.
- Org-unit-hierarchy "include children" convenience, multi-admin concurrent-edit safety.

## Things flagged for live verification, not assumed

Two Sharing/Role API details are written defensively and must be confirmed against a real instance before being trusted:
- Whether an empty `authorities: []` array is accepted when creating the "Data Share Hub - Read Only" role, or a minimal real authority is required.
- The exact Sharing API access-string convention (`r-r-----` is the assumed read-only metadata+data pair) -- this is the single most load-bearing detail for whether the feature works at all, and is checked against a live `GET /api/sharing` response before the `POST` is trusted.

## Relationship to sibling apps

| | OneHealth Data Trust | Data Quality Auditor | Data Share Hub |
|---|---|---|---|
| Config | Static, 8 hardcoded programmes | Runtime, dataStore-backed | Runtime, dataStore-backed |
| New credentials created | No | No | Yes, for API shares (minimal-permission accounts) |
| Authority gate meaning | N/A | UI convenience only | Real server-enforced check, UI gate is fail-fast only |

Separate DHIS2 App Hub submissions, developed and versioned independently.

## Install

```bash
yarn install
yarn build       # produces build/bundle/*.zip
yarn test
```

Install the same way as the sibling apps: **Apps → App Management → Install app → Upload a ZIP file**, or via the App Management API. See `scripts/install-to-play-demo.sh` for the public-demo install pattern (same cross-host-redirect caveat documented in the Auditor's README applies here too).
