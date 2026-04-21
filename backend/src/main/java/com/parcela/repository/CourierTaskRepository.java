package com.parcela.repository;

import com.parcela.model.CourierTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CourierTaskRepository extends JpaRepository<CourierTask, UUID> {
    List<CourierTask> findByCourierIdOrderByCreatedAtDesc(String courierId);
    Optional<CourierTask> findByTaskIdAndCourierId(String taskId, String courierId);
    Optional<CourierTask> findByTaskId(String taskId);
}
