package com.parcela.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
@SuppressWarnings("null")
public class SupabaseAuthClient {

    private static final Logger log = LoggerFactory.getLogger(SupabaseAuthClient.class);

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final WebClient webClient;

    public SupabaseAuthClient(WebClient webClient) {
        this.webClient = webClient;
    }

    @Value("${app.supabase.url}")
    private String supabaseUrl;

    @Value("${app.supabase.service-key}")
    private String serviceKey;

    /** Create a user in Supabase Auth using the Admin API (service role). Returns auth user map. */
    public Map<String, Object> adminCreateUser(String email, String password) {
        try {
            Map<String, Object> body = Map.of(
                    "email", email,
                    "password", password,
                    "email_confirm", true
            );
            Map<String, Object> response = webClient.post()
                    .uri(supabaseUrl + "/auth/v1/admin/users")
                    .header("apikey", serviceKey)
                    .header("Authorization", "Bearer " + serviceKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block();
            if (response == null) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No response from Supabase Auth");
            return response;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Supabase adminCreateUser error: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to create auth user: " + e.getMessage());
        }
    }

    /** Sign in via email + password. Returns access_token and user data. */
    public Map<String, Object> signInWithPassword(String email, String password) {
        try {
            Map<String, Object> body = Map.of("email", email, "password", password);
            Map<String, Object> response = webClient.post()
                    .uri(supabaseUrl + "/auth/v1/token?grant_type=password")
                    .header("apikey", serviceKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block();
            if (response == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No response from Supabase Auth");
            return response;
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Supabase signIn error: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }
    }

    /** Sign out a user by their access token. */
    public void signOut(String accessToken) {
        try {
            webClient.post()
                    .uri(supabaseUrl + "/auth/v1/logout")
                    .header("apikey", serviceKey)
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
        } catch (Exception e) {
            log.warn("Supabase signOut error (ignored): {}", e.getMessage());
        }
    }

    /**
     * List all users from Supabase Auth (admin API).
     * Returns the raw "users" list from the first page (up to 1000).
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> adminListUsers() {
        try {
            Map<String, Object> response = webClient.get()
                    .uri(supabaseUrl + "/auth/v1/admin/users?per_page=1000&page=1")
                    .header("apikey", serviceKey)
                    .header("Authorization", "Bearer " + serviceKey)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block();
            if (response != null && response.get("users") instanceof List<?> list) {
                return (List<Map<String, Object>>) list;
            }
        } catch (Exception e) {
            log.warn("adminListUsers error: {}", e.getMessage());
        }
        return List.of();
    }

    /**
     * Update a Supabase user's password (and optionally email_confirm) by their Supabase UUID.
     */
    public void adminUpdateUserPassword(String supabaseUserId, String newPassword) {
        try {
            Map<String, Object> body = Map.of("password", newPassword, "email_confirm", true);
            webClient.put()
                    .uri(supabaseUrl + "/auth/v1/admin/users/" + supabaseUserId)
                    .header("apikey", serviceKey)
                    .header("Authorization", "Bearer " + serviceKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block();
            log.info("Updated password for Supabase user {}", supabaseUserId);
        } catch (Exception e) {
            log.warn("adminUpdateUserPassword error for {}: {}", supabaseUserId, e.getMessage());
        }
    }

    /** Delete a user from Supabase Auth by their UUID (admin only). */
    public void adminDeleteUser(String authUserId) {
        try {
            webClient.delete()
                    .uri(supabaseUrl + "/auth/v1/admin/users/" + authUserId)
                    .header("apikey", serviceKey)
                    .header("Authorization", "Bearer " + serviceKey)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();
        } catch (Exception e) {
            log.warn("Supabase adminDeleteUser error (ignored): {}", e.getMessage());
        }
    }
}
