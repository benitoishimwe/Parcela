package com.parcela.dto.request;

import jakarta.validation.constraints.NotBlank;

public class StatusUpdateRequest {
    @NotBlank private String status;
    private String note;

    public String getStatus() { return status; }
    public String getNote() { return note; }

    public void setStatus(String status) { this.status = status; }
    public void setNote(String note) { this.note = note; }
}
