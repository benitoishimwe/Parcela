package com.parcela.service;

import com.parcela.dto.response.NotificationDto;
import com.parcela.model.Notification;
import com.parcela.repository.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@SuppressWarnings("null")
public class NotificationService {

    private final NotificationRepository notificationRepo;

    public NotificationService(NotificationRepository notificationRepo) {
        this.notificationRepo = notificationRepo;
    }

    public List<NotificationDto> getUserNotifications(String userId) {
        return notificationRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(NotificationDto::from).collect(Collectors.toList());
    }

    @Transactional
    public NotificationDto markRead(String notificationId, String userId) {
        Notification n = notificationRepo.findByNotificationIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        n.setRead(true);
        return NotificationDto.from(notificationRepo.save(n));
    }

    @Transactional
    public void markAllRead(String userId) {
        notificationRepo.markAllReadByUserId(userId);
    }

    @Transactional
    public NotificationDto create(String userId, String title, String body,
                                   String parcelId, String trackingCode, String type) {
        String notifId = "NTF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Notification n = Notification.builder()
                .notificationId(notifId)
                .userId(userId)
                .title(title)
                .body(body)
                .parcelId(parcelId)
                .trackingCode(trackingCode)
                .type(type)
                .read(false)
                .build();
        return NotificationDto.from(notificationRepo.save(n));
    }
}
