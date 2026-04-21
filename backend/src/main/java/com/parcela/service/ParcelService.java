package com.parcela.service;

import com.parcela.dto.request.ParcelCreateRequest;
import com.parcela.dto.request.ProcessPaymentRequest;
import com.parcela.dto.request.StatusUpdateRequest;
import com.parcela.dto.response.ParcelDto;
import com.parcela.model.AppUser;
import com.parcela.model.Locker;
import com.parcela.model.Parcel;
import com.parcela.model.CourierTask;
import com.parcela.repository.AppUserRepository;
import com.parcela.repository.CourierTaskRepository;
import com.parcela.repository.LockerRepository;
import com.parcela.repository.ParcelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.beans.factory.annotation.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@SuppressWarnings("null")
public class ParcelService {

    private static final Logger log = LoggerFactory.getLogger(ParcelService.class);

    private final ParcelRepository parcelRepo;
    private final AppUserRepository userRepo;
    private final LockerRepository lockerRepo;
    private final CourierTaskRepository taskRepo;
    private final LockerService lockerService;
    private final NotificationService notificationService;
    private final SmsService smsService;
    private final MtnMomoService mtnMomoService;

    @Value("${app.mtn.enabled:false}")
    private boolean mtnEnabled;

    public ParcelService(ParcelRepository parcelRepo, AppUserRepository userRepo,
                         LockerRepository lockerRepo, CourierTaskRepository taskRepo,
                         LockerService lockerService, NotificationService notificationService,
                         SmsService smsService, MtnMomoService mtnMomoService) {
        this.parcelRepo = parcelRepo;
        this.userRepo = userRepo;
        this.lockerRepo = lockerRepo;
        this.taskRepo = taskRepo;
        this.lockerService = lockerService;
        this.notificationService = notificationService;
        this.smsService = smsService;
        this.mtnMomoService = mtnMomoService;
    }

    // ── Pricing ────────────────────────────────────────────────────────────────

    private BigDecimal getPrice(String size, String deliveryMode) {
        int base = switch (size.toLowerCase()) {
            case "small"  -> 0;
            case "medium" -> 500;
            case "large"  -> 1000;
            default -> 0;
        };
        int modePrice = switch ((deliveryMode != null ? deliveryMode : "basic").toLowerCase()) {
            case "fast"    -> 3000;
            case "express" -> 6000;
            default        -> 1500; // basic
        };
        return BigDecimal.valueOf(base + modePrice);
    }

    // ── Create parcel ──────────────────────────────────────────────────────────

    @Transactional
    public ParcelDto createParcel(ParcelCreateRequest req, Jwt jwt) {
        AppUser sender = resolveUser(jwt);

        Locker origin = lockerRepo.findByLockerId(req.getOriginLockerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Origin locker not found"));
        Locker dest = lockerRepo.findByLockerId(req.getDestinationLockerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destination locker not found"));

        // Reserve slot in origin locker
        lockerService.reserveSlot(req.getOriginLockerId(), req.getSize());

        String parcelId = "PCL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String trackingCode = "PAR-" + generateTrackingCode();
        String qrData = "PARCELA:" + parcelId;
        String deliveryMode = req.getDeliveryMode() != null ? req.getDeliveryMode() : "basic";

        Parcel parcel = Parcel.builder()
                .parcelId(parcelId)
                .trackingCode(trackingCode)
                .senderId(sender.getUserId())
                .senderName(req.getSenderName())
                .senderPhone(req.getSenderPhone())
                .recipientName(req.getRecipientName())
                .recipientPhone(req.getRecipientPhone())
                .recipientEmail(req.getRecipientEmail())
                .originLockerId(origin.getLockerId())
                .destinationLockerId(dest.getLockerId())
                .originLockerName(origin.getName())
                .destinationLockerName(dest.getName())
                .size(req.getSize())
                .status("awaiting_payment")
                .qrCode(trackingCode)
                .qrData(qrData)
                .paymentStatus("pending")
                .paymentMethod(req.getPaymentMethod() != null ? req.getPaymentMethod() : "mobile_money")
                .deliveryMode(deliveryMode)
                .clientNotes(req.getClientNotes())
                .price(getPrice(req.getSize(), deliveryMode))
                .statusHistory(new ArrayList<>())
                .build();

        addStatusEntry(parcel, "awaiting_payment", "Parcel created, awaiting payment");
        return ParcelDto.from(parcelRepo.save(parcel));
    }

    // ── Process payment ────────────────────────────────────────────────────────

    @Transactional
    public ParcelDto processPayment(String parcelId, ProcessPaymentRequest req, Jwt jwt) {
        Parcel parcel = getOwnedParcel(parcelId, jwt);

        if (!"awaiting_payment".equals(parcel.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parcel is not awaiting payment");
        }

        String phone = req.getPhoneNumber() != null ? req.getPhoneNumber() : parcel.getSenderPhone();
        String mtnRefId = mtnMomoService.requestPayment(phone, parcel.getPrice(), parcelId);

        parcel.setMtnRefId(mtnRefId);

        if (!mtnEnabled) {
            // Mock mode: immediately confirm payment and notify all parties
            parcel.setPaymentStatus("paid");
            parcel.setStatus("awaiting_dropoff");
            addStatusEntry(parcel, "awaiting_dropoff",
                    "Payment confirmed — please drop off your parcel at " + parcel.getOriginLockerName());
            parcelRepo.save(parcel);
            notifyAllParties(parcel);
            log.info("Mock payment confirmed for parcel {}", parcel.getTrackingCode());
        } else {
            parcel.setPaymentStatus("processing");
            parcelRepo.save(parcel);
        }

        return ParcelDto.from(parcel);
    }

    /** Send payment-confirmed notifications to sender, all admins, and all couriers. */
    private void notifyAllParties(Parcel parcel) {
        try {
            String trackingCode = parcel.getTrackingCode();
            String parcelId = parcel.getParcelId();

            // Notify sender
            notificationService.create(
                    parcel.getSenderId(),
                    "Payment Confirmed ✅",
                    "Your parcel " + trackingCode + " is paid! Drop it off at " + parcel.getOriginLockerName() + ".",
                    parcelId, trackingCode, "payment");

            // Notify all admins
            String adminTitle = "New Parcel: " + trackingCode;
            String adminBody = parcel.getSenderName() + " → " + parcel.getRecipientName()
                    + " | " + parcel.getOriginLockerName() + " → " + parcel.getDestinationLockerName()
                    + " | " + parcel.getSize() + " | " + parcel.getDeliveryMode()
                    + (parcel.getClientNotes() != null && !parcel.getClientNotes().isBlank()
                        ? " | Note: " + parcel.getClientNotes() : "");
            userRepo.findAll().stream()
                    .filter(u -> "admin".equals(u.getRole()))
                    .forEach(admin -> notificationService.create(
                            admin.getUserId(), adminTitle, adminBody, parcelId, trackingCode, "new_parcel"));

            // Notify all couriers and create a pickup task for each one
            String courierTitle = "New Pickup Available";
            String courierBody = "Parcel " + trackingCode + " waiting at " + parcel.getOriginLockerName()
                    + " → " + parcel.getDestinationLockerName()
                    + " [" + parcel.getDeliveryMode() + "]";
            userRepo.findAll().stream()
                    .filter(u -> "courier".equals(u.getRole()))
                    .forEach(courier -> {
                        notificationService.create(
                                courier.getUserId(), courierTitle, courierBody, parcelId, trackingCode, "new_parcel");
                        // Auto-create a courier task so the parcel appears in the courier dashboard
                        CourierTask task = CourierTask.builder()
                                .taskId("TSK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                                .courierId(courier.getUserId())
                                .type("collect")
                                .lockerId(parcel.getOriginLockerId())
                                .lockerName(parcel.getOriginLockerName())
                                .parcelIds(List.of(parcelId))
                                .parcelCount(1)
                                .status("pending")
                                .build();
                        taskRepo.save(task);
                        log.info("Auto-created courier task for {} → parcel {}", courier.getUserId(), trackingCode);
                    });

            // SMS to sender
            smsService.send(parcel.getSenderPhone(),
                    "Parcela: Ihishurwa rya " + trackingCode + " ryemejwe. Shimangira ipaki yawe muri "
                            + parcel.getOriginLockerName() + ".");
        } catch (Exception e) {
            log.warn("Notification error (non-critical): {}", e.getMessage());
        }
    }

    // ── Poll payment status ────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> getPaymentStatus(String parcelId, Jwt jwt) {
        Parcel parcel = getOwnedParcel(parcelId, jwt);

        if ("paid".equals(parcel.getPaymentStatus())) {
            return Map.of("payment_status", "paid", "parcel_status", parcel.getStatus());
        }

        if (parcel.getMtnRefId() == null) {
            return Map.of("payment_status", parcel.getPaymentStatus(), "parcel_status", parcel.getStatus());
        }

        String momoStatus = mtnMomoService.checkPaymentStatus(parcel.getMtnRefId());

        if ("SUCCESSFUL".equals(momoStatus)) {
            parcel.setPaymentStatus("paid");
            parcel.setStatus("awaiting_dropoff");
            addStatusEntry(parcel, "awaiting_dropoff", "Payment confirmed — please drop off at origin locker");
            parcelRepo.save(parcel);

            // Notify sender
            notificationService.create(parcel.getSenderId(),
                    "Payment Confirmed", "Your parcel " + parcel.getTrackingCode() + " is paid and ready to drop off.",
                    parcel.getParcelId(), parcel.getTrackingCode(), "payment");
        } else if ("FAILED".equals(momoStatus)) {
            parcel.setPaymentStatus("failed");
            parcelRepo.save(parcel);
        }

        return Map.of("payment_status", parcel.getPaymentStatus(), "parcel_status", parcel.getStatus());
    }

    // ── Get parcels ────────────────────────────────────────────────────────────

    public List<ParcelDto> getMyParcels(Jwt jwt) {
        AppUser user = resolveUser(jwt);
        return parcelRepo.findMyParcels(user.getUserId(),
                user.getPhone() != null ? user.getPhone() : "",
                user.getEmail() != null ? user.getEmail() : "")
                .stream().map(ParcelDto::from).collect(Collectors.toList());
    }

    public ParcelDto trackParcel(String trackingCode) {
        return parcelRepo.findByTrackingCode(trackingCode)
                .map(ParcelDto::fromPublic)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));
    }

    /** Assign a parcel to a courier — creates a pending CourierTask. No JWT required. */
    @Transactional
    public Map<String, Object> assignToCourier(String parcelId, String courierId, String type) {
        if (courierId == null || courierId.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "courier_id is required");

        Parcel parcel = parcelRepo.findByParcelId(parcelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));

        AppUser courier = userRepo.findByUserId(courierId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Courier not found"));
        if (!"courier".equals(courier.getRole()) && !"admin".equals(courier.getRole()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is not a courier");

        String lockerId   = "collect".equals(type) ? parcel.getOriginLockerId()       : parcel.getDestinationLockerId();
        String lockerName = "collect".equals(type) ? parcel.getOriginLockerName()      : parcel.getDestinationLockerName();

        String taskId = "TSK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        CourierTask task = CourierTask.builder()
                .taskId(taskId)
                .courierId(courierId)
                .type(type)
                .lockerId(lockerId)
                .lockerName(lockerName)
                .parcelIds(List.of(parcelId))
                .parcelCount(1)
                .status("pending")
                .build();
        taskRepo.save(task);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("task_id", taskId);
        result.put("courier_id", courierId);
        result.put("courier_name", courier.getName());
        result.put("parcel_id", parcelId);
        result.put("tracking_code", parcel.getTrackingCode());
        result.put("type", type);
        result.put("locker_name", lockerName);
        result.put("status", "pending");
        return result;
    }

    public List<ParcelDto> getAllParcelsPublic() {
        return parcelRepo.findAllByOrderByCreatedAtDesc()
                .stream().map(ParcelDto::from).collect(Collectors.toList());
    }

    /** Public: return parcels where sender_id = userId OR recipient matches phone/email. */
    public List<ParcelDto> getParcelsByUser(String userId, String phone, String email) {
        return parcelRepo.findMyParcels(userId, phone, email)
                .stream().map(ParcelDto::from).collect(Collectors.toList());
    }

    public List<ParcelDto> getAllParcels(Jwt jwt) {
        requireAdminOrCourier(jwt);
        return parcelRepo.findAllByOrderByCreatedAtDesc()
                .stream().map(ParcelDto::from).collect(Collectors.toList());
    }

    public ParcelDto getParcel(String parcelId, Jwt jwt) {
        requireAdminOrCourier(jwt);
        return parcelRepo.findByParcelId(parcelId)
                .map(ParcelDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));
    }

    // ── Update status (courier / admin) ───────────────────────────────────────

    @Transactional
    public ParcelDto updateStatus(String parcelId, StatusUpdateRequest req, Jwt jwt) {
        requireAdminOrCourier(jwt);
        Parcel parcel = parcelRepo.findByParcelId(parcelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));

        String oldStatus = parcel.getStatus();
        parcel.setStatus(req.getStatus());
        addStatusEntry(parcel, req.getStatus(), req.getNote() != null ? req.getNote() : req.getStatus());

        // Release destination slot when delivered
        if ("delivered".equals(req.getStatus()) && !"delivered".equals(oldStatus)) {
            lockerService.releaseSlot(parcel.getDestinationLockerId(), parcel.getSize());
        }

        parcelRepo.save(parcel);
        sendStatusNotifications(parcel, req.getStatus());
        return ParcelDto.from(parcel);
    }

    // ── Courier: scan QR to mark dropped_off or picked_up ────────────────────

    @Transactional
    public ParcelDto scanParcel(String parcelId, String action, Jwt jwt) {
        AppUser courier = resolveUser(jwt);
        if (!"courier".equals(courier.getRole()) && !"admin".equals(courier.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Courier access required");
        }

        Parcel parcel = parcelRepo.findByParcelId(parcelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));

        String newStatus;
        String note;
        if ("drop_off".equals(action)) {
            newStatus = "in_transit";
            note = "Dropped off at " + parcel.getOriginLockerName();
        } else if ("picked_up".equals(action)) {
            newStatus = "ready_for_pickup";
            note = "Parcela: Iderevu yagejeje ipaki yawe muri " + parcel.getDestinationLockerName()
                    + ". Mode: " + parcel.getDeliveryMode() + ". Code: " + parcel.getTrackingCode();
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid action: " + action);
        }

        parcel.setStatus(newStatus);
        addStatusEntry(parcel, newStatus, note);
        parcelRepo.save(parcel);
        sendStatusNotifications(parcel, newStatus);
        return ParcelDto.from(parcel);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private void addStatusEntry(Parcel parcel, String status, String note) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("status", status);
        entry.put("note", note);
        entry.put("timestamp", Instant.now().toString());
        if (parcel.getStatusHistory() == null) parcel.setStatusHistory(new ArrayList<>());
        parcel.getStatusHistory().add(entry);
    }

    private AppUser resolveUser(Jwt jwt) {
        UUID authId = UUID.fromString(jwt.getSubject());

        // 1. Fast path: match stored auth_user_id
        Optional<AppUser> userOpt = userRepo.findByAuthUserId(authId);

        if (userOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                // 2. Real-email users: find by email claim
                userOpt = userRepo.findByEmail(email);

                // 3. Phone-only users: Supabase stores their email as "{phone}@parcela.internal"
                //    but the DB has email=NULL. Extract the phone and look up by that instead.
                if (userOpt.isEmpty() && email.endsWith("@parcela.internal")) {
                    String phone = email.replace("@parcela.internal", "");
                    userOpt = userRepo.findByPhone(phone);
                }

                // Sync the UUID so the fast path works on every future request
                userOpt.ifPresent(u -> {
                    log.info("resolveUser: syncing auth_user_id for {} → {}", u.getUserId(), authId);
                    u.setAuthUserId(authId);
                    userRepo.save(u);
                });
            }
        }

        return userOpt.orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private Parcel getOwnedParcel(String parcelId, Jwt jwt) {
        AppUser user = resolveUser(jwt);
        Parcel parcel = parcelRepo.findByParcelId(parcelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));
        if (!parcel.getSenderId().equals(user.getUserId()) && !"admin".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return parcel;
    }

    private void requireAdminOrCourier(Jwt jwt) {
        AppUser user = resolveUser(jwt);
        if (!"admin".equals(user.getRole()) && !"courier".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Courier or admin access required");
        }
    }

    private void sendStatusNotifications(Parcel parcel, String status) {
        try {
            String tc  = parcel.getTrackingCode();
            String pid = parcel.getParcelId();
            String origin = parcel.getOriginLockerName();
            String dest   = parcel.getDestinationLockerName();

            switch (status) {

                // ── Sender: parcel dropped at origin locker ───────────────────────
                case "dropped_off" -> {
                    notificationService.create(
                            parcel.getSenderId(),
                            "Parcel Dropped Off 📥",
                            "Your parcel " + tc + " has been received at " + origin + " and is awaiting courier pickup.",
                            pid, tc, "dropped_off");

                    // Alert admins so they can assign a courier if none is assigned yet
                    userRepo.findAll().stream()
                            .filter(u -> "admin".equals(u.getRole()))
                            .forEach(admin -> notificationService.create(
                                    admin.getUserId(),
                                    "Parcel Dropped Off — Action May Be Needed",
                                    "Parcel " + tc + " is at " + origin + " and waiting for courier pickup → " + dest + ".",
                                    pid, tc, "new_parcel"));
                }

                // ── Sender + courier: courier has picked up, parcel moving ────────
                case "in_transit" -> {
                    notificationService.create(
                            parcel.getSenderId(),
                            "Parcel In Transit 🚚",
                            "Your parcel " + tc + " has been picked up by a courier and is on its way to " + dest + ".",
                            pid, tc, "in_transit");
                    smsService.send(parcel.getSenderPhone(),
                            "Parcela: Ipaki yawe " + tc + " iri mu nzira yerekeza " + dest + ".");
                }

                // ── Sender + recipient: parcel arrived at destination locker ─────
                case "ready_for_pickup" -> {
                    String pickupMsg = "Your parcel " + tc + " has arrived at " + dest
                            + ". Use code " + parcel.getQrCode() + " to collect it.";
                    notificationService.create(
                            parcel.getSenderId(),
                            "Parcel Ready for Pickup 📬",
                            "Your parcel " + tc + " is now at " + dest + " and ready for collection.",
                            pid, tc, "ready_for_pickup");
                    // Notify recipient by SMS (they may not have the app)
                    smsService.send(parcel.getRecipientPhone(),
                            "Parcela: Ipaki yawe yageze muri " + dest + ". Code: " + parcel.getQrCode()
                                    + ". Tracking: " + tc);
                }

                // ── Sender: delivery confirmed, trigger post-delivery feedback ────
                case "delivered" -> {
                    notificationService.create(
                            parcel.getSenderId(),
                            "Parcel Delivered ✅",
                            "Great news! Your parcel " + tc + " has been successfully delivered to "
                                    + parcel.getRecipientName() + ". How was the experience?",
                            pid, tc, "delivered");
                    // Prompt feedback — separate notification so it appears as a distinct card
                    notificationService.create(
                            parcel.getSenderId(),
                            "Rate Your Delivery ⭐",
                            "Parcel " + tc + " delivered! Tap to rate your Parcela experience and help us improve.",
                            pid, tc, "feedback_prompt");
                    // Notify admins of successful delivery
                    userRepo.findAll().stream()
                            .filter(u -> "admin".equals(u.getRole()))
                            .forEach(admin -> notificationService.create(
                                    admin.getUserId(),
                                    "Delivery Completed: " + tc,
                                    parcel.getSenderName() + " → " + parcel.getRecipientName()
                                            + " | " + origin + " → " + dest + " | Delivered successfully.",
                                    pid, tc, "status"));
                }

                // ── Sender + admins: parcel returned / issue occurred ─────────────
                case "returned" -> {
                    notificationService.create(
                            parcel.getSenderId(),
                            "Parcel Returned ↩️",
                            "Unfortunately, parcel " + tc + " could not be delivered and has been returned to "
                                    + origin + ". Please contact support for next steps.",
                            pid, tc, "returned");
                    // Alert admins of the issue
                    userRepo.findAll().stream()
                            .filter(u -> "admin".equals(u.getRole()))
                            .forEach(admin -> notificationService.create(
                                    admin.getUserId(),
                                    "⚠️ Parcel Returned — Needs Review",
                                    "Parcel " + tc + " (" + parcel.getSenderName() + " → " + parcel.getRecipientName()
                                            + ") was returned to " + origin + ". Review required.",
                                    pid, tc, "delay"));
                }

                default -> log.debug("No notification template for status: {}", status);
            }
        } catch (Exception e) {
            log.warn("Notification send failed (non-critical): {}", e.getMessage());
        }
    }

    private String generateTrackingCode() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(6);
        Random rnd = new Random();
        for (int i = 0; i < 6; i++) sb.append(chars.charAt(rnd.nextInt(chars.length())));
        return sb.toString();
    }
}
