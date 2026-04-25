package com.parcela.controller;

import com.parcela.dto.response.CourierTaskDto;
import com.parcela.service.CourierTaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/courier")
public class CourierController {

    private final CourierTaskService courierTaskService;

    public CourierController(CourierTaskService courierTaskService) {
        this.courierTaskService = courierTaskService;
    }

    @GetMapping("/tasks")
    public ResponseEntity<List<CourierTaskDto>> myTasks(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(courierTaskService.getMyCourierTasks(jwt));
    }

    /** Public endpoint — no JWT needed. Courier's user_id is passed as path variable. */
    @GetMapping("/tasks/by-courier/{courierId}")
    public ResponseEntity<List<CourierTaskDto>> tasksByCourier(@PathVariable String courierId) {
        return ResponseEntity.ok(courierTaskService.getTasksByCourierId(courierId));
    }

    @PutMapping("/tasks/{taskId}")
    public ResponseEntity<CourierTaskDto> updateTask(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String taskId,
            @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "completed");
        return ResponseEntity.ok(courierTaskService.updateTaskStatus(taskId, status, jwt));
    }
}
