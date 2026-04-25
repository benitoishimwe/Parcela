package com.parcela.dto.request;

public class LockerUpdateRequest {
    private String name;
    private String address;
    private String district;
    private Double lat;
    private Double lng;
    private String status;
    private Integer availableSmall;
    private Integer availableMedium;
    private Integer availableLarge;

    public String getName() { return name; }
    public String getAddress() { return address; }
    public String getDistrict() { return district; }
    public Double getLat() { return lat; }
    public Double getLng() { return lng; }
    public String getStatus() { return status; }
    public Integer getAvailableSmall() { return availableSmall; }
    public Integer getAvailableMedium() { return availableMedium; }
    public Integer getAvailableLarge() { return availableLarge; }

    public void setName(String name) { this.name = name; }
    public void setAddress(String address) { this.address = address; }
    public void setDistrict(String district) { this.district = district; }
    public void setLat(Double lat) { this.lat = lat; }
    public void setLng(Double lng) { this.lng = lng; }
    public void setStatus(String status) { this.status = status; }
    public void setAvailableSmall(Integer availableSmall) { this.availableSmall = availableSmall; }
    public void setAvailableMedium(Integer availableMedium) { this.availableMedium = availableMedium; }
    public void setAvailableLarge(Integer availableLarge) { this.availableLarge = availableLarge; }
}
