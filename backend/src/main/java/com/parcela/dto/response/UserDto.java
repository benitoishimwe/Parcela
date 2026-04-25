package com.parcela.dto.response;

import com.parcela.model.AppUser;
import java.time.Instant;

public class UserDto {
    private String userId;
    private String name;
    private String phone;
    private String email;
    private String role;
    private String picture;
    private Instant createdAt;

    public UserDto() {}

    public String getUserId() { return userId; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public String getPicture() { return picture; }
    public Instant getCreatedAt() { return createdAt; }

    public void setUserId(String userId) { this.userId = userId; }
    public void setName(String name) { this.name = name; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setEmail(String email) { this.email = email; }
    public void setRole(String role) { this.role = role; }
    public void setPicture(String picture) { this.picture = picture; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public static UserDto from(AppUser u) {
        UserDto dto = new UserDto();
        dto.userId = u.getUserId();
        dto.name = u.getName();
        dto.phone = u.getPhone();
        dto.email = u.getEmail();
        dto.role = u.getRole();
        dto.picture = u.getPicture();
        dto.createdAt = u.getCreatedAt();
        return dto;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final UserDto dto = new UserDto();
        public Builder userId(String v) { dto.userId = v; return this; }
        public Builder name(String v) { dto.name = v; return this; }
        public Builder phone(String v) { dto.phone = v; return this; }
        public Builder email(String v) { dto.email = v; return this; }
        public Builder role(String v) { dto.role = v; return this; }
        public Builder picture(String v) { dto.picture = v; return this; }
        public Builder createdAt(Instant v) { dto.createdAt = v; return this; }
        public UserDto build() { return dto; }
    }
}
