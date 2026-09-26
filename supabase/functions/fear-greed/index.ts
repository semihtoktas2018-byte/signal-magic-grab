// KELTOŞ — Crypto Fear & Greed (Supabase Edge Function, Deno)
//
// alternative.me -> Supabase cache (market_sentiment) -> panel.
// Günlük veri olduğu için DB'deki son kayıt 6 saatten yeni ise dış API'ye
// gidilmez. Dış API başarısız olursa yalnızca gerçek cache döner; asla uydurma
// değer üretilmez.
//
// Panel (AISignalIntelligence) bu fonksiyonu tarayıcıdan GET ile çağırır; bu
// yüzden CORS header'ları döner. Gizli anahtar yoktur; service role varsa cache
// yazar, yoksa yalnızca dış API'den okuyup döner.
//
// Not: Bu fonksiyon herkese açık okunabilir olmalı; supabase/config.toml içinde
// [functions.fear-greed] verify_jwt = false ayarı ile deploy edilir.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_AGE_MS = 6 * 60 * 60 * 1000

type Row = { value: number; classification: string; source_timestamp: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publishableKey =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  const key = serviceKey ?? publishableKey

  const db =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null

  const cachedRows = db
    ? (
        await db
          .from('market_sentiment')
          .select('value,classification,source_timestamp')
          .order('source_timestamp', { ascending: false })
          .limit(1)
      ).data
    : null
  const cached = (cachedRows?.[0] as Row | undefined) ?? null

  const fresh =
    cached && Date.now() - new Date(cached.source_timestamp).getTime() < MAX_AGE_MS

  if (fresh) return json({ data: cached, cached: true })

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`fng_http_${res.status}`)
    const payload = (await res.json()) as {
      data?: Array<{ value?: string; value_classification?: string; timestamp?: string }>
    }
    const item = payload.data?.[0]
    const value = Number(item?.value)
    const classification = item?.value_classification
    const ts = Number(item?.timestamp)
    if (!Number.isFinite(value) || !classification || !Number.isFinite(ts)) {
      throw new Error('fng_bad_payload')
    }
    const row: Row = {
      value: Math.round(value),
      classification,
      source_timestamp: new Date(ts * 1000).toISOString(),
    }
    if (db) {
      await db.from('market_sentiment').upsert(row, { onConflict: 'source_timestamp' })
    }
    return json({ data: row, cached: false })
  } catch (e) {
    return json({ data: cached, error: e instanceof Error ? e.message : 'fng_failed' })
  }
})
