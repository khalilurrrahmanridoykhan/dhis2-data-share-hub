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
