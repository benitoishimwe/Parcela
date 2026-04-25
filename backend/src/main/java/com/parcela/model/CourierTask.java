package com.parcela.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "courier_tasks")
public class CourierTask {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", unique = true, nullable = false)
    private String taskId;

    @Column(name = "courier_id", nullable = false)
    private String courierId;

    @Column(nullable = false)
    private String type;

    @Column(name = "locker_id", nullable = false)
    private String lockerId;

    @Column(name = "locker_name", nullable = false)
    private String lockerName;

    @Column(name = "parcel_ids", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> parcelIds = new ArrayList<>();

    @Column(name = "parcel_count", nullable = false)
    private Integer parcelCount = 0;

    @Column(nullable = false)
    private String status = "pending";

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public CourierTask() {}

    public UUID getId() { return id; }
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

    public void setId(UUID id) { this.id = id; }
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

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private String taskId;
        private String courierId;
        private String type;
        private String lockerId;
        private String lockerName;
        private List<String> parcelIds = new ArrayList<>();
        private Integer parcelCount = 0;
        private String status = "pending";
        private Instant completedAt;
        private Instant createdAt = Instant.now();

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder taskId(String taskId) { this.taskId = taskId; return this; }
        public Builder courierId(String courierId) { this.courierId = courierId; return this; }
        public Builder type(String type) { this.type = type; return this; }
        public Builder lockerId(String lockerId) { this.lockerId = lockerId; return this; }
        public Builder lockerName(String lockerName) { this.lockerName = lockerName; return this; }
        public Builder parcelIds(List<String> parcelIds) { this.parcelIds = parcelIds; return this; }
        public Builder parcelCount(Integer parcelCount) { this.parcelCount = parcelCount; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder completedAt(Instant completedAt) { this.completedAt = completedAt; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public CourierTask build() {
            CourierTask t = new CourierTask();
            t.id = id; t.taskId = taskId; t.courierId = courierId;
            t.type = type; t.lockerId = lockerId; t.lockerName = lockerName;
            t.parcelIds = parcelIds; t.parcelCount = parcelCount;
            t.status = status; t.completedAt = completedAt; t.createdAt = createdAt;
            return t;
        }
    }
}
