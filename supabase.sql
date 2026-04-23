-- Add original_price_cents to subject_offers table
-- This allows for promotional pricing. If original_price_cents > price_cents, 
-- it acts as a base price (crossed out) while price_cents acts as the discounted price.

ALTER TABLE public.subject_offers 
ADD COLUMN original_price_cents integer DEFAULT NULL;

-- Optional: If you want to rename price_cents to make it clearer
-- you could rename it, but keeping it as price_cents and adding original_price_cents 
-- is safer for backward compatibility with existing code.
