package com.parcela.dto.response;

import com.parcela.model.CourierTask;
import java.time.Instant;
import java.util.List;

public class CourierTaskDto {
    private String taskId;
    private String courierId;
    private String type;
    private String lockerId;
    private String lockerName;
    private List<String> parcelIds;
    private Integer parcelCount;
    private String status;
    private Instant completedAt;
    private Instant createdAt;

    public CourierTaskDto() {}

    public String getTaskId() { return taskId; }
    public String getCourierId() { return courierId; }
    public String getType() { return type; }
    public String getLockerId() { return lockerId; }
    public String getLockerName() { return lockerName; }
    public List<String> getParcelIds() { return parcelIds; }
    public Integer getParcelCount() { return parcelCount; }
    public String getStatus() { return status; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void setTaskId(String taskId) { this.taskId = taskId; }
    public void setCourierId(String courierId) { this.courierId = courierId; }
    public void setType(String type) { this.type = type; }
    public void setLockerId(String lockerId) { this.lockerId = lockerId; }
    public void setLockerName(String lockerName) { this.lockerName = lockerName; }
    public void setParcelIds(List<String> parcelIds) { this.parcelIds = parcelIds; }
    public void setParcelCount(Integer parcelCount) { this.parcelCount = parcelCount; }
    public void setStatus(String status) { this.status = status; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static CourierTaskDto from(CourierTask t) {
        CourierTaskDto dto = new CourierTaskDto();
        dto.taskId = t.getTaskId();
        dto.courierId = t.getCourierId();
        dto.type = t.getType();
        dto.lockerId = t.getLockerId();
        dto.lockerName = t.getLockerName();
        dto.parcelIds = t.getParcelIds();
        dto.parcelCount = t.getParcelCount();
        dto.status = t.getStatus();
        dto.completedAt = t.getCompletedAt();
        dto.createdAt = t.getCreatedAt();
        return dto;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final CourierTaskDto dto = new CourierTaskDto();
        public Builder taskId(String v) { dto.taskId = v; return this; }
        public Builder courierId(String v) { dto.courierId = v; return this; }
        public Builder type(String v) { dto.type = v; return this; }
        public Builder lockerId(String v) { dto.lockerId = v; return this; }
        public Builder lockerName(String v) { dto.lockerName = v; return this; }
        public Builder parcelIds(List<String> v) { dto.parcelIds = v; return this; }
        public Builder parcelCount(Integer v) { dto.parcelCount = v; return this; }
        public Builder status(String v) { dto.status = v; return this; }
        public Builder completedAt(Instant v) { dto.completedAt = v; return this; }
        public Builder createdAt(Instant v) { dto.createdAt = v; return this; }
        public CourierTaskDto build() { return dto; }
    }
}
