import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Usa el Service Role para saltar el RLS
  )

  const body = await req.json()
  const { event } = body
  
  // App User ID que configuraste en RevenueCat (normalmente el ID de Supabase)
  const userId = event.app_user_id 
  
  // Tipos de eventos de RevenueCat
  const isExpired = event.type === 'EXPIRATION'
  const isCanceled = event.type === 'CANCELLATION'
  const isPurchased = event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL'

  let isPremium = false
  if (isPurchased) isPremium = true
  if (isExpired || isCanceled) isPremium = false

  // Actualizar la tabla profiles
  const { error } = await supabase
    .from('profiles')
    .update({ is_premium: isPremium })
    .eq('id', userId)

  if (error) return new Response(JSON.stringify(error), { status: 500 })

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
})