# MediFind Connect — Frontend Integration Guide & API Contract Readiness

**Prepared by:** Person B (Backend Architect)  
**Target Audience:** Person A (Frontend Lead)  
**Contract Sources:**
* OpenAPI 3.1 Specification: [openapi.yaml](./openapi.yaml)
* Shared TypeScript Models: [models.ts](./models.ts)

---

## 1. API Base URL & Environment Conventions

The frontend must resolve all backend requests dynamically via `NEXT_PUBLIC_API_BASE_URL` (never hardcode URLs):

* **Production (Render):** `https://medifind-connect-vh5s.onrender.com`
* **Local Development:** `http://localhost:5000`

### Route & Naming Conventions
* System probes are mounted at both `/health` and `/api/health` (and `/readiness`, `/api/readiness`).
* All domain endpoints will be versioned under **`/api/v1/`**:
  * `/api/v1/medicines`
  * `/api/v1/pharmacies`
  * `/api/v1/transfers`
  * `/api/v1/intelligence`
  * `/api/v1/auth`
* Use `camelCase` for all JSON request and response keys.
* All IDs are UUID v4 strings; all timestamps are ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`); all currency amounts are numeric INR.

---

## 2. Standard Response & Error Formats

### 2.1 Success Envelope
```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": { ... },
  "timestamp": "2026-11-26T17:00:00.000Z"
}
```

### 2.2 Error Envelope
Every `4xx` and `5xx` error conforms strictly to:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Requested quantity exceeds available stock.",
    "details": [
      { "path": "quantityRequested", "message": "Available: 4, Requested: 10" }
    ]
  },
  "timestamp": "2026-11-26T17:00:00.000Z"
}
```

### 2.3 Pagination Convention
List endpoints accept `?page=1&limit=20` (max `limit=100`) and return:
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 142,
      "totalPages": 8
    }
  },
  "timestamp": "2026-11-26T17:00:00.000Z"
}
```

---

## 3. Authentication & Authorization Approach (Planned)

* **Provider:** Supabase Auth issuing cryptographic JWT tokens.
* **Transport:** Frontend sends `Authorization: Bearer <access_token>` on all protected requests.
* **Roles:** `consumer`, `pharmacy_staff`, `pharmacy_admin`, `network_admin`.
* **Tenant Isolation:** Pharmacy staff can only read or mutate inventory, dashboard KPIs, and transfer records belonging to their assigned `pharmacyId`. Unauthorized access returns `403 FORBIDDEN`.

---

## 4. Endpoints Available NOW vs. Planned for Later

### Available NOW (Operational & Implemented)
* `GET /api/health` (and `GET /health`) — Liveness check returning `status: "ok"`.
* `GET /api/readiness` (and `GET /readiness`) — Supabase PostgreSQL connectivity probe.
* `GET /api/v1/medicines` — Ranked medicine search (`q`, `form`, `page`, `limit`) with separate `items` and `suggestions`.
* `GET /api/v1/medicines/:id` — Public medicine details and brands.
* `GET /api/v1/medicines/:id/availability` — Geo-sorted availability (`lat`, `lng`, `radiusKm`) excluding expired stock and private fields.
* `GET /api/v1/medicines/:id/prices` — INR price comparisons across compatible formulations (`sortBy=price_asc|distance_asc`).
* **Pharmacy Management:**
  * `POST /api/v1/pharmacies/register` — Canonical self-service (email + password) or authenticated pharmacy registration with drug license validation, `PENDING_VERIFICATION` status, `Idempotency-Key` retry safety, and automatic Auth rollback on partial failure.
  * `POST /api/v1/pharmacies` — Backward-compatible authenticated registration alias (requires `Authorization: Bearer <Supabase_JWT>`).
  * **Admin License Verification (Requires Administrator JWT):**
    * `GET /api/v1/admin/pharmacies/pending` — List pharmacies by verification status (`PENDING` default).
    * `GET /api/v1/admin/pharmacies/:id/verification` — View submitted license details and immutable verification audit history.
    * `PATCH /api/v1/admin/pharmacies/:id/verification` — Approve (`VERIFIED`, `isLicensedVerified: true`) or reject (`REJECTED` with mandatory reason); blocks self-approval.
  * *(Protected `/me/*` routes below require `Authorization: Bearer <Supabase_JWT>`):*
  * `GET / PUT /api/v1/pharmacies/me` — Retrieve / update authorized pharmacy profile.
  * `GET / PUT /api/v1/pharmacies/me/operating-hours` — Retrieve / update IST operating hours.
  * `GET /api/v1/pharmacies/me/dashboard` — Real inventory KPIs and recent movements.
  * `GET /api/v1/pharmacies/me/alerts` — Configurable alerts (`?nearExpiryDays=30`).
  * `GET / POST /api/v1/pharmacies/me/inventory` — Search/filter/paginate or add batch.
  * `GET / PUT /api/v1/pharmacies/me/inventory/:itemId` — View or update batch metadata.
  * `POST /api/v1/pharmacies/me/inventory/:itemId/adjust` — Atomic stock adjustment with audit history.
  * `GET /api/v1/pharmacies/me/inventory/:itemId/history` — Item stock movement ledger.
* **Pharmacy-to-Pharmacy Collaboration (Requires `Authorization: Bearer <Supabase_JWT>`):**
  * `GET /api/v1/collaboration/stock` — Discover eligible transfer stock (excludes expired, controlled, and private counts).
  * `GET / POST /api/v1/collaboration/transfers` — List participant transfers or create a new transfer request.
  * `GET /api/v1/collaboration/transfers/:transferId` — View transfer details and immutable audit history.
  * `POST /api/v1/collaboration/transfers/:transferId/{approve|reject|dispatch|receive|cancel}` — Atomic state transitions (supports `Idempotency-Key` header).
* **Local Demand Intelligence (Requires `Authorization: Bearer <Supabase_JWT>` + Authorized Pharmacy):**
  * `GET /api/v1/intelligence/demand/overview` — Area-scoped aggregated demand, unmet signals, eligible supply indicators, and period-over-period change.
  * `GET /api/v1/intelligence/demand/trends` — Day/week aggregated search trends (`medicineId`, `area`, `fromDate`, `toDate`, `granularity`, `page`, `limit`).
  * `GET /api/v1/intelligence/demand/areas` — Coarse area-wise aggregated demand and supply indicators.
  * `GET /api/v1/intelligence/demand/unmet` — Aggregated unmet demand signals (`NO_MATCH`, `NO_ELIGIBLE_NEARBY_STOCK`, `PARTIAL_AVAILABILITY`).
  * `GET /api/v1/intelligence/demand/medicines/:medicineId` — Per-medicine local demand level, trend, supply indicators, and data confidence.
  * `GET /api/v1/pharmacies/me/intelligence/demand` — Demand intelligence strictly scoped to the authenticated pharmacy's permitted area.
  * `GET /api/v1/intelligence/shortages` & `GET /api/v1/intelligence/shortages/:medicineId` — Multi-factor area shortage-risk radar (`LOW | MODERATE | HIGH | INSUFFICIENT_DATA`).
  * `GET /api/v1/pharmacies/me/intelligence/restock` & `/:medicineId` — Pharmacy-specific restock review recommendations (`DEMAND_SIGNAL_BASED` when sales absent; never auto-orders).
  * `GET /api/v1/intelligence/forecast` — Walk-forward exponential-smoothing demand-signal forecast with MAE/RMSE/MAPE & Naive baseline evaluation.
  * `GET /api/v1/intelligence/matches` — Potential peer-to-peer transfer matches for verified pharmacies (excludes expired/reserved/controlled/cold-chain; never auto-creates transfers).
  * *Privacy & Thresholds:* Minimum group threshold (`DEMAND_MIN_THRESHOLD`, default `5`) suppresses small groups and prevents differencing; no raw events, IPs, or exact timestamps are exposed; 90-day aggregate retention and 15-minute SHA-256 deduplication window.

### Planned for Upcoming Phases (NOT YET IMPLEMENTED)
Do **not** call these in production UI without fallback/mocking until Person B marks them operational:
* **Public Pharmacy Directory:** `GET /api/v1/pharmacies`, `GET /api/v1/pharmacies/:id`

---

## 5. Page-by-Page Frontend Integration Map

| Frontend Page | Route | Required Data & Operations | Auth & Authz | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Landing Page** | `/` | Backend liveness (`GET /health`) | Public | **Available Now** |
| **Medicine Search** | `/medicines` | `GET /api/v1/medicines?q=...`, `GET /api/v1/medicines/:id/availability`, `.../prices` | Public | Planned |
| **Pharmacy Discovery** | `/pharmacies` | `GET /api/v1/pharmacies?area=...`, `GET /api/v1/pharmacies/:id` | Public | Planned |
| **Pharmacy Login / Reg** | `/pharmacy/login`, `/register` | `POST /api/v1/auth/login`, `POST /api/v1/pharmacies/register` | Public | Planned |
| **Pharmacy Dashboard** | `/pharmacy/dashboard` | `GET /api/v1/pharmacies/:id/dashboard` (low stock counts, pending transfers, revenue) | `Bearer` (`pharmacy_staff` of `:id`) | Planned |
| **Inventory Management** | `/pharmacy/inventory` | `GET /api/v1/pharmacies/:id/inventory`, `PATCH /api/v1/pharmacies/:id/inventory` | `Bearer` (`pharmacy_staff` of `:id`) | Planned |
| **Pharmacy Collaboration** | `/collaboration` | `GET /api/v1/collaboration/stock`, `GET/POST /api/v1/collaboration/transfers`, `POST /api/v1/collaboration/transfers/:id/{approve\|reject\|dispatch\|receive\|cancel}` | `Bearer` (authorized pharmacy participant) | **Available Now** |
| **Intelligence Overview** | `/intelligence` | `GET /api/v1/intelligence/demand/overview`, `/trends`, `/areas`, `/unmet`, `GET /api/v1/pharmacies/me/intelligence/demand` | `Bearer` (authorized pharmacy) | **Available Now** |
| **Shortage Radar** | `/intelligence/shortage-radar` | `GET /api/v1/intelligence/shortages`, `/shortages/:medicineId` | `Bearer` (authorized pharmacy) | **Available Now** |
| **Smart Restock** | `/intelligence/smart-restock` | `GET /api/v1/pharmacies/me/intelligence/restock`, `/restock/:medicineId` | `Bearer` (authorized pharmacy) | **Available Now** |

### Loading & Error Handling Expectations
* **Cold Starts (Render Free Tier):** Initial requests after 15 minutes of inactivity may take 30–50s. Use non-blocking loading skeletons and timeouts >= 15s on interactive queries.
* **401 / 403 Handling:** Redirect to `/pharmacy/login` on `401 UNAUTHORIZED`; display permission-denied banner on `403 FORBIDDEN`.
* **409 Conflict Handling:** Display exact backend message on `INSUFFICIENT_STOCK` or `INVALID_STATE_TRANSITION` (e.g., trying to approve an already-approved transfer).

---

## 6. Security, Privacy & Business Rules

1. **Tenant Isolation:** Pharmacy staff can strictly access/modify only their own pharmacy's private inventory.
2. **Non-Negative & Race-Safe Stock:** Inventory quantities can never drop below `0`; concurrent sales/transfers use atomic row-level database locks.
3. **Transfer State Machine & Cancellation Rules:**
   * Permitted forward transitions: `REQUESTED` -> `APPROVED` / `REJECTED` -> `DISPATCHED` -> `RECEIVED`.
   * Permitted `CANCELLED` transitions:
     * From `REQUESTED`: `requesting_pharmacy` or `network_admin` (no stock effect).
     * From `APPROVED`: `requesting_pharmacy`, `fulfilling_pharmacy`, or `network_admin` (releases reserved stock back to `quantityAvailable`).
     * From `DISPATCHED`: `fulfilling_pharmacy` or `network_admin` only, with mandatory audit reason (in-transit recall/damage reconciliation).
   * Terminal states (`REJECTED`, `RECEIVED`, `CANCELLED`) allow **no** further transitions; duplicate actions return `409 CONFLICT`.
4. **Patient Privacy:** Demand analytics are aggregated at the geographic `area` level. Individual patient search histories or PII are never stored or exposed.
5. **Explainable AI:** Shortage and Restock insights always include `evidence`, `generatedAt` timestamps, and `confidence` / `uncertaintyNote` fields.
6. **Regulatory Compliance:** Controlled and prescription-only medicines (`isPrescriptionRequired: true`) must enforce prescription flags before dispensing or transfer.

---

## 7. Fields the Frontend Must NOT Assume

* **Do NOT expect `licenseNumber` or internal `email`** in public `/api/v1/pharmacies` discovery responses — public endpoints return `PublicPharmacy`, while `InternalPharmacy` is restricted to authorized staff/admins.
* **Do NOT expect `unitCostPrice` (wholesale cost)** in public `/medicines/:id/availability` responses — it is strictly confidential to the owning pharmacy.
* **Do NOT expect exact batch counts** in public patient search results — use `status` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`) and `isApproximateStockHigh`.
* **Do NOT expect `SUPABASE_SERVICE_ROLE_KEY`** in frontend `.env` — it belongs exclusively on the Render backend.
* **Do NOT expect live AI alerts without `confidence` / `uncertaintyNote`** — low-volume areas may return low-confidence notices rather than definitive predictions.

---

## 8. Remaining Contract Work (Planned Phase 5+)

* All `/api/v1/*` endpoints in `openapi.yaml` are currently **drafts/planned** and will have full `requestBody` and concrete `200`/`201` response schema `$ref` bindings finalized prior to backend implementation in Phase 5.
