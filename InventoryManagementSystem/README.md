# Cloud-Based Inventory Management System — Backend API

Phase 1 backend for the Cloud-Based Inventory Management System for Small
Businesses (Group 2 — Pejman Govari, Gregory Corder).

Converted from the Module 2 Java console prototype into a Spring Boot REST
service. The `model` / `repository` / `service` / `controller` package structure
is unchanged and the business rules were ported rather than rewritten; what
changed is that the data now lives in PostgreSQL, the entry points are HTTP
endpoints, and every state change is validated, transactional, and audited.

> **Architecture correction.** Section 2.1.4 of the Software Design Description
> states that the REST API is implemented with ASP.NET Core on .NET. That is
> incorrect. **The API is a Java 21 Spring Boot service**, built with Maven,
> using Spring Web, Spring Data JPA, Bean Validation, Spring Security, and
> Flyway against PostgreSQL. No .NET component exists in this system or is
> planned. Replacement text for that paragraph is in section 10 below.

---

## 1. Prerequisites

| Requirement | Version | Check with |
|---|---|---|
| JDK | **21 (LTS)** | `java -version` |
| Maven | 3.9 or newer | `mvn -version` |
| PostgreSQL | 14 or newer (16 recommended) | `psql --version` |
| Docker (optional) | Engine 24+ with Compose v2 | `docker compose version` |

Java 21 is required, not merely supported: the code uses records for the
request and response DTOs and the enhanced `switch`/pattern features of the
modern language level.

If `java -version` reports something other than 21:

```bash
# macOS / Linux
export JAVA_HOME=$(/usr/libexec/java_home -v 21)   # macOS
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk       # Linux

# Windows PowerShell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

---

## 2. Quick start with Docker (nothing to install but Docker)

```bash
cd InventoryManagementSystem
docker compose up --build
```

This starts PostgreSQL 16, waits for it to report healthy, runs the Flyway
migrations, and starts the API on <http://localhost:8080>.

```bash
curl -u manager:manager123 http://localhost:8080/api/assets
docker compose down       # stop, keep data
docker compose down -v    # stop, delete data
```

---

## 3. Running locally against your own PostgreSQL

### 3.1 Create the database

```bash
# psql as a superuser
psql -U postgres
```

```sql
CREATE DATABASE inventorydb;
CREATE USER inventory WITH PASSWORD 'inventory';
GRANT ALL PRIVILEGES ON DATABASE inventorydb TO inventory;
\c inventorydb
GRANT ALL ON SCHEMA public TO inventory;
\q
```

On PostgreSQL 15+ the last `GRANT ALL ON SCHEMA public` is required — the
`public` schema is no longer writable by every user by default, and Flyway
will fail with a permission error without it.

### 3.2 Point the application at it

The defaults in `application.yml` already match the values above. Override with
environment variables when they do not:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/inventorydb
export DB_USERNAME=inventory
export DB_PASSWORD=inventory
```

```powershell
# Windows PowerShell
$env:DB_URL="jdbc:postgresql://localhost:5432/inventorydb"
$env:DB_USERNAME="inventory"
$env:DB_PASSWORD="inventory"
```

### 3.3 Start the application

```bash
cd InventoryManagementSystem
mvn spring-boot:run
```

Flyway applies `V1__baseline_schema.sql` on first start and creates all six
tables. Confirm the service is up:

```bash
curl http://localhost:8080/actuator/health
# {"status":"UP"}
```

### 3.4 Start it with the Module 2 demonstration data

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=demo
```

The `demo` profile runs `DemoDataRunner`, which performs the original console
demonstration through the same services: create asset `IT-10042`, find it by
searching for "Toughbook", check it out to a technician, check it back in, print
the transaction history, create 500 MC4 connectors, and reduce them to 450. It
does nothing if the database already contains assets.

---

## 4. Maven commands

```bash
mvn clean                    # remove target/
mvn test                     # run the automated test suite
mvn clean package            # compile, test, and build the executable jar
mvn clean package -DskipTests
mvn spring-boot:run          # run from source
java -jar target/InventoryManagementSystem-1.0.0-SNAPSHOT.jar
```

The jar in `target/` is a self-contained executable — it needs a JRE 21 and a
reachable database, nothing else.

### In VS Code

```
code InventoryManagementSystem
```

Install the **Extension Pack for Java** and **Spring Boot Extension Pack**
(`Ctrl+Shift+X`), then:

- `Ctrl+Shift+P` → **Java: Clean Java Language Server Workspace** if imports
  look unresolved after the first open
- Run and Debug (`F5`) picks up `InventoryApplication` automatically
- Terminal → **Run Task** → `mvn test`

---

## 5. Testing

```bash
mvn test                                   # everything
mvn test -Dtest=AssetServiceTest           # one class
mvn test -Dtest=TransactionServiceTest#rejectsDuplicateCheckout
```

The tests run against an in-memory **H2** database in PostgreSQL compatibility
mode, so `mvn test` needs no running PostgreSQL and no Docker. They are
integration tests over the real Spring context and a real database rather than
mock-based unit tests: a mocked repository would happily accept a duplicate tag
and a negative quantity, which are precisely the behaviours under test.

### What is covered

| Test | Class | SDD test case |
|---|---|---|
| Duplicate asset tag rejected | `AssetServiceTest` | TC-07 |
| Duplicate tag differing only in case rejected | `AssetServiceTest` | — |
| Missing tag or name rejected | `AssetServiceTest` | — |
| Asset created AVAILABLE, no custodian | `AssetServiceTest` | TC-01 |
| Search by tag, name, serial, status, location | `AssetServiceTest` | TC-02 |
| Successful checkout | `TransactionServiceTest` | TC-03 |
| Duplicate checkout rejected, custody unchanged | `TransactionServiceTest` | TC-08 |
| Checkout with no employee rejected | `TransactionServiceTest` | TC-10 |
| Successful check-in | `TransactionServiceTest` | TC-04 |
| Check-in of an asset that is not out rejected | `TransactionServiceTest` | — |
| Check-in to maintenance | `TransactionServiceTest` | — |
| Transaction history created, newest first | `TransactionServiceTest` | TC-05 |
| Move, maintenance, lost, recover, retire | `TransactionServiceTest` | — |
| Inventory adjustment 500 → 450 | `InventoryServiceTest` | TC-06 |
| Negative stock rejected, balance unchanged | `InventoryServiceTest` | TC-09 |
| Adjustment to exactly zero allowed | `InventoryServiceTest` | — |
| Zero delta and missing reason rejected | `InventoryServiceTest` | — |
| Denied attempts written to the audit trail | all three | — |
| HTTP 400 / 404 / 409 error bodies | `AssetApiIntegrationTest` | — |
| 401 unauthenticated, 403 wrong role | `AssetApiIntegrationTest` | — |

TC-07, TC-08, TC-09, and TC-10 are the four the design document lists as
*Pending — dedicated test still required*. They are now executed.

---

## 6. Verifying the migrations against PostgreSQL

`mvn test` uses H2, so it does not exercise the Flyway migrations — those are
PostgreSQL-specific (functional unique indexes on `lower(column)`, partial
indexes, `COMMENT ON CONSTRAINT`). To check them against the real thing:

```bash
psql -U postgres -c "CREATE DATABASE migration_check;"
psql -U postgres -d migration_check -v ON_ERROR_STOP=1 \
     -f src/main/resources/db/migration/V1__baseline_schema.sql
psql -U postgres -d migration_check -c "\dt"
psql -U postgres -c "DROP DATABASE migration_check;"
```

Or simply start the application — Flyway runs the migrations at boot and
refuses to start if one fails.

---

## 7. API endpoint summary

All endpoints require HTTP Basic authentication. Development accounts:

| Username | Password | Role | Can |
|---|---|---|---|
| `field` | `field123` | FIELD | read; create assets and stock; check out, check in, move, adjust |
| `manager` | `manager123` | MANAGER | everything above; edit assets; maintenance, lost, recover, retire; audit |
| `finance` | `finance123` | FINANCE | read-only; create stock; audit |
| `admin` | `admin123` | ADMIN | everything |

Override every password with an environment variable outside your own machine —
`FIELD_PASSWORD`, `MANAGER_PASSWORD`, `FINANCE_PASSWORD`, `ADMIN_PASSWORD`.

### Assets

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/assets` | any | `?query=&status=&locationId=&category=&custodianEmployeeId=&page=&size=&sort=` |
| GET | `/api/assets/{id}` | any | 404 if unknown |
| GET | `/api/assets/by-tag/{tag}` | any | barcode / QR lookup |
| POST | `/api/assets` | FIELD, MANAGER, ADMIN | 201 + `Location` header; 409 on duplicate tag |
| PUT | `/api/assets/{id}` | MANAGER, ADMIN | descriptive fields only; never tag or status |

### Asset lifecycle

| Method | Path | Role | Allowed from | Result |
|---|---|---|---|---|
| POST | `/api/assets/{id}/checkout` | FIELD, MANAGER, ADMIN | AVAILABLE | CHECKED_OUT, `CHECKOUT` transaction |
| POST | `/api/assets/{id}/checkin` | FIELD, MANAGER, ADMIN | CHECKED_OUT | AVAILABLE (or MAINTENANCE), `CHECKIN` |
| POST | `/api/assets/{id}/move` | FIELD, MANAGER, ADMIN | anything but RETIRED | same status, `MOVE` |
| POST | `/api/assets/{id}/maintenance` | MANAGER, ADMIN | AVAILABLE | MAINTENANCE |
| POST | `/api/assets/{id}/lost` | MANAGER, ADMIN | anything but LOST, RETIRED | LOST |
| POST | `/api/assets/{id}/recover` | MANAGER, ADMIN | LOST or MAINTENANCE | AVAILABLE, `RECOVER` |
| POST | `/api/assets/{id}/retire` | MANAGER, ADMIN | anything but CHECKED_OUT, RETIRED | RETIRED, `DISPOSE` |
| GET | `/api/assets/{id}/history` | any | — | transactions, newest first |

Every one of them returns the updated asset, so a client never needs a
follow-up GET.

### Inventory, locations, employees, transactions, audit

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/inventory` | any | `?query=&locationId=&category=&lowStockOnly=true` |
| GET | `/api/inventory/{id}` | any | |
| POST | `/api/inventory` | any but nothing lower | 409 on duplicate SKU |
| POST | `/api/inventory/{id}/adjust` | FIELD, MANAGER, ADMIN | signed `delta`; 409 if it would go below zero |
| GET | `/api/locations` | any | unpaged, reference data |
| POST | `/api/locations` | MANAGER, ADMIN | 409 on duplicate code |
| GET | `/api/employees` | any | unpaged |
| GET | `/api/employees/{id}/assets` | any | everything in this person's custody |
| POST | `/api/employees` | MANAGER, ADMIN | |
| GET | `/api/transactions` | any | recent activity across all assets |
| GET | `/api/audit` | MANAGER, FINANCE, ADMIN | `?entityId=` narrows to one record |
| GET | `/actuator/health` | public | |

### Worked example

```bash
BASE=http://localhost:8080
AUTH='-u manager:manager123'

LOC=$(curl -s $AUTH -X POST $BASE/api/locations -H 'Content-Type: application/json' \
  -d '{"code":"WH-SD","name":"San Diego Warehouse","type":"WAREHOUSE"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["locationId"])')

EMP=$(curl -s $AUTH -X POST $BASE/api/employees -H 'Content-Type: application/json' \
  -d '{"name":"Maria Alvarez","email":"ma@example.com","jobTitle":"Field Tech"}' \
  | python -c 'import sys,json;print(json.load(sys.stdin)["employeeId"])')

AST=$(curl -s $AUTH -X POST $BASE/api/assets -H 'Content-Type: application/json' \
  -d "{\"tag\":\"IT-10042\",\"name\":\"Toughbook FZ-55\",\"category\":\"IT\",\"locationId\":\"$LOC\"}" \
  | python -c 'import sys,json;print(json.load(sys.stdin)["assetId"])')

curl -s $AUTH -X POST $BASE/api/assets/$AST/checkout -H 'Content-Type: application/json' \
  -d "{\"employeeId\":\"$EMP\",\"notes\":\"Riverside commissioning\"}"

# Same call again -> 409
curl -s $AUTH -X POST $BASE/api/assets/$AST/checkout -H 'Content-Type: application/json' \
  -d "{\"employeeId\":\"$EMP\"}"

curl -s $AUTH $BASE/api/assets/$AST/history
```

### Error format

Every failure returns the same shape:

```json
{
  "timestamp": "2026-09-06T12:34:56Z",
  "status": 409,
  "error": "Conflict",
  "code": "ASSET_NOT_AVAILABLE",
  "message": "Asset IT-10042 cannot be checked out. Current status: CHECKED_OUT.",
  "path": "/api/assets/8f14.../checkout",
  "fieldErrors": [ { "field": "tag", "message": "Asset tag is required." } ]
}
```

`code` is what a client should branch on; `message` is for people;
`fieldErrors` appears only when validation failed.

| Status | When | Codes |
|---|---|---|
| 400 | missing or malformed input | `VALIDATION_FAILED`, `FIELD_REQUIRED`, `MALFORMED_REQUEST_BODY`, `INVENTORY_ZERO_DELTA` |
| 401 | no credentials | — |
| 403 | authenticated, wrong role | `ACCESS_DENIED` |
| 404 | record does not exist | `ASSET_NOT_FOUND`, `INVENTORY_ITEM_NOT_FOUND`, `LOCATION_NOT_FOUND`, `EMPLOYEE_NOT_FOUND` |
| 409 | rule or state conflict | `ASSET_TAG_DUPLICATE`, `INVENTORY_SKU_DUPLICATE`, `ASSET_NOT_AVAILABLE`, `ASSET_NOT_CHECKED_OUT`, `ASSET_TRANSITION_NOT_ALLOWED`, `INVENTORY_NEGATIVE_STOCK`, `CONCURRENT_MODIFICATION` |
| 500 | unexpected | `INTERNAL_ERROR` — detail goes to the log, never the response |

---

## 8. Design notes worth carrying into the document

**Transaction types.** `TransactionType` keeps exactly the five values of the
Module 2 model: `CHECKOUT`, `CHECKIN`, `MOVE`, `DISPOSE`, `RECOVER`. The
transitions to `MAINTENANCE` and `LOST` therefore have no type of their own, and
are recorded as audit events (`ASSET_MAINTENANCE`, `ASSET_LOST`) retrievable
with `GET /api/audit?entityId={assetId}`. If the team decides they belong in the
typed history instead, the change is three edits: add the values to the enum,
widen `ck_asset_transactions_type` in a new migration, and pass them in
`TransactionService.sendToMaintenance` and `markLost`.

**`synchronized` became a row lock.** The prototype guarded `checkOut`,
`checkIn`, and `adjustQuantity` with `synchronized`. A JVM monitor only
serialises threads inside one process; two instances behind a load balancer
would both pass the status check and both write. Those methods now load the row
with `@Lock(PESSIMISTIC_WRITE)` inside a transaction, so "check the status, then
change it" is atomic in the database. `@Version` columns add optimistic locking
on top for the ordinary edit paths.

**Rules are declared twice, deliberately.** Unique tags, non-negative stock, and
valid enum values are enforced in the service *and* by constraints in
`V1__baseline_schema.sql`. A rule that lives only in Java holds only for callers
that go through Java — not for a migration script, a support query, or a second
service added later.

**Denied attempts are audited.** `AuditService.recordDenied()` runs in
`REQUIRES_NEW` so the record of a rejected action survives the rollback of the
business transaction that rejected it. A log of only what succeeded cannot
answer "did someone try?", which is what the repudiation and elevation-of-
privilege rows of the SDD threat model are about.

**Assignment happens through checkout.** There is no "assign asset to employee"
endpoint. Assignment is `POST /api/assets/{id}/checkout`, so it always produces
a transaction record; assigning by editing an employee would change custody with
no history behind it.

---

## 9. What is complete, and what is not

### Complete in Phase 1

- Asset management: create, get, search (tag / name / serial / status /
  location / category / custodian), update
- Asset lifecycle: checkout, check-in, move, maintenance, lost, recover, retire,
  with the transitions validated against the SDD state machine
- Transaction history: written for every typed event, retrievable per asset,
  each row carrying the status it moved from and to
- Inventory: create, get, list with low-stock filter, signed adjustment,
  negative stock refused in both the service and the database
- Locations and employees: create and list, with duplicate protection
- Audit logging: actor, action, entity, summary, outcome, timestamp — successes
  and denials alike
- REST API with Bean Validation, a single JSON error contract, and 400/404/409
  mapped from the exception types the prototype already threw
- Spring Security with the four SDD roles and method-level authorization
- PostgreSQL with Flyway migrations, UUID primary keys, foreign keys, check
  constraints, and indexes
- Docker image and Compose stack
- Automated tests for every behaviour listed in section 5

### Deliberately not built yet

- **Microsoft Entra ID / OIDC** — Phase 3. HTTP Basic with configured accounts
  stands in. The swap is contained: replace `httpBasic` with
  `oauth2ResourceServer(jwt)` in `SecurityConfig`, delete the in-memory user
  store, and map role claims to authorities. The `@PreAuthorize` rules on the
  controllers are written against role names and do not change.
- **HR, accounting/ERP, project/billing integrations** — Phase 3. The
  boundaries exist as interfaces in `service/integration/` with logging no-op
  implementations, so a caller gets a working object rather than a null, and a
  real client replaces the stub simply by existing.
- **Maintenance work orders, purchasing, reporting endpoints, bulk import and
  export, document storage** — later phases.
- **Cloud deployment** — no Cloud Run, Cloud SQL, or object storage
  configuration in this repository.

### Remaining production tasks

1. **Turn on `ddl-auto: validate`** in `application.yml` once the application
   starts cleanly against your PostgreSQL. It is `none` today only so that a
   strict timestamp-column check cannot fail your first run.
2. **Replace the development accounts** with Entra ID before this is exposed to
   anyone.
3. **Add Testcontainers** so the test suite runs against real PostgreSQL and the
   Flyway migrations are covered by `mvn test` rather than checked by hand.
4. **Add API documentation** — `springdoc-openapi-starter-webmvc-ui` gives
   Swagger UI from the existing annotations with one dependency.
5. **Pagination limits**: cap `size` so a client cannot request the whole table
   in one response.
6. **Rate limiting and request size limits** on the write endpoints — the denial
   of service row of the threat model.
7. **Structured JSON logging with a correlation id**, so an audit record and the
   log lines from the same request can be tied together.
8. **Database backup, restore rehearsal, and migration rollback plan** before
   any production data exists.
9. **Connection pool and index tuning** against measured load rather than
   assumption.
10. **CI**: run `mvn verify` on every push, and fail the build on new findings
    from a dependency vulnerability scan.

---

## 10. Replacement text for SDD section 2.1.4

The paragraph currently beginning *"Users connect through current supported
versions of Microsoft Edge…"* should read:

> Users connect through current supported versions of Microsoft Edge, Google
> Chrome, or supported mobile browsers on Android and iOS. The application is
> published through a company-controlled HTTPS subdomain. The browser client is
> a responsive HTML, CSS, and JavaScript application, while the REST API is
> implemented in Java 21 (LTS) with Spring Boot, built with Maven and using
> Spring Web, Spring Data JPA, Bean Validation, and Spring Security. The API is
> packaged as an executable JAR in a container image and is hosted on Google
> Cloud Run. Structured application data is stored in Cloud SQL for PostgreSQL
> with schema changes applied through versioned Flyway migrations, and files
> such as images, receipts, and manuals are stored in Google Cloud Storage.
> Microsoft Entra ID provides organizational authentication through OpenID
> Connect (Govari, 2026).

Any other reference to ASP.NET Core or .NET in the document should be replaced
with **Java Spring Boot REST API**. No .NET component exists in this system or is
planned.

---

## 11. Project structure

```
InventoryManagementSystem/
├── pom.xml                        Spring Boot 3.5 / Java 21 build
├── Dockerfile                     multi-stage build, non-root runtime
├── docker-compose.yml             PostgreSQL 16 + API
├── .dockerignore
├── README.md
└── src/
    ├── main/
    │   ├── java/com/solarintegrators/inventory/
    │   │   ├── InventoryApplication.java        entry point (replaces Main.java)
    │   │   ├── config/
    │   │   │   ├── SecurityConfig.java          filter chain, roles, CORS
    │   │   │   ├── SecurityProperties.java      app.security.* binding
    │   │   │   ├── JacksonConfig.java           ISO-8601 timestamps
    │   │   │   └── DemoDataRunner.java          Module 2 demo (profile: demo)
    │   │   ├── controller/
    │   │   │   ├── AssetController.java         CRUD + search
    │   │   │   ├── AssetLifecycleController.java checkout … retire, history
    │   │   │   ├── TransactionController.java   recent activity feed
    │   │   │   ├── InventoryController.java
    │   │   │   ├── LocationController.java
    │   │   │   ├── EmployeeController.java
    │   │   │   └── AuditController.java
    │   │   ├── dto/
    │   │   │   ├── request/                     10 validated request records
    │   │   │   └── response/                    9 response records + error shape
    │   │   ├── exception/
    │   │   │   ├── GlobalExceptionHandler.java  400 / 403 / 404 / 409 / 500
    │   │   │   ├── ResourceNotFoundException.java
    │   │   │   ├── DuplicateResourceException.java
    │   │   │   ├── InvalidAssetStateException.java
    │   │   │   ├── InsufficientStockException.java
    │   │   │   ├── InvalidRequestException.java
    │   │   │   └── HasErrorCode.java
    │   │   ├── model/
    │   │   │   ├── Asset.java                   @Entity, UUID key, @Version
    │   │   │   ├── InventoryItem.java           @Entity
    │   │   │   ├── AssetTransaction.java        @Entity, append-only
    │   │   │   ├── Location.java                @Entity (new)
    │   │   │   ├── Employee.java                @Entity (new)
    │   │   │   ├── AuditEvent.java              @Entity (new)
    │   │   │   ├── AssetStatus.java             enum, unchanged
    │   │   │   ├── TransactionType.java         enum, unchanged
    │   │   │   └── AuditOutcome.java            enum (new)
    │   │   ├── repository/
    │   │   │   ├── AssetRepository.java         Spring Data JPA + row lock
    │   │   │   ├── AssetSpecifications.java     search predicates
    │   │   │   ├── InventoryRepository.java
    │   │   │   ├── InventorySpecifications.java
    │   │   │   ├── TransactionRepository.java
    │   │   │   ├── LocationRepository.java
    │   │   │   ├── EmployeeRepository.java
    │   │   │   └── AuditEventRepository.java
    │   │   └── service/
    │   │       ├── AssetService.java            ported rules
    │   │       ├── TransactionService.java      lifecycle state machine
    │   │       ├── InventoryService.java        non-negative stock
    │   │       ├── LocationService.java
    │   │       ├── EmployeeService.java
    │   │       ├── AuditService.java
    │   │       └── integration/                 Phase 3 boundaries (stubs)
    │   └── resources/
    │       ├── application.yml
    │       └── db/migration/
    │           └── V1__baseline_schema.sql      6 tables, FKs, checks, indexes
    └── test/
        ├── java/com/solarintegrators/inventory/
        │   ├── AbstractIntegrationTest.java     shared fixtures
        │   ├── service/AssetServiceTest.java
        │   ├── service/TransactionServiceTest.java
        │   ├── service/InventoryServiceTest.java
        │   └── controller/AssetApiIntegrationTest.java
        └── resources/application.properties     H2 test configuration
```

---

## 12. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Connection refused` on startup | PostgreSQL is not running, or `DB_URL` points at the wrong port. |
| `FATAL: password authentication failed` | `DB_USERNAME` / `DB_PASSWORD` do not match the database user. |
| Flyway: `permission denied for schema public` | PostgreSQL 15+: run `GRANT ALL ON SCHEMA public TO inventory;` inside the database. |
| `Schema-validation: wrong column type` after enabling `validate` | Entity and migration disagree. The message names the column; fix whichever is wrong, or set `ddl-auto: none` again. |
| 401 on every request | HTTP Basic is required — `curl -u manager:manager123 …`. |
| 403 with `ACCESS_DENIED` | The account's role does not include that operation; see the role table in section 7. |
| Tests fail with `Table not found` | Stale H2 state. `mvn clean test`. |
| `release version 21 not supported` | Maven is running on an older JDK. Set `JAVA_HOME` to a JDK 21 and re-run. |
