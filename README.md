# Parcela — Rwanda's Smart Parcel Locker Network

Parcela is a full-stack mobile and web application that powers a distributed parcel locker delivery network across Rwanda. Instead of home delivery, senders drop parcels off at a nearby smart locker, a courier moves them through the network, and recipients pick them up from a locker of their choosing — all tracked in real time.

---

## Table of Contents

- [Overview](#overview)
- [User Roles](#user-roles)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Data Models](#data-models)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Demo Accounts](#demo-accounts)
- [Design System](#design-system)

---

## Overview

Parcela solves last-mile delivery in Rwanda by replacing direct-to-door couriers with a network of secure lockers placed in high-traffic areas (markets, hospitals, bus parks, commercial centres) across Kigali. 

**How a delivery works:**

1. Sender creates a parcel in the app, picks origin and destination lockers, pays via mobile money (MTN MoMo / Airtel Money)
2. Sender receives a QR code and drops the parcel at the origin locker
3. A courier picks up the parcel and delivers it to the destination locker
4. Recipient gets a notification and picks it up using a 6-digit code

---

## User Roles

The platform serves three distinct roles, each with its own dashboard:

### Regular User
- Send parcels between any two active lockers
- Choose parcel size (Small / Medium / Large) and delivery speed (Basic / Fast / Express)
- Pay via MTN MoMo or Airtel Money
- Track any parcel in real time by tracking code
- View full parcel history with status filters
- Receive push notifications at every status change
- Access QR codes and pickup codes for drop-off
- Find locker locations on an interactive map
- Submit feedback and ratings

### Courier
- View a personal task dashboard (pending and completed tasks)
- Each task details which locker to visit, what parcels to collect or deliver
- Mark tasks as complete (auto-updates parcel statuses across the network)

### Admin
- System-wide dashboard: total parcels, lockers, users, couriers, in-transit and delivered counts
- Manage all lockers (add, edit capacity, toggle active/inactive)
- Manage all users (view profiles, change roles, add new users)
- View and update status on any parcel
- Assign parcels to specific couriers
- Receive notifications for new parcels and user feedback

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile / Web UI | React Native (Expo 54), TypeScript |
| Navigation | Expo Router 6 (file-based) |
| State | React Context API |
| Maps | OpenStreetMap + Leaflet.js via WebView |
| QR Codes | react-native-qrcode-svg |
| Storage | Expo Secure Store (native) / localStorage (web) |
| Backend | Java 21, Spring Boot 3.2.5 |
| ORM | Spring Data JPA / Hibernate 6.4 |
| Database | PostgreSQL (hosted on Supabase) |
| Auth | Supabase Auth (JWT, Google OAuth) |
| Translation | Anthropic Claude API (claude-haiku-4-5) |
| Build | Expo EAS (mobile), Maven (backend) |
| API Style | REST (JSON) |

---

## Project Structure

```
Akabati/
├── frontend/                        # React Native Expo application
│   ├── app/                         # File-based routing (expo-router)
│   │   ├── (auth)/                  # Public auth screens
│   │   │   ├── login.tsx            # Login with phone/email or Google
│   │   │   └── signup.tsx           # New user registration
│   │   ├── (user)/                  # Authenticated user screens (tab nav)
│   │   │   ├── _layout.tsx          # Bottom tab bar (Home, Map, Send, Track, Me)
│   │   │   ├── home.tsx             # Dashboard — stats, quick actions, recent parcels
│   │   │   ├── send.tsx             # 6-step parcel creation wizard
│   │   │   ├── track.tsx            # Track any parcel by code
│   │   │   ├── map.tsx              # Interactive locker map
│   │   │   ├── history.tsx          # Full parcel history with filters
│   │   │   ├── notifications.tsx    # In-app notification feed
│   │   │   ├── profile.tsx          # Account info, language, feedback, logout
│   │   │   └── qrcode.tsx           # QR code + pickup code after sending
│   │   ├── (courier)/               # Courier-only screens
│   │   │   ├── dashboard.tsx        # Task list (pending / completed tabs)
│   │   │   └── task.tsx             # Individual task details
│   │   ├── admin/                   # Admin-only screens
│   │   │   ├── index.tsx            # System dashboard with stats
│   │   │   ├── lockers.tsx          # Locker management
│   │   │   ├── users.tsx            # User management and role assignment
│   │   │   └── parcels.tsx          # All parcels with status updates
│   │   └── index.tsx                # Splash router (redirects by role)
│   ├── constants/
│   │   ├── Colors.ts                # Full design token system (colors, shadows, status colors)
│   │   └── translations.ts          # i18n strings (English + Kinyarwanda)
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Auth state, login, signup, logout, token refresh
│   │   └── LanguageContext.tsx      # Language switching (en / rw)
│   └── utils/
│       ├── api.ts                   # HTTP client (auto-derives backend host from Metro)
│       └── storage.ts               # Unified storage (SecureStore vs localStorage)
│
├── backend/                         # Spring Boot backend
│   └── src/main/java/com/parcela/
│       ├── config/
│       │   ├── DataSeeder.java       # Seeds lockers, users, parcels, tasks on startup
│       │   └── SecurityConfig.java   # JWT auth filter, public vs protected routes
│       ├── controller/
│       │   ├── AuthController.java   # /api/auth/*
│       │   ├── LockerController.java # /api/lockers/*
│       │   ├── ParcelController.java # /api/parcels/*
│       │   ├── CourierController.java# /api/courier/*
│       │   ├── AdminController.java  # /api/admin/*
│       │   └── UserController.java   # /api/users
│       ├── service/                  # Business logic
│       ├── model/                    # JPA entities
│       ├── repository/               # Spring Data JPA repositories
│       ├── dto/                      # Request and response DTOs
│       └── ParchelaApplication.java  # Spring Boot entry point
│
└── design_guidelines.json            # Full design system specification
```

---

## Key Features

### Parcel Sending — 6-Step Wizard

`frontend/app/(user)/send.tsx` walks the sender through:

| Step | What happens |
|---|---|
| 1 | Enter sender name and phone |
| 2 | Enter recipient name, phone, optional email and delivery notes |
| 3 | Choose parcel size (Small / Medium / Large) |
| 4 | Select origin locker (drop-off) and destination locker (pick-up) |
| 5 | Choose delivery speed: Basic, Fast (+1 500 RWF), Express (+4 500 RWF) |
| 6 | Pay via MTN MoMo or Airtel Money — a polling modal confirms payment |

On successful payment the sender receives a QR code screen (`/qrcode`) with the scannable code and 6-digit fallback pickup code.

### Real-Time Tracking

Any user can track a parcel by its `PAR-XXXXXXXX` code without logging in. The tracking screen shows:
- Current status with emoji and color-coded hero banner
- Origin → destination route display
- Full timestamped status history

### Interactive Locker Map

Built with OpenStreetMap and Leaflet.js rendered inside a `<WebView>`. Shows all active lockers as custom markers with live availability counts (S / M / L slots remaining). Falls back to a list view and caches locker data in AsyncStorage for offline use.

### Courier Task System

When a parcel is paid for (or assigned by an admin), a `CourierTask` record is created linking a courier to a set of parcels at a specific locker. The courier's dashboard groups tasks as **Collect** (pick up from origin locker) or **Deliver** (drop at destination locker). Completing a task automatically advances all linked parcels to `in_transit` or `ready_for_pickup`.

### Admin Parcel Assignment

Admins can open any parcel in the Parcels tab, select a task type (Collect / Deliver), choose a courier from the live user list, and create an assignment — no JWT ceremony required, the parcel ID is the secret.

### Multi-Language Support

The entire UI supports English and Kinyarwanda. All strings are centralized in `constants/translations.ts` and toggled via `LanguageContext`. The language preference persists across sessions.

### Notifications

Every significant parcel event (payment confirmed, in transit, ready for pickup, delivered) creates a notification record for relevant users. Admins get notified of new parcels and user feedback. The bell icon in the header shows an unread count badge.

### Translation Endpoint

`POST /api/translate` accepts any text and target language, calls the Anthropic Claude API, and returns the translated string. Used for dynamic content that isn't covered by the static i18n strings.

---

## Data Models

### AppUser

| Field | Type | Notes |
|---|---|---|
| `user_id` | String | e.g. `USR-XXXXXXXX` |
| `auth_user_id` | UUID | Supabase auth UUID (synced on login) |
| `name` | String | Full name |
| `phone` | String | Unique, used as login identifier |
| `email` | String | Optional, unique |
| `role` | String | `user` / `courier` / `admin` |
| `created_at` | Instant | |

### Locker

| Field | Type | Notes |
|---|---|---|
| `locker_id` | String | e.g. `LKR-KGL001` |
| `name` | String | Display name |
| `address` | String | Street address |
| `district` | String | Kigali district |
| `lat` / `lng` | Double | GPS coordinates |
| `total_small/medium/large` | Int | Physical capacity per size |
| `available_small/medium/large` | Int | Current availability |
| `status` | String | `active` / `inactive` |

### Parcel

| Field | Type | Notes |
|---|---|---|
| `parcel_id` | String | e.g. `PCL-0001` |
| `tracking_code` | String | e.g. `PAR-AA11BB22` (public) |
| `sender_id` | String | References AppUser |
| `sender_name` / `sender_phone` | String | |
| `recipient_name` / `recipient_phone` / `recipient_email` | String | |
| `origin_locker_id` / `origin_locker_name` | String | Drop-off point |
| `destination_locker_id` / `destination_locker_name` | String | Pick-up point |
| `size` | String | `small` / `medium` / `large` |
| `price` | BigDecimal | RWF |
| `status` | String | See status lifecycle below |
| `payment_status` | String | `pending` / `paid` / `failed` |
| `delivery_mode` | String | `basic` / `fast` / `express` |
| `qr_code` | String | 6-digit pickup code |
| `qr_data` | String | `PARCELA:{parcelId}:{trackingCode}:{code}` |
| `status_history` | JSONB | Timestamped status changelog |
| `client_notes` | String | Optional sender note (max 250 chars) |

**Parcel status lifecycle:**
```
awaiting_payment → awaiting_dropoff → dropped_off → in_transit → ready_for_pickup → delivered
                                                                                   ↘ returned
```

### CourierTask

| Field | Type | Notes |
|---|---|---|
| `task_id` | String | e.g. `TSK-COL001` |
| `courier_id` | String | References AppUser (courier role) |
| `type` | String | `collect` / `deliver` |
| `locker_id` / `locker_name` | String | Target locker |
| `parcel_ids` | JSONB | Array of parcel IDs |
| `parcel_count` | Int | |
| `status` | String | `pending` / `completed` |

---

## API Reference

All requests go to the backend base URL (default: `http://localhost:8080`).

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Register with name, phone, password, optional email |
| POST | `/api/auth/login` | Public | Login with phone or email + password |
| POST | `/api/auth/google/callback` | Public | Exchange Supabase session_id for app token |
| GET | `/api/auth/me` | JWT | Get current user profile |
| POST | `/api/auth/logout` | JWT | Invalidate session |

### Lockers — `/api/lockers`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/lockers` | Public | All lockers with availability |
| GET | `/api/lockers/{id}` | Public | Single locker |
| POST | `/api/lockers` | Admin JWT | Create locker |
| PUT | `/api/lockers/{id}` | Admin JWT | Update locker |

### Parcels — `/api/parcels`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/parcels` | Public | All parcels (admin dashboard use) |
| POST | `/api/parcels` | JWT | Create parcel |
| GET | `/api/parcels/my` | JWT | Current user's parcels |
| GET | `/api/parcels/by-user/{userId}` | Public | Parcels by user_id (+ optional ?phone= &email=) |
| GET | `/api/parcels/track/{code}` | Public | Track by tracking code |
| GET | `/api/parcels/{id}` | JWT | Single parcel |
| PUT | `/api/parcels/{id}/status` | Courier/Admin JWT | Update status |
| POST | `/api/parcels/{id}/payment` | JWT | Process payment |
| GET | `/api/parcels/{id}/payment-status` | JWT | Poll payment status |
| POST | `/api/parcels/{id}/assign` | Public | Assign parcel to courier |

### Couriers — `/api/courier`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/courier/tasks` | JWT | Current courier's tasks |
| GET | `/api/courier/tasks/by-courier/{id}` | Public | Tasks by courier user_id |
| PUT | `/api/courier/tasks/{taskId}` | JWT | Update task status |

### Admin — `/api/admin`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | Admin JWT | System-wide statistics |
| GET | `/api/admin/users` | Admin JWT | All users |
| PUT | `/api/admin/users/{id}/role` | Admin JWT | Change user role |
| GET | `/api/admin/parcels` | Admin JWT | All parcels |
| GET | `/api/admin/lockers` | Admin JWT | All lockers |
| PUT | `/api/admin/lockers/{id}` | Admin JWT | Update locker |

### Other

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | Public | All users (for admin UI dropdowns) |
| GET | `/api/notifications` | JWT | Current user's notifications |
| PUT | `/api/notifications/{id}/read` | JWT | Mark one as read |
| PUT | `/api/notifications/read-all` | JWT | Mark all as read |
| POST | `/api/translate` | Public | Translate text via Claude API |
| POST | `/api/feedback` | JWT | Submit rating and message |

---

## Authentication

Parcela uses **Supabase Auth** for identity and **JWT** for stateless API authorization.

### Login flow (phone or email)

```
User enters phone + password
  → POST /api/auth/login
    → Backend looks up AppUser by phone or email
    → Calls Supabase signInWithPassword (synthetic email for phone-only: phone@parcela.internal)
    → Supabase returns JWT access token
    → Backend syncs Supabase UUID → app_users.auth_user_id
    → Returns { token, user }
  → Frontend stores token (SecureStore on native, localStorage on web)
  → AuthContext sets user state → Expo Router redirects by role
```

### Google OAuth (web only)

```
User taps "Continue with Google"
  → Redirect to https://auth.emergentagent.com/?redirect=<origin>
  → On return, URL hash contains session_id
  → POST /api/auth/google/callback { session_id }
    → Backend extracts sub and email from JWT
    → Creates AppUser if first login
    → Returns { token, user }
```

### Token refresh / session restore

On every app launch `AuthContext.initAuth()` reads the stored token and calls `GET /api/auth/me`. If the token is expired the stored token is deleted and the user lands on the login screen.

### Public vs protected routes (SecurityConfig)

Routes that require no JWT:
- `GET /api/lockers`, `GET /api/lockers/**`
- `GET /api/users`
- `GET /api/parcels`, `GET /api/parcels/track/**`, `GET /api/parcels/by-user/**`
- `GET /api/courier/tasks/by-courier/**`
- `POST /api/parcels/*/assign`
- `POST /api/payments/mtn/callback`

Everything else requires a valid Supabase JWT in the `Authorization: Bearer <token>` header.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Java 21 and Maven 3.9+
- A Supabase project (PostgreSQL + Auth enabled)
- Expo CLI (`npm install -g expo-cli`)

### 1. Clone the repo

```bash
git clone <repo-url>
cd Akabati
```

### 2. Backend

```bash
cd backend

# Copy and fill in environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run the Spring Boot server
./mvnw spring-boot:run
# Server starts on http://localhost:8080
# DataSeeder auto-runs and seeds 8 lockers + 5 demo users on first start
```

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env
# Edit EXPO_PUBLIC_API_BASE_URL if your backend is not on localhost:8080

# Start the Expo dev server
npx expo start
```

Then press:
- `w` — open in browser at `http://localhost:8081`
- `a` — open in Android emulator
- `i` — open in iOS simulator
- Scan the QR code with the Expo Go app on a physical device

### 4. Build for production

```bash
# Mobile (requires EAS account)
cd frontend
eas build --platform android
eas build --platform ios

# Backend (Docker)
cd backend
docker build -t parcela-backend .
docker run -p 8080:8080 --env-file .env parcela-backend
```

---

## Environment Variables

### Backend (`backend/.env` or application properties)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (backend only) |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret from Supabase project settings |
| `SPRING_DATASOURCE_URL` | Yes | PostgreSQL JDBC URL from Supabase |
| `SPRING_DATASOURCE_USERNAME` | Yes | Database username |
| `SPRING_DATASOURCE_PASSWORD` | Yes | Database password |
| `APP_ADMIN_EMAIL` | No | Email address that gets auto-assigned admin role on first login |
| `APP_MTN_ENABLED` | No | `true` to enable live MTN MoMo (default: `false`, uses mock) |
| `ANTHROPIC_API_KEY` | No | Claude API key for `/api/translate` |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | No | Backend base URL (default: auto-detected from Metro host on port 8080) |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |

---

## Demo Accounts

These accounts are seeded automatically by `DataSeeder.java` on first startup:

| Role | Identifier | Password |
|---|---|---|
| User | `0789999999` | `User@1234` |
| User | `marie@test.rw` | `User@1234` |
| Courier | `courier@parcela.rw` | `Courier@1234` |
| Admin | `benishimwe31@gmail.com` | `Admin@1234` |

The seeder also creates 8 Kigali locker locations and 11 sample parcels across all status stages so every screen has data to display immediately.

---

## Design System

The full design specification lives in `design_guidelines.json`. The implemented tokens are in `frontend/constants/Colors.ts`:

| Token | Value | Usage |
|---|---|---|
| `primary` | `#00A1DE` | Buttons, links, active states, user role |
| `green` | `#16A34A` | Success, courier role, admin header |
| `yellow` / `yellowDark` | `#FAD201` / `#C7A600` | Admin role, warnings, demo box |
| `error` | `#EF4444` | Errors, returned status |
| `textPrimary` | `#0F172A` | Body text |
| `textSecondary` | `#64748B` | Labels, captions |
| `background` | `#F8FAFC` | Screen background |

Parcel statuses each have a dedicated color set (`STATUS_COLORS`) used consistently across every card and badge in the app.

---

## License

Private project. All rights reserved — Engr-BenitoIshimwe / Parcela Rwanda.
