package com.parcela.dto.request;

public class ProcessPaymentRequest {
    private String paymentMethod = "mobile_money";
    private String phoneNumber;

    public String getPaymentMethod() { return paymentMethod; }
    public String getPhoneNumber() { return phoneNumber; }

    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
}
