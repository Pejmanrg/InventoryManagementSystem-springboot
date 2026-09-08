# Cloud-Based Inventory Management System — Front-End Prototype

Clickable HTML / CSS / vanilla-JavaScript prototype of the browser application described in
the *Software Design Description* (Group 2 — Pejman Govari, Gregory Corder).

**No backend.** All data is mocked in `js/data.js` and served through a promise-based
mock API in `js/api.js`. Every mock function is annotated with the REST endpoint it is
expected to become, so the screens can be pointed at a Spring Boot service without
rewriting any UI code.

---

## 1. File structure

```
frontend-prototype/
├── index.html                 Screen 1  — Login (mocked Entra ID sign-in + demo roles)
├── dashboard.html             Screen 2  — Role-aware dashboard
├── assets.html                Screen 3  — Assets list (search, filters, sort, export)
├── asset-detail.html          Screen 4  — Asset detail + transaction history + lifecycle actions
├── asset-new.html             Screen 5  — Create asset (validation states)
├── checkout.html              Screen 6  — Check-out workflow (3 steps + confirmation)
├── checkin.html               Screen 7  — Check-in workflow (3 steps + confirmation)
├── inventory.html             Screen 8  — Quantity-based inventory list
├── inventory-adjust.html      Screen 9  — Inventory adjustment (negative-stock guard)
├── maintenance.html           Screen 10 — Work orders (create / start / close)
├── reports.html               Screen 11 — Four ReportService reports
├── admin.html                 Screen 12 — Users, roles, lookups, integrations
├── audit.html                 Screen 13 — Audit history (search, filter, export)
│
├── css/
│   └── styles.css             Design tokens, app shell, tables, forms, badges, modals,
│                              responsive rules (desktop / tablet / mobile), print styles
│
├── js/
│   ├── data.js                Mock dataset shaped like the future JSON payloads
│   ├── store.js               Session-scoped state container (sessionStorage + in-memory fallback)
│   ├── api.js                 Mock API — one function per planned REST endpoint
│   ├── ui.js                  Shell, navigation, RBAC helpers, modal, toast, formatters
│   └── pages/                 One script per screen
│       ├── login.js               dashboard.js        assets.js
│       ├── asset-detail.js        asset-new.js        checkout.js
│       ├── checkin.js             inventory.js        inventory-adjust.js
│       ├── maintenance.js         reports.js          admin.js
│       └── audit.js
└── README.md
```

Each HTML file is a thin shell. `UI.mountShell()` renders the sidebar, top bar, modal
host, and toast region so all 13 screens stay structurally identical — the predictable
layout and button placement required by SDD section 2.1.2.

### Load order (already wired in every page)

```
data.js  →  store.js  →  api.js  →  ui.js  →  pages/<screen>.js
```

---

## 2. How to run it locally

The prototype is static. It needs a local web server (opening `index.html` with
`file://` works in most browsers but is not reliable for all of them).

### Option A — VS Code Live Server (recommended)

```
code frontend-prototype
```

Then, in VS Code:

1. `Ctrl+Shift+X` → search **Live Server** (Ritwick Dey) → **Install**
2. Right-click `index.html` in the Explorer → **Open with Live Server**
3. The browser opens at `http://127.0.0.1:5500/index.html`

### Option B — Python (no extension needed)

```
cd frontend-prototype
python -m http.server 5500
```

Open <http://localhost:5500/index.html>

### Option C — Node

```
cd frontend-prototype
npx --yes serve -l 5500 .
```

Open <http://localhost:5500/index.html>

### Using the prototype

* Pick any of the four demo accounts on the login screen — the sidebar, buttons, and
  pages change with the role.
* **Scan** in the top bar simulates a barcode / QR lookup: type `IT-10042`, `VEH-204`,
  or `TOOL-3312`.
* Changes persist across pages for the tab session. Close the tab, or use
  **Account → Reset demo data**, to restore the original sample records.

### Demo accounts

| Account | Role | Sees |
|---|---|---|
| Maria Alvarez | Warehouse / Field User | Dashboard, assets, check-out/in, inventory, adjustments, maintenance, basic reports |
| Dana Nguyen | Manager / Supervisor | Everything above, plus dispose/recover, close work orders, all reports, audit |
| Chris Boone | Purchasing / Finance | Read-only assets and inventory, cost and value data, purchase orders, reports, audit |
| Priya Raman | System Administrator | Everything, plus users and roles, lookups, integrations, audit export |

---

## 3. Screen-to-function mapping

| # | Screen | SDD component (CSC) | Java class / method today | Planned REST endpoint |
|---|---|---|---|---|
| 1 | Login | CSC-09 Identity & Access | *(not implemented)* | OIDC redirect + `POST /api/v1/auth/session` |
| 2 | Dashboard | CSC-06 Reporting & Administration | *(not implemented)* | `GET /api/v1/reports/summary` |
| 3 | Assets list | CSC-03 Asset & Inventory | `AssetService.searchAssets()` → `AssetRepository.search()` | `GET /api/v1/assets?query=&status=&locationId=` |
| 4 | Asset detail | CSC-03 + CSC-04 | `AssetService.getAsset()`, `TransactionService.getHistory()` | `GET /api/v1/assets/{id}`, `GET /api/v1/assets/{id}/transactions` |
| 5 | Create asset | CSC-03 | `AssetService.createAsset()` | `POST /api/v1/assets` |
| 6 | Check-out workflow | CSC-04 Transactions | `TransactionService.checkOut()` | `POST /api/v1/assets/{id}/checkout` |
| 7 | Check-in workflow | CSC-04 Transactions | `TransactionService.checkIn()` | `POST /api/v1/assets/{id}/checkin` |
| 8 | Inventory list | CSC-03 | `InventoryService.getStock()` | `GET /api/v1/inventory` |
| 9 | Inventory adjustment | CSC-03 | `InventoryService.adjustQuantity()` | `POST /api/v1/inventory/{id}/adjust` |
| 10 | Maintenance | CSC-05 Maintenance & Purchasing | *(planned)* `MaintenanceService.createWorkOrder/updateWorkOrder/closeWorkOrder` | `GET/POST /api/v1/work-orders`, `POST /api/v1/work-orders/{id}/close` |
| 11 | Reports | CSC-06 | *(planned)* `ReportService.assetsBySite/assetsByEmployee/lowStock/maintenanceDue` | `GET /api/v1/reports/{name}` |
| 12 | Users & roles | CSC-06 + CSC-13 | *(planned)* `UserRoleService.assignRole/removeRole` | `PUT /api/v1/admin/users/{id}/role`, `GET /api/v1/admin/integrations` |
| 13 | Audit history | CSC-12 Audit & Monitoring | *(planned)* `AuditService.searchEvents/exportAudit` | `GET /api/v1/audit`, `GET /api/v1/audit/export` |

Cross-cutting: the barcode / QR **Scan** dialog maps to CSC-07 Mobility
(`MobileAccessService.resolveScannedCode()`), and the Export buttons map to CSC-08
Bulk Data Exchange (`ExportService.exportFiltered()`).

### Business rules already reproduced in the prototype

These are enforced in `js/api.js` with the same messages the Java services produce, so a
demonstration exercises the same decisions:

| Rule | Where | SDD reference |
|---|---|---|
| Asset tag required, name required | `assets.create()` | `AssetService.createAsset()` |
| Duplicate asset tag rejected | `assets.create()` | TC-07 (currently *Pending*) |
| Checkout requires a receiving employee | `transactions.checkOut()` | TC-10 (currently *Pending*) |
| Checkout only when status is `AVAILABLE` | `transactions.checkOut()` | REQ-TRN-01 / TC-08 |
| Check-in only when status is `CHECKED_OUT` | `transactions.checkIn()` | REQ-TRN-02 |
| Quantity adjustment cannot go below zero | `inventory.adjust()` | REQ-INV-02 / TC-09 |
| Every state change writes an audit event | `audit()` in `api.js` | CSC-12, STRIDE repudiation |

Rejected actions are written to the audit history with outcome `DENIED` — filter the
Audit screen by **Denied** to demonstrate the non-repudiation control.

---

## 4. Design notes for the team

Three points where the prototype had to make a decision the SDD leaves open. Each one is
worth a sentence in the next revision of the document:

1. **Inventory adjustments are not `AssetTransaction` records.** `TransactionType` in the
   Java model has five values (`CHECKOUT`, `CHECKIN`, `MOVE`, `DISPOSE`, `RECOVER`) and
   `AssetTransaction` carries an `assetId`, so it cannot represent a change to an
   `InventoryItem`. The prototype keeps a separate adjustment record and writes an
   `INVENTORY_ADJUST` audit event. If the team prefers one unified log, add an `ADJUST`
   value to `TransactionType` and give the transaction an optional inventory-item
   reference.
2. **Check-in can route an asset to `MAINTENANCE`.** The SDD state machine (Figure 6)
   allows `CHECKED_OUT → MAINTENANCE`, so a return flagged "needs service" sets that
   status and opens a work order instead of going to `AVAILABLE`. No new workflow was
   invented — it is the existing edge, surfaced as a checkbox.
3. **Fields not yet in the Java model.** The screens show `category`, `condition`,
   `serialNumber`, `purchaseDate`, `purchaseCost`, `warrantyEnd`, and inventory
   `reorderPoint` / `unitCost`. These come from section 2 of the SDD but are not yet
   attributes on `Asset` or `InventoryItem`. They are the natural first additions when
   the JPA entities are written.

Accessibility and UX choices worth noting in section 2.1.2: 14 px base type, visible
focus rings on every control, `aria-live` status regions, labelled form fields with
inline error text, confirmation dialogs on every inventory-changing action, and a
sidebar that collapses to an off-canvas menu below 860 px.

---

## 5. What to implement next in the Java backend

The current Maven project already has the right shape — `controller → service →
repository → model`. The work below adds the web and persistence layers without
rewriting those business rules.

### Phase 1 — Turn the prototype into a Spring Boot service (Module 4 scope)

1. **Add Spring Boot to `pom.xml`.** Set a parent of `spring-boot-starter-parent`, add
   `spring-boot-starter-web` and `spring-boot-starter-validation`, and fix
   `exec.mainClass` — it currently points at
   `com.solarintegrators.inventory.InventoryManagementSystem`, which does not exist
   (the class is `Main`). Also reconsider `maven.compiler.release` 26; pin it to the LTS
   the team actually has installed (21 is the safe choice).
2. **Annotate the existing controllers.** `AssetController` becomes
   `@RestController @RequestMapping("/api/v1/assets")`; `TransactionController` supplies
   `POST /{id}/checkout` and `POST /{id}/checkin`. Method bodies stay as they are.
3. **Add DTOs and bean validation** (`CreateAssetRequest`, `CheckoutRequest`) so
   `@Valid` produces the field-level errors the forms already know how to display.
4. **Add a `@RestControllerAdvice`** that maps the exceptions the services already throw:
   `IllegalArgumentException → 400`, `NoSuchElementException → 404`,
   `IllegalStateException → 409`. The prototype's `ApiError` object matches that shape,
   so the screens will consume it unchanged.
5. **Enable CORS** for the prototype's origin while the two run separately.
6. **Point `js/api.js` at the service.** Replace each mock body with a `fetch()` to the
   endpoint already named in its comment. Nothing in `js/pages/` changes.

### Phase 2 — Persistence

7. **Introduce interfaces** for `AssetRepository`, `InventoryRepository`, and
   `TransactionRepository`, keeping the current in-memory classes as the test
   implementations.
8. **Add Spring Data JPA + PostgreSQL** with Flyway migrations for `asset`,
   `inventory_item`, `asset_transaction`, `location`, and `employee`. Reinforce the
   service rules at the database level: unique constraint on `asset.tag`, check
   constraint `quantity_on_hand >= 0`, foreign keys on custodian and location.
9. **Add the missing model attributes** listed in Design note 3.
10. **Make check-out, check-in, and adjustment `@Transactional`** so the asset row, the
    history row, and the audit row commit together — the requirement in SDD 2.1.3.

### Phase 3 — Identity, audit, and the remaining components

11. **`AuditService`** as a separate table plus an `@Around` aspect or explicit calls in
    the services, storing actor, action, entity, outcome, and timestamp.
12. **Microsoft Entra ID** via `spring-boot-starter-oauth2-resource-server`; map role
    claims to authorities and put `@PreAuthorize` on every controller method. The
    capability strings in `js/data.js` (`asset.checkout`, `inventory.adjust`,
    `admin.roles`, …) are the list to implement.
13. **`MaintenanceService` and `ReportService`** — the screens define exactly which
    queries are needed.
14. **CSC-13 integration gateway** last: HR employee sync, accounting PO sync and receipt
    status, project/billing allocation events, all behind versioned clients.

### Phase 4 — Tests (closes the *Pending* rows in the SDD traceability matrix)

JUnit 5 tests for the four cases the document lists as not yet executed — duplicate tag
(TC-07), checkout of an already checked-out asset (TC-08), adjustment below zero
(TC-09), and checkout with a null employee (TC-10) — then `@WebMvcTest` for the
controllers and `@SpringBootTest` with Testcontainers for the repositories.

---

*Prototype only. No credentials are collected, no network requests are made, and all
sample records are fictional.*
