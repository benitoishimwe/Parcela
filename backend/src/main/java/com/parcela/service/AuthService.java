package com.parcela.service;

import com.parcela.dto.request.GoogleCallbackRequest;
import com.parcela.dto.request.LoginRequest;
import com.parcela.dto.request.SignupRequest;
import com.parcela.dto.response.AuthResponse;
import com.parcela.dto.response.UserDto;
import com.parcela.model.AppUser;
import com.parcela.repository.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@SuppressWarnings("null")
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final AppUserRepository userRepo;
    private final SupabaseAuthClient supabaseAuth;

    public AuthService(AppUserRepository userRepo, SupabaseAuthClient supabaseAuth) {
        this.userRepo = userRepo;
        this.supabaseAuth = supabaseAuth;
    }

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        if (userRepo.existsByPhone(req.getPhone())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number already registered");
        }
        if (req.getEmail() != null && !req.getEmail().isBlank() && userRepo.existsByEmail(req.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }

        // Supabase Auth requires an email — generate synthetic one for phone-only users
        String supabaseEmail = (req.getEmail() != null && !req.getEmail().isBlank())
                ? req.getEmail()
                : req.getPhone() + "@parcela.internal";

        Map<String, Object> authUser = supabaseAuth.adminCreateUser(supabaseEmail, req.getPassword());
        String authUserIdStr = (String) authUser.get("id");
        if (authUserIdStr == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to create auth user");
        }

        String userId = "USR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        AppUser user = AppUser.builder()
                .userId(userId)
                .authUserId(UUID.fromString(authUserIdStr))
                .name(req.getName())
                .phone(req.getPhone())
                .email(req.getEmail() != null && !req.getEmail().isBlank() ? req.getEmail() : null)
                .role("user")
                .build();
        userRepo.save(user);

        Map<String, Object> tokenResp = supabaseAuth.signInWithPassword(supabaseEmail, req.getPassword());
        String token = (String) tokenResp.get("access_token");

        return new AuthResponse(token, UserDto.from(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        String identifier = req.getIdentifier();
        boolean isEmail = identifier.contains("@");

        AppUser user;
        if (isEmail) {
            user = userRepo.findByEmail(identifier)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        } else {
            user = userRepo.findByPhone(identifier)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
        }

        // Resolve Supabase email (synthetic for phone-only accounts)
        String supabaseEmail = (user.getEmail() != null) ? user.getEmail() : user.getPhone() + "@parcela.internal";

        Map<String, Object> tokenResp = supabaseAuth.signInWithPassword(supabaseEmail, req.getPassword());
        String token = (String) tokenResp.get("access_token");
        if (token == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        // Sync auth_user_id: the JWT sub must match what we have in DB for API calls to work.
        // This fixes accounts that were created manually or whose Supabase UUID changed.
        Object supabaseUserObj = tokenResp.get("user");
        if (supabaseUserObj instanceof Map<?, ?> supabaseUser) {
            Object idObj = supabaseUser.get("id");
            if (idObj instanceof String supabaseUuidStr && !supabaseUuidStr.isBlank()) {
                try {
                    UUID supabaseUuid = UUID.fromString(supabaseUuidStr);
                    if (!supabaseUuid.equals(user.getAuthUserId())) {
                        log.info("Syncing auth_user_id for {} → {}", user.getUserId(), supabaseUuid);
                        user.setAuthUserId(supabaseUuid);
                        userRepo.save(user);
                    }
                } catch (IllegalArgumentException e) {
                    log.warn("Could not parse Supabase UUID '{}': {}", idObj, e.getMessage());
                }
            }
        }

        return new AuthResponse(token, UserDto.from(user));
    }

    public UserDto getMe(Jwt jwt) {
        UUID authUserId = UUID.fromString(jwt.getSubject());
        Optional<AppUser> userOpt = userRepo.findByAuthUserId(authUserId);
        if (userOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                userOpt = userRepo.findByEmail(email);
                if (userOpt.isEmpty() && email.endsWith("@parcela.internal")) {
                    userOpt = userRepo.findByPhone(email.replace("@parcela.internal", ""));
                }
                userOpt.ifPresent(u -> {
                    log.info("getMe: syncing auth_user_id for {} → {}", u.getUserId(), authUserId);
                    u.setAuthUserId(authUserId);
                    userRepo.save(u);
                });
            }
        }
        return userOpt.map(UserDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public void logout(String bearerToken) {
        String token = bearerToken != null && bearerToken.startsWith("Bearer ")
                ? bearerToken.substring(7) : bearerToken;
        if (token != null) supabaseAuth.signOut(token);
    }

    @Transactional
    public AuthResponse googleCallback(GoogleCallbackRequest req) {
        // The frontend sends session_id from the Supabase OAuth redirect URL hash.
        // We exchange it for user info via Supabase Auth admin lookup.
        String sessionId = req.getSessionId();
        if (sessionId == null || sessionId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "session_id required");
        }

        // Treat session_id as the Supabase access_token (Supabase returns it in the URL hash)
        String sub = extractSubFromJwt(sessionId);
        UUID authUserId = UUID.fromString(sub);

        AppUser user = userRepo.findByAuthUserId(authUserId).orElseGet(() -> {
            // New Google user — get their info from the JWT claims
            String email = extractClaimFromJwt(sessionId, "email");
            String name = extractClaimFromJwt(sessionId, "name");
            if (name == null || name.isBlank()) name = email != null ? email.split("@")[0] : "User";
            String userId = "USR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            return userRepo.save(AppUser.builder()
                    .userId(userId)
                    .authUserId(authUserId)
                    .name(name)
                    .email(email)
                    .role("user")
                    .build());
        });

        return new AuthResponse(sessionId, UserDto.from(user));
    }

    private String extractSubFromJwt(String token) {
        return extractClaimFromJwt(token, "sub");
    }

    private String extractClaimFromJwt(String token, String claim) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            byte[] decoded = java.util.Base64.getUrlDecoder().decode(parts[1] + "==");
            String payload = new String(decoded);
            String key = "\"" + claim + "\"";
            int idx = payload.indexOf(key);
            if (idx < 0) return null;
            int colon = payload.indexOf(':', idx);
            // skip whitespace
            int valStart = colon + 1;
            while (valStart < payload.length() && payload.charAt(valStart) == ' ') valStart++;
            if (payload.charAt(valStart) == '"') {
                int start = valStart + 1;
                int end = payload.indexOf('"', start);
                return payload.substring(start, end);
            }
            return null;
        } catch (Exception e) {
            log.warn("JWT parse error for claim {}: {}", claim, e.getMessage());
            return null;
        }
    }
}
