package com.parcela.repository;

import com.parcela.model.Parcel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ParcelRepository extends JpaRepository<Parcel, UUID> {
    Optional<Parcel> findByParcelId(String parcelId);
    Optional<Parcel> findByTrackingCode(String trackingCode);
    long countByStatus(String status);

    @Query("SELECT p FROM Parcel p WHERE p.senderId = :uid OR p.recipientPhone = :phone OR p.recipientEmail = :email ORDER BY p.createdAt DESC")
    List<Parcel> findMyParcels(@Param("uid") String userId,
                               @Param("phone") String phone,
                               @Param("email") String email);

    List<Parcel> findAllByOrderByCreatedAtDesc();
}
