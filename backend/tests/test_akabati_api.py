"""
Akabati Parcel Locker API Tests
Tests: auth, lockers, parcels, admin, courier endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

# Shared state
state = {}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============ AUTH TESTS ============

class TestAuth:
    """Authentication endpoint tests"""

    def test_login_admin(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"identifier": "benishimwe31@gmail.com", "password": "admin123"})
        assert r.status_code == 200, f"Admin login failed: {r.text}"
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        state["admin_token"] = data["token"]
        state["admin_user"] = data["user"]
        print(f"Admin login OK, user_id={data['user']['user_id']}")

    def test_login_user(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"identifier": "+250788111222", "password": "test123"})
        assert r.status_code == 200, f"User login failed: {r.text}"
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "user"
        state["user_token"] = data["token"]
        state["user_id"] = data["user"]["user_id"]
        print(f"User login OK, user_id={data['user']['user_id']}")

    def test_login_courier(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"identifier": "+250788333444", "password": "courier123"})
        assert r.status_code == 200, f"Courier login failed: {r.text}"
        data = r.json()
        assert data["user"]["role"] == "courier"
        state["courier_token"] = data["token"]
        state["courier_user"] = data["user"]
        print(f"Courier login OK")

    def test_login_invalid(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"identifier": "wrong@email.com", "password": "bad"})
        assert r.status_code == 401

    def test_get_me(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 200
        data = r.json()
        assert "user_id" in data
        assert "password_hash" not in data
        print(f"GET /me OK: {data['name']}")

    def test_get_me_unauthenticated(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_signup_new_user(self, session):
        r = session.post(f"{BASE_URL}/api/auth/signup", json={
            "name": "TEST User Signup",
            "phone": "+250788TEST001",
            "email": "test_signup_akabati@test.com",
            "password": "testpass123"
        })
        assert r.status_code == 200, f"Signup failed: {r.text}"
        data = r.json()
        assert "token" in data
        state["signup_user_id"] = data["user"]["user_id"]
        print(f"Signup OK, user_id={data['user']['user_id']}")

    def test_signup_duplicate_phone(self, session):
        r = session.post(f"{BASE_URL}/api/auth/signup", json={
            "name": "Dupe", "phone": "+250788TEST001", "password": "pass"
        })
        assert r.status_code == 400


# ============ LOCKERS TESTS ============

class TestLockers:
    """Locker endpoint tests"""

    def test_get_lockers(self, session):
        r = session.get(f"{BASE_URL}/api/lockers")
        assert r.status_code == 200
        lockers = r.json()
        assert isinstance(lockers, list)
        assert len(lockers) >= 8, f"Expected 8 lockers, got {len(lockers)}"
        state["lockers"] = lockers
        state["locker_id_1"] = lockers[0]["locker_id"]
        state["locker_id_2"] = lockers[1]["locker_id"]
        print(f"GET /lockers OK: {len(lockers)} lockers")

    def test_get_single_locker(self, session):
        if not state.get("locker_id_1"):
            pytest.skip("No locker id")
        r = session.get(f"{BASE_URL}/api/lockers/{state['locker_id_1']}")
        assert r.status_code == 200
        data = r.json()
        assert data["locker_id"] == state["locker_id_1"]

    def test_get_locker_not_found(self, session):
        r = session.get(f"{BASE_URL}/api/lockers/nonexistent_locker")
        assert r.status_code == 404


# ============ PARCELS TESTS ============

class TestParcels:
    """Parcel endpoint tests"""

    def test_create_parcel(self, session):
        if not state.get("user_token") or not state.get("locker_id_1"):
            pytest.skip("Prerequisites missing")
        r = session.post(f"{BASE_URL}/api/parcels",
            headers={"Authorization": f"Bearer {state['user_token']}"},
            json={
                "sender_name": "Amina Uwimana",
                "sender_phone": "+250788111222",
                "recipient_name": "TEST Recipient",
                "recipient_phone": "+250788999000",
                "origin_locker_id": state["locker_id_1"],
                "destination_locker_id": state["locker_id_2"],
                "size": "small",
                "payment_method": "mobile_money"
            })
        assert r.status_code == 200, f"Create parcel failed: {r.text}"
        data = r.json()
        assert data["status"] == "awaiting_payment"
        assert data["payment_status"] == "pending"
        assert "tracking_code" in data
        assert "parcel_id" in data
        state["parcel_id"] = data["parcel_id"]
        state["tracking_code"] = data["tracking_code"]
        print(f"Create parcel OK: {data['parcel_id']}, tracking={data['tracking_code']}")

    def test_create_parcel_unauthenticated(self, session):
        r = session.post(f"{BASE_URL}/api/parcels", json={
            "sender_name": "Test", "sender_phone": "+250788111222",
            "recipient_name": "Test", "recipient_phone": "+250788999000",
            "origin_locker_id": "l1", "destination_locker_id": "l2",
            "size": "small"
        })
        assert r.status_code == 401

    def test_process_payment(self, session):
        if not state.get("user_token") or not state.get("parcel_id"):
            pytest.skip("No parcel to pay for")
        r = session.post(f"{BASE_URL}/api/parcels/{state['parcel_id']}/payment",
            headers={"Authorization": f"Bearer {state['user_token']}"},
            json={"payment_method": "mobile_money", "phone_number": "+250788111222"})
        assert r.status_code == 200, f"Payment failed: {r.text}"
        data = r.json()
        assert data["payment_status"] == "paid"
        assert data["status"] == "awaiting_dropoff"
        print(f"Payment OK: parcel status={data['status']}")

    def test_get_my_parcels(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/parcels/my",
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 200
        parcels = r.json()
        assert isinstance(parcels, list)
        assert len(parcels) > 0
        print(f"GET /parcels/my OK: {len(parcels)} parcels")

    def test_track_parcel(self, session):
        if not state.get("tracking_code"):
            pytest.skip("No tracking code")
        r = session.get(f"{BASE_URL}/api/parcels/track/{state['tracking_code']}")
        assert r.status_code == 200
        data = r.json()
        assert data["tracking_code"] == state["tracking_code"]
        assert "qr_data" not in data  # sensitive field should be excluded
        print(f"Track parcel OK: status={data['status']}")

    def test_track_parcel_not_found(self, session):
        r = session.get(f"{BASE_URL}/api/parcels/track/AKB-NOTEXIST")
        assert r.status_code == 404


# ============ ADMIN TESTS ============

class TestAdmin:
    """Admin-only endpoint tests"""

    def test_admin_stats(self, session):
        if not state.get("admin_token"):
            pytest.skip("No admin token")
        r = session.get(f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {state['admin_token']}"})
        assert r.status_code == 200
        data = r.json()
        assert "total_lockers" in data
        assert data["total_lockers"] >= 8
        assert "total_users" in data
        print(f"Admin stats OK: {data}")

    def test_admin_users(self, session):
        if not state.get("admin_token"):
            pytest.skip("No admin token")
        r = session.get(f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {state['admin_token']}"})
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        for u in users:
            assert "password_hash" not in u
        print(f"Admin users OK: {len(users)} users")

    def test_admin_parcels(self, session):
        if not state.get("admin_token"):
            pytest.skip("No admin token")
        r = session.get(f"{BASE_URL}/api/admin/parcels",
            headers={"Authorization": f"Bearer {state['admin_token']}"})
        assert r.status_code == 200
        parcels = r.json()
        assert isinstance(parcels, list)
        print(f"Admin parcels OK: {len(parcels)} parcels")

    def test_admin_only_no_access_for_user(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 403


# ============ COURIER TESTS ============

class TestCourier:
    """Courier endpoint tests"""

    def test_get_courier_tasks(self, session):
        if not state.get("courier_token"):
            pytest.skip("No courier token")
        r = session.get(f"{BASE_URL}/api/courier/tasks",
            headers={"Authorization": f"Bearer {state['courier_token']}"})
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list)
        if tasks:
            state["task_id"] = tasks[0]["task_id"]
        print(f"Courier tasks OK: {len(tasks)} tasks")

    def test_courier_tasks_denied_for_user(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/courier/tasks",
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 403

    def test_complete_courier_task(self, session):
        if not state.get("courier_token") or not state.get("task_id"):
            pytest.skip("No task to complete")
        r = session.put(f"{BASE_URL}/api/courier/tasks/{state['task_id']}/complete",
            headers={"Authorization": f"Bearer {state['courier_token']}"})
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        print(f"Complete task OK: {data}")

    def test_complete_nonexistent_task(self, session):
        if not state.get("courier_token"):
            pytest.skip("No courier token")
        r = session.put(f"{BASE_URL}/api/courier/tasks/nonexistent_task/complete",
            headers={"Authorization": f"Bearer {state['courier_token']}"})
        assert r.status_code == 404


# ============ ADMIN LOCKERS TESTS ============

class TestAdminLockers:
    """Admin locker create/edit tests"""

    def test_admin_get_lockers(self, session):
        if not state.get("admin_token"):
            pytest.skip("No admin token")
        r = session.get(f"{BASE_URL}/api/admin/lockers",
            headers={"Authorization": f"Bearer {state['admin_token']}"})
        assert r.status_code == 200
        lockers = r.json()
        assert isinstance(lockers, list)
        assert len(lockers) >= 8
        state["admin_locker_id"] = lockers[0]["locker_id"]
        print(f"Admin lockers OK: {len(lockers)} lockers")

    def test_admin_create_locker(self, session):
        if not state.get("admin_token"):
            pytest.skip("No admin token")
        r = session.post(f"{BASE_URL}/api/lockers",
            headers={"Authorization": f"Bearer {state['admin_token']}"},
            json={
                "name": "TEST_Locker_Phase5",
                "address": "Test Address, Kigali",
                "district": "Gasabo",
                "lat": -1.95, "lng": 30.07,
                "total_small": 5, "total_medium": 4, "total_large": 2
            })
        assert r.status_code == 200, f"Create locker failed: {r.text}"
        data = r.json()
        assert data["name"] == "TEST_Locker_Phase5"
        state["new_locker_id"] = data["locker_id"]
        print(f"Create locker OK: {data['locker_id']}")

    def test_admin_edit_locker(self, session):
        if not state.get("admin_token") or not state.get("new_locker_id"):
            pytest.skip("Prerequisites missing")
        r = session.put(f"{BASE_URL}/api/admin/lockers/{state['new_locker_id']}",
            headers={"Authorization": f"Bearer {state['admin_token']}"},
            json={"name": "TEST_Locker_Phase5_Updated", "address": "Updated Address"})
        assert r.status_code == 200, f"Edit locker failed: {r.text}"
        data = r.json()
        assert data["name"] == "TEST_Locker_Phase5_Updated"
        print(f"Edit locker OK")

    def test_admin_change_locker_status(self, session):
        if not state.get("admin_token") or not state.get("new_locker_id"):
            pytest.skip("Prerequisites missing")
        r = session.put(f"{BASE_URL}/api/admin/lockers/{state['new_locker_id']}",
            headers={"Authorization": f"Bearer {state['admin_token']}"},
            json={"status": "maintenance"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "maintenance"
        print(f"Status change OK: {data['status']}")

    def test_admin_locker_no_access_for_user(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/admin/lockers",
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 403


# ============ COURIER SCAN/STATUS TESTS ============

class TestCourierScan:
    """Courier parcel lookup and status update tests"""

    def test_courier_lookup_by_tracking(self, session):
        if not state.get("courier_token") or not state.get("tracking_code"):
            pytest.skip("Prerequisites missing")
        # First track to get parcel_id
        r = session.get(f"{BASE_URL}/api/parcels/track/{state['tracking_code']}")
        assert r.status_code == 200
        data = r.json()
        assert data["tracking_code"] == state["tracking_code"]
        print(f"Track by code OK: {data['status']}")

    def test_courier_update_status_in_transit(self, session):
        if not state.get("courier_token") or not state.get("parcel_id"):
            pytest.skip("Prerequisites missing")
        r = session.put(f"{BASE_URL}/api/parcels/{state['parcel_id']}/status",
            headers={"Authorization": f"Bearer {state['courier_token']}"},
            json={"status": "in_transit", "note": "Updated by courier test"})
        assert r.status_code == 200, f"Status update failed: {r.text}"
        data = r.json()
        assert data["status"] == "in_transit"
        print(f"Status update to in_transit OK")

    def test_courier_update_status_ready_for_pickup(self, session):
        if not state.get("courier_token") or not state.get("parcel_id"):
            pytest.skip("Prerequisites missing")
        r = session.put(f"{BASE_URL}/api/parcels/{state['parcel_id']}/status",
            headers={"Authorization": f"Bearer {state['courier_token']}"},
            json={"status": "ready_for_pickup", "note": "At destination locker"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ready_for_pickup"
        print(f"Status update to ready_for_pickup OK")


# ============ NOTIFICATIONS TESTS ============

class TestNotifications:
    """Notification endpoint tests"""

    def test_get_notifications(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 200
        notifs = r.json()
        assert isinstance(notifs, list)
        print(f"GET notifications OK: {len(notifs)} notifications")
        if notifs:
            state["notif_id"] = notifs[0]["notification_id"]

    def test_notifications_have_required_fields(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.get(f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 200
        notifs = r.json()
        if notifs:
            n = notifs[0]
            assert "notification_id" in n
            assert "title" in n
            assert "body" in n
            assert "read" in n
            assert "created_at" in n
            assert "_id" not in n
            print(f"Notification fields OK: {n['title']}")

    def test_mark_notification_read(self, session):
        if not state.get("user_token") or not state.get("notif_id"):
            pytest.skip("No notification to mark")
        r = session.put(f"{BASE_URL}/api/notifications/{state['notif_id']}/read", json={},
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 200
        print(f"Mark read OK")

    def test_mark_all_notifications_read(self, session):
        if not state.get("user_token"):
            pytest.skip("No user token")
        r = session.put(f"{BASE_URL}/api/notifications/read-all", json={},
            headers={"Authorization": f"Bearer {state['user_token']}"})
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        print(f"Mark all read OK: {data}")

    def test_notifications_unauthenticated(self, session):
        r = session.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 401
