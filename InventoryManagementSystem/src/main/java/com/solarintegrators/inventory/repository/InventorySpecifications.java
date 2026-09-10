package com.solarintegrators.inventory.repository;

import com.solarintegrators.inventory.model.InventoryItem;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class InventorySpecifications {
    private InventorySpecifications() {
    }

    public static Specification<InventoryItem> textMatches(String query) {
        if (query == null || query.isBlank()) {
            return null;
        }
        String needle = "%" + query.trim().toLowerCase() + "%";
        return (root, criteriaQuery, cb) -> {
            Predicate sku = cb.like(cb.lower(root.get("sku")), needle);
            Predicate description = cb.like(cb.lower(cb.coalesce(root.get("description"), "")), needle);
            return cb.or(sku, description);
        };
    }

    public static Specification<InventoryItem> atLocation(UUID locationId) {
        return locationId == null
                ? null
                : (root, query, cb) -> cb.equal(root.get("location").get("locationId"), locationId);
    }

    public static Specification<InventoryItem> inCategory(String category) {
        return (category == null || category.isBlank())
                ? null
                : (root, query, cb) -> cb.equal(root.get("category"), category);
    }

    public static Specification<InventoryItem> belowReorderPoint(Boolean lowStockOnly) {
        if (!Boolean.TRUE.equals(lowStockOnly)) {
            return null;
        }
        return (root, query, cb) -> {
            Expression<BigDecimal> onHand = root.get("quantityOnHand");
            Expression<BigDecimal> reorderPoint =
                    cb.coalesce(root.<BigDecimal>get("reorderPoint"), BigDecimal.ZERO);
            return cb.lessThanOrEqualTo(onHand, reorderPoint);
        };
    }
}
