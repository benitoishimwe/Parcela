package com.parcela.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "notification_id", unique = true, nullable = false)
    private String notificationId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String body;

    @Column(name = "parcel_id")
    private String parcelId;

    @Column(name = "tracking_code")
    private String trackingCode;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private Boolean read = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Notification() {}

    public UUID getId() { return id; }
    public String getNotificationId() { return notificationId; }
    public String getUserId() { return userId; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public String getParcelId() { return parcelId; }
    public String getTrackingCode() { return trackingCode; }
    public String getType() { return type; }
    public Boolean getRead() { return read; }
    public Instant getCreatedAt() { return createdAt; }

    public void setId(UUID id) { this.id = id; }
    public void setNotificationId(String notificationId) { this.notificationId = notificationId; }
    public void setUserId(String userId) { this.userId = userId; }
    public void setTitle(String title) { this.title = title; }
    public void setBody(String body) { this.body = body; }
    public void setParcelId(String parcelId) { this.parcelId = parcelId; }
    public void setTrackingCode(String trackingCode) { this.trackingCode = trackingCode; }
    public void setType(String type) { this.type = type; }
    public void setRead(Boolean read) { this.read = read; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private String notificationId;
        private String userId;
        private String title;
        private String body;
        private String parcelId;
        private String trackingCode;
        private String type;
        private Boolean read = false;
        private Instant createdAt = Instant.now();

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder notificationId(String notificationId) { this.notificationId = notificationId; return this; }
        public Builder userId(String userId) { this.userId = userId; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder body(String body) { this.body = body; return this; }
        public Builder parcelId(String parcelId) { this.parcelId = parcelId; return this; }
        public Builder trackingCode(String trackingCode) { this.trackingCode = trackingCode; return this; }
        public Builder type(String type) { this.type = type; return this; }
        public Builder read(Boolean read) { this.read = read; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public Notification build() {
            Notification n = new Notification();
            n.id = id; n.notificationId = notificationId; n.userId = userId;
            n.title = title; n.body = body; n.parcelId = parcelId;
            n.trackingCode = trackingCode; n.type = type; n.read = read;
            n.createdAt = createdAt;
            return n;
        }
    }
}
