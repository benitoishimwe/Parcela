package com.parcela.dto.response;

public class AdminStatsDto {
    private long totalLockers;
    private long activeLockers;
    private long totalUsers;
    private long totalCouriers;
    private long totalParcels;
    private long inTransit;
    private long readyForPickup;
    private long delivered;

    public AdminStatsDto() {}

    public long getTotalLockers() { return totalLockers; }
    public long getActiveLockers() { return activeLockers; }
    public long getTotalUsers() { return totalUsers; }
    public long getTotalCouriers() { return totalCouriers; }
    public long getTotalParcels() { return totalParcels; }
    public long getInTransit() { return inTransit; }
    public long getReadyForPickup() { return readyForPickup; }
    public long getDelivered() { return delivered; }

    public void setTotalLockers(long totalLockers) { this.totalLockers = totalLockers; }
    public void setActiveLockers(long activeLockers) { this.activeLockers = activeLockers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }
    public void setTotalCouriers(long totalCouriers) { this.totalCouriers = totalCouriers; }
    public void setTotalParcels(long totalParcels) { this.totalParcels = totalParcels; }
    public void setInTransit(long inTransit) { this.inTransit = inTransit; }
    public void setReadyForPickup(long readyForPickup) { this.readyForPickup = readyForPickup; }
    public void setDelivered(long delivered) { this.delivered = delivered; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final AdminStatsDto dto = new AdminStatsDto();
        public Builder totalLockers(long v) { dto.totalLockers = v; return this; }
        public Builder activeLockers(long v) { dto.activeLockers = v; return this; }
        public Builder totalUsers(long v) { dto.totalUsers = v; return this; }
        public Builder totalCouriers(long v) { dto.totalCouriers = v; return this; }
        public Builder totalParcels(long v) { dto.totalParcels = v; return this; }
        public Builder inTransit(long v) { dto.inTransit = v; return this; }
        public Builder readyForPickup(long v) { dto.readyForPickup = v; return this; }
        public Builder delivered(long v) { dto.delivered = v; return this; }
        public AdminStatsDto build() { return dto; }
    }
}
