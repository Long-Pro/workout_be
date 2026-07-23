# FitTracker API

A workout tracking REST API built with **NestJS 11**, **Prisma 7**, and **PostgreSQL 16**.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Trade-offs & Scale Considerations](#trade-offs--scale-considerations)

---

## Architecture Overview

### Technology Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (Express adapter) |
| ORM | Prisma 7 (pg adapter) |
| Database | PostgreSQL 16 |
| Pattern | CQRS (`@nestjs/cqrs`) |
| Transactions | `nestjs-cls` + `@nestjs-cls/transactional` |
| Validation | `class-validator` + `class-transformer` |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |

### Request Flow

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  WorkoutController  (src/features/workout/)          │
│  POST /workouts                                      │
│  GET  /workouts/history                              │
│  GET  /workouts/personal-records                     │
└──────────────────┬──────────────────────────────────┘
                   │  ValidationPipe (global)
                   │  - transforms body/query via class-transformer
                   │  - rejects unknown fields
                   ▼
┌─────────────────────────────────────────────────────┐
│  CommandBus / QueryBus  (@nestjs/cqrs)               │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────┐   ┌───────────────────────────────┐
│ CreateWorkout   │   │ GetWorkoutHistory /            │
│ Handler         │   │ GetPersonalRecords Handler     │
│ (@Transactional)│   │ (read-only, raw SQL for PRs)   │
└────────┬────────┘   └───────────────┬───────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────────┐
│  PrismaService  (src/database/)                      │
│  Prisma Client + PrismaPg adapter                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   PostgreSQL 16  │
              └─────────────────┘
```

### Module Structure

```
src/
├── main.ts                        # Bootstrap: ValidationPipe, Swagger, port
├── app.module.ts                  # Root module: CqrsModule, ClsModule (transactions)
├── database/
│   ├── database.module.ts         # Global module, exports PrismaService
│   └── prisma.service.ts          # PrismaClient with PrismaPg adapter
├── features/
│   ├── user/user.module.ts        # Placeholder (users seeded via SQL)
│   └── workout/
│       ├── workout.controller.ts  # Route definitions + Swagger decorators
│       ├── workout.module.ts      # Registers handlers as CQRS providers
│       └── handlers/
│           ├── create-workout/    # Command + CommandHandler + Input DTO
│           ├── get-workout-history/   # Query + QueryHandler + Arg/Response DTOs
│           └── get-personal-records/  # Query + QueryHandler + Arg/Response DTOs
├── utils/weight.ts                # Unit conversion (kg ↔ lb), Epley 1RM
└── validators/
    └── is-after-or-equal-to.ts    # Custom date-range class-validator decorator
```

### Design Patterns

**CQRS** — The controller dispatches to `CommandBus` (mutations) or `QueryBus` (reads). Each use-case lives in its own handler class; the controller has zero business logic.

**Transactional writes** — `CreateWorkoutHandler` is decorated with `@Transactional()` from `nestjs-cls`. All Prisma calls inside use `this.txHost.tx` ensuring the workout and all its exercises/sets are committed atomically.

**Normalised weight storage** — Every set stores `normalized_weight_kg` (always kilograms) alongside `original_weight_value` / `original_weight_unit`. This makes cross-unit queries trivial while preserving the user's original input.

---

## Setup Instructions

### Option A — Docker Compose (recommended, one command)

> Prerequisites: [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

```bash
# 1. Clone and enter the project
git clone <repo-url> workout_be
cd workout_be

# 2. Copy environment file
cp .env.example .env

# 3. Start the database
docker compose up -d

# 4. Install dependencies
yarn install

# 5. Generate Prisma client
yarn prisma generate

# 6. Start the API (watch mode)
yarn start:dev
```

The API is now available at **http://localhost:3000**.
Interactive Swagger UI: **http://localhost:3000/api**

> The `docker compose up` command starts **PostgreSQL 16** and automatically runs `init.sql`, which creates all tables and seeds two users (Alice, Bob) and three exercises (Squat, Bench Press, Deadlift).

---

### Option B — Step-by-step (manual Postgres)

```bash
# 1. Install dependencies
yarn install

# 2. Create a PostgreSQL database named "workout"
#    and update .env accordingly:
echo "DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/workout?schema=public" > .env

# 3. Apply the schema and seed data manually
psql -U <user> -d workout -f init.sql

# 4. Generate Prisma client
yarn prisma generate

# 5. Start the server
yarn start:dev
```

---

### Running Tests

```bash
# All unit tests
yarn test

# Unit tests with coverage report
yarn test:cov

# Watch mode
yarn test:watch
```

---

### Environment Variables

| Variable | Description | Default (`.env.example`) |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://admin:password@localhost:5432/workout?schema=public` |
| `PORT` | HTTP port | `3000` |

---

## API Documentation

> A live interactive version is available at **http://localhost:3000/api** (Swagger UI) once the server is running.

### Base URL

```
http://localhost:3000
```

### Common Error Codes

| HTTP Status | Meaning |
|---|---|
| `400 Bad Request` | Validation failure — missing/invalid field, inverted date range, unsupported unit |
| `404 Not Found` | `userId` or `exerciseId` does not exist (or is soft-deleted) |
| `500 Internal Server Error` | Unexpected database or server error |

All error responses follow NestJS's default shape:

```json
{
  "statusCode": 400,
  "message": ["userId must be a UUID"],
  "error": "Bad Request"
}
```

---

### POST /workouts

Record a new workout session for a user.

**Request Body**

```json
{
  "userId": "10000000-0000-4000-8000-000000000001",
  "exercises": [
    {
      "exerciseId": "20000000-0000-4000-8000-000000000001",
      "sets": [
        { "reps": 5, "weight": 100, "unit": "kg" },
        { "reps": 5, "weight": 100, "unit": "kg" }
      ]
    },
    {
      "exerciseId": "20000000-0000-4000-8000-000000000002",
      "sets": [
        { "reps": 10, "weight": 225, "unit": "lb" }
      ]
    }
  ]
}
```

| Field | Type | Rules |
|---|---|---|
| `userId` | `string (UUID)` | required; must exist in `users` |
| `exercises` | `array` | required; at least one element |
| `exercises[].exerciseId` | `string (UUID)` | required; must exist in `exercises` |
| `exercises[].sets` | `array` | required; at least one element |
| `sets[].reps` | `integer` | `>= 1` |
| `sets[].weight` | `number` | `>= 0`, max 3 decimal places |
| `sets[].unit` | `"kg" \| "lb"` | required |

**Success Response — 201 Created**

```json
true
```

**Error Responses**

| Status | Condition |
|---|---|
| `400` | Validation error (missing field, bad UUID, reps < 1, etc.) |
| `404` | `userId` not found, or one or more `exerciseId`s not found |

---

### GET /workouts/history

Retrieve a user's paginated workout history with optional filtering.

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `userId` | `string (UUID)` | yes | — | The user whose history to fetch |
| `from` | `ISO 8601 date` | yes | — | Inclusive start of the date range |
| `to` | `ISO 8601 date` | yes | — | Inclusive end; must be `>= from` |
| `exerciseName` | `string` | no | — | Case-insensitive partial name filter |
| `muscleGroup` | `string` | no | — | Case-insensitive exact muscle group filter |
| `unit` | `"kg" \| "lb"` | no | `"kg"` | Weight unit for the response |
| `page` | `integer >= 1` | no | `1` | Page number |
| `limit` | `integer 1–100` | no | `20` | Items per page |

**Example Request**

```
GET /workouts/history?userId=10000000-0000-4000-8000-000000000001&from=2026-07-01T00:00:00.000Z&to=2026-07-31T23:59:59.999Z&unit=kg&page=1&limit=20
```

**Success Response — 200 OK**

```json
{
  "data": [
    {
      "id": "30000000-0000-4000-8000-000000000001",
      "performedAt": "2026-07-23T02:00:00.000Z",
      "exercises": [
        {
          "exerciseId": "20000000-0000-4000-8000-000000000001",
          "exerciseName": "Barbell Back Squat",
          "muscleGroup": "Legs",
          "sets": [
            { "reps": 5, "weight": 100.0, "unit": "kg" },
            { "reps": 5, "weight": 100.0, "unit": "kg" }
          ]
        }
      ]
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

> When no workouts match the filters, `data` is an empty array and `total` is `0`.

**Error Responses**

| Status | Condition |
|---|---|
| `400` | Missing `from`/`to`, `to` < `from`, invalid `unit`, `limit` > 100 |
| `404` | `userId` not found |

---

### GET /workouts/personal-records

Get the three personal records for a user on a specific exercise: heaviest single set, highest-volume set (reps × weight), and best estimated 1-rep max (Epley formula). Optionally scoped to a time window.

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `userId` | `string (UUID)` | yes | — | Target user |
| `exerciseId` | `string (UUID)` | yes | — | Target exercise |
| `unit` | `"kg" \| "lb"` | no | `"kg"` | Weight unit for the response |
| `from` | `ISO 8601 date` | no | — | Inclusive window start |
| `to` | `ISO 8601 date` | no | — | Inclusive window end; must be `>= from` |

**Example Request**

```
GET /workouts/personal-records?userId=10000000-0000-4000-8000-000000000001&exerciseId=20000000-0000-4000-8000-000000000001&unit=kg
```

**Success Response — 200 OK**

```json
{
  "exerciseId": "20000000-0000-4000-8000-000000000001",
  "exerciseName": "Barbell Back Squat",
  "muscleGroup": "Legs",
  "heaviestSet": {
    "reps": 5,
    "weight": 140.0,
    "unit": "kg",
    "performedAt": "2026-07-20T09:00:00.000Z"
  },
  "highestVolumeSet": {
    "reps": 10,
    "weight": 100.0,
    "unit": "kg",
    "volume": 1000.0,
    "performedAt": "2026-07-18T09:00:00.000Z"
  },
  "bestOneRepMax": {
    "reps": 5,
    "weight": 140.0,
    "unit": "kg",
    "estimatedOneRepMax": 163.333,
    "performedAt": "2026-07-20T09:00:00.000Z"
  }
}
```

> All three PR fields (`heaviestSet`, `highestVolumeSet`, `bestOneRepMax`) are `null` when no workout data exists for the given user/exercise (or within the time window).

**1RM Formula (Epley):**
```
estimatedOneRepMax = weight × (1 + reps / 30)
```

**Error Responses**

| Status | Condition |
|---|---|
| `400` | Invalid parameters or `to` < `from` |
| `404` | `userId` or `exerciseId` not found |

---

### Seeded Test Data

The database is pre-populated via `init.sql` for immediate testing:

**Users**

| Name | userId |
|---|---|
| Alice Nguyen | `10000000-0000-4000-8000-000000000001` |
| Bob Tran | `10000000-0000-4000-8000-000000000002` |

**Exercises**

| Name | exerciseId | Muscle Group |
|---|---|---|
| Barbell Back Squat | `20000000-0000-4000-8000-000000000001` | Legs |
| Bench Press | `20000000-0000-4000-8000-000000000002` | Chest |
| Deadlift | `20000000-0000-4000-8000-000000000003` | Back |

---

## Database Schema

### Entity Relationship Diagram

```
┌────────────┐          ┌───────────────────┐          ┌─────────────┐
│   users    │          │     workouts       │          │  exercises  │
│────────────│          │───────────────────│          │─────────────│
│ id (PK)    │──┐       │ id (PK)           │    ┌──── │ id (PK)     │
│ name       │  └──────▶│ user_id (FK)      │    │     │ name        │
│ deleted_at │          │ performed_at      │    │     │ normalized_ │
│ created_at │          │ created_at        │    │     │   name      │
│ updated_at │          │ updated_at        │    │     │ description │
└────────────┘          └─────────┬─────────┘    │     │ muscle_group│
                                  │ 1            │     │ deleted_at  │
                                  │              │     │ created_at  │
                                  │ N            │     │ updated_at  │
                         ┌────────┴──────────┐   │     └─────────────┘
                         │ workout_exercises  │   │
                         │───────────────────│   │
                         │ id (PK)           │   │
                         │ workout_id (FK)   │   │
                         │ exercise_id (FK)  │───┘
                         │ order             │
                         │ created_at        │
                         │ updated_at        │
                         └────────┬──────────┘
                                  │ 1
                                  │
                                  │ N
                    ┌─────────────┴──────────────┐
                    │  workout_exercise_entries   │
                    │────────────────────────────│
                    │ id (PK)                    │
                    │ workout_exercise_id (FK)   │
                    │ order                      │
                    │ reps                       │
                    │ normalized_weight_kg       │
                    │ original_weight_value      │
                    │ original_weight_unit       │
                    │ created_at                 │
                    │ updated_at                 │
                    └────────────────────────────┘
```

### Tables

#### `users`
Stores user accounts. `deleted_at` enables soft-deletion — queries always filter `deleted_at IS NULL`.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | Client-provided or auto-generated |
| `name` | `VARCHAR(255)` | Display name |
| `deleted_at` | `TIMESTAMPTZ(3)` | Nullable; set on soft-delete |
| `created_at` | `TIMESTAMPTZ(3)` | Auto |
| `updated_at` | `TIMESTAMPTZ(3)` | Auto-updated |

#### `exercises`
Catalogue of exercises. `normalized_name` enables deduplication by storing a slug (`barbell-back-squat`).

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `name` | `VARCHAR(255)` | Human-readable |
| `normalized_name` | `VARCHAR(255) UNIQUE` | Lowercase slug, enforces uniqueness |
| `description` | `TEXT` | Optional |
| `muscle_group` | `VARCHAR(100)` | Optional; e.g. `"Legs"` |
| `deleted_at` | `TIMESTAMPTZ(3)` | Soft-delete |

#### `workouts`
One row per training session. Only records when the workout was actually performed (`performed_at`), not when it was entered.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `user_id` | `UUID FK → users` | |
| `performed_at` | `TIMESTAMPTZ(3)` | When the workout took place |

**Index:** `idx_workouts_user_performed_id (user_id, performed_at DESC, id DESC)` — covers the paginated history query's `WHERE user_id = ? AND performed_at BETWEEN ? AND ?` with `ORDER BY performed_at DESC, id DESC`, avoiding a sort step.

#### `workout_exercises`
Join table linking a workout to an exercise. `order` preserves the user-defined exercise sequence within a session.

| Column | Type | Notes |
|---|---|---|
| `workout_id` | `UUID FK → workouts` | |
| `exercise_id` | `UUID FK → exercises` | |
| `order` | `INTEGER` | 1-based; unique per workout |

**Constraint:** `UNIQUE (workout_id, order)` — prevents duplicate positions.

#### `workout_exercise_entries`
Individual sets within a workout exercise. The split between `workout_exercises` and `workout_exercise_entries` allows one exercise to have multiple sets with independent reps/weight.

| Column | Type | Notes |
|---|---|---|
| `workout_exercise_id` | `UUID FK → workout_exercises` | |
| `order` | `INTEGER` | 1-based set sequence; unique per exercise |
| `reps` | `INTEGER` | |
| `normalized_weight_kg` | `DECIMAL(10,3)` | Always kg — canonical for queries/PRs |
| `original_weight_value` | `DECIMAL(10,3)` | What the user typed |
| `original_weight_unit` | `TEXT` | `"kg"` or `"lb"` |

**Design decision — dual weight columns:** Storing both the normalised kg value and the original input means: (1) PR queries run purely on `normalized_weight_kg` with no runtime conversion; (2) history responses can faithfully replay the user's preferred unit; (3) the lb↔kg conversion factor (0.45359237) only needs to be applied once on write.

### Constraints Summary

| Table | Constraint | Purpose |
|---|---|---|
| `exercises` | `UNIQUE (normalized_name)` | Prevent duplicate exercises |
| `workout_exercises` | `UNIQUE (workout_id, order)` | Enforce exercise ordering |
| `workout_exercise_entries` | `UNIQUE (workout_exercise_id, order)` | Enforce set ordering |
| `workouts` | `INDEX (user_id, performed_at DESC, id DESC)` | Fast paginated history |

---

## Trade-offs & Scale Considerations

### Current Trade-offs

**No authentication**
`userId` is a plain query/body parameter. Any caller can read or write for any user. This was acceptable for the scope of this exercise but would be the first thing addressed in production (JWT/session auth; `userId` derived from the token, never from the request).

**Personal records via three separate raw SQL queries**
Each PR metric (heaviest, volume, 1RM) issues its own `SELECT … ORDER BY … LIMIT 1`. This is clean and easy to reason about, but means three round-trips per request. They run in `Promise.all` so latency is bounded by the slowest. A single query using window functions (`RANK() OVER (PARTITION BY metric ORDER BY value DESC)`) would reduce this to one round-trip.

**`performedAt` is set server-side**
`CreateWorkoutHandler` uses `new Date()` rather than accepting a timestamp from the client. This prevents backdating, but it also means the API cannot import historical data.

**No cursor-based pagination**
History uses `OFFSET/LIMIT` pagination. For the first few pages this is fine, but `OFFSET N` requires the database to scan and discard N rows. At high `total` values this degrades. Keyset/cursor pagination (`WHERE (performed_at, id) < (lastPerformedAt, lastId)`) is O(1) regardless of page depth.

**No caching layer**
Personal records and history are recomputed on every request. With write-heavy load, a Redis layer caching PRs per `(userId, exerciseId)` — invalidated on new workout creation — would substantially reduce read load.

**`UserModule` is a stub**
User management (creation, profile) is not implemented. Users are seeded via SQL. A real product would expose `POST /users`, handle registration, etc.

### What I Would Change at Scale

| Concern | Current | At Scale |
|---|---|---|
| **Authentication** | None (userId in request) | JWT / OAuth 2.0; userId from token claims |
| **Pagination** | Offset/limit | Keyset pagination on `(performed_at, id)` |
| **PR queries** | 3 × raw SQL, parallel | Single window-function query or materialised view updated on write |
| **Weight conversion** | On-read in application | Pre-compute on write; store kg + all requested units, or keep as-is and cache |
| **Caching** | None | Redis for PR responses, invalidated on new workout insert |
| **Rate limiting** | None | Per-user rate limiter (e.g. `@nestjs/throttler`) |
| **Observability** | `console.log` on start | Structured JSON logging, distributed tracing (OpenTelemetry), metrics |
| **Database connections** | Single PrismaClient | PgBouncer connection pool in front of Postgres |
| **Horizontal scaling** | Single process | Stateless API pods behind a load balancer; ClsModule is already request-scoped, so no sticky-session issues |
| **Exercise catalogue** | Admin-seeded only | Dedicated `ExerciseModule` with CRUD and search |
| **Testing** | Unit tests only | Integration tests against a real test DB; E2E tests against the running server |
