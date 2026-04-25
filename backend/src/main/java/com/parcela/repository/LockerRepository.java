package com.parcela.repository;

import com.parcela.model.Locker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LockerRepository extends JpaRepository<Locker, UUID> {
    Optional<Locker> findByLockerId(String lockerId);
    List<Locker> findByStatus(String status);
    long countByStatus(String status);
}
