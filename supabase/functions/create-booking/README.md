# create-booking Edge Function

Server-side booking creator that closes audit finding **C-3** — re-computes
`subtotal` / `vat` / `total` from the authoritative `packages` + `addons` +
`app_settings` tables so the client can never supply a forged total.

## Deploy

```bash
# 1. Install the Supabase CLI if you haven't:
brew install supabase/tap/supabase            # macOS
# or: npm install -g supabase                  # everywhere

# 2. Log in + link the project:
supabase login
supabase link --project-ref <your-project-ref>

# 3. Push the function:
supabase functions deploy create-booking
```

The function uses the **service role key** (set automatically as
`SUPABASE_SERVICE_ROLE_KEY` in the Function runtime). You don't need to add
any secrets manually for the standard insert flow.

## After deployment — tighten RLS

Once the function is live and the client is calling it, **remove direct
anonymous INSERT** on the `bookings` table:

```sql
-- in the Supabase SQL editor
drop policy if exists "Anon insert bookings" on public.bookings;
-- (or whatever your policy is named; list them with:)
-- select policyname from pg_policies where tablename = 'bookings';
```

The Edge Function still works because it uses the service-role key, which
bypasses RLS.

## Client behaviour

`src/services/booking.ts` tries the Edge Function first. If the function
returns 404 (not yet deployed), it falls back to the direct-insert path so
existing deployments don't break mid-rollout. The console emits a warning
in that case.

Once you've deployed the function AND tightened RLS, the fallback path
will simply fail (which is the desired posture — no insecure inserts).

## Contract

**Request body** (POST):

```jsonc
{
  "customerName":    "فاطمة محمد",
  "customerPhone":   "+9665XXXXXXXX",
  "customerEmail":   "fatima@example.com",   // optional
  "packageId":       3,                       // numeric id from packages table
  "addOnIds":        ["album-upgrade", "second-photog"],
  "eventDate":       "2026-08-12",
  "eventTime":       "18:00",
  "city":            "jubail",                // one of CITIES keys
  "location":        "قاعة الياسمين، الجبيل",
  "specialRequests": "نريد تركيزاً خاصاً على لقطات العائلة"
}
```

**Response 200:**

```jsonc
{
  "id":         "uuid",
  "bookingRef": "ATEMA-260517-K9P3X8M2",
  "status":     "pending",
  "createdAt":  "2026-05-17T…Z",
  "eventDate":  "2026-08-12",
  "total":      4830,
  "subtotal":   4200,
  "vat":        630
}
```

**Error responses** (`4xx` / `5xx`) have shape `{ "error": "code", "detail"?: "..." }`:

| Code | Status | Cause |
|---|---|---|
| `invalid_json` | 400 | Body didn't parse as JSON |
| `name_required` | 422 | Missing customer name |
| `phone_invalid` | 422 | Phone doesn't normalise to a Saudi mobile |
| `email_invalid` | 422 | Email present but malformed |
| `date_invalid` | 422 | Event date is missing or in the past |
| `package_required` | 422 | `packageId` missing or not numeric |
| `package_not_found` | 422 | No package row for that id |
| `package_inactive` | 422 | Package row exists but `active = false` |
| `addons_lookup_failed` | 500 | DB error during addon SELECT |
| `insert_failed` | 500 | DB error during booking INSERT |

## Tests

After deploy, sanity-check with the CLI:

```bash
supabase functions invoke create-booking --body '{
  "customerName": "Test User",
  "customerPhone": "+966500000001",
  "packageId": 3,
  "addOnIds": [],
  "eventDate": "2099-01-01",
  "eventTime": "10:00",
  "city": "jubail",
  "location": "Test venue"
}'
```

Expected: a 200 response with a fresh booking ref. Then SELECT the row in
the SQL editor and confirm `subtotal = 4200` (the Classic package price)
and `total = 4830` (4200 + 15% VAT). If your `app_settings.vat_enabled`
is false you'd see `vat = 0` and `total = 4200`.
