-- Read-only diagnostic: do live bookings carry discount data?
-- No PII selected (workflow logs are visible on GitHub).
select booking_ref, created_at::date as created, subtotal, total,
       discount_code, discount_amount, discount_kind, payment_status
from   public.bookings
order  by created_at desc;

select code, kind, value, used_count, active
from   public.discount_codes
order  by created_at desc;
