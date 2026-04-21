package com.parcela.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "lockers")
public class Locker {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "locker_id", unique = true, nullable = false)
    private String lockerId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String address;

    @Column(nullable = false)
    private String district;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    @Column(name = "total_small", nullable = false)
    private Integer totalSmall = 10;

    @Column(name = "total_medium", nullable = false)
    private Integer totalMedium = 8;

    @Column(name = "total_large", nullable = false)
    private Integer totalLarge = 4;

    @Column(name = "available_small", nullable = false)
    private Integer availableSmall = 10;

    @Column(name = "available_medium", nullable = false)
    private Integer availableMedium = 8;

    @Column(name = "available_large", nullable = false)
    private Integer availableLarge = 4;

    @Column(nullable = false)
    private String status = "active";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Locker() {}

    public UUID getId() { return id; }
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

    public void setId(UUID id) { this.id = id; }
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

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private String lockerId;
        private String name;
        private String address;
        private String district;
        private Double lat;
        private Double lng;
        private Integer totalSmall = 10;
        private Integer totalMedium = 8;
        private Integer totalLarge = 4;
        private Integer availableSmall = 10;
        private Integer availableMedium = 8;
        private Integer availableLarge = 4;
        private String status = "active";
        private Instant createdAt = Instant.now();

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder lockerId(String lockerId) { this.lockerId = lockerId; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder address(String address) { this.address = address; return this; }
        public Builder district(String district) { this.district = district; return this; }
        public Builder lat(Double lat) { this.lat = lat; return this; }
        public Builder lng(Double lng) { this.lng = lng; return this; }
        public Builder totalSmall(Integer totalSmall) { this.totalSmall = totalSmall; return this; }
        public Builder totalMedium(Integer totalMedium) { this.totalMedium = totalMedium; return this; }
        public Builder totalLarge(Integer totalLarge) { this.totalLarge = totalLarge; return this; }
        public Builder availableSmall(Integer availableSmall) { this.availableSmall = availableSmall; return this; }
        public Builder availableMedium(Integer availableMedium) { this.availableMedium = availableMedium; return this; }
        public Builder availableLarge(Integer availableLarge) { this.availableLarge = availableLarge; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public Locker build() {
            Locker l = new Locker();
            l.id = id; l.lockerId = lockerId; l.name = name;
            l.address = address; l.district = district;
            l.lat = lat; l.lng = lng;
            l.totalSmall = totalSmall; l.totalMedium = totalMedium; l.totalLarge = totalLarge;
            l.availableSmall = availableSmall; l.availableMedium = availableMedium; l.availableLarge = availableLarge;
            l.status = status; l.createdAt = createdAt;
            return l;
        }
    }
}
