# ATEMA Studio — Backend Setup Guide

## 1. Supabase Database

1. Create project at https://app.supabase.com
2. Go to **SQL Editor** and run the full contents of `database/schema.sql`
3. Copy your **Project URL** and **anon key** into a `.env` file (see `.env.example`)

## 2. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy create-booking
supabase functions deploy send-whatsapp

# Set secrets for WhatsApp (Twilio)
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=your_token
supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

## 3. Raed Payment Integration

1. Register at https://raed.sa as a merchant
2. Get your **API Key** and **Merchant ID** from the dashboard
3. Add to `.env`:
   ```
   VITE_RAED_API_KEY=raed_live_...
   VITE_RAED_MERCHANT_ID=merchant_...
   VITE_RAED_MODE=production
   ```

## 4. WhatsApp via Twilio

1. Create account at https://twilio.com
2. Enable WhatsApp in the Twilio Console
3. For production: apply for a **WhatsApp Business Profile**
4. Set secrets in Supabase (see step 2)

## 5. Re-deploy frontend

```bash
# Copy .env.example to .env and fill in values, then:
npm run build && npm run deploy
```
