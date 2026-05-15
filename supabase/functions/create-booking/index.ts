import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();

    // Upsert customer
    const { data: customer } = await supabase
      .from('customers')
      .upsert({ full_name: body.customerName, phone: body.customerPhone, email: body.customerEmail, city: body.city },
               { onConflict: 'phone' })
      .select()
      .single();

    // Insert booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert([{
        customer_id:      customer?.id,
        package_id:       body.packageId,
        addon_ids:        body.addOnIds,
        event_date:       body.eventDate,
        event_time:       body.eventTime,
        customer_name:    body.customerName,
        customer_phone:   body.customerPhone,
        customer_email:   body.customerEmail,
        location:         body.location,
        special_requests: body.specialRequests,
        subtotal:         body.subtotal,
        vat:              body.vat,
        total:            body.total,
        status:           'pending',
      }])
      .select()
      .single();

    if (error) throw error;

    // Trigger WhatsApp notification (fire & forget)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method:  'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
      body: JSON.stringify({
        phone:      body.customerPhone,
        name:       body.customerName,
        bookingRef: booking.booking_ref,
        package:    body.packageName,
        total:      body.total,
        eventDate:  body.eventDate,
      }),
    }).catch(console.error);

    return new Response(JSON.stringify(booking), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
