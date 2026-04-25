package com.parcela.dto.request;

import jakarta.validation.constraints.NotBlank;

public class ParcelCreateRequest {
    @NotBlank private String senderName;
    @NotBlank private String senderPhone;
    @NotBlank private String recipientName;
    @NotBlank private String recipientPhone;
    private String recipientEmail;
    @NotBlank private String originLockerId;
    @NotBlank private String destinationLockerId;
    @NotBlank private String size;
    private String paymentMethod = "mobile_money";
    private String deliveryMode = "basic";
    private String clientNotes;

    public String getSenderName() { return senderName; }
    public String getSenderPhone() { return senderPhone; }
    public String getRecipientName() { return recipientName; }
    public String getRecipientPhone() { return recipientPhone; }
    public String getRecipientEmail() { return recipientEmail; }
    public String getOriginLockerId() { return originLockerId; }
    public String getDestinationLockerId() { return destinationLockerId; }
    public String getSize() { return size; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getDeliveryMode() { return deliveryMode; }
    public String getClientNotes() { return clientNotes; }

    public void setSenderName(String senderName) { this.senderName = senderName; }
    public void setSenderPhone(String senderPhone) { this.senderPhone = senderPhone; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    public void setRecipientPhone(String recipientPhone) { this.recipientPhone = recipientPhone; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public void setOriginLockerId(String originLockerId) { this.originLockerId = originLockerId; }
    public void setDestinationLockerId(String destinationLockerId) { this.destinationLockerId = destinationLockerId; }
    public void setSize(String size) { this.size = size; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public void setDeliveryMode(String deliveryMode) { this.deliveryMode = deliveryMode; }
    public void setClientNotes(String clientNotes) { this.clientNotes = clientNotes; }
}
