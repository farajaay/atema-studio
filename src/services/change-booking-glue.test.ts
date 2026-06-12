// Glue tests for the change-booking Edge Function wiring (handlers.ts) with a
// mocked Supabase client. The pure policy engines (reschedule / otp / change
// math) have their own suites — these tests cover what was previously
// untested: token gating, OTP issuance/consumption, catalogue recompute,
// the DB writes, and what goes out over WhatsApp.

import { describe, it, expect } from 'vitest';
import {
  routeChangeRequest, type HandlerEnv,
} from '../../supabase/functions/change-booking/handlers';
import { hashOtp } from '../../supabase/functions/_shared/otp';
import { computePackageChange } from '../../supabase/functions/_shared/change';

// ── Mock Supabase client ──────────────────────────────────────────────────────
interface Call {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: unknown;
  filters: Array<[string, unknown[]]>;
}
type Resp = { data?: unknown; error?: { message: string } | null };

function mockDb(route: (call: Call) => Resp | undefined) {
  const calls: Call[] = [];
  function from(table: string) {
    const call: Call = { table, op: 'select', filters: [] };
    calls.push(call);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    for (const m of ['select', 'eq', 'neq', 'is', 'in', 'order', 'limit', 'gte']) {
      builder[m] = (...args: unknown[]) => { call.filters.push([m, args]); return builder; };
    }
    builder.insert = (payload: unknown) => { call.op = 'insert'; call.payload = payload; return builder; };
    builder.update = (payload: unknown) => { call.op = 'update'; call.payload = payload; return builder; };
    const resolve = () => Promise.resolve(route(call) ?? { data: null, error: null });
    builder.maybeSingle = resolve;
    builder.single = resolve;
    builder.then = (onF?: unknown, onR?: unknown) =>
      resolve().then(onF as never, onR as never);
    return builder;
  }
  return { client: { from }, calls };
}

const filterValue = (call: Call, name: string) =>
  call.filters.find(([m]) => m === name)?.[1];

// ── Fixtures ──────────────────────────────────────────────────────────────────
const TOKEN = 'a'.repeat(40);
const isoPlus = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const TODAY = () => new Date().toISOString().slice(0, 10);

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 'b-1', booking_ref: 'ATEMA-260612-TESTREF1',
    customer_name: 'نورة', customer_phone: '+966512345678',
    package_id: 3, addon_ids: [],
    event_date: isoPlus(14), event_time: '18:00',
    location: 'الجبيل', status: 'confirmed', payment_status: 'paid',
    subtotal: 5200, vat: 780, total: 5980,
    vat_enabled: true, reschedule_count: 0,
    manage_token: TOKEN, discount_amount: 0,
    ...over,
  };
}

function env(messages: Array<{ phone?: string; message: string }> = []): HandlerEnv {
  return {
    ownerPhone: '+966500000000',
    siteOrigin: 'https://example.test',
    notify: async (phone, message) => { messages.push({ phone, message }); },
    today: TODAY,
  };
}

/** Default router: token lookup hits, WA enabled, every write succeeds. */
function defaultRoute(b = booking()) {
  return (call: Call): Resp | undefined => {
    if (call.table === 'bookings' && call.op === 'select' && filterValue(call, 'eq')?.[0] === 'manage_token') {
      return { data: b };
    }
    if (call.table === 'app_settings') return { data: { wa_enabled: true } };
    return { data: null, error: null };
  };
}

// ── Token gate ────────────────────────────────────────────────────────────────
describe('routeChangeRequest token gate', () => {
  it('rejects a short token without touching the database', async () => {
    const db = mockDb(() => ({ data: null }));
    const res = await routeChangeRequest(db.client, { action: 'reschedule', token: 'short' }, env());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('token_invalid');
    expect(db.calls.length).toBe(0);
  });

  it('404s an unknown token', async () => {
    const db = mockDb(() => ({ data: null }));
    const res = await routeChangeRequest(db.client, { action: 'reschedule', token: TOKEN }, env());
    expect(res.status).toBe(404);
  });

  it('422s a cancelled booking before reaching any handler', async () => {
    const db = mockDb(defaultRoute(booking({ status: 'cancelled' })));
    const res = await routeChangeRequest(db.client, { action: 'request_otp', token: TOKEN }, env());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('booking_cancelled');
  });
});

// ── Reschedule ────────────────────────────────────────────────────────────────
describe('reschedule glue', () => {
  it('moves the date, bumps the counter, audits, and notifies both parties', async () => {
    const messages: Array<{ phone?: string; message: string }> = [];
    const newDate = isoPlus(20);
    const db = mockDb(defaultRoute());
    const res = await routeChangeRequest(db.client,
      { action: 'reschedule', token: TOKEN, newDate, newTime: '19:00' }, env(messages));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, eventDate: newDate, rescheduleCount: 1 });

    const upd = db.calls.find(c => c.table === 'bookings' && c.op === 'update');
    expect(upd?.payload).toMatchObject({ event_date: newDate, event_time: '19:00', reschedule_count: 1 });

    const audit = db.calls.find(c => c.table === 'booking_changes' && c.op === 'insert');
    expect(audit?.payload).toMatchObject({ kind: 'reschedule', actor: 'customer' });

    expect(messages).toHaveLength(2); // bride + owner
    expect(messages[0].message).toContain(newDate);
  });

  it('409s when the new date is taken and writes nothing', async () => {
    const db = mockDb((call) => {
      if (call.table === 'bookings' && call.op === 'select') {
        if (filterValue(call, 'eq')?.[0] === 'manage_token') return { data: booking() };
        return { data: [{ id: 'someone-else' }] }; // clash probe
      }
      if (call.table === 'app_settings') return { data: { wa_enabled: true } };
      return { data: null };
    });
    const res = await routeChangeRequest(db.client,
      { action: 'reschedule', token: TOKEN, newDate: isoPlus(20) }, env());
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('date_unavailable');
    expect(db.calls.some(c => c.table === 'bookings' && c.op === 'update')).toBe(false);
  });
});

// ── OTP issuance ──────────────────────────────────────────────────────────────
describe('request_otp glue', () => {
  it('stores only the salted hash, texts the code, never returns it', async () => {
    const messages: Array<{ phone?: string; message: string }> = [];
    const db = mockDb(defaultRoute());
    const res = await routeChangeRequest(db.client, { action: 'request_otp', token: TOKEN }, env(messages));

    expect(res.status).toBe(200);
    const ins = db.calls.find(c => c.table === 'booking_otps' && c.op === 'insert');
    const row = ins?.payload as { code_hash: string; salt: string; expires_at: string };
    expect(row.code_hash).toBeTruthy();
    expect(row.salt).toBeTruthy();
    expect(new Date(row.expires_at).getTime()).toBeGreaterThan(Date.now());

    // The texted code hashes to exactly what was stored…
    const sms = messages.find(m => m.phone === '+966512345678');
    const code = sms?.message.match(/(\d{6})/)?.[1];
    expect(code).toBeTruthy();
    expect(await hashOtp(code!, row.salt)).toBe(row.code_hash);
    // …and the code never appears in the stored row or the HTTP response.
    expect(row.code_hash).not.toContain(code);
    expect(JSON.stringify(await res.json())).not.toContain(code);
    // The anti-phishing line ships with every code.
    expect(sms?.message).toContain('لن يطلبه منكِ أبداً');
  });
});

// ── Package change ────────────────────────────────────────────────────────────
const PKG_ROYAL = { id: 4, price: 10500, active: true, name_ar: 'الملكية', name_en: 'Royal' };
const ADDON_HENNA = { id: 'henna', price: 2400, active: true };

async function otpRow(code: string) {
  const salt = 'fixed-salt';
  return {
    id: 'otp-1', code_hash: await hashOtp(code, salt), salt,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), attempts: 0,
  };
}

function changeRoute(opts: { otp?: Awaited<ReturnType<typeof otpRow>> | null; b?: ReturnType<typeof booking>; pkg?: typeof PKG_ROYAL | null }) {
  const b = opts.b ?? booking();
  return (call: Call): Resp | undefined => {
    if (call.table === 'bookings' && call.op === 'select') return { data: b };
    if (call.table === 'app_settings') return { data: { wa_enabled: true } };
    if (call.table === 'booking_otps' && call.op === 'select') return { data: opts.otp ?? null };
    if (call.table === 'packages') return { data: opts.pkg === undefined ? PKG_ROYAL : opts.pkg };
    if (call.table === 'addons') return { data: [ADDON_HENNA] };
    return { data: null, error: null };
  };
}

describe('change_package glue', () => {
  it('401s when no unconsumed OTP exists', async () => {
    const db = mockDb(changeRoute({ otp: null }));
    const res = await routeChangeRequest(db.client,
      { action: 'change_package', token: TOKEN, otp: '123456', packageId: 4 }, env());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('otp_required');
  });

  it('counts a wrong code as an attempt and rejects it', async () => {
    const db = mockDb(changeRoute({ otp: await otpRow('111111') }));
    const res = await routeChangeRequest(db.client,
      { action: 'change_package', token: TOKEN, otp: '222222', packageId: 4 }, env());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('otp_mismatch');
    const upd = db.calls.find(c => c.table === 'booking_otps' && c.op === 'update');
    expect(upd?.payload).toMatchObject({ attempts: 1 });
    expect(db.calls.some(c => c.table === 'bookings' && c.op === 'update')).toBe(false);
  });

  it('rejects an inactive package after consuming the OTP', async () => {
    const db = mockDb(changeRoute({
      otp: await otpRow('123456'), pkg: { ...PKG_ROYAL, active: false },
    }));
    const res = await routeChangeRequest(db.client,
      { action: 'change_package', token: TOKEN, otp: '123456', packageId: 4 }, env());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('package_invalid');
  });

  it('recomputes totals from the catalogue, persists the top-up, and links the payment', async () => {
    const messages: Array<{ phone?: string; message: string }> = [];
    const db = mockDb(changeRoute({ otp: await otpRow('123456') }));
    const res = await routeChangeRequest(db.client, {
      action: 'change_package', token: TOKEN, otp: '123456',
      packageId: 4, addOnIds: ['henna'],
      // A forged client total must be ignored:
      total: 1,
    }, env(messages));

    expect(res.status).toBe(200);
    const body = await res.json();
    // Royal 10,500 + henna 2,400 + Jubail fee 0 — exactly the pure engine's math.
    const expected = computePackageChange({
      newGrossSubtotal: 12900, oldTotal: 5980, discountAmount: 0, vatEnabled: true,
    });
    expect(body).toMatchObject({
      ok: true, subtotal: expected.subtotal, vat: expected.vat,
      total: expected.total, topUpDue: expected.topUpDue, direction: 'top_up',
    });

    const updates = db.calls.filter(c => c.table === 'bookings' && c.op === 'update');
    expect(updates[0].payload).toMatchObject({
      package_id: 4, addon_ids: ['henna'],
      subtotal: expected.subtotal, vat: expected.vat, total: expected.total,
    });
    expect(updates[1].payload).toMatchObject({ topup_amount_due: expected.topUpDue });

    const consumed = db.calls.find(c => c.table === 'booking_otps' && c.op === 'update');
    expect((consumed?.payload as { consumed_at?: string }).consumed_at).toBeTruthy();

    // The bride's WA message carries the manage link so she can pay the top-up.
    const sms = messages.find(m => m.phone === '+966512345678');
    expect(sms?.message).toContain(`https://example.test/#/manage/${TOKEN}`);
  });

  it('422s when the event date has already passed', async () => {
    const db = mockDb(changeRoute({
      otp: await otpRow('123456'), b: booking({ event_date: isoPlus(-2) }),
    }));
    const res = await routeChangeRequest(db.client,
      { action: 'change_package', token: TOKEN, otp: '123456', packageId: 4 }, env());
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('event_passed');
  });
});
