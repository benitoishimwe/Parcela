package com.parcela.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public class TranslateRequest {

    @NotBlank
    private String text;

    @JsonProperty("target_lang")
    @NotBlank
    private String targetLang;

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getTargetLang() { return targetLang; }
    public void setTargetLang(String targetLang) { this.targetLang = targetLang; }
}
