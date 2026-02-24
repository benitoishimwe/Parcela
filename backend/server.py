from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os, logging, uuid, string, random, httpx
from passlib.context import CryptContext
from jose import jwt, JWTError
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'akabati-secret-2024')
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
ADMIN_EMAIL = "benishimwe31@gmail.com"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Akabati API")
api_router = APIRouter(prefix="/api")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserSignup(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    identifier: str
    password: str

class GoogleCallbackRequest(BaseModel):
    session_id: str

class LockerCreate(BaseModel):
    name: str
    address: str
    district: str
    lat: float
    lng: float
    total_small: int = 10
    total_medium: int = 8
    total_large: int = 4

class LockerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    available_small: Optional[int] = None
    available_medium: Optional[int] = None
    available_large: Optional[int] = None

class ParcelCreate(BaseModel):
    sender_name: str
    sender_phone: str
    recipient_name: str
    recipient_phone: str
    recipient_email: Optional[str] = None
    origin_locker_id: str
    destination_locker_id: str
    size: str
    payment_method: str = "mobile_money"

class TranslateRequest(BaseModel):
    text: str
    target_lang: str

class UpdateRole(BaseModel):
    role: str

class ProcessPayment(BaseModel):
    payment_method: str = "mobile_money"
    phone_number: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None

# ============ HELPERS ============

def gen_tracking_code() -> str:
    return f"AKB-{''.join(random.choices(string.ascii_uppercase + string.digits, k=8))}"

def gen_pickup_code() -> str:
    return ''.join(random.choices(string.digits, k=6))

def get_price(size: str) -> float:
    return {"small": 1000.0, "medium": 2000.0, "large": 3500.0}.get(size.lower(), 1000.0)

def create_jwt(user_id: str, role: str) -> str:
    payload = {"user_id": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def hash_pwd(p: str) -> str: return pwd_context.hash(p)
def verify_pwd(plain: str, hashed: str) -> bool: return pwd_context.verify(plain, hashed)

STATUS_LABELS = {
    "awaiting_payment": "Awaiting Payment",
    "awaiting_dropoff": "Awaiting Drop-off",
    "dropped_off": "Dropped Off",
    "in_transit": "In Transit",
    "ready_for_pickup": "Ready for Pickup",
    "delivered": "Delivered",
    "returned": "Returned",
}

# ============ AUTH DEPENDENCY ============

async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = session["expires_at"]
        if isinstance(exp, str): exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if not user: raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if not user: raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    return user

async def require_courier_or_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in ["courier", "admin"]: raise HTTPException(status_code=403, detail="Courier/Admin only")
    return user

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/signup")
async def signup(data: UserSignup):
    existing = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    if existing: raise HTTPException(status_code=400, detail="Phone already registered")
    if data.email:
        existing_email = await db.users.find_one({"email": data.email}, {"_id": 0})
        if existing_email: raise HTTPException(status_code=400, detail="Email already registered")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    role = "admin" if data.email == ADMIN_EMAIL else "user"
    user_doc = {
        "user_id": user_id, "name": data.name, "phone": data.phone,
        "email": data.email, "role": role, "picture": None,
        "password_hash": hash_pwd(data.password),
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("password_hash"); user_doc.pop("_id", None)
    return {"token": create_jwt(user_id, role), "user": user_doc}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    user = await db.users.find_one({"$or": [{"phone": data.identifier}, {"email": data.identifier}]}, {"_id": 0})
    if not user: raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("password_hash"): raise HTTPException(status_code=401, detail="Use Google login")
    if not verify_pwd(data.password, user["password_hash"]): raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user["user_id"], user["role"])
    user.pop("password_hash", None)
    return {"token": token, "user": user}

@api_router.post("/auth/google/callback")
async def google_callback(data: GoogleCallbackRequest, response: Response):
    async with httpx.AsyncClient() as http_client:
        result = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": data.session_id}
        )
    if result.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to verify Google session")
    auth_data = result.json()
    email = auth_data.get("email")
    session_token = auth_data.get("session_token")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        role = "admin" if email == ADMIN_EMAIL else "user"
        user = {
            "user_id": user_id, "name": auth_data.get("name", ""), "phone": None,
            "email": email, "role": role, "picture": auth_data.get("picture", ""),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one({**user})
    else:
        user_id = user["user_id"]
        user.pop("password_hash", None)

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": expires_at, "created_at": datetime.now(timezone.utc)
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/")
    user.pop("_id", None)
    return {"token": session_token, "user": user}

@api_router.get("/auth/me")
async def get_me(request: Request):
    return await get_current_user(request)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token: await db.user_sessions.delete_many({"session_token": token})
    response.delete_cookie("session_token")
    return {"message": "Logged out"}

# ============ LOCKERS ============

@api_router.get("/lockers")
async def get_lockers():
    return await db.lockers.find({}, {"_id": 0}).to_list(100)

@api_router.get("/lockers/{locker_id}")
async def get_locker(locker_id: str):
    locker = await db.lockers.find_one({"locker_id": locker_id}, {"_id": 0})
    if not locker: raise HTTPException(status_code=404, detail="Locker not found")
    return locker

@api_router.post("/lockers")
async def create_locker(data: LockerCreate, request: Request):
    await require_admin(request)
    locker_id = f"locker_{uuid.uuid4().hex[:8]}"
    locker = {"locker_id": locker_id, **data.dict(),
              "available_small": data.total_small, "available_medium": data.total_medium,
              "available_large": data.total_large, "status": "active", "created_at": datetime.now(timezone.utc)}
    await db.lockers.insert_one(locker)
    locker.pop("_id", None)
    return locker

@api_router.put("/lockers/{locker_id}")
async def update_locker(locker_id: str, data: LockerUpdate, request: Request):
    await require_admin(request)
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update: raise HTTPException(status_code=400, detail="No update data")
    await db.lockers.update_one({"locker_id": locker_id}, {"$set": update})
    return await db.lockers.find_one({"locker_id": locker_id}, {"_id": 0})

# ============ PARCELS ============

@api_router.post("/parcels")
async def create_parcel(data: ParcelCreate, request: Request):
    user = await get_current_user(request)
    origin = await db.lockers.find_one({"locker_id": data.origin_locker_id}, {"_id": 0})
    destination = await db.lockers.find_one({"locker_id": data.destination_locker_id}, {"_id": 0})
    if not origin or not destination: raise HTTPException(status_code=404, detail="Locker not found")

    size_key = f"available_{data.size.lower()}"
    if destination.get(size_key, 0) <= 0:
        raise HTTPException(status_code=400, detail=f"No {data.size} compartments available")

    parcel_id = f"parcel_{uuid.uuid4().hex[:12]}"
    tracking_code = gen_tracking_code()
    pickup_code = gen_pickup_code()
    now = datetime.now(timezone.utc)
    parcel = {
        "parcel_id": parcel_id, "tracking_code": tracking_code,
        "sender_id": user["user_id"], "sender_name": data.sender_name,
        "sender_phone": data.sender_phone, "recipient_name": data.recipient_name,
        "recipient_phone": data.recipient_phone, "recipient_email": data.recipient_email,
        "origin_locker_id": data.origin_locker_id, "destination_locker_id": data.destination_locker_id,
        "origin_locker_name": origin["name"], "destination_locker_name": destination["name"],
        "size": data.size, "status": "awaiting_payment", "qr_code": pickup_code,
        "qr_data": f"AKABATI:{parcel_id}:{tracking_code}:{pickup_code}",
        "payment_status": "pending", "payment_method": data.payment_method,
        "price": get_price(data.size),
        "status_history": [{"status": "awaiting_payment", "timestamp": now.isoformat(), "note": "Parcel created"}],
        "created_at": now
    }
    await db.parcels.insert_one(parcel)
    await db.lockers.update_one({"locker_id": data.destination_locker_id}, {"$inc": {size_key: -1}})
    parcel.pop("_id", None)
    return parcel

@api_router.post("/parcels/{parcel_id}/payment")
async def process_payment(parcel_id: str, data: ProcessPayment, request: Request):
    user = await get_current_user(request)
    parcel = await db.parcels.find_one({"parcel_id": parcel_id, "sender_id": user["user_id"]}, {"_id": 0})
    if not parcel: raise HTTPException(status_code=404, detail="Parcel not found")
    now = datetime.now(timezone.utc)
    await db.parcels.update_one({"parcel_id": parcel_id}, {
        "$set": {"payment_status": "paid", "status": "awaiting_dropoff", "payment_method": data.payment_method},
        "$push": {"status_history": {"status": "awaiting_dropoff", "timestamp": now.isoformat(), "note": "Payment received"}}
    })
    return await db.parcels.find_one({"parcel_id": parcel_id}, {"_id": 0})

@api_router.get("/parcels/my")
async def get_my_parcels(request: Request):
    user = await get_current_user(request)
    q = {"$or": [
        {"sender_id": user["user_id"]},
        {"recipient_phone": user.get("phone", "__none__")},
        {"recipient_email": user.get("email", "__none__")}
    ]}
    return await db.parcels.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.get("/parcels/track/{tracking_code}")
async def track_parcel(tracking_code: str):
    parcel = await db.parcels.find_one({"tracking_code": tracking_code}, {"_id": 0})
    if not parcel: raise HTTPException(status_code=404, detail="Parcel not found")
    parcel.pop("qr_data", None)
    return parcel

@api_router.get("/parcels/{parcel_id}")
async def get_parcel(parcel_id: str, request: Request):
    await get_current_user(request)
    parcel = await db.parcels.find_one({"parcel_id": parcel_id}, {"_id": 0})
    if not parcel: raise HTTPException(status_code=404, detail="Parcel not found")
    return parcel

@api_router.put("/parcels/{parcel_id}/status")
async def update_status(parcel_id: str, data: StatusUpdate, request: Request):
    await require_courier_or_admin(request)
    valid = list(STATUS_LABELS.keys())
    if data.status not in valid: raise HTTPException(status_code=400, detail="Invalid status")
    now = datetime.now(timezone.utc)
    await db.parcels.update_one({"parcel_id": parcel_id}, {
        "$set": {"status": data.status},
        "$push": {"status_history": {"status": data.status, "timestamp": now.isoformat(), "note": data.note or STATUS_LABELS[data.status]}}
    })
    parcel = await db.parcels.find_one({"parcel_id": parcel_id}, {"_id": 0})
    # Auto-create notifications
    if parcel:
        await send_parcel_notification(parcel, data.status, now)
    return parcel

# ============ COURIER ============

@api_router.get("/courier/tasks")
async def get_tasks(request: Request):
    user = await require_courier_or_admin(request)
    return await db.courier_tasks.find({"courier_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

@api_router.put("/courier/tasks/{task_id}/complete")
async def complete_task(task_id: str, request: Request):
    user = await require_courier_or_admin(request)
    task = await db.courier_tasks.find_one({"task_id": task_id, "courier_id": user["user_id"]}, {"_id": 0})
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    now = datetime.now(timezone.utc)
    await db.courier_tasks.update_one({"task_id": task_id}, {"$set": {"status": "completed", "completed_at": now}})
    new_status = "in_transit" if task["type"] == "collect" else "ready_for_pickup"
    for pid in task.get("parcel_ids", []):
        await db.parcels.update_one({"parcel_id": pid}, {
            "$set": {"status": new_status},
            "$push": {"status_history": {"status": new_status, "timestamp": now.isoformat(), "note": "Updated by courier"}}
        })
    return {"message": "Task completed"}

# ============ ADMIN ============

@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    return {
        "total_lockers": await db.lockers.count_documents({}),
        "active_lockers": await db.lockers.count_documents({"status": "active"}),
        "total_users": await db.users.count_documents({"role": "user"}),
        "total_couriers": await db.users.count_documents({"role": "courier"}),
        "total_parcels": await db.parcels.count_documents({}),
        "in_transit": await db.parcels.count_documents({"status": "in_transit"}),
        "ready_for_pickup": await db.parcels.count_documents({"status": "ready_for_pickup"}),
        "delivered": await db.parcels.count_documents({"status": "delivered"}),
    }

@api_router.get("/admin/users")
async def admin_users(request: Request):
    await require_admin(request)
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(200)

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_role(user_id: str, data: UpdateRole, request: Request):
    await require_admin(request)
    if data.role not in ["user", "courier", "admin"]: raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": data.role}})
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

@api_router.get("/admin/parcels")
async def admin_parcels(request: Request):
    await require_admin(request)
    return await db.parcels.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api_router.get("/admin/lockers")
async def admin_lockers(request: Request):
    await require_admin(request)
    return await db.lockers.find({}, {"_id": 0}).to_list(100)

@api_router.put("/admin/lockers/{locker_id}")
async def admin_update_locker(locker_id: str, data: LockerUpdate, request: Request):
    await require_admin(request)
    update = {k: v for k, v in data.dict().items() if v is not None}
    if not update: raise HTTPException(status_code=400, detail="No update data")
    await db.lockers.update_one({"locker_id": locker_id}, {"$set": update})
    return await db.lockers.find_one({"locker_id": locker_id}, {"_id": 0})

# ============ TRANSLATE ============

@api_router.post("/translate")
async def translate(data: TranslateRequest):
    if not EMERGENT_LLM_KEY:
        return {"translated": data.text}
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"trans_{uuid.uuid4().hex[:8]}",
            system_message=f"Translate to {data.target_lang}. Return ONLY the translated text."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=data.text))
        return {"translated": response}
    except Exception as e:
        logger.error(f"Translation error: {e}")
        return {"translated": data.text}

# ============ NOTIFICATION HELPER ============

NOTIFICATION_MESSAGES = {
    "dropped_off": ("📦 Parcel Dropped Off", "Your parcel {code} has been dropped off and is being processed."),
    "in_transit": ("🚚 Parcel In Transit", "Your parcel {code} is on its way to {dest}."),
    "ready_for_pickup": ("📬 Ready for Pickup!", "Your parcel {code} is ready for pickup at {dest}. Your code: {pickup}."),
    "delivered": ("✅ Parcel Delivered", "Your parcel {code} has been delivered successfully."),
    "awaiting_dropoff": ("📋 Awaiting Drop-off", "Your parcel {code} is confirmed. Please drop it off at {origin}."),
}

async def send_parcel_notification(parcel: dict, new_status: str, now: datetime):
    try:
        msgs = NOTIFICATION_MESSAGES.get(new_status)
        if not msgs: return
        title, body_template = msgs
        code = parcel.get("tracking_code", "")
        dest = parcel.get("destination_locker_name", "destination")
        origin = parcel.get("origin_locker_name", "origin")
        pickup = parcel.get("qr_code", "")
        body = body_template.format(code=code, dest=dest, origin=origin, pickup=pickup)

        # Notify recipient for ready_for_pickup
        if new_status == "ready_for_pickup":
            recipient = await db.users.find_one({"phone": parcel.get("recipient_phone")})
            if recipient:
                await db.notifications.insert_one({
                    "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                    "user_id": recipient["user_id"],
                    "title": title, "body": body,
                    "parcel_id": parcel.get("parcel_id"),
                    "tracking_code": code,
                    "read": False,
                    "created_at": now.isoformat(),
                    "type": new_status,
                })

        # Notify sender for in_transit, dropped_off, delivered
        if new_status in ["in_transit", "dropped_off", "delivered"]:
            sender = await db.users.find_one({"phone": parcel.get("sender_phone")})
            if sender:
                await db.notifications.insert_one({
                    "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                    "user_id": sender["user_id"],
                    "title": title, "body": body,
                    "parcel_id": parcel.get("parcel_id"),
                    "tracking_code": code,
                    "read": False,
                    "created_at": now.isoformat(),
                    "type": new_status,
                })
    except Exception as e:
        logger.error(f"Notification error: {e}")



@api_router.get("/notifications")
async def get_notifications(request: Request):
    user = await get_current_user(request)
    return await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)

@api_router.put("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, request: Request):
    user = await get_current_user(request)
    await db.notifications.update_one({"notification_id": notif_id, "user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"message": "ok"}

# ============ SEED DATA ============

KIGALI_LOCKERS = [
    {"name": "Nyabugogo Terminal", "address": "Nyabugogo Bus Terminal, Kigali", "district": "Nyarugenge", "lat": -1.9396, "lng": 30.0587},
    {"name": "Kigali City Tower", "address": "KN 3 Ave, City Tower, Kigali", "district": "Nyarugenge", "lat": -1.9442, "lng": 30.0619},
    {"name": "Remera Market", "address": "Remera Market, Kigali", "district": "Gasabo", "lat": -1.9532, "lng": 30.1068},
    {"name": "Kimironko Centre", "address": "Kimironko Market Area, Kigali", "district": "Gasabo", "lat": -1.9423, "lng": 30.1008},
    {"name": "Kicukiro Centre", "address": "Kicukiro Centre, Kigali", "district": "Kicukiro", "lat": -1.9764, "lng": 30.0847},
    {"name": "Nyamirambo Stadium", "address": "Near Nyamirambo Regional Stadium", "district": "Nyarugenge", "lat": -1.9690, "lng": 30.0408},
    {"name": "Kanombe Airport", "address": "Kanombe, Near Kigali International Airport", "district": "Kicukiro", "lat": -1.9688, "lng": 30.1292},
    {"name": "Gisozi Business Park", "address": "Gisozi, Kigali", "district": "Gasabo", "lat": -1.9152, "lng": 30.0784},
]

async def seed_data():
    if await db.lockers.count_documents({}) > 0:
        return
    logger.info("Seeding Akabati data...")
    now = datetime.now(timezone.utc)
    locker_ids = []

    for l in KIGALI_LOCKERS:
        lid = f"locker_{uuid.uuid4().hex[:8]}"
        await db.lockers.insert_one({
            "locker_id": lid, **l,
            "total_small": 10, "total_medium": 8, "total_large": 4,
            "available_small": random.randint(3, 10),
            "available_medium": random.randint(2, 8),
            "available_large": random.randint(1, 4),
            "status": "active", "created_at": now
        })
        locker_ids.append(lid)

    admin_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": admin_id, "name": "Admin Benishimwe", "phone": "+250788000001",
        "email": ADMIN_EMAIL, "role": "admin", "picture": None,
        "password_hash": hash_pwd("admin123"), "created_at": now
    })

    test_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": test_id, "name": "Amina Uwimana", "phone": "+250788111222",
        "email": "amina@test.com", "role": "user", "picture": None,
        "password_hash": hash_pwd("test123"), "created_at": now
    })

    courier_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": courier_id, "name": "Claude Nkurunziza", "phone": "+250788333444",
        "email": "courier@test.com", "role": "courier", "picture": None,
        "password_hash": hash_pwd("courier123"), "created_at": now
    })

    statuses = ["awaiting_dropoff", "dropped_off", "in_transit", "ready_for_pickup", "delivered"]
    for i, status in enumerate(statuses):
        pid = f"parcel_{uuid.uuid4().hex[:12]}"
        tc = gen_tracking_code()
        pc = gen_pickup_code()
        size = ["small", "medium", "large"][i % 3]
        await db.parcels.insert_one({
            "parcel_id": pid, "tracking_code": tc, "sender_id": test_id,
            "sender_name": "Amina Uwimana", "sender_phone": "+250788111222",
            "recipient_name": "Jean Mugisha", "recipient_phone": "+250788555666",
            "recipient_email": "jean@test.com",
            "origin_locker_id": locker_ids[i % len(locker_ids)],
            "destination_locker_id": locker_ids[(i + 2) % len(locker_ids)],
            "origin_locker_name": KIGALI_LOCKERS[i % len(KIGALI_LOCKERS)]["name"],
            "destination_locker_name": KIGALI_LOCKERS[(i + 2) % len(KIGALI_LOCKERS)]["name"],
            "size": size, "status": status, "qr_code": pc,
            "qr_data": f"AKABATI:{pid}:{tc}:{pc}",
            "payment_status": "paid", "payment_method": "mobile_money",
            "price": get_price(size),
            "status_history": [{"status": status, "timestamp": now.isoformat(), "note": "Sample parcel"}],
            "created_at": now
        })

    for i, (ttype, lidx) in enumerate([("collect", 0), ("deliver", 2)]):
        await db.courier_tasks.insert_one({
            "task_id": f"task_{uuid.uuid4().hex[:8]}", "courier_id": courier_id,
            "type": ttype, "locker_id": locker_ids[lidx],
            "locker_name": KIGALI_LOCKERS[lidx]["name"],
            "parcel_ids": [], "parcel_count": random.randint(2, 6),
            "status": "pending", "created_at": now
        })

    logger.info("Seed complete!")

@app.on_event("startup")
async def startup():
    await seed_data()

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
