import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

/**
 * Crypto Fear & Greed (alternative.me) -> Supabase cache -> panel.
 * Günlük veri olduğu için DB'deki son kayıt 6 saatten yeni ise dış API'ye gitmez.
 * API başarısız olursa mevcut cache döner; asla uydurma değer üretilmez.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000

type Row = { value: number; classification: string; source_timestamp: string }

export const Route = createFileRoute('/api/public/hooks/fear-greed')({
  server: {
    handlers: {
      GET: async () => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
          })

        const url = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL']
        const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']
        const publishableKey =
          process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY']
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
          // Dış API başarısızsa yalnızca gerçek cache döner (varsa).
          return json({ data: cached, error: e instanceof Error ? e.message : 'fng_failed' })
        }
      },
    },
  },
})
