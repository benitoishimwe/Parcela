package com.parcela.controller;

import com.parcela.dto.response.NotificationDto;
import com.parcela.model.AppUser;
import com.parcela.repository.AppUserRepository;
import com.parcela.service.NotificationService;
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
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final Logger log = LoggerFactory.getLogger(NotificationController.class);

    private final NotificationService notificationService;
    private final AppUserRepository userRepo;

    public NotificationController(NotificationService notificationService, AppUserRepository userRepo) {
        this.notificationService = notificationService;
        this.userRepo = userRepo;
    }

    @GetMapping
    public ResponseEntity<List<NotificationDto>> getNotifications(@AuthenticationPrincipal Jwt jwt) {
        AppUser user = resolveUser(jwt);
        return ResponseEntity.ok(notificationService.getUserNotifications(user.getUserId()));
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<NotificationDto> markRead(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String notificationId) {
        AppUser user = resolveUser(jwt);
        return ResponseEntity.ok(notificationService.markRead(notificationId, user.getUserId()));
    }

    @PutMapping("/read-all")
    public ResponseEntity<Map<String, String>> markAllRead(@AuthenticationPrincipal Jwt jwt) {
        AppUser user = resolveUser(jwt);
        notificationService.markAllRead(user.getUserId());
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }

    private AppUser resolveUser(Jwt jwt) {
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
                    log.info("resolveUser: syncing auth_user_id for {} → {}", u.getUserId(), authId);
                    u.setAuthUserId(authId);
                    userRepo.save(u);
                });
            }
        }
        return userOpt.orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
