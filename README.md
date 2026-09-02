# Spotless API

Backend for a machine-learning waste intelligence platform. Citizens photograph waste; a CNN classifies what is in the image; collection organisations get dashboards, priorities and optimised routes.

This document is the contract for anyone building against the server — the web dashboard, the mobile apps, and the ML service.

- **Base URL:** `http://localhost:3000`
- **Stack:** NestJS 11, Sequelize 6 (`sequelize-typescript`), PostgreSQL, Socket.IO
- **Auth:** none. Role-based access, sessions and JWT are explicitly out of scope for the MVP, so **every endpoint below is unauthenticated**.
- **Optional env vars:** `GOOGLE_MAPS_API_KEY`, `OPENWEATHER_API_KEY` — see [Routing](#routing). Everything works without them.

```bash
npm install
npm run start:dev
```

The database connection string is hardcoded in [`src/app.module.ts`](src/app.module.ts). `synchronize` and `sync: { alter: true }` are on, so the schema is reconciled to the models on every boot.

---

## Conventions

Read this section once and the rest of the document gets much shorter.

### Identifiers

Every id is a **UUID v4 string**. There are no numeric ids anywhere. Note that `@IsUUID()` validates the variant nibble, so placeholder ids like `11111111-1111-1111-1111-111111111111` are rejected with a 400 — generate real UUIDs in tests.

### Timestamps

All timestamps are **ISO 8601 UTC strings** (`2026-08-31T15:38:29.371Z`). Every record carries `createdAt` and `updatedAt`, managed by the server; never send them.

### Soft deletes

Most tables are *paranoid*: `DELETE` sets `deletedAt` rather than removing the row, and the record disappears from every subsequent read. A `DELETE` returns **200 with an empty body**, and a following `GET` of the same id returns **404**.

Soft-deleted: `cases`, `collectors`, `wasteTypes`, `wasteInstances`, `routes`.
Hard-deleted: `routeStops` (they are replaced wholesale when a route is re-planned).

`deletedAt` appears in responses and is `null` for live records.

### Validation

A global `ValidationPipe` runs with `whitelist: true` and `transform: true`:

- **Unknown properties are silently stripped.** Sending `{"name":"x","isAdmin":true}` stores only `name`. You cannot set server-controlled fields such as `id` or `createdAt` by including them.
- Type and constraint failures return **400** with an array of messages.

### Error shape

Every error is a standard Nest exception body:

```json
{ "message": "Case 'a1b2…' not found", "error": "Not Found", "statusCode": 404 }
```

Validation errors put an **array of strings** in `message`:

```json
{ "message": ["name should not be empty", "hazardLevel must be a valid enum value"], "error": "Bad Request", "statusCode": 400 }
```

| Status | When |
|---|---|
| 200 | successful `GET`, `PATCH`, `DELETE` |
| 201 | successful `POST` |
| 400 | validation failure, bad enum, unknown foreign key, domain rule violation |
| 404 | id does not resolve to a live record |
| 500 | unexpected server or database failure |

A missing record is always **404**, never 500 — including on `PATCH` and `DELETE`.

### Enumerations

| Enum | Values | Used by |
|---|---|---|
| `Roles` | `spotter`, `collector`, `admin` | `User.role` |
| `Status` | `pending`, `open`, `inProgress`, `closed`, `rejected` | `Case.status` |
| `Priority` | `low`, `medium`, `high` | `Case.priority` |
| `hazardLevel` | `low`, `medium`, `high` | `WasteType.hazardLevel` |
| `RouteStatus` | `draft`, `dispatched`, `inProgress`, `completed`, `cancelled` | `Route.status` |
| `RouteStopStatus` | `pending`, `arrived`, `collected`, `skipped` | `RouteStop.status` |
| `RouteProvider` | `google.computeRoutes`, `google.computeRouteMatrix`, `offline.haversine` | `Route.provider` |

### Entity relationships

```
Collector 1──* User          (User.collectorId, nullable — citizens have none)
Collector 1──* Case          (Case.collectorId, nullable — set on dispatch)
User      1──* Case          (Case.reporterId — who reported it)
Case      1──* WasteInstance (WasteInstance.caseId — CNN detections)
WasteType 1──* WasteInstance (WasteInstance.wasteTypeId)
Collector 1──* Route         (Route.collectorId)
Route     1──* RouteStop     (RouteStop.routeId, cascade delete)
Case      1──* RouteStop     (RouteStop.caseId)
```

---

## Users

`User` objects are returned in full. **The bcrypt `password` hash is currently included in every user response** — see [Known gaps](#known-gaps).

```json
{
  "id": "585d5a51-8acb-4a2f-952e-6819de698b8d",
  "firstName": "Ada",
  "lastName": "Nakato",
  "email": "ada@example.com",
  "role": "spotter",
  "collectorId": null,
  "password": "$2b$10$0DwPpDbOSTt…",
  "isActive": true,
  "createdAt": "2026-08-31T11:02:12.426Z",
  "updatedAt": "2026-08-31T11:03:56.747Z"
}
```

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/users` | `CreateUserDto` | 201, `User` |
| `GET` | `/users` | — | 200, `User[]` |
| `GET` | `/users/:id` | — | 200, `User` |
| `PATCH` | `/users/:id` | partial `CreateUserDto` | 200, `User` |
| `DELETE` | `/users/:id` | — | 200, empty |

**`CreateUserDto`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `firstName` | string | yes | |
| `lastName` | string | yes | |
| `email` | string | yes | must be a valid email |
| `role` | string | yes | one of `Roles`, not currently enum-validated |
| `password` | string | yes | hashed with bcrypt before storage |
| `collectorId` | UUID | no | the organisation this user works for |

`PATCH` accepts any subset of the same fields.

> `GET /users` has no `ORDER BY`, so list order is not stable between calls. Sort client-side if order matters.

---

## Auth

A single credential check. It returns the `User` on success — there is no token, session or cookie.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/auth` | `{ "email": string, "password": string }` | **201**, `User` |

A successful login returns **201**, not 200 — it is a `POST` and Nest's default applies.

A wrong password and an unknown email are indistinguishable to the caller: both return **404**.

```json
{ "message": "Failed to login: Invalid password", "error": "Not Found", "statusCode": 404 }
{ "message": "Failed to login: Failed to retrieve user: User not found", "error": "Not Found", "statusCode": 404 }
```

The doubled prefix in the second is a message-wrapping quirk in `UsersService`, not two separate failures. Do not parse these strings — branch on the status code.

The request body is typed as an interface rather than a class, so the `ValidationPipe` does not inspect it; a malformed payload surfaces as a 404 rather than a 400.

---

## Cases

The core entity: one reported sighting of waste.

```json
{
  "id": "3aa19553-fdd9-48ab-8481-f319823b8a1a",
  "imagePath": "uploads/cases/c4439938-ece5-4e58-9a16-893b922e96e2.png",
  "caseVerified": false,
  "latitude": 0.315,
  "longitude": 32.58,
  "timeTaken": "2026-08-31T15:38:29.370Z",
  "reporterId": "585d5a51-8acb-4a2f-952e-6819de698b8d",
  "collectorId": null,
  "description": null,
  "status": "open",
  "priority": "low",
  "closedAt": null,
  "createdAt": "2026-08-31T15:38:29.371Z",
  "updatedAt": "2026-08-31T15:38:29.963Z",
  "deletedAt": null,
  "reporter": { "id": "…", "firstName": "Ada", "lastName": "Nakato", "email": "ada@example.com" },
  "collector": null
}
```

`reporter` and `collector` are joined on every read. `reporter` never includes the password hash. `collector` is `null` until the case is dispatched.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/case` | **`multipart/form-data`** | 201, `Case` |
| `GET` | `/case` | — | 200, `Case[]` (newest first) |
| `GET` | `/case/:id` | — | 200, `Case` |
| `PATCH` | `/case/:id` | `UpdateCaseDto` (JSON) | 200, `Case` |
| `DELETE` | `/case/:id` | — | 200, empty |

### Creating a case — multipart only

`POST /case` is the one endpoint that is **not** JSON. The photo is uploaded with the report.

| Field | Type | Required | Notes |
|---|---|---|---|
| `image` | file | yes | `image/jpeg`, `image/png` or `image/webp`; max **10 MB** |
| `latitude` | string | yes | −90 … 90 |
| `longitude` | string | yes | −180 … 180 |
| `reporterId` | UUID | yes | must match an existing user |
| `timeTaken` | string | no | ISO 8601; defaults to now |
| `description` | string | no | |

Because the body is multipart, every text field arrives as a **string**; the server parses and range-checks the coordinates. Send `latitude` as `"0.3476"`, not a JSON number.

```bash
curl -X POST http://localhost:3000/case \
  -F "image=@rubbish.jpg;type=image/jpeg" \
  -F "latitude=0.3476" -F "longitude=32.5825" \
  -F "reporterId=585d5a51-8acb-4a2f-952e-6819de698b8d" \
  -F "description=Overflowing skip near the market"
```

The server discards the client's filename, stores the file as a generated UUID under `uploads/cases/`, and returns the relative path in `imagePath`. New cases always start `status: "pending"`, `caseVerified: false`, `priority: null`.

Failures return 400 and the uploaded file is deleted rather than left orphaned:

- no `image` field → `A case requires a photo, sent as the 'image' field…`
- wrong MIME type → `Unsupported image type 'application/json'. Accepted: …`
- bad coordinate → `'latitude' must be a number between -90 and 90`
- unknown `reporterId` → `'reporterId' does not match a known user`

> The server does not serve the uploaded images back. `imagePath` is a path relative to the project root; static file serving is not configured yet.

### Updating a case — `UpdateCaseDto`

All fields optional; JSON.

| Field | Type | Notes |
|---|---|---|
| `latitude`, `longitude` | string | re-validated against the same ranges |
| `timeTaken` | string | ISO 8601 |
| `description` | string | |
| `status` | enum | `Status`; invalid values list the allowed set |
| `priority` | enum | `Priority` |
| `caseVerified` | boolean | accepts `true`/`false` or `"true"`/`"false"` |
| `collectorId` | UUID | dispatch the case to an organisation |

Setting `status` to `closed` stamps `closedAt` **once** — reopening and re-closing preserves the original resolution time. Assigning a `collectorId` does **not** change `status`; send both if a dispatch should also move the case to `inProgress`.

---

## Collectors

Organisations that respond to cases.

`GET /collectors` returns plain records. `GET /collectors/:id` additionally joins `staff` and `cases`:

```json
{
  "id": "baf865ce-7ace-48d7-b840-ad8e11285f51",
  "name": "Nakawa Collectors",
  "address": null,
  "employeeCount": 12,
  "averageRating": 4.2,
  "createdAt": "2026-08-31T15:38:29.184Z",
  "updatedAt": "2026-08-31T15:38:29.184Z",
  "deletedAt": null,
  "staff": [],
  "cases": [
    { "id": "2d89c1ef-…", "status": "inProgress", "priority": "high", "latitude": 0.3476, "longitude": 32.58 }
  ]
}
```

`staff` entries are `{ id, firstName, lastName, email, role }` — no password hashes.

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/collectors` | `CreateCollectorDto` | 201, `Collector` |
| `GET` | `/collectors` | — | 200, `Collector[]` (by name) |
| `GET` | `/collectors/:id` | — | 200, `Collector` with `staff` + `cases` |
| `PATCH` | `/collectors/:id` | partial `CreateCollectorDto` | 200, `Collector` |
| `DELETE` | `/collectors/:id` | — | 200, empty |

**`CreateCollectorDto`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | non-empty, **unique case-insensitively** |
| `address` | string | no | free text; no coordinates yet |
| `employeeCount` | integer | no | ≥ 0 |
| `averageRating` | number | no | 0 … 5, fractional allowed |

Two domain rules return 400:

- creating `"nakawa collectors"` when `"Nakawa Collectors"` exists → `Collector 'Nakawa Collectors' already exists`
- deleting a collector that still has unresolved cases → `Collector 'X' still has N unresolved case(s) assigned and cannot be removed`

A case counts as resolved once its status is `closed` or `rejected`.

---

## Waste

Two resources under one prefix. **The ML service is the primary client**: it posts detections after classifying a case image.

### Waste types — the catalog

```json
{
  "id": "ff20ee85-7c27-4902-b582-40ebeaf127bb",
  "name": "Plastic Bottle",
  "description": null,
  "material": "PET",
  "hazardLevel": "low",
  "createdAt": "2026-08-31T11:03:56.896Z",
  "updatedAt": "2026-08-31T11:03:56.896Z",
  "deletedAt": null
}
```

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/waste/types` | `CreateWasteTypeDto` | 201, `WasteType` |
| `GET` | `/waste/types` | — | 200, `WasteType[]` (by name) |
| `GET` | `/waste/types/:id` | — | 200, `WasteType` |
| `PATCH` | `/waste/types/:id` | partial | 200, `WasteType` |
| `DELETE` | `/waste/types/:id` | — | 200, empty |

**`CreateWasteTypeDto`** — `name` (string, required, unique case-insensitively), `description`, `material`, `hazardLevel` (enum) all optional. Only `name` is required so the auto-create path below can register an unseen CNN label.

Deleting a type that has recorded instances returns 400: `Waste type 'X' still has N recorded instance(s) and cannot be removed`.

### Waste instances — what the CNN found

One row per detection: *this waste type, this many, in this case*.

```json
{
  "id": "23b69992-1ee9-463d-8ef1-0f19608f0426",
  "wasteTypeId": "ff20ee85-…",
  "caseId": "2d89c1ef-…",
  "quantity": 12,
  "location": null,
  "date": "2026-09-01T04:34:02.441Z",
  "createdAt": "2026-09-01T04:34:02.442Z",
  "updatedAt": "2026-09-01T04:34:02.442Z",
  "deletedAt": null,
  "wasteType": { "id": "…", "name": "Plastic Bottle", "material": "PET", "hazardLevel": "low", "…": "…" },
  "case": { "id": "…", "status": "inProgress", "latitude": 0.3476, "longitude": 32.58, "imagePath": "uploads/cases/….png" }
}
```

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `POST` | `/waste/instances` | `CreateWasteInstanceDto` | 201, `WasteInstance` |
| `GET` | `/waste/instances` | `?caseId=` `?wasteTypeId=` | 200, `WasteInstance[]` (newest first) |
| `GET` | `/waste/instances/:id` | — | 200, `WasteInstance` |
| `PATCH` | `/waste/instances/:id` | partial | 200, `WasteInstance` |
| `DELETE` | `/waste/instances/:id` | — | 200, empty |

**`CreateWasteInstanceDto`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `caseId` | UUID | yes | must match an existing case |
| `wasteTypeId` | UUID | no* | when the ML service already knows the id |
| `wasteTypeName` | string | no* | the CNN's own label, e.g. `"plastic bottle"` |
| `quantity` | integer | no | ≥ 1, defaults to `1` |
| `date` | string | no | ISO 8601, defaults to now |
| `location` | string | no | redundant with the case's coordinates |

\* Exactly one of `wasteTypeId` or `wasteTypeName` is required; omitting both returns 400 `Provide either 'wasteTypeId' or 'wasteTypeName'`.

**How label resolution works.** `wasteTypeId` wins when present. Otherwise the label is trimmed, internal whitespace collapsed, and matched **case-insensitively** against the catalog — `"plastic bottle"` resolves to an existing `"Plastic Bottle"` rather than creating a second entry. A genuinely new label creates a new waste type with only its name set, for an admin to enrich later.

Creation runs in a transaction: if the instance insert fails (an unknown `caseId`, for instance), an auto-created waste type is rolled back with it, so a rejected detection never leaves a junk catalog entry.

```bash
curl -X POST http://localhost:3000/waste/instances \
  -H 'Content-Type: application/json' \
  -d '{"caseId":"2d89c1ef-…","wasteTypeName":"plastic bottle","quantity":12}'
```

---

## Routing

Plans a collection run: pick nearby cases worth visiting, put them in a sensible order, and store the result.

A `Route` carries `id`, `name`, `collectorId`, `status` (`RouteStatus`), `plannedFor` (date), `originLatitude`, `originLongitude`, `totalDistanceMeters`, `totalDurationSeconds`, `encodedPolyline`, `provider` (`RouteProvider`), `optimizedAt`, a joined `collector`, and `stops` **ordered by `sequence`**.

Each `RouteStop` carries `id`, `routeId`, `caseId`, `sequence` (1-based), `legDistanceMeters`, `legDurationSeconds`, `estimatedArrival`, `arrivedAt`, `completedAt`, `status` (`RouteStopStatus`), and its joined `case`.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| `POST` | `/routing/plan` | `PlanRouteDto` | 201, `Route` with `stops` |
| `GET` | `/routing` | `?collectorId=` | 200, `Route[]` (newest first) |
| `GET` | `/routing/:id` | — | 200, `Route` |
| `PATCH` | `/routing/:id` | `{ name?, status? }` | 200, `Route` |
| `DELETE` | `/routing/:id` | — | 200, empty |

**`PlanRouteDto`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `collectorId` | UUID | yes | must exist |
| `name` | string | no | defaults to `Run YYYY-MM-DD` |
| `plannedFor` | date string | no | defaults to today |
| `originLatitude` | number | no* | depot latitude |
| `originLongitude` | number | no* | depot longitude |
| `maxStops` | integer | no | 1–25, defaults to 25 |
| `radiusKm` | number | no | 0.1–100, defaults to 10 |

\* Omit both and the collector's `address` is geocoded instead — see below.

### Which cases get selected

A case is a candidate only when **all** hold: `caseVerified` is `true`, `status` is `pending` or `open`, it falls within `radiusKm` of the origin, and it is not already on a live route. Candidates are then sorted by straight-line distance from the depot and cut to `maxStops`, so the cap keeps the *nearest* cases.

Cases on a route whose status is `completed` or `cancelled` are released and can be planned again. Planning does **not** modify the cases — it sets no `collectorId` and changes no `status`. Dispatch stays a separate action.

With nothing available you get a 400: `No open, verified cases within 10km of the origin are available to plan`.

### How the order is chosen

`provider` on the returned route records which of three strategies ran:

| `provider` | When | Distances | Durations | Polyline |
|---|---|---|---|---|
| `google.computeRoutes` | ≤ 2 stops, key present | road | road | **yes** |
| `google.computeRouteMatrix` | > 2 stops, key present | road | road | no |
| `offline.haversine` | no `GOOGLE_MAPS_API_KEY` | straight-line | **null** | no |

Short runs go to `computeRoutes`, which orders the stops and returns a drawable polyline in one call. Longer runs buy a cost matrix once and order it locally with nearest-neighbour + 2-opt, which avoids paying for waypoint optimisation on every replan; the matrix endpoint returns no geometry, so `encodedPolyline` is `null` and the client should draw straight lines between stops.

The offline fallback needs no key and makes no network call. Its distances are as-the-crow-flies and therefore optimistic, and **every duration is `null`** — without road data any number would be invented. Render time as `—` when `provider` is `offline.haversine`.

### Origin and geocoding

Send `originLatitude`/`originLongitude` and no lookup happens. Otherwise the collector's `address` is resolved through the **OpenWeather geocoding API**, and that answer is held in an **in-memory cache only** (24-hour TTL) — no collector coordinate is ever written to a table.

Two consequences worth planning around:

- The cache dies with the process, so the first plan after a restart re-geocodes.
- OpenWeather resolves **place names, not street addresses**. `"Kampala,UG"` works; `"Plot 12, Nakawa"` will not. Prefer sending explicit coordinates from a map picker.

Without `OPENWEATHER_API_KEY`, or when the address does not resolve, you get a 400 naming both fixes.

### Configuration

Both keys are read from the environment and both are optional:

| Variable | Effect when unset |
|---|---|
| `GOOGLE_MAPS_API_KEY` | planner uses `offline.haversine` |
| `OPENWEATHER_API_KEY` | plan requests must carry explicit origin coordinates |

---

## Analytics — WebSocket

Live dashboard data. **Socket.IO**, mounted on the same origin and port as the REST API. There is no HTTP endpoint for analytics and no polling: the server pushes.

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('analytics:snapshot', (snapshot) => {
  render(snapshot);          // fires on connect, then on every relevant write
});

socket.emit('analytics:refresh');   // optional manual resync after a reconnect
```

| Direction | Event | Payload |
|---|---|---|
| server → client | `analytics:snapshot` | `AnalyticsSnapshot` |
| client → server | `analytics:refresh` | none; server replies with a snapshot |

**Delivery semantics you can rely on:**

- One snapshot arrives **immediately on connect**.
- Another arrives after any write to cases, waste instances, waste types or routes — including writes made by *other* clients or by the ML service.
- Snapshots are recomputed **after the database transaction commits**, so figures are never mid-transaction. A rolled-back write pushes nothing.
- Bursts are collapsed into at most one snapshot per **250 ms**, so a batch of CNN detections yields one update, not one per row.
- The payload is **always complete** — never a delta. Replace your state wholesale; there is nothing to merge.
- CORS is currently `origin: '*'`.

### `AnalyticsSnapshot`

```ts
{
  generatedAt: string;   // ISO 8601
  live:  LiveView;       // 1. heat map, case tracker, route viewer
  cases: CasesOverview;  // 2. case counts
  waste: WasteMetrics;   // 3. waste breakdown
}
```

#### 1. `live` — map and tracker

```ts
{
  points: HeatPoint[];
  activeCases: TrackedCase[];
  routes: RouteView[];
}
```

Both `points` and `activeCases` cover exactly the **unresolved** cases — anything not `closed` or `rejected`. They are the same set viewed two ways: `points` is trimmed for a heat layer, `activeCases` carries the detail a list or popup needs.

**`HeatPoint`** — one per unresolved case.

| Field | Type | Notes |
|---|---|---|
| `caseId` | string | |
| `latitude`, `longitude` | number | |
| `weight` | number | intensity for the heat layer |
| `status` | string | `Status` |
| `priority` | string \| null | `null` until triaged |
| `verified` | boolean | |

`weight` is `severity × max(1, totalWasteQuantity)`, where severity is `low`→1, `medium`→2, `high`→3, and an untriaged case counts as 1. A high-priority case holding 17 detected items weighs `3 × 17 = 51`. **Weights are unbounded and skew heavily** — one case with thousands of items will dominate. Normalise or apply a log scale before feeding a heat layer.

**`TrackedCase`** — one per unresolved case.

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `status`, `priority`, `verified` | | as above |
| `latitude`, `longitude` | number | |
| `reportedAt` | string | `timeTaken`, falling back to `createdAt` |
| `collector` | `{ id, name }` \| null | `null` when not yet dispatched |
| `wasteQuantity` | number | summed across the case's detections; `0` if none |

**`RouteView`** — every route, newest first.

| Field | Type | Notes |
|---|---|---|
| `id`, `name` | string | |
| `status` | string | `RouteStatus` |
| `collectorId` | string | |
| `totalDistanceMeters` | number \| null | `null` until optimised |
| `totalDurationSeconds` | number \| null | |
| `encodedPolyline` | string \| null | Google encoded polyline; decode to draw the line |
| `stops` | `RouteStopView[]` | **ordered by `sequence`** |

**`RouteStopView`**

| Field | Type | Notes |
|---|---|---|
| `caseId` | string | |
| `sequence` | number | 1-based visit order |
| `status` | string | `RouteStopStatus` |
| `latitude`, `longitude` | number \| null | from the joined case |
| `caseStatus` | string \| null | the case's own `Status` — distinct from the stop's |
| `priority` | string \| null | |
| `estimatedArrival` | string \| null | ISO 8601 |

Note the two independent status fields: `status` is progress on the visit (`pending` → `arrived` → `collected`/`skipped`), `caseStatus` is the case's lifecycle. A stop can be `collected` while the case is still `inProgress`.

#### 2. `cases` — overview counters

| Field | Type | Notes |
|---|---|---|
| `total` | number | every case, **including** closed and rejected |
| `byStatus` | `Record<string, number>` | keyed by `Status`; **absent statuses are omitted, not zero** |
| `byPriority` | `Record<string, number>` | keyed by `Priority`, plus **`"unset"`** for untriaged cases |
| `verified` | number | `caseVerified === true` |
| `unverified` | number | `total − verified` |
| `unassigned` | number | unresolved cases with no `collectorId` |
| `openedLast24h` | number | by `createdAt` |
| `openedLast7d` | number | by `createdAt` |
| `avgResolutionHours` | number \| null | mean `closedAt − createdAt`, 2 dp; `null` when nothing has closed |

```json
{
  "total": 3,
  "byStatus": { "closed": 1, "inProgress": 1, "open": 1 },
  "byPriority": { "high": 1, "low": 1, "unset": 1 },
  "verified": 1, "unverified": 2, "unassigned": 1,
  "openedLast24h": 3, "openedLast7d": 3,
  "avgResolutionHours": 6.55
}
```

Iterate the enum and default to `0` rather than reading `byStatus.rejected` directly — a status with no cases has no key.

#### 3. `waste` — what is being thrown away

| Field | Type | Notes |
|---|---|---|
| `totalDetections` | number | count of instance rows |
| `totalQuantity` | number | summed `quantity` |
| `byType` | `WasteTypeMetric[]` | **sorted by `quantity`, descending** |
| `byHazardLevel` | `Record<string, number>` | quantity per level, plus **`"unclassified"`** |

**`WasteTypeMetric`** — `wasteTypeId`, `name`, `hazardLevel` (`null` for auto-created types), `detections` (how many rows), `quantity` (how many items).

`detections` and `quantity` answer different questions: `detections` is how often a type shows up across cases, `quantity` is how much of it there is. `byType` is already ordered for a "top waste types" chart.

```json
{
  "totalDetections": 8,
  "totalQuantity": 8125,
  "byType": [
    { "wasteTypeId": "ff20ee85-…", "name": "Plastic Bottle", "hazardLevel": "low", "detections": 4, "quantity": 8112 },
    { "wasteTypeId": "47387be5-…", "name": "banana peel", "hazardLevel": null, "detections": 2, "quantity": 5 }
  ],
  "byHazardLevel": { "low": 8112, "high": 5, "unclassified": 8 }
}
```

---

## Known gaps

Current, deliberate limitations. Plan around them.

1. **No authentication or authorisation anywhere.** Any client can create users, dispatch cases, change any case's `status` or `caseVerified`, or post ML detections. This is the documented MVP scope.
2. **Route planning does not dispatch.** A plan reserves its cases against re-planning, but sets no `collectorId` and changes no case `status`; do that with `PATCH /case/:id`.
3. **Uploaded images are not served.** `imagePath` is a server-relative path with no static route configured.
4. **`GET /users` has no stable ordering.** Other list endpoints do sort (`/case` and `/waste/instances` newest first, `/collectors` and `/waste/types` by name).
5. **`role` is not enum-validated** on `CreateUserDto`; it accepts any string.
6. **The WebSocket gateway is single-instance.** Broadcasts reach only clients connected to the same process; running more than one server needs a Redis adapter or Postgres `LISTEN/NOTIFY`.
7. **`sync: { alter: true }` runs on every boot.** Convenient in development, but it will reshape tables to match the models — replace with migrations before deploying.
