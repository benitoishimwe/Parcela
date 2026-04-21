package com.parcela.dto.response;

import com.parcela.model.Notification;
import java.time.Instant;

public class NotificationDto {
    private String notificationId;
    private String userId;
    private String title;
    private String body;
    private String parcelId;
    private String trackingCode;
    private String type;
    private Boolean read;
    private Instant createdAt;

    public NotificationDto() {}

    public String getNotificationId() { return notificationId; }
    public String getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getParcelId() { return parcelId; }
    public String getTrackingCode() { return trackingCode; }
    public String getType() { return type; }
    public Boolean getRead() { return read; }
    public Instant getCreatedAt() { return createdAt; }

    public void setNotificationId(String notificationId) { this.notificationId = notificationId; }
    public void setUserId(String userId) { this.userId = userId; }
    public void setTitle(String title) { this.title = title; }
    public void setBody(String body) { this.body = body; }
    public void setParcelId(String parcelId) { this.parcelId = parcelId; }
    public void setTrackingCode(String trackingCode) { this.trackingCode = trackingCode; }
    public void setType(String type) { this.type = type; }
    public void setRead(Boolean read) { this.read = read; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static NotificationDto from(Notification n) {
        NotificationDto dto = new NotificationDto();
        dto.notificationId = n.getNotificationId();
        dto.userId = n.getUserId();
        dto.title = n.getTitle();
        dto.body = n.getBody();
        dto.parcelId = n.getParcelId();
        dto.trackingCode = n.getTrackingCode();
        dto.type = n.getType();
        dto.read = n.getRead();
        dto.createdAt = n.getCreatedAt();
        return dto;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final NotificationDto dto = new NotificationDto();
        public Builder notificationId(String v) { dto.notificationId = v; return this; }
        public Builder userId(String v) { dto.userId = v; return this; }
        public Builder title(String v) { dto.title = v; return this; }
        public Builder body(String v) { dto.body = v; return this; }
        public Builder parcelId(String v) { dto.parcelId = v; return this; }
        public Builder trackingCode(String v) { dto.trackingCode = v; return this; }
        public Builder type(String v) { dto.type = v; return this; }
        public Builder read(Boolean v) { dto.read = v; return this; }
        public Builder createdAt(Instant v) { dto.createdAt = v; return this; }
        public NotificationDto build() { return dto; }
    }
}
