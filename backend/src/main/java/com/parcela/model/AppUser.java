package com.parcela.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", unique = true, nullable = false)
    private String userId;

    @Column(name = "auth_user_id", unique = true)
    private UUID authUserId;

    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String phone;

    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private String role = "user";

    private String picture;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public AppUser() {}

    public UUID getId() { return id; }
    public String getUserId() { return userId; }
    public UUID getAuthUserId() { return authUserId; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public String getPicture() { return picture; }
    public Instant getCreatedAt() { return createdAt; }

    public void setId(UUID id) { this.id = id; }
    public void setUserId(String userId) { this.userId = userId; }
    public void setAuthUserId(UUID authUserId) { this.authUserId = authUserId; }
    public void setName(String name) { this.name = name; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setEmail(String email) { this.email = email; }
    public void setRole(String role) { this.role = role; }
    public void setPicture(String picture) { this.picture = picture; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private UUID id;
        private String userId;
        private UUID authUserId;
        private String name;
        private String phone;
        private String email;
        private String role = "user";
        private String picture;
        private Instant createdAt = Instant.now();

        public Builder id(UUID id) { this.id = id; return this; }
        public Builder userId(String userId) { this.userId = userId; return this; }
        public Builder authUserId(UUID authUserId) { this.authUserId = authUserId; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder phone(String phone) { this.phone = phone; return this; }
        public Builder email(String email) { this.email = email; return this; }
        public Builder role(String role) { this.role = role; return this; }
        public Builder picture(String picture) { this.picture = picture; return this; }
        public Builder createdAt(Instant createdAt) { this.createdAt = createdAt; return this; }

        public AppUser build() {
            AppUser u = new AppUser();
            u.id = id; u.userId = userId; u.authUserId = authUserId;
            u.name = name; u.phone = phone; u.email = email;
            u.role = role; u.picture = picture; u.createdAt = createdAt;
            return u;
        }
    }
}
