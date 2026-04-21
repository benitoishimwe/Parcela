package com.parcela.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Public auth endpoints
                .requestMatchers(HttpMethod.POST, "/api/auth/signup").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/google/callback").permitAll()
                // Public locker reads
                .requestMatchers(HttpMethod.GET, "/api/lockers").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/lockers/**").permitAll()
                // Public user list (read-only, mirrors /api/lockers pattern)
                .requestMatchers(HttpMethod.GET, "/api/users").permitAll()
                // Public parcel reads (admin dashboard uses this — mirrors /api/lockers pattern)
                .requestMatchers(HttpMethod.GET, "/api/parcels").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/parcels/track/**").permitAll()
                // Parcel assignment — no JWT needed (parcel_id is already a secret identifier)
                .requestMatchers(HttpMethod.POST, "/api/parcels/*/assign").permitAll()
                // Public courier tasks read (courier_id is passed as path param)
                .requestMatchers(HttpMethod.GET, "/api/courier/tasks/by-courier/**").permitAll()
                // Public user parcels read (user_id is passed as path param)
                .requestMatchers(HttpMethod.GET, "/api/parcels/by-user/**").permitAll()
                // Translation endpoint — public, no auth required
                .requestMatchers(HttpMethod.POST, "/api/translate").permitAll()
                // MTN callback webhook (called by MTN, no JWT)
                .requestMatchers(HttpMethod.POST, "/api/payments/mtn/callback").permitAll()
                // Everything else requires JWT
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
