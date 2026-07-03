import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

const COINS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT']

// ---------- indicator helpers ----------
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values[0]
  out.push(prev)
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1]
    if (ch >= 0) gain += ch; else loss -= ch
  }
  let ag = gain / period, al = loss / period
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1]
    const g = ch > 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    ag = (ag * (period - 1) + g) / period
    al = (al * (period - 1) + l) / period
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al)
  }
  return out
}

function macd(values: number[]) {
  const e12 = ema(values, 12), e26 = ema(values, 26)
  const line = values.map((_, i) => e12[i] - e26[i])
  const sig = ema(line.slice(25), 9)
  const last = line[line.length - 1]
  const lastSig = sig[sig.length - 1]
  return { hist: last - lastSig }
}

function bollinger(values: number[], period = 20, mult = 2) {
  if (values.length < period) return { pct: null as number | null }
  const slice = values.slice(-period)
  const mean = slice.reduce((a, b) => a + b, 0) / period
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
  const sd = Math.sqrt(variance)
  const upper = mean + mult * sd, lower = mean - mult * sd
  const price = values[values.length - 1]
  return { pct: upper === lower ? 0.5 : (price - lower) / (upper - lower) }
}

// ---------- Whale Radar ----------
// Binance'in ücretsiz aggTrades endpoint'inden son işlemleri tarar,
// tek seferde büyük miktar (varsayılan $250k+) alım/satım olursa "whale hareketi" sayar.
// Kimseyi hedef almaz, sadece büyük paranın nereye gittiğini takip eder.
const WHALE_THRESHOLD_USD = 250_000

interface WhaleActivity {
  buyUsd: number
  sellUsd: number
  biggestUsd: number
  biggestSide: 'BUY' | 'SELL' | null
}

async function fetchWhaleActivity(symbol: string): Promise<WhaleActivity> {
  const url = `https://api.bybit.com/v5/market/recent-trade?category=spot&symbol=${symbol}&limit=1000`
  const r = await fetch(url)
  if (!r.ok) return { buyUsd: 0, sellUsd: 0, biggestUsd: 0, biggestSide: null }
  const j = await r.json() as any
  if (j.retCode !== 0) return { buyUsd: 0, sellUsd: 0, biggestUsd: 0, biggestSide: null }
  const trades = (j.result?.list ?? []) as any[]
  let buyUsd = 0, sellUsd = 0, biggestUsd = 0
  let biggestSide: 'BUY' | 'SELL' | null = null
  for (const t of trades) {
    const price = parseFloat(t.price)
    const qty = parseFloat(t.size)
    const usd = price * qty
    const isBuy = t.side === 'Buy' // Bybit'te "Buy" = agresif alıcı (taker buy), yani alım baskısı
    if (usd >= WHALE_THRESHOLD_USD) {
      if (usd > biggestUsd) { biggestUsd = usd; biggestSide = isBuy ? 'BUY' : 'SELL' }
      if (isBuy) buyUsd += usd; else sellUsd += usd
    }
  }
  return { buyUsd, sellUsd, biggestUsd, biggestSide }
}

// ---------- signal logic (mirrors public/keltos.html signalLogic) ----------
function signalLogic(
  price: number, prevPrice: number,
  rsiVal: number | null, prevRsi: number | null,
  e20: number, e50: number, e20Prev: number,
  macdData: { hist: number | null },
  bbData: { pct: number | null },
  volData: { ratio: number | null },
  whale: WhaleActivity
) {
  if (!rsiVal || !e20 || !e50) return { signal: 'WAIT', quality: 'ZAYIF', score: 0, whale }
  const rsiTurn = prevRsi !== null && prevRsi < 30 && rsiVal >= 30
  const rsiOS = rsiVal < 30
  const above20 = price > e20
  const crossed20 = prevPrice < e20 && price >= e20
  const below20 = price < e20
  const trendOk = e20 >= e50
  const slopeUp = e20Prev ? e20 > e20Prev : false
  const overbought = rsiVal > 70
  const macdBull = macdData.hist !== null && macdData.hist > 0
  const macdBear = macdData.hist !== null && macdData.hist < 0
  const bbOS = bbData.pct !== null && bbData.pct < 0.2
  const bbOB = bbData.pct !== null && bbData.pct > 0.8
  const highVol = volData.ratio !== null && volData.ratio > 1.3
  const whaleBuy = whale.buyUsd > whale.sellUsd * 1.5 && whale.buyUsd > 0
  const whaleSell = whale.sellUsd > whale.buyUsd * 1.5 && whale.sellUsd > 0

  let buy = 0
  if (rsiTurn) buy += 35; else if (rsiOS) buy += 22
  if (above20) buy += 22; if (crossed20) buy += 8
  if (trendOk) buy += 18; if (slopeUp) buy += 12
  if (macdBull) buy += 15; if (bbOS) buy += 10; if (highVol) buy += 8
  if (whaleBuy) buy += 15

  let sell = 0
  if (overbought) sell += 40; if (below20) sell += 35
  if (e20 < e50) sell += 10; if (macdBear) sell += 12; if (bbOB) sell += 8
  if (whaleSell) sell += 15

  const ultra = rsiTurn && above20 && trendOk && slopeUp && macdBull && buy >= 85
  if (sell >= 75) {
    const q = sell >= 90 ? 'ULTRA' : sell >= 70 ? 'GÜÇLÜ' : 'ORTA'
    return { signal: 'SELL', quality: q, score: Math.min(100, sell), whale }
  }
  if (ultra) return { signal: 'BUY', quality: 'ULTRA', score: Math.min(100, buy), whale }
  if (buy >= 70) return { signal: 'BUY', quality: 'GÜÇLÜ', score: Math.min(100, buy), whale }
  if (buy >= 50) return { signal: 'BUY', quality: 'ORTA', score: Math.min(100, buy), whale }
  if (sell >= 55) return { signal: 'SELL', quality: 'ORTA', score: Math.min(100, sell), whale }
  return { signal: 'WAIT', quality: 'ZAYIF', score: Math.max(buy, sell), whale }
}

// ---------- Binance fetchers ----------
async function fetchKlines(symbol: string) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=100`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`klines ${symbol} ${r.status}`)
  const j = await r.json() as any
  if (j.retCode !== 0) throw new Error(`klines ${symbol} retCode ${j.retCode} ${j.retMsg}`)
  const list = (j.result?.list ?? []) as string[][]
  // Bybit en yeniyi en başa koyar, bizim hesaplamalar eskiden yeniye sıralama bekliyor.
  return list.slice().reverse()
}

async function fetchPrice(symbol: string): Promise<number> {
  const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`)
  if (!r.ok) throw new Error(`price ${symbol} ${r.status}`)
  const j = await r.json() as any
  if (j.retCode !== 0) throw new Error(`price ${symbol} retCode ${j.retCode}`)
  return parseFloat(j.result.list[0].lastPrice)
}

async function analyzeCoin(symbol: string, klines: any[][]) {
  const closes = klines.map(k => parseFloat(k[4]))
  const volumes = klines.map(k => parseFloat(k[5]))
  const price = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]
  const e20Arr = ema(closes, 20)
  const e50Arr = ema(closes, 50)
  const rsiArr = rsi(closes, 14)
  const e20 = e20Arr[e20Arr.length - 1]
  const e20Prev = e20Arr[e20Arr.length - 2]
  const e50 = e50Arr[e50Arr.length - 1]
  const rsiVal = rsiArr[rsiArr.length - 1]
  const prevRsi = rsiArr[rsiArr.length - 2]
  const macdData = macd(closes)
  const bbData = bollinger(closes)
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const volData = { ratio: avgVol ? volumes[volumes.length - 1] / avgVol : null }
  const whale = await fetchWhaleActivity(symbol)
  const sig = signalLogic(price, prevPrice, rsiVal, prevRsi, e20, e50, e20Prev, macdData, bbData, volData, whale)
  return { ...sig, price }
}

const TELEGRAM_CHAT_ID = '-1003733127546'

function fmtPrice(p: number): string {
  if (p >= 100) return p.toFixed(2)
  if (p >= 1) return p.toFixed(4)
  return p.toFixed(6)
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1000).toFixed(0)}K`
}

async function sendTelegram(coin: string, signal: string, quality: string, score: number, price: number, whale: WhaleActivity) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  const symbol = coin.replace(/USDT$/, '')
  const isBuy = signal === 'BUY'
  const emoji = isBuy ? '🟢' : '🔴'
  const stop = isBuy ? price * 0.98 : price * 1.02
  const target = isBuy ? price * 1.04 : price * 0.96
  const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const whaleLine = whale.biggestUsd > 0
    ? `\n🐋 Whale: ${whale.biggestSide === 'BUY' ? 'Büyük ALIM' : 'Büyük SATIM'} — en büyük işlem ${fmtUsd(whale.biggestUsd)}\n━━━━━━━━━━━━━━`
    : ''
  const text =
`${emoji} KELTOŞ SİNYAL · ${signal}
━━━━━━━━━━━━━━
💰 Coin: ${symbol}/USDT
⭐ Kalite: ${quality} · Skor: ${score}/100${whaleLine}
━━━━━━━━━━━━━━
🎯 Giriş: ${fmtPrice(price)}
🛑 Stop: ${fmtPrice(stop)}
✅ Hedef: ${fmtPrice(target)}
━━━━━━━━━━━━━━
⏰ ${time}
⚠️ Yatırım tavsiyesi değildir.`
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`telegram ${r.status}: ${body.slice(0, 200)}`)
  }
}

export const Route = createFileRoute('/api/public/hooks/kpk-signals-cron')({

  server: {
    handlers: {
      POST: async () => {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        )

        const inserted: string[] = []
        const closed: string[] = []
        const errors: string[] = []

        // 1) Generate new signals
        for (const coin of COINS) {
          try {
            const klines = await fetchKlines(coin)
            const a = await analyzeCoin(coin, klines)
            if ((a.signal === 'BUY' || a.signal === 'SELL') && a.score >= 75) {
              // dedupe: same coin+signal today
              const { data: dup } = await supabase
                .from('kpk_signals')
                .select('id')
                .eq('coin', coin)
                .eq('signal', a.signal)
                .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString())
                .limit(1)
              if (!dup || dup.length === 0) {
                const { error } = await supabase.from('kpk_signals').insert({
                  coin, signal: a.signal, score: Math.round(a.score),
                  quality: a.quality, price: a.price,
                })
                if (error) errors.push(`${coin} insert: ${error.message}`)
                else {
                  inserted.push(`${coin} ${a.signal} ${a.score}`)
                  try {
                    await sendTelegram(coin, a.signal, a.quality, Math.round(a.score), a.price, a.whale)
                  } catch (te: any) {
                    errors.push(`${coin} telegram: ${te.message}`)
                  }
                }
              }
            }
          } catch (e: any) {
            errors.push(`${coin}: ${e.message}`)
          }
        }


        // 2) Resolve open signals older than 1h
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: openSigs } = await supabase
          .from('kpk_signals')
          .select('id, coin, signal, price')
          .eq('result', 'bekliyor')
          .lt('created_at', oneHourAgo)

        const priceCache = new Map<string, number>()
        for (const row of openSigs ?? []) {
          try {
            let cur = priceCache.get(row.coin)
            if (cur === undefined) {
              cur = await fetchPrice(row.coin)
              priceCache.set(row.coin, cur)
            }
            const entry = Number(row.price)
            let result: 'tuttu' | 'tutmadi' | null = null
            if (row.signal === 'BUY') {
              if (cur >= entry * 1.04) result = 'tuttu'
              else if (cur <= entry * 0.98) result = 'tutmadi'
            } else if (row.signal === 'SELL') {
              if (cur <= entry * 0.96) result = 'tuttu'
              else if (cur >= entry * 1.02) result = 'tutmadi'
            }
            if (result) {
              const { error } = await supabase
                .from('kpk_signals')
                .update({ result, closed_at: new Date().toISOString() })
                .eq('id', row.id)
              if (error) errors.push(`update ${row.id}: ${error.message}`)
              else closed.push(`${row.coin} ${row.signal} → ${result}`)
            }
          } catch (e: any) {
            errors.push(`resolve ${row.coin}: ${e.message}`)
          }
        }

        console.log('kpk-signals-cron result', JSON.stringify({ inserted, closed, errors }))
        return Response.json({ ok: true, inserted, closed, errors })
      },
    },
  },
})
