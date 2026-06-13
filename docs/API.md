# Parcela API Reference

**Base URL:** `http://localhost:8080` (development) / `https://api.parcela.rw` (production)

**Auth:** Protected endpoints require `Authorization: Bearer <jwt>` in the request header. JWTs are issued by Supabase Auth.

**Content-Type:** `application/json`

**Naming:** All JSON fields use `snake_case`.

---

## Auth — `/api/auth`

### POST `/api/auth/signup`

Register a new user account.

**Auth required:** No

**Request body:**
```json
{
  "name": "Alice Test",
  "phone": "0789999999",
  "email": "alice@example.com",
  "password": "secret123"
}
```
`email` is optional. `phone` is required.

**Response `200`:**
```json
{
  "token": "<jwt>",
  "user": {
    "user_id": "USR-USR001",
    "name": "Alice Test",
    "phone": "0789999999",
    "email": "alice@example.com",
    "role": "user",
    "picture": null,
    "created_at": "2026-04-04T14:00:00Z"
  }
}
```

---

### POST `/api/auth/login`

Login with phone number or email.

**Auth required:** No

**Request body:**
```json
{
  "identifier": "0789999999",
  "password": "secret123"
}
```
`identifier` may be a phone number or email address.

**Response `200`:** Same shape as signup response.

---

### POST `/api/auth/google/callback`

Complete a Google OAuth sign-in after the Supabase redirect.

**Auth required:** No

**Request body:**
```json
{
  "session_id": "<supabase-session-id-from-url-hash>"
}
```

**Response `200`:** Same shape as signup response.

---

### GET `/api/auth/me`

Fetch the currently authenticated user's profile.

**Auth required:** Yes (JWT)

**Response `200`:**
```json
{
  "user_id": "USR-USR001",
  "name": "Alice Test",
  "phone": "0789999999",
  "email": "alice@example.com",
  "role": "user",
  "picture": null,
  "created_at": "2026-04-04T14:00:00Z"
}
```

---

### POST `/api/auth/logout`

Invalidate the current session in Supabase.

**Auth required:** Yes (JWT)

**Response `200`:** `{ "message": "Logged out successfully" }`

---

## Parcels — `/api/parcels`

### POST `/api/parcels`

Create a new parcel.

**Auth required:** Yes (JWT)

**Request body:**
```json
{
  "sender_name": "Alice Test",
  "sender_phone": "0789999999",
  "recipient_name": "Jean Mugisha",
  "recipient_phone": "0781111111",
  "recipient_email": "jean@example.com",
  "origin_locker_id": "LOC-001",
  "destination_locker_id": "LOC-002",
  "size": "medium",
  "delivery_mode": "basic",
  "client_notes": "Fragile, handle with care"
}
```

**Size values:** `small` | `medium` | `large`

**Delivery mode values:** `basic` (2–3 days, 2,000 RWF) | `fast` (next morning, 3,500 RWF) | `express` (30 min–1 hr, 6,500 RWF)

**Response `201`:**
```json
{
  "parcel_id": "PAR-AA11BB22",
  "tracking_code": "AKB-XXXXXXXX",
  "status": "awaiting_payment",
  "price": 2000,
  "size": "medium",
  "delivery_mode": "basic",
  "origin_locker_name": "Kigali City Centre",
  "destination_locker_name": "Kimironko Market",
  "qr_code": "data:image/png;base64,...",
  "payment_status": "pending",
  "created_at": "2026-04-10T09:00:00Z"
}
```

---

### GET `/api/parcels/my`

List the authenticated sender's parcels.

**Auth required:** Yes (JWT)

**Response `200`:** Array of parcel objects (same shape as creation response, with `status_history`).

---

### GET `/api/parcels`

List all parcels in the system.

**Auth required:** Yes (JWT — Courier or Admin)

---

### GET `/api/parcels/{parcelId}`

Get full detail of a single parcel.

**Auth required:** Yes (JWT)

---

### GET `/api/parcels/track/{trackingCode}`

Track a parcel by tracking code. **No authentication required** — safe to share publicly.

**Auth required:** No

**Path param:** `trackingCode` — e.g., `AKB-XXXXXXXX`

**Response `200`:**
```json
{
  "parcel_id": "PAR-AA11BB22",
  "tracking_code": "AKB-XXXXXXXX",
  "status": "in_transit",
  "origin_locker_name": "Kigali City Centre",
  "destination_locker_name": "Kimironko Market",
  "size": "medium",
  "delivery_mode": "basic",
  "status_history": [
    { "status": "awaiting_payment", "timestamp": "2026-04-10T09:00:00Z" },
    { "status": "awaiting_dropoff", "timestamp": "2026-04-10T09:05:00Z" },
    { "status": "dropped_off", "timestamp": "2026-04-10T10:30:00Z" },
    { "status": "in_transit", "timestamp": "2026-04-10T11:00:00Z" }
  ]
}
```

---

### GET `/api/parcels/by-user/{userId}`

Get parcels created by a specific user. Optionally filter by phone or email via query params.

**Auth required:** No

**Query params:** `?phone=0789999999` or `?email=alice@example.com`

---

### POST `/api/parcels/{parcelId}/payment`

Initiate mobile money payment for a parcel.

**Auth required:** Yes (JWT)

**Request body:**
```json
{
  "phone": "0789999999",
  "payment_method": "mtn_momo"
}
```

**Payment method values:** `mtn_momo` | `airtel_money`

**Response `200`:**
```json
{
  "status": "pending",
  "reference_id": "<mtn-momo-reference-uuid>"
}
```

---

### GET `/api/parcels/{parcelId}/payment-status`

Poll the payment status. Call after initiating payment until `completed` or `failed`.

**Auth required:** Yes (JWT)

**Response `200`:**
```json
{
  "payment_status": "completed",
  "parcel_status": "awaiting_dropoff"
}
```

---

### PUT `/api/parcels/{parcelId}/status`

Manually update a parcel's status. Used by couriers and admins.

**Auth required:** Yes (JWT — Courier or Admin)

**Request body:**
```json
{
  "status": "delivered",
  "note": "Delivered to compartment 3B"
}
```

---

### POST `/api/parcels/{parcelId}/scan`

Process a courier QR code scan at a locker.

**Auth required:** Yes (JWT — Courier)

**Request body:**
```json
{
  "scan_type": "drop_off"
}
```

**Scan type values:** `drop_off` (courier collecting from origin locker) | `picked_up` (recipient collecting from destination locker)

---

### POST `/api/parcels/{parcelId}/assign`

Assign a parcel to a courier task. Admin only.

**Auth required:** Yes (JWT — Admin)

**Request body:**
```json
{
  "courier_id": "USR-COU001",
  "task_type": "collect"
}
```

---

## Lockers — `/api/lockers`

### GET `/api/lockers`

List all active lockers. Used to populate the map and locker-picker in the send flow.

**Auth required:** No

**Response `200`:**
```json
[
  {
    "locker_id": "LOC-001",
    "name": "Kigali City Centre",
    "address": "KN 4 Ave, Nyarugenge",
    "district": "Nyarugenge",
    "lat": -1.9441,
    "lng": 30.0619,
    "available_small": 10,
    "available_medium": 8,
    "available_large": 4,
    "total_small": 10,
    "total_medium": 8,
    "total_large": 4,
    "status": "active"
  }
]
```

---

### GET `/api/lockers/{lockerId}`

Get full details for a single locker.

**Auth required:** No

---

### POST `/api/lockers`

Create a new locker station. Admin only.

**Auth required:** Yes (JWT — Admin)

**Request body:**
```json
{
  "name": "Gikondo Industrial",
  "address": "KK 17 Ave, Kicukiro",
  "district": "Kicukiro",
  "lat": -1.9700,
  "lng": 30.0700,
  "total_small": 10,
  "total_medium": 8,
  "total_large": 4
}
```

**Response `201`:** Full locker object. Locker is automatically set to `active` with full compartment availability.

---

### PUT `/api/lockers/{lockerId}`

Update locker name, address, or status. Admin only.

**Auth required:** Yes (JWT — Admin)

**Request body:** Any subset of locker fields.

---

### DELETE `/api/lockers/{lockerId}`

Delete a locker. Admin only.

**Auth required:** Yes (JWT — Admin)

**Response `204`:** No content.

---

## Courier — `/api/courier`

### GET `/api/courier/tasks`

Get the authenticated courier's pending and completed tasks.

**Auth required:** Yes (JWT — Courier role)

**Response `200`:**
```json
[
  {
    "task_id": "TASK-001",
    "type": "collect",
    "locker_id": "LOC-001",
    "locker_name": "Kigali City Centre",
    "parcel_ids": ["PAR-AA11BB22"],
    "parcel_count": 1,
    "status": "pending",
    "created_at": "2026-04-22T08:00:00Z"
  }
]
```

---

### GET `/api/courier/tasks/by-courier/{courierId}`

Get tasks for a courier by ID (no auth required, used internally).

---

### PUT `/api/courier/tasks/{taskId}`

Update a task's status (e.g., mark as completed).

**Auth required:** Yes (JWT — Courier)

**Request body:**
```json
{
  "status": "completed"
}
```

---

## Admin — `/api/admin`

### GET `/api/admin/stats`

System-wide dashboard statistics.

**Auth required:** Yes (JWT — Admin)

**Response `200`:**
```json
{
  "total_parcels": 48,
  "parcels_today": 3,
  "in_transit": 12,
  "delivered": 30,
  "active_lockers": 8,
  "ready_for_pickup": 6,
  "total_users": 5,
  "total_couriers": 1,
  "total_admins": 1
}
```

---

### GET `/api/admin/lockers`

List all lockers including inactive ones. Admin only.

**Auth required:** Yes (JWT — Admin)

---

### GET `/api/admin/users`

List all registered users with role information.

**Auth required:** Yes (JWT — Admin)

---

### GET `/api/admin/couriers/{courierId}/tasks`

Get all tasks assigned to a specific courier.

**Auth required:** Yes (JWT — Admin)

---

### POST `/api/admin/courier-tasks`

Create a new courier task.

**Auth required:** Yes (JWT — Admin)

**Request body:**
```json
{
  "courier_id": "USR-COU001",
  "type": "collect",
  "locker_id": "LOC-001",
  "parcel_ids": ["PAR-AA11BB22", "PAR-CC33DD44"]
}
```

---

### PUT `/api/admin/users/{userId}/role`

Change a user's role.

**Auth required:** Yes (JWT — Admin)

**Request body:**
```json
{
  "role": "courier"
}
```

**Role values:** `user` | `courier` | `admin`

---

## Notifications — `/api/notifications`

### GET `/api/notifications`

Get all notifications for the authenticated user, sorted by recency.

**Auth required:** Yes (JWT)

**Response `200`:**
```json
[
  {
    "notification_id": "NOTIF-001",
    "title": "Parcel Ready for Pickup",
    "body": "Your parcel PAR-AA11BB22 is ready to collect at Kimironko Market.",
    "type": "parcel_update",
    "parcel_id": "PAR-AA11BB22",
    "tracking_code": "AKB-XXXXXXXX",
    "read": false,
    "created_at": "2026-04-10T14:30:00Z"
  }
]
```

---

### PUT `/api/notifications/{notificationId}/read`

Mark a single notification as read.

**Auth required:** Yes (JWT)

**Response `200`:** `{ "message": "Notification marked as read" }`

---

### PUT `/api/notifications/read-all`

Mark all of the current user's notifications as read.

**Auth required:** Yes (JWT)

---

## Feedback — `/api/feedback`

### POST `/api/feedback`

Submit a user feedback rating and comment.

**Auth required:** Yes (JWT)

**Request body:**
```json
{
  "rating": 5,
  "comment": "Very fast delivery, great service!"
}
```

---

## Translation — `/api/translate`

### POST `/api/translate`

Translate text using the Anthropic Claude API. Currently supports English ↔ Kinyarwanda.

**Auth required:** No

**Request body:**
```json
{
  "text": "Your parcel is ready for pickup.",
  "target_language": "rw"
}
```

**Response `200`:**
```json
{
  "translated_text": "Umufuko wawe uri gutegereza gufatwa."
}
```

---

## Error Responses

All error responses follow this shape:

```json
{
  "error": "Parcel not found",
  "status": 404,
  "timestamp": "2026-04-10T14:30:00Z"
}
```

| Status | Meaning |
|---|---|
| 400 | Bad request — validation error or missing required field |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict — e.g., phone number already registered |
| 500 | Internal server error |
