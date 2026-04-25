package com.parcela.service;

import com.parcela.dto.request.LockerCreateRequest;
import com.parcela.dto.request.LockerUpdateRequest;
import com.parcela.dto.response.LockerDto;
import com.parcela.model.Locker;
import com.parcela.repository.LockerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@SuppressWarnings("null")
public class LockerService {

    private final LockerRepository lockerRepo;

    public LockerService(LockerRepository lockerRepo) {
        this.lockerRepo = lockerRepo;
    }

    public List<LockerDto> getAllLockers() {
        return lockerRepo.findAll().stream().map(LockerDto::from).collect(Collectors.toList());
    }

    public List<LockerDto> getActiveLockers() {
        return lockerRepo.findByStatus("active").stream().map(LockerDto::from).collect(Collectors.toList());
    }

    public LockerDto getLocker(String lockerId) {
        return lockerRepo.findByLockerId(lockerId)
                .map(LockerDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Locker not found"));
    }

    @Transactional
    public LockerDto createLocker(LockerCreateRequest req) {
        String lockerId = "LKR-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Locker locker = Locker.builder()
                .lockerId(lockerId)
                .name(req.getName())
                .address(req.getAddress())
                .district(req.getDistrict())
                .lat(req.getLat())
                .lng(req.getLng())
                .totalSmall(req.getTotalSmall() != null ? req.getTotalSmall() : 10)
                .totalMedium(req.getTotalMedium() != null ? req.getTotalMedium() : 8)
                .totalLarge(req.getTotalLarge() != null ? req.getTotalLarge() : 4)
                .availableSmall(req.getTotalSmall() != null ? req.getTotalSmall() : 10)
                .availableMedium(req.getTotalMedium() != null ? req.getTotalMedium() : 8)
                .availableLarge(req.getTotalLarge() != null ? req.getTotalLarge() : 4)
                .status("active")
                .build();
        return LockerDto.from(lockerRepo.save(locker));
    }

    @Transactional
    public LockerDto updateLocker(String lockerId, LockerUpdateRequest req) {
        Locker locker = lockerRepo.findByLockerId(lockerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Locker not found"));
        if (req.getName() != null) locker.setName(req.getName());
        if (req.getAddress() != null) locker.setAddress(req.getAddress());
        if (req.getDistrict() != null) locker.setDistrict(req.getDistrict());
        if (req.getLat() != null) locker.setLat(req.getLat());
        if (req.getLng() != null) locker.setLng(req.getLng());
        if (req.getStatus() != null) locker.setStatus(req.getStatus());
        if (req.getAvailableSmall() != null) locker.setAvailableSmall(req.getAvailableSmall());
        if (req.getAvailableMedium() != null) locker.setAvailableMedium(req.getAvailableMedium());
        if (req.getAvailableLarge() != null) locker.setAvailableLarge(req.getAvailableLarge());
        return LockerDto.from(lockerRepo.save(locker));
    }

    @Transactional
    public void deleteLocker(String lockerId) {
        Locker locker = lockerRepo.findByLockerId(lockerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Locker not found"));
        lockerRepo.delete(locker);
    }

    /** Reserve a slot for a parcel (called during parcel creation). */
    @Transactional
    public void reserveSlot(String lockerId, String size) {
        Locker locker = lockerRepo.findByLockerId(lockerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Locker not found: " + lockerId));
        switch (size.toLowerCase()) {
            case "small"  -> { if (locker.getAvailableSmall() <= 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "No small slots available"); locker.setAvailableSmall(locker.getAvailableSmall() - 1); }
            case "medium" -> { if (locker.getAvailableMedium() <= 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "No medium slots available"); locker.setAvailableMedium(locker.getAvailableMedium() - 1); }
            case "large"  -> { if (locker.getAvailableLarge() <= 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "No large slots available"); locker.setAvailableLarge(locker.getAvailableLarge() - 1); }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid size: " + size);
        }
        lockerRepo.save(locker);
    }

    /** Release a slot (called when parcel is delivered or cancelled). */
    @Transactional
    public void releaseSlot(String lockerId, String size) {
        lockerRepo.findByLockerId(lockerId).ifPresent(locker -> {
            switch (size.toLowerCase()) {
                case "small"  -> locker.setAvailableSmall(Math.min(locker.getAvailableSmall() + 1, locker.getTotalSmall()));
                case "medium" -> locker.setAvailableMedium(Math.min(locker.getAvailableMedium() + 1, locker.getTotalMedium()));
                case "large"  -> locker.setAvailableLarge(Math.min(locker.getAvailableLarge() + 1, locker.getTotalLarge()));
            }
            lockerRepo.save(locker);
        });
    }
}
