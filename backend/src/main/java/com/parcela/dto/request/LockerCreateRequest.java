package com.parcela.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class LockerCreateRequest {
    @NotBlank private String name;
    @NotBlank private String address;
    @NotBlank private String district;
    @NotNull  private Double lat;
    @NotNull  private Double lng;
    private Integer totalSmall = 10;
    private Integer totalMedium = 8;
    private Integer totalLarge = 4;

    public String getName() { return name; }
    public String getAddress() { return address; }
    public String getDistrict() { return district; }
    public Double getLat() { return lat; }
    public Double getLng() { return lng; }
    public Integer getTotalSmall() { return totalSmall; }
    public Integer getTotalMedium() { return totalMedium; }
    public Integer getTotalLarge() { return totalLarge; }

    public void setName(String name) { this.name = name; }
    public void setAddress(String address) { this.address = address; }
    public void setDistrict(String district) { this.district = district; }
    public void setLat(Double lat) { this.lat = lat; }
    public void setLng(Double lng) { this.lng = lng; }
    public void setTotalSmall(Integer totalSmall) { this.totalSmall = totalSmall; }
    public void setTotalMedium(Integer totalMedium) { this.totalMedium = totalMedium; }
    public void setTotalLarge(Integer totalLarge) { this.totalLarge = totalLarge; }
}
