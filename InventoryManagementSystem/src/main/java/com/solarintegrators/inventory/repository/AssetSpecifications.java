package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.Asset;
import com.solarintegrators.inventory.model.AssetStatus;
import jakarta.persistence.criteria.Predicate;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/**
 * Filter predicates for the asset search endpoint.
 *
 * <p>Written with the Criteria API rather than a JPQL query with nullable
 * parameters, because every filter here is optional and a single query with
 * five {@code (:param is null or ...)} clauses is both harder to read and
 * harder for the optimiser to plan.</p>
 */
public final class AssetSpecifications {

    private AssetSpecifications() {
    }

    /** Matches the prototype's AssetRepository.search(): tag, name, or serial contains the text. */
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
