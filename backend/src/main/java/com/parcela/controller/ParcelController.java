package com.parcela.controller;

import com.parcela.dto.request.ParcelCreateRequest;
import com.parcela.dto.request.ProcessPaymentRequest;
import com.parcela.dto.request.StatusUpdateRequest;
import com.parcela.dto.response.ParcelDto;
import com.parcela.service.ParcelService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/parcels")
public class ParcelController {

    private final ParcelService parcelService;

    public ParcelController(ParcelService parcelService) {
        this.parcelService = parcelService;
    }

    /** Public tracking — no auth required. */
    @GetMapping("/track/{trackingCode}")
    public ResponseEntity<ParcelDto> track(@PathVariable String trackingCode) {
        return ResponseEntity.ok(parcelService.trackParcel(trackingCode));
    }

    @PostMapping
    public ResponseEntity<ParcelDto> createParcel(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ParcelCreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(parcelService.createParcel(req, jwt));
    }

    @GetMapping("/my")
    public ResponseEntity<List<ParcelDto>> myParcels(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(parcelService.getMyParcels(jwt));
    }

    @PostMapping("/{parcelId}/payment")
    public ResponseEntity<ParcelDto> processPayment(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String parcelId,
            @RequestBody ProcessPaymentRequest req) {
        return ResponseEntity.ok(parcelService.processPayment(parcelId, req, jwt));
    }

    @GetMapping("/{parcelId}/payment-status")
    public ResponseEntity<Map<String, Object>> paymentStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String parcelId) {
        return ResponseEntity.ok(parcelService.getPaymentStatus(parcelId, jwt));
    }

    /** Public — all parcels (no auth required, mirrors GET /api/lockers). */
    @GetMapping
    public ResponseEntity<List<ParcelDto>> allParcels() {
        return ResponseEntity.ok(parcelService.getAllParcelsPublic());
    }

    /** Public — parcels for a specific user by their user_id + phone + email (no JWT needed). */
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<List<ParcelDto>> parcelsByUser(
            @PathVariable String userId,
            @RequestParam(required = false, defaultValue = "") String phone,
            @RequestParam(required = false, defaultValue = "") String email) {
        return ResponseEntity.ok(parcelService.getParcelsByUser(userId, phone, email));
    }

    @GetMapping("/{parcelId}")
    public ResponseEntity<ParcelDto> getParcel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String parcelId) {
        return ResponseEntity.ok(parcelService.getParcel(parcelId, jwt));
    }

    /** Courier / admin: update parcel status. */
    @PutMapping("/{parcelId}/status")
    public ResponseEntity<ParcelDto> updateStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String parcelId,
            @Valid @RequestBody StatusUpdateRequest req) {
        return ResponseEntity.ok(parcelService.updateStatus(parcelId, req, jwt));
    }

    /** Courier: scan QR and perform drop_off or picked_up action. */
    @PostMapping("/{parcelId}/scan")
    public ResponseEntity<ParcelDto> scanParcel(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String parcelId,
            @RequestBody Map<String, String> body) {
        String action = body.getOrDefault("action", "drop_off");
        return ResponseEntity.ok(parcelService.scanParcel(parcelId, action, jwt));
    }

    /** Admin: assign parcel to a courier — no JWT required (parcel_id is secret). */
    @PostMapping("/{parcelId}/assign")
    public ResponseEntity<Map<String, Object>> assignCourier(
            @PathVariable String parcelId,
            @RequestBody Map<String, String> body) {
        String courierId = body.get("courier_id");
        String type = body.getOrDefault("type", "collect");
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(parcelService.assignToCourier(parcelId, courierId, type));
    }
}
