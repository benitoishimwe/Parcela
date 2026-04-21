package com.parcela.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    private final WebClient webClient;

    @Value("${app.sms.api-key:}")
    private String apiKey;

    @Value("${app.sms.sender-id:Parcela}")
    private String senderId;

    @Value("${app.sms.enabled:false}")
    private boolean enabled;

    public SmsService(WebClient webClient) {
        this.webClient = webClient;
    }

    public void send(String phone, String message) {
        log.info("SMS to {}: {}", phone, message);
        if (!enabled || apiKey == null || apiKey.isBlank()) {
            log.info("SMS sending disabled — message logged above.");
            return;
        }
        try {
            // Africa's Talking SMS API
            webClient.post()
                    .uri("https://api.africastalking.com/version1/messaging")
                    .header("apiKey", apiKey)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .bodyValue("username=parcela&to=" + phone + "&message=" + message + "&from=" + senderId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("SMS send failed (non-critical): {}", e.getMessage());
        }
    }
}
