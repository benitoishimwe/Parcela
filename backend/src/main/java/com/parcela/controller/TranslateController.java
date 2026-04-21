package com.parcela.controller;

import com.parcela.dto.request.TranslateRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@SuppressWarnings("null")
public class TranslateController {

    private static final Logger log = LoggerFactory.getLogger(TranslateController.class);

    private static final String ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
    private static final String ANTHROPIC_VERSION = "2023-06-01";
    private static final String MODEL = "claude-haiku-4-5-20251001";

    private final WebClient webClient;

    @Value("${app.anthropic.api-key:}")
    private String anthropicApiKey;

    public TranslateController(WebClient webClient) {
        this.webClient = webClient;
    }

    @PostMapping("/translate")
    public Map<String, String> translate(@Valid @RequestBody TranslateRequest req) {
        if (anthropicApiKey == null || anthropicApiKey.isBlank()) {
            // No API key configured — return original text (matches Python fallback)
            return Map.of("translated", req.getText());
        }

        try {
            Map<String, Object> body = Map.of(
                    "model", MODEL,
                    "max_tokens", 1024,
                    "system", "Translate to " + req.getTargetLang() + ". Return ONLY the translated text, nothing else.",
                    "messages", List.of(Map.of("role", "user", "content", req.getText()))
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> response = webClient.post()
                    .uri(ANTHROPIC_API_URL)
                    .header("x-api-key", anthropicApiKey)
                    .header("anthropic-version", ANTHROPIC_VERSION)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();

            if (response != null && response.get("content") instanceof List<?> content
                    && !content.isEmpty()
                    && content.get(0) instanceof Map<?, ?> first
                    && first.get("text") instanceof String text) {
                return Map.of("translated", text);
            }
        } catch (Exception e) {
            log.error("Translation error: {}", e.getMessage());
        }

        return Map.of("translated", req.getText());
    }
}
