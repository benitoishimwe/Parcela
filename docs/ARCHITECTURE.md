# Parcela — Architecture

## Overview

Parcela follows a three-tier architecture: a React Native client (mobile + web), a Java Spring Boot REST API, and a PostgreSQL database hosted on Supabase. All inter-service communication uses JSON over HTTPS. Authentication is delegated to Supabase Auth, with the backend validating JWTs via a JWKS endpoint.

---

## Component Relationships

```
┌────────────────────────────────────────────────────────────────────┐
│  CLIENT (React Native / Expo)                                      │
│                                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐               │
│  │  User App   │  │ Courier App  │  │ Admin Panel│               │
│  │  (tabs)     │  │  (tasks)     │  │  (web)     │               │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘               │
│         │                │                │                       │
│  ┌──────▼────────────────▼────────────────▼──────┐               │
│  │  AuthContext  ·  LanguageContext  ·  api.ts    │               │
│  └──────────────────────────┬─────────────────────┘               │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ JWT Bearer Token
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│  SPRING BOOT API  (port 8080)                                      │
│                                                                    │
│  SecurityConfig ──▶ OAuth2ResourceServer ──▶ JWKS (Supabase)      │
│                                                                    │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌───────────────┐  │
│  │Auth      │  │Parcel      │  │Locker     │  │Admin          │  │
│  │Service   │  │Service     │  │Service    │  │(AdminCtrl)    │  │
│  └────┬─────┘  └─────┬──────┘  └─────┬─────┘  └──────┬────────┘  │
│       │              │               │               │            │
│  ┌────▼──────────────▼───────────────▼───────────────▼────────┐  │
│  │  Spring Data JPA Repositories (AppUser, Parcel, Locker …)  │  │
│  └───────────────────────────────┬─────────────────────────────┘  │
└──────────────────────────────────┼─────────────────────────────────┘
                                   │ JDBC / pgbouncer
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│  SUPABASE                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐   │
│  │  PostgreSQL Database  │  │  Supabase Auth (JWT / JWKS)      │   │
│  │  app_users            │  │  Phone + Email + Google OAuth    │   │
│  │  parcels              │  └──────────────────────────────────┘   │
│  │  lockers              │                                          │
│  │  courier_tasks        │                                          │
│  │  notifications        │                                          │
│  └──────────────────────┘                                          │
└────────────────────────────────────────────────────────────────────┘
                    │                          │
          ┌─────────▼──────────┐   ┌──────────▼──────────────┐
          │  MTN Mobile Money  │   │  Anthropic Claude API   │
          │  (payment)         │   │  (translation)          │
          └────────────────────┘   └─────────────────────────┘
```

---

## Data Entities

### AppUser

Mirrors a Supabase Auth user. Created on first login/signup.

| Field | Type | Notes |
|---|---|---|
| user_id | String (PK) | Application-level ID (e.g., `USR-USR001`) |
| auth_user_id | UUID | Supabase Auth UUID |
| name | String | Full display name |
| phone | String (unique) | Primary identifier for phone-only users |
| email | String (unique, nullable) | Optional email |
| role | Enum | `user` \| `courier` \| `admin` |
| picture | String | Profile photo URL |
| created_at | Timestamp | |

Phone-only users receive a synthetic email `{phone}@parcela.internal` in Supabase Auth to enable password-based login.

### Parcel

Central entity representing a single parcel shipment.

| Field | Type | Notes |
|---|---|---|
| parcel_id | String (PK) | e.g., `PAR-AA11BB22` |
| tracking_code | String (unique) | Short alphanumeric code shown to users |
| sender_id | String (FK → AppUser) | |
| sender_name, sender_phone | String | Denormalized for display |
| recipient_name, recipient_phone, recipient_email | String | |
| origin_locker_id / name | String | Drop-off locker |
| destination_locker_id / name | String | Pickup locker |
| size | Enum | `small` \| `medium` \| `large` |
| status | Enum | See lifecycle below |
| delivery_mode | Enum | `basic` \| `fast` \| `express` |
| price | Decimal | Total price in RWF |
| payment_status | Enum | `pending` \| `completed` \| `failed` |
| payment_method | Enum | `mobile_money` |
| mtn_ref_id | String | MTN MoMo transaction reference |
| qr_code | String | Base64 QR image or data URI |
| qr_data | String | Raw QR payload |
| client_notes | String | Sender notes to courier |
| status_history | JSONB | Array of `{status, timestamp, note}` |
| created_at | Timestamp | |

**Parcel status lifecycle:**

```
awaiting_payment
      │
      ▼ (payment confirmed)
awaiting_dropoff
      │
      ▼ (sender scans QR at origin locker)
dropped_off
      │
      ▼ (courier scans and collects)
in_transit
      │
      ▼ (courier delivers to destination locker)
ready_for_pickup
      │
      ▼ (recipient scans QR)
delivered
      │
      ▼ (if uncollected / issue)
returned
```

### Locker

A physical locker station with compartments grouped by size.

| Field | Type | Notes |
|---|---|---|
| locker_id | String (PK) | e.g., `LOC-001` |
| name | String | Human-readable name |
| address | String | Street address |
| district | String | Kigali district |
| lat / lng | Double | GPS coordinates |
| total_small / medium / large | Integer | Physical compartment capacity |
| available_small / medium / large | Integer | Current free slots |
| status | Enum | `active` \| `maintenance` \| `offline` |
| created_at | Timestamp | |

### CourierTask

An individual assignment for a courier to collect or deliver parcels at one locker.

| Field | Type | Notes |
|---|---|---|
| task_id | String (PK) | e.g., `TASK-001` |
| courier_id | String (FK → AppUser) | |
| type | Enum | `collect` (pick up from locker) \| `deliver` (drop off at locker) |
| locker_id / locker_name | String | Target locker |
| parcel_ids | JSONB | Array of parcel IDs for this task |
| parcel_count | Integer | |
| status | Enum | `pending` \| `completed` |
| completed_at | Timestamp | Nullable |
| created_at | Timestamp | |

### Notification

In-app notification for a user.

| Field | Type | Notes |
|---|---|---|
| notification_id | String (PK) | |
| user_id | String (FK → AppUser) | |
| title / body | String | |
| parcel_id / tracking_code | String (nullable) | Deep-link data |
| type | Enum | `parcel_update` \| `feedback` \| `system` |
| read | Boolean | |
| created_at | Timestamp | |

---

## Authentication Flow

### Phone / Email Login

```
Client                         Backend                        Supabase Auth
  │                               │                               │
  │──POST /api/auth/login────────▶│                               │
  │  {identifier, password}       │──signInWithPassword()────────▶│
  │                               │◀─── {access_token, user} ────│
  │◀── {token, user} ─────────────│                               │
  │                               │                               │
  │ (store token in SecureStore)  │                               │
```

### Google OAuth

```
Client                    Supabase OAuth          Backend
  │                           │                     │
  │──open OAuth URL──────────▶│                     │
  │◀─── redirect with         │                     │
  │     #session_id ──────────│                     │
  │                           │                     │
  │──POST /api/auth/google/callback─────────────────▶
  │  {session_id}             │                     │──exchange session──▶Supabase
  │                           │                     │◀─── {token, user} ─│
  │◀── {token, user} ─────────────────────────────── │
```

### Request Authentication

Every protected API call sends `Authorization: Bearer <jwt>` in the request header. Spring Security validates the JWT signature against the Supabase JWKS endpoint (`https://<project>.supabase.co/auth/v1/keys`) and extracts the `sub` claim (Supabase UUID). The `AuthService` then resolves the `AppUser` from the database using the `auth_user_id`.

---

## Payment Flow

```
Client                    Backend                   MTN MoMo
  │                          │                          │
  │──POST /payment───────────▶│                         │
  │  {phone, method}          │──requestToPay()─────────▶│
  │                           │◀─── {referenceId} ──────│
  │◀─── {status: pending} ────│                         │
  │                           │                         │
  │──GET /payment-status──────▶│                        │
  │                           │──getPaymentStatus()─────▶│
  │                           │◀─── {status: SUCCESSFUL}│
  │◀─── {status: completed} ──│                         │
  │  (parcel status updated to awaiting_dropoff)        │
```

---

## Frontend Navigation Structure

```
app/
├── index.tsx                  ← Splash screen (auto-redirects based on auth state)
├── (auth)/
│   ├── login.tsx              ← Phone/email + password, Google OAuth
│   └── signup.tsx             ← New user registration
├── (user)/                    ← Bottom tab navigator
│   ├── home.tsx               ← Dashboard + recent parcels
│   ├── send.tsx               ← 6-step parcel creation wizard
│   ├── map.tsx                ← Leaflet locker map
│   ├── track.tsx              ← Public parcel tracking
│   ├── history.tsx            ← Parcel history with filters
│   ├── notifications.tsx      ← In-app notifications
│   ├── profile.tsx            ← Settings + account info
│   └── qrcode.tsx             ← QR display + scanner
├── (courier)/
│   ├── dashboard.tsx          ← Task list (pending/completed)
│   └── task.tsx               ← Task detail + Mark complete
└── admin/
    ├── index.tsx              ← Analytics overview
    ├── lockers.tsx            ← Locker CRUD
    ├── users.tsx              ← User/role management
    └── parcels.tsx            ← Parcel management
```

Role-based routing is enforced in the root `_layout.tsx`: after login, users are redirected to `/(user)/home`, couriers to `/(courier)/dashboard`, and admins to `/admin`.

---

## External Services

| Service | Purpose | Config key |
|---|---|---|
| Supabase | Database + Auth | `supabase.url`, `supabase.service-role-key` |
| MTN Mobile Money | Payment processing | `mtn.momo.*` |
| Airtel Money | Payment processing (alt) | Integrated alongside MTN MoMo |
| Anthropic Claude | Text translation (EN↔RW) | `anthropic.api.key` |
| SMS Provider | Delivery notifications | `sms.*` (stubbed) |
| OpenStreetMap + Leaflet | Locker map tiles | No key required |
