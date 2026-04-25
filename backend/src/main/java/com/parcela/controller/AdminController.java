package com.parcela.controller;

import com.parcela.dto.request.UpdateRoleRequest;
import com.parcela.dto.response.AdminStatsDto;
import com.parcela.dto.response.CourierTaskDto;
import com.parcela.dto.response.LockerDto;
import com.parcela.dto.response.UserDto;
import com.parcela.model.AppUser;
import com.parcela.repository.AppUserRepository;
import com.parcela.repository.LockerRepository;
import com.parcela.repository.ParcelRepository;
import com.parcela.service.CourierTaskService;
import com.parcela.service.LockerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final AppUserRepository userRepo;
    private final LockerRepository lockerRepo;
    private final ParcelRepository parcelRepo;
    private final CourierTaskService courierTaskService;
    private final LockerService lockerService;

    public AdminController(AppUserRepository userRepo, LockerRepository lockerRepo,
                           ParcelRepository parcelRepo, CourierTaskService courierTaskService,
                           LockerService lockerService) {
        this.userRepo = userRepo;
        this.lockerRepo = lockerRepo;
        this.parcelRepo = parcelRepo;
        this.courierTaskService = courierTaskService;
        this.lockerService = lockerService;
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminStatsDto> getStats(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        AdminStatsDto stats = AdminStatsDto.builder()
                .totalLockers(lockerRepo.count())
                .activeLockers(lockerRepo.countByStatus("active"))
                .totalUsers(userRepo.countByRole("user"))
                .totalCouriers(userRepo.countByRole("courier"))
                .totalParcels(parcelRepo.count())
                .inTransit(parcelRepo.countByStatus("in_transit"))
                .readyForPickup(parcelRepo.countByStatus("ready_for_pickup"))
                .delivered(parcelRepo.countByStatus("delivered"))
                .build();
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/lockers")
    public ResponseEntity<List<LockerDto>> getAllLockers(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return ResponseEntity.ok(lockerService.getAllLockers());
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserDto>> getUsers(@AuthenticationPrincipal Jwt jwt) {
        requireAdmin(jwt);
        return ResponseEntity.ok(
                userRepo.findAll().stream().map(UserDto::from).collect(Collectors.toList()));
    }

    @PutMapping("/users/{userId}/role")
    public ResponseEntity<UserDto> updateRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String userId,
            @Valid @RequestBody UpdateRoleRequest req) {
        requireAdmin(jwt);
        AppUser user = userRepo.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        List<String> validRoles = List.of("user", "courier", "admin");
        if (!validRoles.contains(req.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role: " + req.getRole());
        }
        user.setRole(req.getRole());
        return ResponseEntity.ok(UserDto.from(userRepo.save(user)));
    }

    @GetMapping("/couriers/{courierId}/tasks")
    public ResponseEntity<List<CourierTaskDto>> getCourierTasks(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String courierId) {
        // requireAdmin is called inside the service
        return ResponseEntity.ok(courierTaskService.getCourierTasks(courierId, jwt));
    }

    @PostMapping("/courier-tasks")
    public ResponseEntity<CourierTaskDto> createCourierTask(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, Object> body) {
        requireAdmin(jwt);
        String courierId = (String) body.get("courier_id");
        String type = (String) body.getOrDefault("type", "collect");
        String lockerId = (String) body.get("locker_id");
        String lockerName = (String) body.getOrDefault("locker_name", lockerId);
        @SuppressWarnings("unchecked")
        List<String> parcelIds = (List<String>) body.getOrDefault("parcel_ids", List.of());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(courierTaskService.createTask(courierId, type, lockerId, lockerName, parcelIds, jwt));
    }

    private AppUser requireAdmin(Jwt jwt) {
        UUID authId = UUID.fromString(jwt.getSubject());

        // Primary lookup by Supabase UUID
        Optional<AppUser> userOpt = userRepo.findByAuthUserId(authId);

        // Fallback: Supabase JWTs always include the email claim.
        // If the stored auth_user_id is stale (e.g., Supabase account was recreated),
        // find the user by email and sync the UUID so future requests use the fast path.
        if (userOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                userOpt = userRepo.findByEmail(email);
                // Phone-only users have a synthetic email "{phone}@parcela.internal" with DB email=NULL
                if (userOpt.isEmpty() && email.endsWith("@parcela.internal")) {
                    userOpt = userRepo.findByPhone(email.replace("@parcela.internal", ""));
                }
                userOpt.ifPresent(u -> {
                    log.info("requireAdmin: auth_user_id mismatch for {} — syncing {} → {}",
                            u.getUserId(), u.getAuthUserId(), authId);
                    u.setAuthUserId(authId);
                    userRepo.save(u);
                });
            }
        }

        AppUser user = userOpt.orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        if (!"admin".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access required");
        }
        return user;
    }
}
