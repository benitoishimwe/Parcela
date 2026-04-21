package com.parcela.dto.response;

import com.parcela.model.Locker;
import java.time.Instant;

public class LockerDto {
    private String lockerId;
    private String name;
    private String address;
    private String district;
    private Double lat;
    private Double lng;
    private Integer totalSmall;
    private Integer totalMedium;
    private Integer totalLarge;
    private Integer availableSmall;
    private Integer availableMedium;
    private Integer availableLarge;
    private String status;
    private Instant createdAt;

    public LockerDto() {}

    public String getLockerId() { return lockerId; }
    public String getName() { return name; }
    public String getAddress() { return address; }
    public String getDistrict() { return district; }
    public Double getLat() { return lat; }
    public Double getLng() { return lng; }
    public Integer getTotalSmall() { return totalSmall; }
    public Integer getTotalMedium() { return totalMedium; }
    public Integer getTotalLarge() { return totalLarge; }
    public Integer getAvailableSmall() { return availableSmall; }
    public Integer getAvailableMedium() { return availableMedium; }
    public Integer getAvailableLarge() { return availableLarge; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }

    public void setLockerId(String lockerId) { this.lockerId = lockerId; }
    public void setName(String name) { this.name = name; }
    public void setAddress(String address) { this.address = address; }
    public void setDistrict(String district) { this.district = district; }
    public void setLat(Double lat) { this.lat = lat; }
    public void setLng(Double lng) { this.lng = lng; }
    public void setTotalSmall(Integer totalSmall) { this.totalSmall = totalSmall; }
    public void setTotalMedium(Integer totalMedium) { this.totalMedium = totalMedium; }
    public void setTotalLarge(Integer totalLarge) { this.totalLarge = totalLarge; }
    public void setAvailableSmall(Integer availableSmall) { this.availableSmall = availableSmall; }
    public void setAvailableMedium(Integer availableMedium) { this.availableMedium = availableMedium; }
    public void setAvailableLarge(Integer availableLarge) { this.availableLarge = availableLarge; }
    public void setStatus(String status) { this.status = status; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static LockerDto from(Locker l) {
        LockerDto dto = new LockerDto();
        dto.lockerId = l.getLockerId();
        dto.name = l.getName();
        dto.address = l.getAddress();
        dto.district = l.getDistrict();
        dto.lat = l.getLat();
        dto.lng = l.getLng();
        dto.totalSmall = l.getTotalSmall();
        dto.totalMedium = l.getTotalMedium();
        dto.totalLarge = l.getTotalLarge();
        dto.availableSmall = l.getAvailableSmall();
        dto.availableMedium = l.getAvailableMedium();
        dto.availableLarge = l.getAvailableLarge();
        dto.status = l.getStatus();
        dto.createdAt = l.getCreatedAt();
        return dto;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final LockerDto dto = new LockerDto();
        public Builder lockerId(String v) { dto.lockerId = v; return this; }
        public Builder name(String v) { dto.name = v; return this; }
        public Builder address(String v) { dto.address = v; return this; }
        public Builder district(String v) { dto.district = v; return this; }
        public Builder lat(Double v) { dto.lat = v; return this; }
        public Builder lng(Double v) { dto.lng = v; return this; }
        public Builder totalSmall(Integer v) { dto.totalSmall = v; return this; }
        public Builder totalMedium(Integer v) { dto.totalMedium = v; return this; }
        public Builder totalLarge(Integer v) { dto.totalLarge = v; return this; }
        public Builder availableSmall(Integer v) { dto.availableSmall = v; return this; }
        public Builder availableMedium(Integer v) { dto.availableMedium = v; return this; }
        public Builder availableLarge(Integer v) { dto.availableLarge = v; return this; }
        public Builder status(String v) { dto.status = v; return this; }
        public Builder createdAt(Instant v) { dto.createdAt = v; return this; }
        public LockerDto build() { return dto; }
    }
}
