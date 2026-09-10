-- V4 - stock is counted in whole units; fractional quantities are rejected.

UPDATE inventory_items
   SET quantity_on_hand = round(quantity_on_hand)
 WHERE quantity_on_hand <> round(quantity_on_hand);

UPDATE inventory_items
   SET reorder_point = round(reorder_point)
 WHERE reorder_point IS NOT NULL
   AND reorder_point <> round(reorder_point);

ALTER TABLE inventory_items
    ADD CONSTRAINT ck_inventory_quantity_whole
        CHECK (quantity_on_hand = trunc(quantity_on_hand));

ALTER TABLE inventory_items
    ADD CONSTRAINT ck_inventory_reorder_whole
        CHECK (reorder_point IS NULL OR reorder_point = trunc(reorder_point));

COMMENT ON CONSTRAINT ck_inventory_quantity_whole ON inventory_items
    IS 'Stock is counted, not measured. Fractional quantities are entry errors.';
