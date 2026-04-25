package com.parcela.dto.response;

import com.parcela.model.Parcel;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class ParcelDto {
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
    private String status;
    private String qrCode;
    private String qrData;
    private String paymentStatus;
    private String paymentMethod;
    private String deliveryMode;
    private String clientNotes;
    private BigDecimal price;
    private List<Map<String, Object>> statusHistory;
    private Instant createdAt;

    public ParcelDto() {}

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
    public List<Map<String, Object>> getStatusHistory() { return statusHistory; }
    public Instant getCreatedAt() { return createdAt; }

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
    public void setStatusHistory(List<Map<String, Object>> statusHistory) { this.statusHistory = statusHistory; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static ParcelDto from(Parcel p) {
        ParcelDto dto = new ParcelDto();
        dto.parcelId = p.getParcelId();
        dto.trackingCode = p.getTrackingCode();
        dto.senderId = p.getSenderId();
        dto.senderName = p.getSenderName();
        dto.senderPhone = p.getSenderPhone();
        dto.recipientName = p.getRecipientName();
        dto.recipientPhone = p.getRecipientPhone();
        dto.recipientEmail = p.getRecipientEmail();
        dto.originLockerId = p.getOriginLockerId();
        dto.destinationLockerId = p.getDestinationLockerId();
        dto.originLockerName = p.getOriginLockerName();
        dto.destinationLockerName = p.getDestinationLockerName();
        dto.size = p.getSize();
        dto.status = p.getStatus();
        dto.qrCode = p.getQrCode();
        dto.qrData = p.getQrData();
        dto.paymentStatus = p.getPaymentStatus();
        dto.paymentMethod = p.getPaymentMethod();
        dto.deliveryMode = p.getDeliveryMode();
        dto.clientNotes = p.getClientNotes();
        dto.price = p.getPrice();
        dto.statusHistory = p.getStatusHistory();
        dto.createdAt = p.getCreatedAt();
        return dto;
    }

    public static ParcelDto fromPublic(Parcel p) {
        ParcelDto dto = from(p);
        dto.setQrData(null);
        return dto;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final ParcelDto dto = new ParcelDto();
        public Builder parcelId(String v) { dto.parcelId = v; return this; }
        public Builder trackingCode(String v) { dto.trackingCode = v; return this; }
        public Builder senderId(String v) { dto.senderId = v; return this; }
        public Builder senderName(String v) { dto.senderName = v; return this; }
        public Builder senderPhone(String v) { dto.senderPhone = v; return this; }
        public Builder recipientName(String v) { dto.recipientName = v; return this; }
        public Builder recipientPhone(String v) { dto.recipientPhone = v; return this; }
        public Builder recipientEmail(String v) { dto.recipientEmail = v; return this; }
        public Builder originLockerId(String v) { dto.originLockerId = v; return this; }
        public Builder destinationLockerId(String v) { dto.destinationLockerId = v; return this; }
        public Builder originLockerName(String v) { dto.originLockerName = v; return this; }
        public Builder destinationLockerName(String v) { dto.destinationLockerName = v; return this; }
        public Builder size(String v) { dto.size = v; return this; }
        public Builder status(String v) { dto.status = v; return this; }
        public Builder qrCode(String v) { dto.qrCode = v; return this; }
        public Builder qrData(String v) { dto.qrData = v; return this; }
        public Builder paymentStatus(String v) { dto.paymentStatus = v; return this; }
        public Builder paymentMethod(String v) { dto.paymentMethod = v; return this; }
        public Builder deliveryMode(String v) { dto.deliveryMode = v; return this; }
        public Builder clientNotes(String v) { dto.clientNotes = v; return this; }
        public Builder price(BigDecimal v) { dto.price = v; return this; }
        public Builder statusHistory(List<Map<String, Object>> v) { dto.statusHistory = v; return this; }
        public Builder createdAt(Instant v) { dto.createdAt = v; return this; }
        public ParcelDto build() { return dto; }
    }
}
