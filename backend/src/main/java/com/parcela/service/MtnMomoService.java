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

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@Service
@SuppressWarnings("null")
public class MtnMomoService {

    private static final Logger log = LoggerFactory.getLogger(MtnMomoService.class);

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final WebClient webClient;

    @Value("${app.mtn.base-url:https://sandbox.momodeveloper.mtn.com}")
    private String baseUrl;

    @Value("${app.mtn.subscription-key:}")
    private String subscriptionKey;

    @Value("${app.mtn.api-user:}")
    private String apiUser;

    @Value("${app.mtn.api-key:}")
    private String apiKey;

    @Value("${app.mtn.target-environment:sandbox}")
    private String targetEnvironment;

    @Value("${app.mtn.enabled:false}")
    private boolean enabled;

    public MtnMomoService(WebClient webClient) {
        this.webClient = webClient;
    }

    /**
     * Initiate a MoMo payment request. Returns the externalId (referenceId) to track status.
     * In sandbox/disabled mode, returns a fake UUID immediately.
     */
    public String requestPayment(String phone, BigDecimal amount, String parcelId) {
        String externalId = UUID.randomUUID().toString();

        if (!enabled || subscriptionKey.isBlank()) {
            log.info("MTN MoMo disabled — simulating payment request for {} RWF from {}", amount, phone);
            return externalId;
        }

        try {
            String token = getAccessToken();
            String normalizedPhone = normalizePhone(phone);

            Map<String, Object> body = Map.of(
                    "amount", amount.toPlainString(),
                    "currency", "RWF",
                    "externalId", externalId,
                    "payer", Map.of("partyIdType", "MSISDN", "partyId", normalizedPhone),
                    "payerMessage", "Parcela delivery payment for " + parcelId,
                    "payeeNote", "Parcela: " + parcelId
            );

            webClient.post()
                    .uri(baseUrl + "/collection/v1_0/requesttopay")
                    .header("Authorization", "Bearer " + token)
                    .header("X-Reference-Id", externalId)
                    .header("X-Target-Environment", targetEnvironment)
                    .header("Ocp-Apim-Subscription-Key", subscriptionKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Void.class)
                    .block();

            log.info("MTN MoMo payment request sent: {}", externalId);
        } catch (Exception e) {
            log.warn("MTN MoMo request failed (using simulated): {}", e.getMessage());
        }
        return externalId;
    }

    /**
     * Check the status of a payment. Returns "SUCCESSFUL", "FAILED", or "PENDING".
     */
    public String checkPaymentStatus(String referenceId) {
        if (!enabled || subscriptionKey.isBlank()) {
            log.info("MTN MoMo disabled — simulating SUCCESSFUL for {}", referenceId);
            return "SUCCESSFUL";
        }

        try {
            String token = getAccessToken();
            Map<String, Object> result = webClient.get()
                    .uri(baseUrl + "/collection/v1_0/requesttopay/" + referenceId)
                    .header("Authorization", "Bearer " + token)
                    .header("X-Target-Environment", targetEnvironment)
                    .header("Ocp-Apim-Subscription-Key", subscriptionKey)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block();

            if (result == null) return "PENDING";
            String status = (String) result.get("status");
            return status != null ? status : "PENDING";
        } catch (Exception e) {
            log.warn("MTN MoMo status check failed: {}", e.getMessage());
            return "PENDING";
        }
    }

    private String getAccessToken() {
        String credentials = Base64.getEncoder().encodeToString(
                (apiUser + ":" + apiKey).getBytes(StandardCharsets.UTF_8));
        Map<String, Object> result = webClient.post()
                .uri(baseUrl + "/collection/token/")
                .header("Authorization", "Basic " + credentials)
                .header("Ocp-Apim-Subscription-Key", subscriptionKey)
                .retrieve()
                .bodyToMono(MAP_TYPE)
                .block();
        if (result == null || result.get("access_token") == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "MTN MoMo auth failed");
        }
        return (String) result.get("access_token");
    }

    /** Normalize Rwandan phone: 078XXXXXXX → 25078XXXXXXX */
    private String normalizePhone(String phone) {
        if (phone.startsWith("+")) return phone.substring(1);
        if (phone.startsWith("07") || phone.startsWith("25")) return phone.startsWith("07") ? "250" + phone : phone;
        return phone;
    }
}
