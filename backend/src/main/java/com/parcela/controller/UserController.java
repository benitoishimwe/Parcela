package com.parcela.controller;

import com.parcela.dto.response.UserDto;
import com.parcela.repository.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository userRepo;

    public UserController(AppUserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @GetMapping
    public ResponseEntity<List<UserDto>> getAllUsers() {
        List<UserDto> users = userRepo.findAll().stream()
                .map(UserDto::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(users);
    }
}
