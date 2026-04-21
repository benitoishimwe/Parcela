package com.parcela.repository;

import com.parcela.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
    Optional<AppUser> findByUserId(String userId);
    Optional<AppUser> findByAuthUserId(UUID authUserId);
    Optional<AppUser> findByEmail(String email);
    Optional<AppUser> findByPhone(String phone);
    Optional<AppUser> findByEmailOrPhone(String email, String phone);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
    boolean existsByUserId(String userId);
    long countByRole(String role);
}
