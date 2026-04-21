package com.parcela.controller;

import com.parcela.dto.request.LockerCreateRequest;
import com.parcela.dto.request.LockerUpdateRequest;
import com.parcela.dto.response.LockerDto;
import com.parcela.model.AppUser;
import com.parcela.repository.AppUserRepository;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/lockers")
public class LockerController {

    private final LockerService lockerService;
    private final AppUserRepository userRepo;

    public LockerController(LockerService lockerService, AppUserRepository userRepo) {
        this.lockerService = lockerService;
        this.userRepo = userRepo;
    }

    /** Public — all active lockers (used by frontend map). */
    @GetMapping
    public ResponseEntity<List<LockerDto>> getLockers() {
        return ResponseEntity.ok(lockerService.getActiveLockers());
    }

    @GetMapping("/{lockerId}")
    public ResponseEntity<LockerDto> getLocker(@PathVariable String lockerId) {
        return ResponseEntity.ok(lockerService.getLocker(lockerId));
    }

    /** Admin only. */
    @PostMapping
    public ResponseEntity<LockerDto> createLocker(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody LockerCreateRequest req) {
        requireAdmin(jwt);
        return ResponseEntity.status(HttpStatus.CREATED).body(lockerService.createLocker(req));
    }

    @PutMapping("/{lockerId}")
    public ResponseEntity<LockerDto> updateLocker(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String lockerId,
            @RequestBody LockerUpdateRequest req) {
        requireAdmin(jwt);
        return ResponseEntity.ok(lockerService.updateLocker(lockerId, req));
    }

    @DeleteMapping("/{lockerId}")
    public ResponseEntity<Map<String, String>> deleteLocker(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String lockerId) {
        requireAdmin(jwt);
        lockerService.deleteLocker(lockerId);
        return ResponseEntity.ok(Map.of("message", "Locker deleted"));
    }

    private static final Logger log = LoggerFactory.getLogger(LockerController.class);

    private void requireAdmin(Jwt jwt) {
        UUID authId = UUID.fromString(jwt.getSubject());
        Optional<AppUser> userOpt = userRepo.findByAuthUserId(authId);
        if (userOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                userOpt = userRepo.findByEmail(email);
                if (userOpt.isEmpty() && email.endsWith("@parcela.internal")) {
                    userOpt = userRepo.findByPhone(email.replace("@parcela.internal", ""));
                }
                userOpt.ifPresent(u -> {
                    log.info("requireAdmin: syncing auth_user_id for {} → {}", u.getUserId(), authId);
                    u.setAuthUserId(authId);
                    userRepo.save(u);
                });
            }
        }
        String role = userOpt.map(AppUser::getRole)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        if (!"admin".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access required");
    }
}
