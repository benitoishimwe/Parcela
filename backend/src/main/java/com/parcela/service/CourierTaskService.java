package com.parcela.service;

import com.parcela.dto.response.CourierTaskDto;
import com.parcela.model.AppUser;
import com.parcela.model.CourierTask;
import com.parcela.repository.AppUserRepository;
import com.parcela.repository.CourierTaskRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@SuppressWarnings("null")
public class CourierTaskService {

    private static final Logger log = LoggerFactory.getLogger(CourierTaskService.class);

    private final CourierTaskRepository taskRepo;
    private final AppUserRepository userRepo;
    private final NotificationService notificationService;

    public CourierTaskService(CourierTaskRepository taskRepo, AppUserRepository userRepo,
                              NotificationService notificationService) {
        this.taskRepo = taskRepo;
        this.userRepo = userRepo;
        this.notificationService = notificationService;
    }

    @Transactional
    public List<CourierTaskDto> getMyCourierTasks(Jwt jwt) {
        AppUser courier = resolveUser(jwt);
        requireCourierOrAdmin(courier);
        return taskRepo.findByCourierIdOrderByCreatedAtDesc(courier.getUserId())
                .stream().map(CourierTaskDto::from).collect(Collectors.toList());
    }

    @Transactional
    public CourierTaskDto createTask(String courierId, String type, String lockerId,
                                     String lockerName, List<String> parcelIds, Jwt jwt) {
        AppUser caller = resolveUser(jwt);
        if (!"admin".equals(caller.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access required");
        }

        String taskId = "TSK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        CourierTask task = CourierTask.builder()
                .taskId(taskId)
                .courierId(courierId)
                .type(type)
                .lockerId(lockerId)
                .lockerName(lockerName)
                .parcelIds(parcelIds)
                .parcelCount(parcelIds != null ? parcelIds.size() : 0)
                .status("pending")
                .build();
        CourierTask saved = taskRepo.save(task);

        // Notify the assigned courier of their new task
        try {
            String action = "collect".equals(type) ? "pick up" : "deliver";
            int count = parcelIds != null ? parcelIds.size() : 0;
            notificationService.create(
                    courierId,
                    "New Task Assigned 📋",
                    "You have a new " + type + " task: " + action + " " + count
                            + " parcel" + (count != 1 ? "s" : "") + " at " + lockerName + ".",
                    null, null, "task_assigned");
        } catch (Exception e) {
            log.warn("Task assignment notification failed (non-critical): {}", e.getMessage());
        }

        return CourierTaskDto.from(saved);
    }

    @Transactional
    public CourierTaskDto updateTaskStatus(String taskId, String status, Jwt jwt) {
        AppUser user = resolveUser(jwt);
        requireCourierOrAdmin(user);

        CourierTask task;
        if ("admin".equals(user.getRole())) {
            task = taskRepo.findByTaskId(taskId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        } else {
            task = taskRepo.findByTaskIdAndCourierId(taskId, user.getUserId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        }

        task.setStatus(status);
        if ("completed".equals(status)) {
            task.setCompletedAt(Instant.now());

            // Notify the courier: task confirmed complete
            try {
                notificationService.create(
                        task.getCourierId(),
                        "Task Completed ✅",
                        "Task " + task.getTaskId() + " at " + task.getLockerName()
                                + " is marked complete. Great work!",
                        null, null, "task_completed");
            } catch (Exception e) {
                log.warn("Task completion notification failed (non-critical): {}", e.getMessage());
            }

            // Notify admins that a courier completed a task
            try {
                userRepo.findAll().stream()
                        .filter(u -> "admin".equals(u.getRole()))
                        .forEach(admin -> notificationService.create(
                                admin.getUserId(),
                                "Courier Task Completed",
                                "Task " + task.getTaskId() + " (" + task.getType() + ") at "
                                        + task.getLockerName() + " completed by courier "
                                        + task.getCourierId() + ".",
                                null, null, "status"));
            } catch (Exception e) {
                log.warn("Admin task-complete notification failed (non-critical): {}", e.getMessage());
            }
        }
        return CourierTaskDto.from(taskRepo.save(task));
    }

    /** Public: get tasks by courier_id without JWT */
    public List<CourierTaskDto> getTasksByCourierId(String courierId) {
        return taskRepo.findByCourierIdOrderByCreatedAtDesc(courierId)
                .stream().map(CourierTaskDto::from).collect(Collectors.toList());
    }

    /** Admin: get all tasks for a specific courier */
    @Transactional
    public List<CourierTaskDto> getCourierTasks(String courierId, Jwt jwt) {
        AppUser caller = resolveUser(jwt);
        if (!"admin".equals(caller.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin access required");
        }
        return taskRepo.findByCourierIdOrderByCreatedAtDesc(courierId)
                .stream().map(CourierTaskDto::from).collect(Collectors.toList());
    }

    private AppUser resolveUser(Jwt jwt) {
        UUID authId = UUID.fromString(jwt.getSubject());
        Optional<AppUser> userOpt = userRepo.findByAuthUserId(authId);
        if (userOpt.isEmpty()) {
            String email = jwt.getClaimAsString("email");
            if (email != null && !email.isBlank()) {
                userOpt = userRepo.findByEmail(email);
                if (userOpt.isEmpty() && email.endsWith("@parcela.internal")) {
                    userOpt = userRepo.findByPhone(email.replace("@parcela.internal", ""));
                }
                userOpt.ifPresent(u -> {
                    log.info("resolveUser: syncing auth_user_id for {} → {}", u.getUserId(), authId);
                    u.setAuthUserId(authId);
                    userRepo.save(u);
                });
            }
        }
        return userOpt.orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private void requireCourierOrAdmin(AppUser user) {
        if (!"courier".equals(user.getRole()) && !"admin".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Courier or admin access required");
        }
    }
}
