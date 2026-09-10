-- ---------------------------------------------------------------------
-- V4 - stock is counted in whole units
--
-- quantity_on_hand and reorder_point were numeric(18,4), which let a
-- fractional quantity through every write path: the adjustment form, the
-- API, and SQL run by hand. Half a connector cannot be issued to a job,
-- and a fractional balance never reconciles against a physical count, so
-- the fraction is always an entry error rather than a real measurement.
--
-- The columns keep scale 4 and a CHECK is added instead of narrowing them
-- to numeric(18,0). That is deliberate: Postgres would silently ROUND a
-- fractional value into a scale-0 column, so 10.2 would become 10 with no
-- complaint. A quantity that quietly changes on the way in is worse than
-- one that is refused, and refusing is what a CHECK does.
--
-- Costs are untouched. unit_cost and purchase_cost are money and must
-- keep their decimals.
-- ---------------------------------------------------------------------

-- Any fraction already stored has to go before the constraint can be
-- added, or this migration fails and the service will not start at all.
-- Rounding is the only safe automatic choice here: there is no way to
-- know from the row whether 439.8 was meant to be 439 or 440.
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
