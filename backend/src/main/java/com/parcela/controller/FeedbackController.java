package com.parcela.controller;

import com.parcela.model.AppUser;
import com.parcela.repository.AppUserRepository;
import com.parcela.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class FeedbackController {

    private static final Logger log = LoggerFactory.getLogger(FeedbackController.class);

    private final AppUserRepository userRepo;
    private final NotificationService notificationService;

    public FeedbackController(AppUserRepository userRepo, NotificationService notificationService) {
        this.userRepo = userRepo;
        this.notificationService = notificationService;
    }

    @PostMapping("/feedback")
    public ResponseEntity<Void> submitFeedback(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody Map<String, Object> body) {

        UUID authId = UUID.fromString(jwt.getSubject());
        Optional<AppUser> senderOpt = userRepo.findByAuthUserId(authId);
        if (senderOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                senderOpt = userRepo.findByEmail(email);
                if (senderOpt.isEmpty() && email.endsWith("@parcela.internal")) {
                    senderOpt = userRepo.findByPhone(email.replace("@parcela.internal", ""));
                }
                senderOpt.ifPresent(u -> {
                    log.info("submitFeedback: syncing auth_user_id for {} → {}", u.getUserId(), authId);
                    u.setAuthUserId(authId);
                    userRepo.save(u);
                });
            }
        }
        AppUser sender = senderOpt.orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        int rating = body.get("rating") instanceof Number n ? n.intValue() : 0;
        if (rating < 1 || rating > 5)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be between 1 and 5");

        String message = body.get("message") instanceof String s ? s : "";
        String stars = "★".repeat(rating) + "☆".repeat(5 - rating);
        String title = "Feedback from " + sender.getName() + " — " + stars;
        String notifBody = message.isBlank()
                ? sender.getName() + " rated the service " + rating + "/5"
                : sender.getName() + " (" + rating + "/5): " + message;

        userRepo.findAll().stream()
                .filter(u -> "admin".equals(u.getRole()))
                .forEach(admin -> notificationService.create(
                        admin.getUserId(), title, notifBody, null, null, "feedback"));

        log.info("Feedback submitted by {} rating={}", sender.getUserId(), rating);
        return ResponseEntity.noContent().build();
    }
}
