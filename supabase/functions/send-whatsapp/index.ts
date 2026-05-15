import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Uses Twilio WhatsApp API — set these in Supabase Dashboard → Settings → Edge Function Secrets
const TWILIO_SID    = Deno.env.get('TWILIO_ACCOUNT_SID')  || '';
const TWILIO_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')    || '';
const TWILIO_FROM   = Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886'; // Twilio sandbox

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { phone, name, bookingRef, package: pkg, total, eventDate } = await req.json();

    const toPhone = phone.startsWith('+') ? phone : `+966${phone.replace(/^0/, '')}`;

    const message =
      `مرحباً ${name} 👋\n\n` +
      `تم استلام طلب حجزك في *ATEMA STUDIO* بنجاح ✅\n\n` +
      `📋 رقم الحجز: *${bookingRef}*\n` +
      `📦 الباقة: *${pkg}*\n` +
      `📅 التاريخ: *${eventDate}*\n` +
      `💰 المجموع: *${Number(total).toLocaleString()} ر.س*\n\n` +
      `سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.\n` +
      `للاستفسار: 📞 +966 54 832 3496`;

    // Send via Twilio
    if (TWILIO_SID && TWILIO_TOKEN) {
      const body = new URLSearchParams({
        To:   `whatsapp:${toPhone}`,
        From: TWILIO_FROM,
        Body: message,
      });

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            'Content-Type':  'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Twilio error');

      return new Response(JSON.stringify({ success: true, sid: result.sid }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log-only fallback (no credentials)
    console.log('[WhatsApp STUB] Would send to', toPhone, '\n', message);
    return new Response(JSON.stringify({ success: true, mode: 'stub' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
