package com.parcela.config;

import com.parcela.model.*;
import com.parcela.repository.*;
import com.parcela.service.SupabaseAuthClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Component
@SuppressWarnings("null")
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final AppUserRepository userRepo;
    private final LockerRepository lockerRepo;
    private final ParcelRepository parcelRepo;
    private final CourierTaskRepository taskRepo;
    private final SupabaseAuthClient supabaseAuth;

    public DataSeeder(AppUserRepository userRepo, LockerRepository lockerRepo,
                      ParcelRepository parcelRepo, CourierTaskRepository taskRepo,
                      SupabaseAuthClient supabaseAuth) {
        this.userRepo = userRepo;
        this.lockerRepo = lockerRepo;
        this.parcelRepo = parcelRepo;
        this.taskRepo = taskRepo;
        this.supabaseAuth = supabaseAuth;
    }

    @Value("${app.admin.email:benishimwe31@gmail.com}")
    private String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Seeding Parcela data...");
        if (lockerRepo.count() == 0) {
            seedLockers();
        }
        seedUsers();
        if (parcelRepo.count() == 0) {
            seedParcels();
        }
        log.info("Seeding complete.");
    }

    // ── Lockers ─────────────────────────────────────────────────────────────

    private void seedLockers() {
        List<Locker> lockers = List.of(
            locker("LKR-KGL001", "Kigali City Centre",    "KN 4 Ave, Nyarugenge",          "Nyarugenge", -1.9441, 30.0619),
            locker("LKR-KGL002", "Kimironko Market",      "KG 11 Ave, Gasabo",              "Gasabo",     -1.9386, 30.1127),
            locker("LKR-KGL003", "Remera Bus Park",       "KG 7 Ave, Remera",               "Gasabo",     -1.9558, 30.1071),
            locker("LKR-KGL004", "Nyabugogo Terminal",    "RN1, Nyarugenge",                "Nyarugenge", -1.9345, 30.0452),
            locker("LKR-KGL005", "Gikondo Industrial",    "KK 17 Ave, Kicukiro",           "Kicukiro",   -1.9803, 30.0785),
            locker("LKR-KGL006", "Kanombe Airport Area",  "KK 15 Rd, Kicukiro",            "Kicukiro",   -1.9684, 30.1395),
            locker("LKR-KGL007", "Muhima Health Centre",  "KN 62 St, Nyarugenge",          "Nyarugenge", -1.9513, 30.0548),
            locker("LKR-KGL008", "Kibagabaga Hospital",   "KG 563 St, Gasabo",             "Gasabo",     -1.9218, 30.1138)
        );
        lockerRepo.saveAll(lockers);
        log.info("Seeded {} lockers", lockers.size());
    }

    private Locker locker(String id, String name, String address, String district, double lat, double lng) {
        return Locker.builder()
                .lockerId(id).name(name).address(address).district(district)
                .lat(lat).lng(lng)
                .totalSmall(10).totalMedium(8).totalLarge(4)
                .availableSmall(8).availableMedium(6).availableLarge(3)
                .status("active").build();
    }

    // ── Users ────────────────────────────────────────────────────────────────

    private void seedUsers() {
        createOrRepairUser("USR-ADMIN01", adminEmail,            null,         "Admin Parcela",   "admin",   "0780000000", "Admin@1234");
        createOrRepairUser("USR-COU001",  "courier@parcela.rw",  null,         "Jean Courier",    "courier", "0781111111", "Courier@1234");
        createOrRepairUser("USR-USR001",  null,                  "0789999999", "Alice Test",      "user",    "0789999999", "User@1234");
        createOrRepairUser("USR-USR002",  "marie@test.rw",       "0788111222", "Marie Uwimana",   "user",    "0788111222", "User@1234");
        createOrRepairUser("USR-USR003",  null,                  "0783222333", "Claude Nkuranga", "user",    "0783222333", "User@1234");
    }

    // ── Parcels ──────────────────────────────────────────────────────────────

    private void seedParcels() {
        Instant now = Instant.now();

        // Parcel data: parcelId, trackingCode, senderId, senderName, senderPhone,
        //              recipientName, recipientPhone, recipientEmail,
        //              originLockerId, originLockerName, destLockerId, destLockerName,
        //              size, price, status, paymentStatus, deliveryMode, clientNotes, daysAgo
        Object[][] rows = {
            // ── awaiting_dropoff (payment done, waiting for sender to drop off) ──
            {"PCL-0001", "PAR-AA11BB22", "USR-USR001", "Alice Test",      "0789999999",
             "Jean Mugisha",    "0782333444", null,
             "LKR-KGL001", "Kigali City Centre",   "LKR-KGL002", "Kimironko Market",
             "small",  new BigDecimal("1000"), "awaiting_dropoff", "paid", "basic",
             null, 0},

            {"PCL-0002", "PAR-CC33DD44", "USR-USR002", "Marie Uwimana",   "0788111222",
             "Amina Kayitesi",  "0785444555", "amina@test.rw",
             "LKR-KGL003", "Remera Bus Park",       "LKR-KGL004", "Nyabugogo Terminal",
             "medium", new BigDecimal("2000"), "awaiting_dropoff", "paid", "fast",
             "Handle with care — glass item", 0},

            // ── dropped_off (at origin locker, awaiting courier) ──
            {"PCL-0003", "PAR-EE55FF66", "USR-USR003", "Claude Nkuranga", "0783222333",
             "Pascal Habimana", "0786555666", null,
             "LKR-KGL005", "Gikondo Industrial",    "LKR-KGL006", "Kanombe Airport Area",
             "large",  new BigDecimal("3500"), "dropped_off",     "paid", "express",
             "Urgent medical documents", 1},

            {"PCL-0004", "PAR-GG77HH88", "USR-USR001", "Alice Test",      "0789999999",
             "Sophie Ingabire", "0787666777", "sophie@test.rw",
             "LKR-KGL002", "Kimironko Market",      "LKR-KGL007", "Muhima Health Centre",
             "small",  new BigDecimal("1000"), "dropped_off",     "paid", "basic",
             null, 1},

            // ── in_transit (courier picked up and is delivering) ──
            {"PCL-0005", "PAR-II99JJ00", "USR-USR002", "Marie Uwimana",   "0788111222",
             "Eric Ndayishimiye","0784777888", null,
             "LKR-KGL004", "Nyabugogo Terminal",    "LKR-KGL008", "Kibagabaga Hospital",
             "medium", new BigDecimal("2000"), "in_transit",      "paid", "fast",
             null, 2},

            {"PCL-0006", "PAR-KK11LL22", "USR-USR003", "Claude Nkuranga", "0783222333",
             "Diane Mukamana",  "0781888999", "diane@test.rw",
             "LKR-KGL006", "Kanombe Airport Area",  "LKR-KGL001", "Kigali City Centre",
             "large",  new BigDecimal("3500"), "in_transit",      "paid", "express",
             "Fragile — electronics", 2},

            // ── ready_for_pickup (at destination locker) ──
            {"PCL-0007", "PAR-MM33NN44", "USR-USR001", "Alice Test",      "0789999999",
             "John Uwizeye",    "0780111222", null,
             "LKR-KGL007", "Muhima Health Centre",  "LKR-KGL003", "Remera Bus Park",
             "small",  new BigDecimal("1000"), "ready_for_pickup","paid", "basic",
             null, 3},

            {"PCL-0008", "PAR-OO55PP66", "USR-USR002", "Marie Uwimana",   "0788111222",
             "Grace Mutesi",    "0782222333", "grace@test.rw",
             "LKR-KGL008", "Kibagabaga Hospital",   "LKR-KGL005", "Gikondo Industrial",
             "medium", new BigDecimal("2000"), "ready_for_pickup","paid", "basic",
             "Call before delivery", 3},

            // ── delivered ──
            {"PCL-0009", "PAR-QQ77RR88", "USR-USR003", "Claude Nkuranga", "0783222333",
             "Peter Nzeyimana", "0785999000", null,
             "LKR-KGL001", "Kigali City Centre",   "LKR-KGL004", "Nyabugogo Terminal",
             "large",  new BigDecimal("3500"), "delivered",       "paid", "fast",
             null, 5},

            {"PCL-0010", "PAR-SS99TT00", "USR-USR001", "Alice Test",      "0789999999",
             "Nadia Uwineza",   "0783111222", "nadia@test.rw",
             "LKR-KGL003", "Remera Bus Park",       "LKR-KGL006", "Kanombe Airport Area",
             "small",  new BigDecimal("1000"), "delivered",       "paid", "basic",
             null, 7},

            {"PCL-0011", "PAR-UU11VV22", "USR-USR002", "Marie Uwimana",   "0788111222",
             "Felix Habimana",  "0786333444", null,
             "LKR-KGL005", "Gikondo Industrial",    "LKR-KGL002", "Kimironko Market",
             "medium", new BigDecimal("2000"), "delivered",       "paid", "express",
             "Delivered on time", 10},
        };

        List<Parcel> parcels = new ArrayList<>();
        List<String> awaitingDropoffIds = new ArrayList<>();
        List<String> droppedOffIds     = new ArrayList<>();
        List<String> inTransitIds      = new ArrayList<>();

        for (Object[] r : rows) {
            String parcelId    = (String) r[0];
            String trackCode   = (String) r[1];
            String senderId    = (String) r[2];
            String senderName  = (String) r[3];
            String senderPhone = (String) r[4];
            String recName     = (String) r[5];
            String recPhone    = (String) r[6];
            String recEmail    = (String) r[7];
            String origId      = (String) r[8];
            String origName    = (String) r[9];
            String destId      = (String) r[10];
            String destName    = (String) r[11];
            String size        = (String) r[12];
            BigDecimal price   = (BigDecimal) r[13];
            String status      = (String) r[14];
            String payStatus   = (String) r[15];
            String dlvMode     = (String) r[16];
            String notes       = (String) r[17];
            int daysAgo        = (int) r[18];

            String pickupCode = randomDigits(6);
            String qrData     = "PARCELA:" + parcelId + ":" + trackCode + ":" + pickupCode;
            Instant createdAt = now.minus(daysAgo, ChronoUnit.DAYS);

            List<Map<String, Object>> history = buildHistory(status, createdAt, origName, destName);

            Parcel p = Parcel.builder()
                    .parcelId(parcelId)
                    .trackingCode(trackCode)
                    .senderId(senderId)
                    .senderName(senderName)
                    .senderPhone(senderPhone)
                    .recipientName(recName)
                    .recipientPhone(recPhone)
                    .recipientEmail(recEmail)
                    .originLockerId(origId)
                    .originLockerName(origName)
                    .destinationLockerId(destId)
                    .destinationLockerName(destName)
                    .size(size)
                    .price(price)
                    .status(status)
                    .paymentStatus(payStatus)
                    .paymentMethod("mobile_money")
                    .deliveryMode(dlvMode)
                    .clientNotes(notes)
                    .qrCode(pickupCode)
                    .qrData(qrData)
                    .statusHistory(history)
                    .createdAt(createdAt)
                    .build();

            parcels.add(p);

            switch (status) {
                case "awaiting_dropoff" -> awaitingDropoffIds.add(parcelId);
                case "dropped_off"      -> droppedOffIds.add(parcelId);
                case "in_transit"       -> inTransitIds.add(parcelId);
            }
        }

        parcelRepo.saveAll(parcels);
        log.info("Seeded {} parcels", parcels.size());

        // ── Courier tasks for the seeded courier ────────────────────────────
        if (taskRepo.count() == 0) {
            List<CourierTask> tasks = new ArrayList<>();

            // Task 1: collect awaiting_dropoff parcels from Kigali City Centre
            if (!awaitingDropoffIds.isEmpty()) {
                tasks.add(CourierTask.builder()
                        .taskId("TSK-COL001")
                        .courierId("USR-COU001")
                        .type("collect")
                        .lockerId("LKR-KGL001")
                        .lockerName("Kigali City Centre")
                        .parcelIds(List.of(awaitingDropoffIds.get(0)))
                        .parcelCount(1)
                        .status("pending")
                        .createdAt(now)
                        .build());
            }
            if (awaitingDropoffIds.size() > 1) {
                tasks.add(CourierTask.builder()
                        .taskId("TSK-COL002")
                        .courierId("USR-COU001")
                        .type("collect")
                        .lockerId("LKR-KGL003")
                        .lockerName("Remera Bus Park")
                        .parcelIds(List.of(awaitingDropoffIds.get(1)))
                        .parcelCount(1)
                        .status("pending")
                        .createdAt(now)
                        .build());
            }

            // Task 2: deliver dropped_off parcels from Gikondo
            if (!droppedOffIds.isEmpty()) {
                tasks.add(CourierTask.builder()
                        .taskId("TSK-COL003")
                        .courierId("USR-COU001")
                        .type("collect")
                        .lockerId("LKR-KGL005")
                        .lockerName("Gikondo Industrial")
                        .parcelIds(new ArrayList<>(droppedOffIds))
                        .parcelCount(droppedOffIds.size())
                        .status("pending")
                        .createdAt(now.minus(1, ChronoUnit.DAYS))
                        .build());
            }

            // Task 3: deliver in_transit parcel to Kibagabaga
            if (!inTransitIds.isEmpty()) {
                tasks.add(CourierTask.builder()
                        .taskId("TSK-DEL001")
                        .courierId("USR-COU001")
                        .type("deliver")
                        .lockerId("LKR-KGL008")
                        .lockerName("Kibagabaga Hospital")
                        .parcelIds(List.of(inTransitIds.get(0)))
                        .parcelCount(1)
                        .status("pending")
                        .createdAt(now.minus(2, ChronoUnit.DAYS))
                        .build());
            }
            if (inTransitIds.size() > 1) {
                tasks.add(CourierTask.builder()
                        .taskId("TSK-DEL002")
                        .courierId("USR-COU001")
                        .type("deliver")
                        .lockerId("LKR-KGL001")
                        .lockerName("Kigali City Centre")
                        .parcelIds(List.of(inTransitIds.get(1)))
                        .parcelCount(1)
                        .status("pending")
                        .createdAt(now.minus(2, ChronoUnit.DAYS))
                        .build());
            }

            taskRepo.saveAll(tasks);
            log.info("Seeded {} courier tasks", tasks.size());
        }
    }

    /** Build a realistic status_history list for a parcel at a given final status. */
    private List<Map<String, Object>> buildHistory(String finalStatus, Instant base,
                                                   String originName, String destName) {
        List<Map<String, Object>> h = new ArrayList<>();
        h.add(histEntry("awaiting_payment", base, "Parcel created, awaiting payment"));
        Instant t = base.plus(5, ChronoUnit.MINUTES);
        h.add(histEntry("awaiting_dropoff", t, "Payment confirmed — please drop off at " + originName));
        if (Set.of("dropped_off","in_transit","ready_for_pickup","delivered").contains(finalStatus)) {
            t = t.plus(2, ChronoUnit.HOURS);
            h.add(histEntry("dropped_off", t, "Parcel dropped off at " + originName));
        }
        if (Set.of("in_transit","ready_for_pickup","delivered").contains(finalStatus)) {
            t = t.plus(1, ChronoUnit.HOURS);
            h.add(histEntry("in_transit", t, "Courier picked up and is en route to " + destName));
        }
        if (Set.of("ready_for_pickup","delivered").contains(finalStatus)) {
            t = t.plus(3, ChronoUnit.HOURS);
            h.add(histEntry("ready_for_pickup", t, "Parcel arrived at " + destName + " — ready for pickup"));
        }
        if ("delivered".equals(finalStatus)) {
            t = t.plus(6, ChronoUnit.HOURS);
            h.add(histEntry("delivered", t, "Parcel collected by recipient"));
        }
        return h;
    }

    private Map<String, Object> histEntry(String status, Instant ts, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", status);
        m.put("timestamp", ts.toString());
        m.put("note", note);
        return m;
    }

    private String randomDigits(int len) {
        Random rng = new Random();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; i++) sb.append(rng.nextInt(10));
        return sb.toString();
    }

    // ── User creation / repair (unchanged) ──────────────────────────────────

    private void createOrRepairUser(String userId, String email, String phone,
                                     String name, String role, String phoneForSms, String password) {
        String supabaseEmail = email != null ? email : phoneForSms + "@parcela.internal";

        Optional<AppUser> existingOpt = userRepo.findByUserId(userId);
        if (existingOpt.isPresent()) {
            repairSupabaseAuth(existingOpt.get(), supabaseEmail, password);
            return;
        }

        try {
            Map<String, Object> authUser = supabaseAuth.adminCreateUser(supabaseEmail, password);
            String authUserIdStr = (String) authUser.get("id");
            if (authUserIdStr == null) {
                log.warn("No Supabase UUID returned for {}", supabaseEmail);
                return;
            }
            AppUser user = AppUser.builder()
                    .userId(userId)
                    .authUserId(UUID.fromString(authUserIdStr))
                    .name(name)
                    .email(email)
                    .phone(phone != null ? phone : phoneForSms)
                    .role(role)
                    .build();
            userRepo.save(user);
            log.info("Seeded new user: {} ({})", name, role);
        } catch (Exception e) {
            log.warn("Could not create user {} — attempting repair path: {}", userId, e.getMessage());
            AppUser partial = AppUser.builder()
                    .userId(userId).authUserId(UUID.randomUUID())
                    .name(name).email(email)
                    .phone(phone != null ? phone : phoneForSms)
                    .role(role).build();
            userRepo.save(partial);
            repairSupabaseAuth(partial, supabaseEmail, password);
        }
    }

    private void repairSupabaseAuth(AppUser dbUser, String supabaseEmail, String password) {
        try {
            Map<String, Object> tokenResp = supabaseAuth.signInWithPassword(supabaseEmail, password);
            String token = (String) tokenResp.get("access_token");
            if (token != null) {
                syncUuidFromTokenResp(dbUser, tokenResp);
                return;
            }
        } catch (Exception e) {
            log.info("Sign-in check failed for {} — repairing Supabase auth: {}", supabaseEmail, e.getMessage());
        }

        List<Map<String, Object>> allSupabaseUsers = supabaseAuth.adminListUsers();
        Optional<Map<String, Object>> supabaseUserOpt = allSupabaseUsers.stream()
                .filter(u -> supabaseEmail.equals(u.get("email")))
                .findFirst();

        if (supabaseUserOpt.isPresent()) {
            String supabaseUuidStr = (String) supabaseUserOpt.get().get("id");
            if (supabaseUuidStr != null) {
                log.info("Found existing Supabase user {} — resetting password and syncing UUID", supabaseEmail);
                supabaseAuth.adminUpdateUserPassword(supabaseUuidStr, password);
                try {
                    UUID supabaseUuid = UUID.fromString(supabaseUuidStr);
                    if (!supabaseUuid.equals(dbUser.getAuthUserId())) {
                        log.info("Syncing auth_user_id for {} → {}", dbUser.getUserId(), supabaseUuid);
                        dbUser.setAuthUserId(supabaseUuid);
                        userRepo.save(dbUser);
                    }
                } catch (IllegalArgumentException ex) {
                    log.warn("Bad UUID from Supabase: {}", supabaseUuidStr);
                }
            }
            return;
        }

        try {
            Map<String, Object> authUser = supabaseAuth.adminCreateUser(supabaseEmail, password);
            String newUuidStr = (String) authUser.get("id");
            if (newUuidStr != null) {
                UUID newUuid = UUID.fromString(newUuidStr);
                log.info("Re-created Supabase auth for {} with new UUID {}", supabaseEmail, newUuid);
                dbUser.setAuthUserId(newUuid);
                userRepo.save(dbUser);
            }
        } catch (Exception e) {
            log.warn("Could not repair Supabase auth for {}: {}", supabaseEmail, e.getMessage());
        }
    }

    private void syncUuidFromTokenResp(AppUser dbUser, Map<String, Object> tokenResp) {
        try {
            if (tokenResp.get("user") instanceof Map<?, ?> userMap) {
                Object idObj = userMap.get("id");
                if (idObj instanceof String uuidStr && !uuidStr.isBlank()) {
                    UUID supabaseUuid = UUID.fromString(uuidStr);
                    if (!supabaseUuid.equals(dbUser.getAuthUserId())) {
                        log.info("Syncing auth_user_id for {}: {} → {}",
                                dbUser.getUserId(), dbUser.getAuthUserId(), supabaseUuid);
                        dbUser.setAuthUserId(supabaseUuid);
                        userRepo.save(dbUser);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("UUID sync error for {}: {}", dbUser.getUserId(), e.getMessage());
        }
    }
}
