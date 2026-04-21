package com.parcela.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "parcels")
public class Parcel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "parcel_id", unique = true, nullable = false)
    private String parcelId;

    @Column(name = "tracking_code", unique = true, nullable = false)
    private String trackingCode;

    @Column(name = "sender_id", nullable = false)
    private String senderId;

    @Column(name = "sender_name", nullable = false)
    private String senderName;

    @Column(name = "sender_phone", nullable = false)
    private String senderPhone;

    @Column(name = "recipient_name", nullable = false)
    private String recipientName;

    @Column(name = "recipient_phone", nullable = false)
    private String recipientPhone;

    @Column(name = "recipient_email")
    private String recipientEmail;

    @Column(name = "origin_locker_id", nullable = false)
    private String originLockerId;

    @Column(name = "destination_locker_id", nullable = false)
    private String destinationLockerId;

    @Column(name = "origin_locker_name", nullable = false)
    private String originLockerName;

    @Column(name = "destination_locker_name", nullable = false)
    private String destinationLockerName;

    @Column(nullable = false)
    private String size;

    @Column(nullable = false)
    private String status = "awaiting_payment";

    @Column(name = "qr_code", nullable = false)
    private String qrCode;

    @Column(name = "qr_data", nullable = false)
    private String qrData;

    @Column(name = "payment_status", nullable = false)
    private String paymentStatus = "pending";

    @Column(name = "payment_method", nullable = false)
    private String paymentMethod = "mobile_money";

    @Column(name = "delivery_mode", nullable = false)
    private String deliveryMode = "basic";

    @Column(name = "client_notes")
    private String clientNotes;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "mtn_ref_id")
    private String mtnRefId;

    @Column(name = "status_history", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<Map<String, Object>> statusHistory = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Parcel() {}

    public UUID getId() { return id; }
    public String getParcelId() { return parcelId; }
    public String getTrackingCode() { return trackingCode; }
    public String getSenderId() { return senderId; }
    public String getSenderName() { return senderName; }
    public String getSenderPhone() { return senderPhone; }
    public String getRecipientName() { return recipientName; }
    public String getRecipientPhone() { return recipientPhone; }
    public String getRecipientEmail() { return recipientEmail; }
    public String getOriginLockerId() { return originLockerId; }
    public String getDestinationLockerId() { return destinationLockerId; }
    public String getOriginLockerName() { return originLockerName; }
    public String getDestinationLockerName() { return destinationLockerName; }
    public String getSize() { return size; }
    public String getStatus() { return status; }
    public String getQrCode() { return qrCode; }
    public String getQrData() { return qrData; }
    public String getPaymentStatus() { return paymentStatus; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getDeliveryMode() { return deliveryMode; }
    public String getClientNotes() { return clientNotes; }
    public BigDecimal getPrice() { return price; }
    public String getMtnRefId() { return mtnRefId; }
    public List<Map<String, Object>> getStatusHistory() { return statusHistory; }
    public Instant getCreatedAt() { return createdAt; }

    public void setId(UUID id) { this.id = id; }
    public void setParcelId(String parcelId) { this.parcelId = parcelId; }
    public void setTrackingCode(String trackingCode) { this.trackingCode = trackingCode; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public void setSenderName(String senderName) { this.senderName = senderName; }
    public void setSenderPhone(String senderPhone) { this.senderPhone = senderPhone; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public void setOriginLockerId(String originLockerId) { this.originLockerId = originLockerId; }
    public void setDestinationLockerId(String destinationLockerId) { this.destinationLockerId = destinationLockerId; }
    public void setOriginLockerName(String originLockerName) { this.originLockerName = originLockerName; }
    public void setDestinationLockerName(String destinationLockerName) { this.destinationLockerName = destinationLockerName; }
    public void setSize(String size) { this.size = size; }
    public void setStatus(String status) { this.status = status; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }
    public void setQrData(String qrData) { this.qrData = qrData; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public void setDeliveryMode(String deliveryMode) { this.deliveryMode = deliveryMode; }
    public void setClientNotes(String clientNotes) { this.clientNotes = clientNotes; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public void setMtnRefId(String mtnRefId) { this.mtnRefId = mtnRefId; }
    public void setStatusHistory(List<Map<String, Object>> statusHistory) { this.statusHistory = statusHistory; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private String parcelId;
        private String trackingCode;
        private String senderId;
        private String senderName;
        private String senderPhone;
        private String recipientName;
        private String recipientPhone;
        private String recipientEmail;
        private String originLockerId;
        private String destinationLockerId;
        private String originLockerName;
        private String destinationLockerName;
        private String size;
        private String status = "awaiting_payment";
        private String qrCode;
        private String qrData;
        private String paymentStatus = "pending";
        private String paymentMethod = "mobile_money";
        private String deliveryMode = "basic";
        private String clientNotes;
        private BigDecimal price;
        private String mtnRefId;
        private List<Map<String, Object>> statusHistory = new ArrayList<>();
        private Instant createdAt = Instant.now();

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder parcelId(String parcelId) { this.parcelId = parcelId; return this; }
        public Builder trackingCode(String trackingCode) { this.trackingCode = trackingCode; return this; }
        public Builder senderId(String senderId) { this.senderId = senderId; return this; }
        public Builder senderName(String senderName) { this.senderName = senderName; return this; }
        public Builder senderPhone(String senderPhone) { this.senderPhone = senderPhone; return this; }
        public Builder recipientName(String recipientName) { this.recipientName = recipientName; return this; }
        public Builder recipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; return this; }
        public Builder recipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; return this; }
        public Builder originLockerId(String originLockerId) { this.originLockerId = originLockerId; return this; }
        public Builder destinationLockerId(String destinationLockerId) { this.destinationLockerId = destinationLockerId; return this; }
        public Builder originLockerName(String originLockerName) { this.originLockerName = originLockerName; return this; }
        public Builder destinationLockerName(String destinationLockerName) { this.destinationLockerName = destinationLockerName; return this; }
        public Builder size(String size) { this.size = size; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder qrCode(String qrCode) { this.qrCode = qrCode; return this; }
        public Builder qrData(String qrData) { this.qrData = qrData; return this; }
        public Builder paymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; return this; }
        public Builder paymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; return this; }
        public Builder deliveryMode(String deliveryMode) { this.deliveryMode = deliveryMode; return this; }
        public Builder clientNotes(String clientNotes) { this.clientNotes = clientNotes; return this; }
        public Builder price(BigDecimal price) { this.price = price; return this; }
        public Builder mtnRefId(String mtnRefId) { this.mtnRefId = mtnRefId; return this; }
        public Builder statusHistory(List<Map<String, Object>> statusHistory) { this.statusHistory = statusHistory; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public Parcel build() {
            Parcel p = new Parcel();
            p.id = id; p.parcelId = parcelId; p.trackingCode = trackingCode;
            p.senderId = senderId; p.senderName = senderName; p.senderPhone = senderPhone;
            p.recipientName = recipientName; p.recipientPhone = recipientPhone; p.recipientEmail = recipientEmail;
            p.originLockerId = originLockerId; p.destinationLockerId = destinationLockerId;
            p.originLockerName = originLockerName; p.destinationLockerName = destinationLockerName;
            p.size = size; p.status = status; p.qrCode = qrCode; p.qrData = qrData;
            p.paymentStatus = paymentStatus; p.paymentMethod = paymentMethod;
            p.deliveryMode = deliveryMode; p.clientNotes = clientNotes;
            p.price = price; p.mtnRefId = mtnRefId;
            p.statusHistory = statusHistory; p.createdAt = createdAt;
            return p;
        }
    }
}
