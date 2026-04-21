package com.parcela.controller;

import com.parcela.dto.request.GoogleCallbackRequest;
import com.parcela.dto.request.LoginRequest;
import com.parcela.dto.request.SignupRequest;
import com.parcela.dto.response.AuthResponse;
import com.parcela.dto.response.UserDto;
import com.parcela.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(req));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(authService.login(req));
    }

    @PostMapping("/google/callback")
    public ResponseEntity<AuthResponse> googleCallback(@Valid @RequestBody GoogleCallbackRequest req) {
        return ResponseEntity.ok(authService.googleCallback(req));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(authService.getMe(jwt));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        authService.logout(authorization);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}
