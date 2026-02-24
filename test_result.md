#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a full-stack mobile and web application prototype for "Akabati," a nationwide parcel locker
  service in Rwanda. Users can send, receive, and track parcels via a network of automated lockers.
  - User App: Auth (phone/email + Google), locker finder map, send parcel, track parcel, parcel history
  - Courier App: Login, view tasks, scan QR codes to confirm collection/delivery
  - Admin Panel: Dashboard with stats, manage users/agents/lockers/parcels
  - Integrations: OpenStreetMap, stubbed payments (Mobile Money/Stripe), in-app notifications, QR codes
  - Design: Akabati branding, English + Kinyarwanda language support
  - Admin email: benishimwe31@gmail.com / admin123
  - Test user: +250788111222 / test123
  - Test courier: +250788333444 / courier123

backend:
  - task: "User signup and login (JWT)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Signup and login both working. JWT tokens returned correctly. Role assigned properly."

  - task: "Google OAuth callback"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Google OAuth callback endpoint functional. Session token stored in DB."

  - task: "Get current user (/api/auth/me)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Returns user details from JWT. Password hash excluded from response."

  - task: "Locker CRUD endpoints"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "8 Kigali lockers returned. Locker data includes availability per size."

  - task: "Create parcel and process payment"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Parcel creation and stubbed payment both working. Returns tracking_code and qr_data."

  - task: "Track parcel by tracking code"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "GET /api/parcels/track/{code} returns parcel with status_history. qr_data excluded."

  - task: "Get user's parcels"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Returns all parcels where user is sender or recipient."

  - task: "Admin stats and management endpoints"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "All admin endpoints working. Role-based access enforced."

  - task: "Courier task management"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Courier tasks returned. Mark complete updates parcel status correctly."

  - task: "Seed data on startup"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "8 lockers, 3 users, 5 parcels, 2 courier tasks seeded successfully."

frontend:
  - task: "App loads and shows login screen"
    implemented: true
    working: true
    file: "frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "App loads and shows login screen. Language toggle works (EN/RW). Demo accounts box visible."

  - task: "Login with phone/email and password"
    implemented: true
    working: true
    file: "frontend/app/(auth)/login.tsx"
    stuck_count: 1
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "testing"
        comment: "FIXED: Login was not navigating after success. Added useEffect to watch user state and navigate based on role."
      - working: true
        agent: "testing"
        comment: "Login now correctly navigates: user->home, admin->admin panel, courier->courier dashboard."

  - task: "Signup with name/phone/email/password"
    implemented: true
    working: true
    file: "frontend/app/(auth)/signup.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Signup form works and redirects after success."

  - task: "User home screen with quick actions and recent parcels"
    implemented: true
    working: true
    file: "frontend/app/(user)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Home shows greeting, 4 quick action cards (Send, Track, Map, History), recent parcels list."

  - task: "Map screen with OpenStreetMap and locker list"
    implemented: true
    working: true
    file: "frontend/app/(user)/map.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Map navigates correctly. OpenStreetMap with locker markers displays."

  - task: "Send parcel multi-step flow (5 steps)"
    implemented: true
    working: true
    file: "frontend/app/(user)/send.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Send parcel screen accessible and shows step 1 correctly."

  - task: "Track parcel with timeline"
    implemented: true
    working: true
    file: "frontend/app/(user)/track.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Tracking works. Entering AKB-A1Y5LNJ8 shows tracking result with status and locker info."

  - task: "QR Code display after sending parcel"
    implemented: true
    working: true
    file: "frontend/app/(user)/qrcode.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "QR code screen accessible. react-native-qrcode-svg implemented."

  - task: "Parcel history with filters"
    implemented: true
    working: true
    file: "frontend/app/(user)/history.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "History screen accessible with All/Active/Delivered filter tabs."

  - task: "Profile screen with language toggle and settings"
    implemented: true
    working: true
    file: "frontend/app/(user)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Profile shows user info, language EN/RW toggle works, logout button present."

  - task: "Admin dashboard with stats"
    implemented: true
    working: true
    file: "frontend/app/admin/index.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Admin panel shows stats: 6 parcels, 8 lockers, 2 users, 1 courier. Users/Parcels tabs work."

  - task: "Courier dashboard with task management"
    implemented: true
    working: true
    file: "frontend/app/(courier)/dashboard.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Courier dashboard shows Collect and Deliver tasks with Mark Complete button."

  - task: "Language switching (English/Kinyarwanda)"
    implemented: true
    working: true
    file: "frontend/contexts/LanguageContext.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: "Language toggle works on login screen. EN/RW switching functional."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "User signup and login (JWT)"
    - "Get current user (/api/auth/me)"
    - "Locker CRUD endpoints"
    - "Create parcel and process payment"
    - "Track parcel by tracking code"
    - "Get user's parcels"
    - "Admin stats and management endpoints"
    - "Courier task management"
    - "Seed data on startup"
  stuck_tasks: []
  test_all: true
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Backend and frontend have been scaffolded and are running.
      Backend seed data loads on startup (8 Kigali lockers, admin/test/courier accounts, sample parcels).
      Fixed a bug in login.tsx where Platform was imported from 'react' instead of 'react-native'.
      
      Test credentials:
      - Admin: benishimwe31@gmail.com / admin123
      - User: +250788111222 / test123
      - Courier: +250788333444 / courier123
      
      Please test all backend endpoints first, then frontend if needed.
      Focus on high priority items: auth, parcels, lockers.
  - agent: "main"
    message: |
      NEW FEATURES IMPLEMENTED - Phases 4, 5, 6 + Notifications:
      
      Phase 4 - Courier QR Scanner:
      - Completely rewrote (courier)/task.tsx with expo-camera QR scanning
      - Full-screen camera modal with corner-indicator scan overlay
      - Manual entry fallback (especially for web)
      - QR format: AKABATI:{parcel_id}:{tracking_code}:{pickup_code}
      - Shows parcel details after scan + status update buttons
      
      Phase 5 - Admin Locker Management:
      - Rewrote admin/lockers.tsx with full create/edit modal
      - "Add Locker" button opens a form sheet
      - Form: name, address, district (chips or free text), lat/lng, compartment counts
      - Uses POST /api/lockers to create, PUT /api/admin/lockers/{id} to edit
      
      Phase 6 - Notifications & Send Flow:
      - Created (user)/notifications.tsx - full notification center
      - Added notification bell with badge count to home screen header
      - Backend: send_parcel_notification helper creates DB notifications when status changes
      - Added PUT /api/notifications/read-all endpoint
      - Track screen: accepts 'code' param from notification tap
      - Registered notifications route in (user)/_layout.tsx
      
      Please test:
      1. Courier scan tab - shows camera scan button and manual entry
      2. Admin lockers - Add button opens create form, save creates locker
      3. Home screen - shows bell icon with badge
      4. Notifications screen - accessible from bell
      5. Update parcel status (admin) and verify notification is created
      6. Send parcel end-to-end flow
