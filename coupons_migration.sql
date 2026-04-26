-- ==========================================
-- COUPON SYSTEM MIGRATION
-- ==========================================

-- 1. Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    description text,
    
    -- Discount Type: 'percentage' or 'fixed'
    discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value numeric NOT NULL CHECK (discount_value > 0),
    
    -- Constraints
    min_order_cents integer DEFAULT 0,
    max_discount_cents integer, -- Useful for percentage discounts
    
    start_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone, -- NULL means no expiry
    
    is_active boolean NOT NULL DEFAULT true,
    is_new_user_only boolean NOT NULL DEFAULT false,
    
    -- Usage Limits
    total_usage_limit integer, -- NULL means unlimited
    used_count integer NOT NULL DEFAULT 0,
    
    -- Subject Link (Optional)
    subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
    
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT coupons_pkey PRIMARY KEY (id)
);

-- 2. Create Coupon Usages Table (Tracking)
CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    
    discount_applied_cents integer NOT NULL,
    ip_address text,
    
    used_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT coupon_usages_pkey PRIMARY KEY (id)
);

-- 3. Create Blocked IPs Table
CREATE TABLE IF NOT EXISTS public.blocked_ips (
    ip_address text NOT NULL,
    reason text,
    blocked_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT blocked_ips_pkey PRIMARY KEY (ip_address)
);

-- 4. Update Orders Table to include Coupon info
-- Note: Check if columns already exist to avoid errors in repeated runs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'coupon_id') THEN
        ALTER TABLE public.orders ADD COLUMN coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'discount_cents') THEN
        ALTER TABLE public.orders ADD COLUMN discount_cents integer DEFAULT 0;
    END IF;
END $$;

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON public.coupon_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON public.coupon_usages(coupon_id);

-- 6. Trigger for updated_at on coupons
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_coupons_updated_at
    BEFORE UPDATE ON public.coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 7. Secure increment function
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(coupon_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
