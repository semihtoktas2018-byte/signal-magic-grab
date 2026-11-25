// KELTOŞ — Sinyal üretim & TP/SL çözüm cron'u (Supabase Edge Function, Deno)
//
// Bu fonksiyon, eski TanStack route'undaki (src/routes/api/public/hooks/
// kpk-signals-cron.ts) tüm mantığı birebir taşır: indikatörler, whale radar,
// Bybit/OKX fiyat karşılaştırması, Signal Engine V2 skorlaması, TP/SL resolver
// ve Telegram bildirimleri.
//
// Gizli anahtarlar YALNIZCA ortam değişkeninden okunur (Supabase Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET
// Hiçbir gizli anahtar bu dosyada gömülü değildir.
//
// Güvenlik: pg_cron çağrısı x-cron-secret header'ında CRON_SECRET göndermelidir;
// eşleşmezse 401 döner.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { calculateBollingerPct, calculateEma, calculateMacdHistogram, calculateRelativeVolumeRatio, calculateRsi, calculateV1Signal, evaluateCandleOutcome, getTradeLevels } from '../../../src/lib/signal-math.ts'

// ============================================================
// Signal Engine V2 (Phase 1) — src/lib/signal-engine-v2.ts'ten taşındı
// ============================================================
interface V2Inputs {
  price: number
  prevPrice: number
  rsi: number | null
  prevRsi: number | null
  ema20: number
  ema20Prev: number
  ema50: number
  macdHist: number | null
  bbPct: number | null
  volRatio: number | null
  whaleBuyUsd: number
  whaleSellUsd: number
  fearGreed?: number | null
  funding?: number | null
  volatilityPct?: number | null
}
type V2Direction = 'BUY' | 'SELL' | 'WAIT'
interface V2Factor {
  key: string
  label: string
  weight: number
  effectiveWeight: number
  available: boolean
  value: number
  contribution: number
}
interface V2Result {
  version: 'v2'
  direction: V2Direction
  score: number
  bias: number
  quality: 'ULTRA' | 'GÜÇLÜ' | 'ORTA' | 'ZAYIF'
  coverage: number
  factors: V2Factor[]
}

const V2_WEIGHTS = {
  trend: 0.3,
  momentum: 0.25,
  volume: 0.15,
  whale: 0.15,
  sentiment: 0.1,
  volatility: 0.05,
} as const

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n))

function trendScore(i: V2Inputs): number | null {
  if (!i.ema20 || !i.ema50) return null
  const spread = (i.ema20 - i.ema50) / i.ema50
  const slope = i.ema20Prev ? (i.ema20 - i.ema20Prev) / i.ema20Prev : 0
  const position = i.ema20 ? (i.price - i.ema20) / i.ema20 : 0
  return clamp(0.5 * clamp(spread / 0.015) + 0.3 * clamp(slope / 0.004) + 0.2 * clamp(position / 0.01))
}

function momentumScore(i: V2Inputs): number | null {
  const parts: number[] = []
  if (i.rsi !== null && i.rsi !== undefined) {
    let v = clamp((50 - i.rsi) / 20)
    if (i.prevRsi !== null && i.prevRsi !== undefined) {
      if (i.prevRsi < 30 && i.rsi >= 30) v = clamp(v + 0.35)
      if (i.prevRsi > 70 && i.rsi <= 70) v = clamp(v - 0.35)
    }
    parts.push(v)
  }
  if (i.macdHist !== null && i.macdHist !== undefined && i.price) {
    parts.push(clamp(i.macdHist / i.price / 0.003))
  }
  if (i.bbPct !== null && i.bbPct !== undefined) {
    parts.push(clamp((0.5 - i.bbPct) * 2) * 0.5)
  }
  if (!parts.length) return null
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length)
}

function volumeScore(i: V2Inputs, directionalBias: number): number | null {
  if (i.volRatio === null || i.volRatio === undefined) return null
  const strength = clamp((i.volRatio - 1) / 0.6, 0, 1)
  return clamp(strength * (directionalBias >= 0 ? 1 : -1))
}

function whaleScore(i: V2Inputs): number | null {
  const total = (i.whaleBuyUsd || 0) + (i.whaleSellUsd || 0)
  if (total <= 0) return null
  return clamp((i.whaleBuyUsd - i.whaleSellUsd) / total)
}

function sentimentScore(i: V2Inputs): number | null {
  const parts: number[] = []
  if (i.fearGreed !== null && i.fearGreed !== undefined) {
    parts.push(clamp((50 - i.fearGreed) / 30))
  }
  if (i.funding !== null && i.funding !== undefined) {
    parts.push(clamp(-i.funding / 0.0005))
  }
  if (!parts.length) return null
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length)
}

function volatilityScore(i: V2Inputs, directionalBias: number): number | null {
  if (i.volatilityPct === null || i.volatilityPct === undefined) return null
  const penalty = clamp((i.volatilityPct - 1.5) / 3, 0, 1)
  return clamp((1 - 2 * penalty) * (directionalBias >= 0 ? 1 : -1))
}

function qualityOf(score: number): V2Result['quality'] {
  if (score >= 85) return 'ULTRA'
  if (score >= 72) return 'GÜÇLÜ'
  if (score >= 55) return 'ORTA'
  return 'ZAYIF'
}

function scoreSignalV2(i: V2Inputs): V2Result {
  const trend = trendScore(i)
  const momentum = momentumScore(i)
  const whale = whaleScore(i)
  const sentiment = sentimentScore(i)

  const coreEntries: Array<[number, number | null]> = [
    [V2_WEIGHTS.trend, trend],
    [V2_WEIGHTS.momentum, momentum],
    [V2_WEIGHTS.whale, whale],
    [V2_WEIGHTS.sentiment, sentiment],
  ]
  const coreW = coreEntries.filter(([, v]) => v !== null).reduce((a, [w]) => a + w, 0)
  const coreBias = coreW
    ? coreEntries.filter(([, v]) => v !== null).reduce((a, [w, v]) => a + w * (v as number), 0) / coreW
    : 1

  const volume = volumeScore(i, coreBias)
  const volatility = volatilityScore(i, coreBias)

  const raw: Array<{ key: string; label: string; weight: number; value: number | null }> = [
    { key: 'trend', label: 'Trend (EMA20/50)', weight: V2_WEIGHTS.trend, value: trend },
    { key: 'momentum', label: 'Momentum (RSI + MACD)', weight: V2_WEIGHTS.momentum, value: momentum },
    { key: 'volume', label: 'Hacim / Likidite', weight: V2_WEIGHTS.volume, value: volume },
    { key: 'whale', label: 'Whale akışı', weight: V2_WEIGHTS.whale, value: whale },
    { key: 'sentiment', label: 'Funding / Fear & Greed', weight: V2_WEIGHTS.sentiment, value: sentiment },
    { key: 'volatility', label: 'Oynaklık', weight: V2_WEIGHTS.volatility, value: volatility },
  ]

  const coverage = raw.filter((f) => f.value !== null).reduce((a, f) => a + f.weight, 0)
  const norm = coverage > 0 ? 1 / coverage : 0

  const factors: V2Factor[] = raw.map((f) => {
    const available = f.value !== null
    const effectiveWeight = available ? f.weight * norm : 0
    const value = available ? (f.value as number) : 0
    return {
      key: f.key,
      label: f.label,
      weight: f.weight,
      effectiveWeight: Number(effectiveWeight.toFixed(4)),
      available,
      value: Number(value.toFixed(4)),
      contribution: Number((effectiveWeight * value).toFixed(4)),
    }
  })

  const bias = clamp(factors.reduce((a, f) => a + f.contribution, 0)) * 100
  const score = Math.round(Math.abs(bias))
  const direction: V2Direction = score < 45 ? 'WAIT' : bias > 0 ? 'BUY' : 'SELL'

  return {
    version: 'v2',
    direction,
    score,
    bias: Math.round(bias),
    quality: direction === 'WAIT' ? 'ZAYIF' : qualityOf(score),
    coverage: Number(coverage.toFixed(4)),
    factors,
  }
}

function agreementWithV1(v1Signal: string, v2: V2Result): 'confirm' | 'conflict' | 'neutral' {
  if (v2.direction === 'WAIT' || v1Signal === 'WAIT') return 'neutral'
  return v1Signal === v2.direction ? 'confirm' : 'conflict'
}

type V2Comparison = 'V2 Better' | 'V2 Same' | 'V2 Lower'
function compareScores(v1Score: number, v2Score: number, tolerance = 3): V2Comparison {
  const diff = v2Score - v1Score
  if (Math.abs(diff) <= tolerance) return 'V2 Same'
  return diff > 0 ? 'V2 Better' : 'V2 Lower'
}

// ============================================================
// Konfigürasyon
// ============================================================
const COINS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT']

// Skoru bu eşiğin altındaki BUY/SELL'ler kaydedilmez; her turda en yüksek
// skorlu ilk N coin kaydedilir (korele sinyal yığılmasını önler).
const RECORD_THRESHOLD = 75
const MAX_SIGNALS_PER_RUN = 2


// ---------- indicator helpers ----------
const ema = calculateEma
const rsi = calculateRsi
const macd = (values: number[]) => ({ hist: calculateMacdHistogram(values) })
const bollinger = (values: number[], period = 20, mult = 2) => ({ pct: calculateBollingerPct(values, period, mult) })

// ---------- Whale Radar ----------
const WHALE_THRESHOLD_USD = 250_000

interface WhaleActivity {
  buyUsd: number
  sellUsd: number
  biggestUsd: number
  biggestSide: 'BUY' | 'SELL' | null
  biggestTradeId: string | null
  biggestTradeAt: string | null
  biggestTradePrice: number | null
  apiStatus: 'ok' | 'error'
  tradesScanned: number
  qualifyingTrades: number
  apiError: string | null
}

async function fetchWhaleActivity(symbol: string, category: 'spot' | 'linear' = 'spot'): Promise<WhaleActivity> {
  const limit = category === 'spot' ? 60 : 1000
  const url = `https://api.bybit.com/v5/market/recent-trade?category=${category}&symbol=${symbol}&limit=${limit}`
  let j: any
  try {
    j = await fetchBybitMarketJson(url, `whale ${symbol}`)
  } catch (error) {
    // Preserve zero-flow fallback, but expose the failure for operational diagnostics.
    const apiError = error instanceof Error ? error.message : String(error)
    return { buyUsd: 0, sellUsd: 0, biggestUsd: 0, biggestSide: null, biggestTradeId: null, biggestTradeAt: null, biggestTradePrice: null, apiStatus: 'error', tradesScanned: 0, qualifyingTrades: 0, apiError }
  }
  const trades = (j.result?.list ?? []) as any[]
  let buyUsd = 0, sellUsd = 0, biggestUsd = 0
  let biggestSide: 'BUY' | 'SELL' | null = null
  let biggestTradeId: string | null = null
  let biggestTradeAt: string | null = null
  let biggestTradePrice: number | null = null
  let qualifyingTrades = 0
  for (const t of trades) {
    const price = parseFloat(t.price)
    const qty = parseFloat(t.size)
    const usd = price * qty
    const isBuy = t.side === 'Buy'
    if (usd >= WHALE_THRESHOLD_USD) {
      qualifyingTrades++
      if (usd > biggestUsd) {
        biggestUsd = usd
        biggestSide = isBuy ? 'BUY' : 'SELL'
        biggestTradeId = String(t.execId ?? '')
        biggestTradePrice = price
        const tradeTime = Number(t.time)
        biggestTradeAt = Number.isFinite(tradeTime) && tradeTime > 0
          ? new Date(tradeTime).toISOString()
          : null
      }
      if (isBuy) buyUsd += usd; else sellUsd += usd
    }
  }
  return { buyUsd, sellUsd, biggestUsd, biggestSide, biggestTradeId, biggestTradeAt, biggestTradePrice, apiStatus: 'ok', tradesScanned: trades.length, qualifyingTrades, apiError: null }
}

// ---------- Exchange comparison (Bybit vs OKX) ----------
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

async function fetchOkxPrice(symbol: string): Promise<number> {
  const instId = symbol.replace('USDT', '-USDT')
  const maxAttempts = 3
  let lastErr = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`)
    if (r.ok) {
      const j = await r.json() as any
      if (j.code !== '0' || !j.data?.[0]) throw new Error(`okx ${symbol} bad response`)
      const price = Number(j.data[0].last)
      if (!Number.isFinite(price) || price <= 0) throw new Error(`okx ${symbol} invalid price`)
      return price
    }
    lastErr = `okx ${symbol} ${r.status}`
    if (r.status === 429 || r.status >= 500) {
      if (attempt < maxAttempts) await sleep(400 * attempt)
      continue
    }
    throw new Error(lastErr)
  }
  throw new Error(lastErr)
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
  const result = calculateV1Signal({
    price, prevPrice, rsi: rsiVal, prevRsi,
    ema20: e20, ema50: e50, ema20Prev: e20Prev,
    macdHist: macdData.hist, bbPct: bbData.pct,
    volumeRatio: volData.ratio,
    whaleBuyUsd: whale.buyUsd, whaleSellUsd: whale.sellUsd,
  })
  return { ...result, whale }
}

// Bybit market endpoints can return HTTP 429 or retCode 10006 during bursts.
// Retry only transient rate-limit/server/network failures; keep attempts bounded.
async function fetchBybitMarketJson(url: string, label: string): Promise<any> {
  const maxAttempts = 3
  let lastError = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        lastError = `${label} HTTP ${response.status}`
        const retryable = response.status === 429 || response.status >= 500
        if (!retryable || attempt === maxAttempts) throw new Error(lastError)
      } else {
        const body = await response.json() as any
        if (body.retCode === 0) return body
        lastError = `${label} retCode ${body.retCode} ${body.retMsg ?? ''}`.trim()
        if (body.retCode !== 10006 || attempt === maxAttempts) throw new Error(lastError)
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      const retryable = /HTTP 429|HTTP 5\d\d|retCode 10006|fetch failed|network/i.test(lastError)
      if (!retryable || attempt === maxAttempts) throw new Error(lastError)
    }
    await sleep(500 * attempt)
  }
  throw new Error(lastError || `${label} failed after retries`)
}

// ---------- Resolve kline fetcher (15dk) ----------
async function fetchResolveKlines(symbol: string, startMs: number, endMs: number): Promise<Array<[string, string, string, string, string, string]>> {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&start=${startMs}&end=${endMs}&limit=1000`
  const j = await fetchBybitMarketJson(url, `resolve klines ${symbol}`)
  const list = (j.result?.list ?? []) as Array<[string, string, string, string, string, string]>
  return list
}

// ---------- TP/SL resolution using historical klines ----------
interface TPSLResolution {
  result: 'tuttu' | 'tutmadi' | 'suresi_doldu' | null
  closedAt: string | null
  error?: string
}

const RESOLVE_WINDOW_HOURS = 48

async function resolveTPSLWithKlines(
  symbol: string,
  signal: 'BUY' | 'SELL',
  entryPrice: number,
  createdAtISO: string
): Promise<TPSLResolution> {
  const createdAtMs = new Date(createdAtISO).getTime()
  const endMs = createdAtMs + RESOLVE_WINDOW_HOURS * 60 * 60 * 1000

  const batch = await fetchResolveKlines(symbol, createdAtMs, endMs)
  const parsed: Array<{ openTime: number; high: number; low: number }> = []
  for (const k of batch) {
    const openTime = Number(k[0])
    const high = Number(k[2])
    const low = Number(k[3])
    if (Number.isFinite(openTime) && Number.isFinite(high) && Number.isFinite(low) && high > 0 && low > 0) {
      parsed.push({ openTime, high, low })
    }
  }

  if (parsed.length === 0) return { result: null, closedAt: null }

  parsed.sort((a, b) => a.openTime - b.openTime)
  const unique = parsed.filter((candle, index) => index === 0 || candle.openTime !== parsed[index - 1].openTime)

  const intervalMs = 15 * 60 * 1000
  const firstExpected = Math.ceil(createdAtMs / intervalMs) * intervalMs
  const observedTimes = new Set(unique
    .filter((candle) => candle.openTime >= firstExpected && candle.openTime + intervalMs <= endMs)
    .map((candle) => candle.openTime))
  const hasCompleteCoverageThrough = (lastOpenTime: number): boolean => {
    if (lastOpenTime < firstExpected) return false
    for (let time = firstExpected; time <= lastOpenTime; time += intervalMs) {
      if (time + intervalMs > endMs || !observedTimes.has(time)) return false
    }
    return true
  }

  const { target: tp, stop: sl } = getTradeLevels(signal, entryPrice)

  for (const candle of unique) {
    // Sinyal anında açık olan mumun sinyal öncesi hareketlerini kullanma.
    if (candle.openTime < createdAtMs) continue
    // 48 saatlik pencerenin dışına taşan mumları sonuç hesabına katma.
    if (candle.openTime >= endMs || candle.openTime + 15 * 60 * 1000 > endMs) break
    if (candle.openTime + 15 * 60 * 1000 > Date.now()) break

    const candleOutcome = evaluateCandleOutcome(signal, entryPrice, candle.high, candle.low)
    if (candleOutcome !== null) {
      // Önceki mumlarda veri boşluğu varsa ilk TP/SL temasını kesin sonuç sayma.
      if (!hasCompleteCoverageThrough(candle.openTime)) return { result: null, closedAt: null }
      return { result: candleOutcome, closedAt: new Date(candle.openTime).toISOString() }
    }
  }

  if (Date.now() < endMs) return { result: null, closedAt: null }

  // Süre doldu kararı yalnızca sinyal sonrası tüm 15 dakikalık mumlar eksiksizse verilir.
  const lastExpected = Math.floor((endMs - intervalMs) / intervalMs) * intervalMs
  const complete = lastExpected >= firstExpected && hasCompleteCoverageThrough(lastExpected)

  return complete
    ? { result: 'suresi_doldu', closedAt: new Date(endMs).toISOString() }
    : { result: null, closedAt: null }
}

// ---------- Bybit fetchers ----------
async function fetchKlines(symbol: string) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=100`
  const j = await fetchBybitMarketJson(url, `klines ${symbol}`)
  const list = (j.result?.list ?? []) as string[][]
  const now = Date.now()
  const closedCandles = list
    .filter((k) => Number(k[0]) + 15 * 60 * 1000 <= now)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  if (closedCandles.length < 50) {
    throw new Error(`klines ${symbol}: insufficient closed candles (${closedCandles.length})`)
  }
  return closedCandles
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
  const volData = { ratio: calculateRelativeVolumeRatio(volumes, 20) }
  const whale = await fetchWhaleActivity(symbol)
  const sig = signalLogic(price, prevPrice, rsiVal, prevRsi, e20, e50, e20Prev, macdData, bbData, volData, whale)
  const recent = closes.slice(-15)
  const volatilityPct = recent.length > 1 && price
    ? (Math.sqrt(recent.reduce((a, c) => a + (c - recent.reduce((x, y) => x + y, 0) / recent.length) ** 2, 0) / recent.length) / price) * 100
    : null
  const v2 = scoreSignalV2({
    price, prevPrice,
    rsi: rsiVal, prevRsi,
    ema20: e20, ema20Prev: e20Prev, ema50: e50,
    macdHist: macdData.hist,
    bbPct: bbData.pct,
    volRatio: volData.ratio,
    whaleBuyUsd: whale.buyUsd,
    whaleSellUsd: whale.sellUsd,
    volatilityPct,
    funding: null,
    fearGreed: null,
  })
  return {
    ...sig, price, v2,
    v2Agreement: agreementWithV1(sig.signal, v2),
    v2Comparison: compareScores(Math.round(sig.score), v2.score),
    components: {
      rsi: rsiVal,
      ema20: e20,
      ema50: e50,
      emaTrend: e20 >= e50 ? 'up' : 'down',
      macdHist: macdData.hist,
      bbPct: bbData.pct,
      volRatio: volData.ratio,
      whaleBuyUsd: whale.buyUsd,
      whaleSellUsd: whale.sellUsd,
      v2Score: v2.score,
    },
  }
}

// Faz 0: skor bandı etiketi (analiz için)
function scoreBand(score: number): string {
  if (score >= 88) return '88+'
  if (score >= 82) return '82-87'
  if (score >= 75) return '75-81'
  if (score >= 70) return '70-74'
  return '<70'
}

async function fetchTicker(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`
    const j = await fetchBybitMarketJson(url, `ticker ${symbol}`)
    const p = Number(j.result?.list?.[0]?.lastPrice)
    return Number.isFinite(p) && p > 0 ? p : null
  } catch {
    return null
  }
}

function fmtPrice(p: number): string {
  if (p >= 100) return p.toFixed(2)
  if (p >= 1) return p.toFixed(4)
  return p.toFixed(6)
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${(n / 1000).toFixed(0)}K`
}

async function sendTelegram(coin: string, signal: string, quality: string, score: number, price: number, whale: WhaleActivity, brandName: string, chatId: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  if (!chatId) throw new Error('TELEGRAM_CHAT_ID not configured')
  const symbol = coin.replace(/USDT$/, '')
  const isBuy = signal === 'BUY'
  const emoji = isBuy ? '🟢' : '🔴'
  const { stop, target } = getTradeLevels(signal as 'BUY' | 'SELL', price)
  const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const whaleLine = whale.biggestUsd > 0
    ? `\n🐋 Whale: ${whale.biggestSide === 'BUY' ? 'Büyük ALIM' : 'Büyük SATIM'} — en büyük işlem ${fmtUsd(whale.biggestUsd)}\n━━━━━━━━━━━━━━`
    : ''
  const text =
`${emoji} ${brandName} · ${signal}
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
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`telegram ${r.status}: ${body.slice(0, 200)}`)
  }
}

// Faz 1: sinyal kapanınca anlık sonuç bildirimi (tuttu/tutmadı)
async function sendResult(coin: string, signal: string, result: 'tuttu' | 'tutmadi', createdAt: string, brandName: string, chatId: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token || !chatId) return
  const symbol = coin.replace(/USDT$/, '')
  const win = result === 'tuttu'
  const emoji = win ? '✅' : '❌'
  const pct = win ? '+%2.5' : '-%2'
  const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
  const dur = mins >= 60 ? `${Math.floor(mins / 60)}s ${mins % 60}dk` : `${mins}dk`
  const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const text =
`${emoji} ${brandName} · SONUÇ · ${win ? 'TUTTU' : 'TUTMADI'}
━━━━━━━━━━━━━━
💰 ${symbol}/USDT · ${signal}
${win ? '🎯 Hedefe ulaştı' : '🛑 Stop oldu'} (${pct})
⏱️ Süre: ${dur}
━━━━━━━━━━━━━━
⏰ ${time}
⚠️ Yatırım tavsiyesi değildir.`
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`telegram result ${r.status}: ${body.slice(0, 150)}`)
  }
}

// ============================================================
// Ana cron mantığı
// ============================================================
async function runCron() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: branding } = await supabase
    .from('app_branding')
    .select('brand_name')
    .eq('singleton', true)
    .maybeSingle()
  const brandName = typeof branding?.brand_name === 'string' && branding.brand_name.trim()
    ? branding.brand_name.trim()
    : 'Market Analysis Terminal'
  const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID') ?? ''

  const inserted: string[] = []
  const closed: string[] = []
  const errors: string[] = []
  const whaleLogged: string[] = []
  const whaleDiagnostics: Array<Record<string, unknown>> = []
  const exchangeCompared: string[] = []
  const v2Report: Array<Record<string, unknown>> = []
  const candidates: Array<{
    coin: string
    signal: 'BUY' | 'SELL'
    score: number
    quality: string
    price: number
    whale: WhaleActivity
    components: Record<string, unknown>
    scoreBand: string
  }> = []

  // 1) Generate new signals
  for (const coin of COINS) {
    try {
      const klines = await fetchKlines(coin)
      const a = await analyzeCoin(coin, klines)
      whaleDiagnostics.push({ coin, market: 'spot', status: a.whale.apiStatus, tradesScanned: a.whale.tradesScanned, qualifyingTrades: a.whale.qualifyingTrades, biggestUsd: a.whale.biggestUsd, error: a.whale.apiError })

      // Linear USDT perpetual trades are tracked separately; they do not affect Spot signal scoring.
      const linearWhale = await fetchWhaleActivity(coin, 'linear')
      whaleDiagnostics.push({ coin, market: 'linear', status: linearWhale.apiStatus, tradesScanned: linearWhale.tradesScanned, qualifyingTrades: linearWhale.qualifyingTrades, biggestUsd: linearWhale.biggestUsd, error: linearWhale.apiError })
      if (linearWhale.biggestUsd > 0 && linearWhale.biggestSide && linearWhale.biggestTradeId && linearWhale.biggestTradeAt && linearWhale.biggestTradePrice !== null) {
        const { error: linearWhaleErr } = await supabase.from('whale_events').upsert({
          source_trade_id: `linear:${linearWhale.biggestTradeId}`,
          category: 'linear',
          coin, side: linearWhale.biggestSide,
          amount_usd: linearWhale.biggestUsd, price: linearWhale.biggestTradePrice,
          created_at: linearWhale.biggestTradeAt,
        }, { onConflict: 'source_trade_id', ignoreDuplicates: true })
        if (linearWhaleErr) errors.push(`${coin} linear whale insert: ${linearWhaleErr.message}`)
        else whaleLogged.push(`${coin} LINEAR ${linearWhale.biggestSide} ${Math.round(linearWhale.biggestUsd)}`)
      }
      v2Report.push({
        coin, v1: a.signal, v1Score: Math.round(a.score),
        v2: a.v2.direction, v2Score: a.v2.score, v2Bias: a.v2.bias,
        v2Quality: a.v2.quality, agreement: a.v2Agreement,
        v2Coverage: a.v2.coverage, comparison: a.v2Comparison,
      })

      // Bybit vs OKX fiyat karşılaştırması
      try {
        await sleep(150)
        const okxPrice = await fetchOkxPrice(coin)
        const diffPct = ((okxPrice - a.price) / a.price) * 100
        const { error: exErr } = await supabase.from('exchange_prices').upsert({
          coin, bybit_price: a.price, okx_price: okxPrice, diff_pct: diffPct, updated_at: new Date().toISOString(),
        }, { onConflict: 'coin' })
        if (exErr) errors.push(`${coin} exchange_prices: ${exErr.message}`)
        else exchangeCompared.push(`${coin} diff ${diffPct.toFixed(3)}%`)
      } catch (ee: any) {
        errors.push(`${coin} okx: ${ee.message}`)
      }

      if (a.whale.biggestUsd > 0 && a.whale.biggestSide && a.whale.biggestTradeId && a.whale.biggestTradeAt && a.whale.biggestTradePrice !== null) {
        const { error: whaleErr } = await supabase.from('whale_events').upsert({
          source_trade_id: a.whale.biggestTradeId,
          category: 'spot',
          coin, side: a.whale.biggestSide,
          amount_usd: a.whale.biggestUsd, price: a.whale.biggestTradePrice,
          created_at: a.whale.biggestTradeAt,
        }, { onConflict: 'source_trade_id', ignoreDuplicates: true })
        if (whaleErr) errors.push(`${coin} whale insert: ${whaleErr.message}`)
        else whaleLogged.push(`${coin} ${a.whale.biggestSide} ${Math.round(a.whale.biggestUsd)}`)
      }

      if ((a.signal === 'BUY' || a.signal === 'SELL') && a.score >= RECORD_THRESHOLD) {
        candidates.push({
          coin,
          signal: a.signal,
          score: Math.round(a.score),
          quality: a.quality,
          price: a.price,
          whale: a.whale,
          components: a.components,
          scoreBand: scoreBand(Math.round(a.score)),
        })
      }
    } catch (e: any) {
      errors.push(`${coin}: ${e.message}`)
    }
  }

  // 1b) Adaylar arasından en yüksek skorlu ilk N tanesini kaydet.
  candidates.sort((x, y) => y.score - x.score)
  for (const c of candidates.slice(0, MAX_SIGNALS_PER_RUN)) {
    try {
      const { data: dup } = await supabase
        .from('kpk_signals')
        .select('id')
        .eq('coin', c.coin)
        .eq('signal', c.signal)
        .gte('created_at', new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString())
        .limit(1)
      if (dup && dup.length > 0) continue
      const tickerPrice = await fetchTicker(c.coin)
      if (tickerPrice === null || !Number.isFinite(tickerPrice) || tickerPrice <= 0) {
        errors.push(`${c.coin} ticker unavailable or invalid; signal not recorded`)
        continue
      }
      const entryPrice = tickerPrice
      const entrySnapshotAt = new Date().toISOString()
      const { error } = await supabase.from('kpk_signals').insert({
        coin: c.coin, signal: c.signal, score: c.score,
        quality: c.quality, price: entryPrice,
        entry_snapshot: entryPrice,
        entry_snapshot_at: entrySnapshotAt,
        components: c.components,
        score_band: c.scoreBand,
      })
      if (error) {
        errors.push(`${c.coin} insert: ${error.message}`)
        continue
      }
      inserted.push(`${c.coin} ${c.signal} ${c.score}`)
      try {
        await sendTelegram(c.coin, c.signal, c.quality, c.score, entryPrice, c.whale, brandName, telegramChatId)
      } catch (te: any) {
        errors.push(`${c.coin} telegram: ${te.message}`)
      }
    } catch (e: any) {
      errors.push(`record ${c.coin}: ${e.message}`)
    }
  }

  // 2) Açık sinyalleri geçmiş mumlarla kapat.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: openSigs, error: openSigsError } = await supabase
    .from('kpk_signals')
    .select('id, coin, signal, price, created_at, resolve_attempted_at')
    .eq('result', 'bekliyor')
    .lt('created_at', oneHourAgo)
    .order('resolve_attempted_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)

  if (openSigsError) {
    errors.push(`open signals query: ${openSigsError.message}`)
  }

  // Claim the oldest untried/least-recently-tried row before external market-data calls.
  // The timestamp comparison prevents two overlapping cron runs from claiming the same row.
  for (const row of openSigs ?? []) {
    try {
      const attemptedAt = new Date().toISOString()
      let claimQuery = supabase
        .from('kpk_signals')
        .update({ resolve_attempted_at: attemptedAt })
        .eq('id', row.id)
        .eq('result', 'bekliyor')

      claimQuery = row.resolve_attempted_at === null
        ? claimQuery.is('resolve_attempted_at', null)
        : claimQuery.eq('resolve_attempted_at', row.resolve_attempted_at)

      const { data: claimed, error: claimError } = await claimQuery
        .select('id')
        .maybeSingle()

      if (claimError) {
        errors.push(`claim ${row.id}: ${claimError.message}`)
        continue
      }
      if (!claimed) continue

      const entry = Number(row.price)
      const signal = row.signal as 'BUY' | 'SELL'
      const createdAt = row.created_at as string
      const resolution = await resolveTPSLWithKlines(row.coin, signal, entry, createdAt)

      if (resolution.result) {
        const { error } = await supabase
          .from('kpk_signals')
          .update({ result: resolution.result, closed_at: resolution.closedAt })
          .eq('id', row.id)
          .eq('result', 'bekliyor')
        if (error) errors.push(`update ${row.id}: ${error.message}`)
        else {
          closed.push(`${row.coin} ${row.signal} → ${resolution.result}`)
          if (resolution.result !== 'suresi_doldu') {
            try {
              await sendResult(row.coin, row.signal, resolution.result, createdAt, brandName, telegramChatId)
            } catch (te: any) {
              errors.push(`${row.coin} sonuç telegram: ${te.message}`)
            }
          }
        }
      }
    } catch (e: any) {
      errors.push(`resolve ${row.coin}: ${e.message}`)
    }
  }

  console.log('kpk-signals-cron result', JSON.stringify({ inserted, closed, errors, whaleLogged, whaleDiagnostics, exchangeCompared, v2Report }))
  return { ok: true, inserted, closed, errors, whaleLogged, whaleDiagnostics, exchangeCompared, engineV2: v2Report }
}

// ============================================================
// HTTP giriş noktası (Deno)
// ============================================================
Deno.serve(async (req) => {
  // Güvenlik: gelen istekteki x-cron-secret, CRON_SECRET ile eşleşmeli.
  const expected = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret')
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await runCron()
    return Response.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cron_failed'
    console.error('kpk-signals-cron fatal', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
