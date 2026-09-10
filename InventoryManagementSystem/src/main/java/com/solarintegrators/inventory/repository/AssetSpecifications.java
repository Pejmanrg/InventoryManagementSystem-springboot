package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import jakarta.persistence.criteria.Predicate;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class AssetSpecifications {
    private AssetSpecifications() {
    }

    public static Specification<Asset> textMatches(String query) {
        if (query == null || query.isBlank()) {
            return null;
        }
        String needle = "%" + query.trim().toLowerCase() + "%";
        return (root, criteriaQuery, cb) -> {
            Predicate tag = cb.like(cb.lower(root.get("tag")), needle);
            Predicate name = cb.like(cb.lower(root.get("name")), needle);
            Predicate serial = cb.like(cb.lower(cb.coalesce(root.get("serialNumber"), "")), needle);
            return cb.or(tag, name, serial);
        };
    }

    public static Specification<Asset> hasStatus(AssetStatus status) {
        return status == null ? null : (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    public static Specification<Asset> atLocation(UUID locationId) {
        return locationId == null
                ? null
                : (root, query, cb) -> cb.equal(root.get("location").get("locationId"), locationId);
    }

    public static Specification<Asset> inCategory(String category) {
        return (category == null || category.isBlank())
                ? null
                : (root, query, cb) -> cb.equal(root.get("category"), category);
    }

    public static Specification<Asset> heldBy(UUID employeeId) {
        return employeeId == null
                ? null
                : (root, query, cb) -> cb.equal(root.get("custodian").get("employeeId"), employeeId);
    }
}
