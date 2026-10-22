// KELTOŞ — Sinyal üretim & TP/SL çözüm cron'u (Supabase Edge Function, Deno)
//
// Bu fonksiyon, eski TanStack route'undaki (src/routes/api/public/hooks/
// kpk-signals-cron.ts) tüm mantığı birebir taşır: indikatörler, whale radar,
// Bybit/OKX fiyat karşılaştırması, Signal Engine V2 skorlaması, TP/SL resolver
// ve Telegram bildirimleri.
//
// Gizli anahtarlar YALNIZCA ortam değişkeninden okunur (Supabase Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET
// Hiçbir gizli anahtar bu dosyada gömülü değildir.
//
// Güvenlik: pg_cron çağrısı x-cron-secret header'ında CRON_SECRET göndermelidir;
// eşleşmezse 401 döner.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
const RECORD_THRESHOLD = 65
const MAX_SIGNALS_PER_RUN = 4

// TELEGRAM_CHAT_ID kanal kimliğidir (gizli anahtar değil) — kod içinde kalır.
const TELEGRAM_CHAT_ID = '-1003733127546'

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
    const isBuy = t.side === 'Buy'
    if (usd >= WHALE_THRESHOLD_USD) {
      if (usd > biggestUsd) { biggestUsd = usd; biggestSide = isBuy ? 'BUY' : 'SELL' }
      if (isBuy) buyUsd += usd; else sellUsd += usd
    }
  }
  return { buyUsd, sellUsd, biggestUsd, biggestSide }
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
      return parseFloat(j.data[0].last)
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

  const trendDown = e20 < e50
  const slopeDown = e20Prev ? e20 < e20Prev : false

  // ============ BUY puanı ============
  let buy = 0
  if (rsiTurn) buy += 32; else if (rsiOS) buy += 20
  if (above20) buy += 20
  if (crossed20) buy += 10
  if (trendOk) buy += 15
  if (slopeUp) buy += 12
  if (macdBull) buy += 14
  if (bbOS) buy += 8
  if (highVol) buy += 6
  if (whaleBuy) buy += 14
  if (!trendOk || !slopeUp) buy -= 30
  if (whaleSell) buy -= 15

  // ============ SELL puanı ============
  let sell = 0
  if (below20) sell += 28
  if (overbought) sell += 24
  if (trendDown) sell += 18
  if (slopeDown) sell += 12
  if (macdBear) sell += 14
  if (bbOB) sell += 8
  if (highVol) sell += 6
  if (whaleSell) sell += 14
  if (!trendDown || !slopeDown) sell -= 30
  if (whaleBuy) sell -= 15

  buy = Math.max(0, buy)
  sell = Math.max(0, sell)

  if (buy >= 50 && sell >= 50) {
    return { signal: 'WAIT', quality: 'ZAYIF', score: 0, whale }
  }

  const ultraBuy = rsiTurn && above20 && trendOk && slopeUp && macdBull && whaleBuy && buy >= 88
  const ultraSell = below20 && overbought && trendDown && slopeDown && macdBear && whaleSell && sell >= 88

  if (ultraBuy) return { signal: 'BUY', quality: 'ULTRA', score: Math.min(100, buy), whale }
  if (ultraSell) return { signal: 'SELL', quality: 'ULTRA', score: Math.min(100, sell), whale }
  if (buy >= 82) return { signal: 'BUY', quality: 'GÜÇLÜ', score: Math.min(100, buy), whale }
  if (sell >= 82) return { signal: 'SELL', quality: 'GÜÇLÜ', score: Math.min(100, sell), whale }
  if (buy >= 65) return { signal: 'BUY', quality: 'ORTA', score: Math.min(100, buy), whale }
  if (sell >= 65) return { signal: 'SELL', quality: 'ORTA', score: Math.min(100, sell), whale }
  return { signal: 'WAIT', quality: 'ZAYIF', score: Math.max(buy, sell), whale }
}

// ---------- Resolve kline fetcher (15dk) ----------
async function fetchResolveKlines(symbol: string, startMs: number, endMs: number): Promise<Array<[string, string, string, string, string, string]>> {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&start=${startMs}&end=${endMs}&limit=1000`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`resolve klines ${symbol} ${r.status}`)
  const j = await r.json() as any
  if (j.retCode !== 0) throw new Error(`resolve klines ${symbol} retCode ${j.retCode} ${j.retMsg}`)
  const list = (j.result?.list ?? []) as Array<[string, string, string, string, string, string]>
  return list
}

// ---------- TP/SL resolution using historical klines ----------
interface TPSLResolution {
  result: 'tuttu' | 'tutmadi' | null
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
    parsed.push({ openTime: parseInt(k[0], 10), high: parseFloat(k[2]), low: parseFloat(k[3]) })
  }

  if (parsed.length === 0) {
    return { result: null, closedAt: null }
  }

  parsed.sort((a, b) => a.openTime - b.openTime)

  const tp = signal === 'BUY' ? entryPrice * 1.025 : entryPrice * 0.975
  const sl = signal === 'BUY' ? entryPrice * 0.98 : entryPrice * 1.02

  let prevOpen = -1
  for (const candle of parsed) {
    if (candle.openTime === prevOpen) continue
    prevOpen = candle.openTime
    if (candle.openTime < createdAtMs) continue
    if (candle.openTime >= endMs) break

    const tpHit = signal === 'BUY' ? candle.high >= tp : candle.low <= tp
    const slHit = signal === 'BUY' ? candle.low <= sl : candle.high >= sl

    if (tpHit && slHit) {
      return { result: 'tutmadi', closedAt: new Date(candle.openTime).toISOString() }
    } else if (tpHit) {
      return { result: 'tuttu', closedAt: new Date(candle.openTime).toISOString() }
    } else if (slHit) {
      return { result: 'tutmadi', closedAt: new Date(candle.openTime).toISOString() }
    }
  }

  return { result: null, closedAt: null }
}

// ---------- Bybit fetchers ----------
async function fetchKlines(symbol: string) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=100`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`klines ${symbol} ${r.status}`)
  const j = await r.json() as any
  if (j.retCode !== 0) throw new Error(`klines ${symbol} retCode ${j.retCode} ${j.retMsg}`)
  const list = (j.result?.list ?? []) as string[][]
  return list.slice().reverse()
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
    const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`)
    if (!r.ok) return null
    const j = await r.json() as any
    if (j.retCode !== 0) return null
    const p = j.result?.list?.[0]?.lastPrice
    return p ? parseFloat(p) : null
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

async function sendTelegram(coin: string, signal: string, quality: string, score: number, price: number, whale: WhaleActivity) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured')
  const symbol = coin.replace(/USDT$/, '')
  const isBuy = signal === 'BUY'
  const emoji = isBuy ? '🟢' : '🔴'
  const stop = isBuy ? price * 0.98 : price * 1.02
  const target = isBuy ? price * 1.025 : price * 0.975
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

// Faz 1: sinyal kapanınca anlık sonuç bildirimi (tuttu/tutmadı)
async function sendResult(coin: string, signal: string, result: 'tuttu' | 'tutmadi', createdAt: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  if (!token) return
  const symbol = coin.replace(/USDT$/, '')
  const win = result === 'tuttu'
  const emoji = win ? '✅' : '❌'
  const pct = win ? '+%2.5' : '-%2'
  const mins = Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000))
  const dur = mins >= 60 ? `${Math.floor(mins / 60)}s ${mins % 60}dk` : `${mins}dk`
  const time = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
  const text =
`${emoji} SONUÇ · ${win ? 'TUTTU' : 'TUTMADI'}
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
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
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

  const inserted: string[] = []
  const closed: string[] = []
  const errors: string[] = []
  const whaleLogged: string[] = []
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

      if (a.whale.biggestUsd > 0 && a.whale.biggestSide) {
        const { error: whaleErr } = await supabase.from('whale_events').insert({
          coin, side: a.whale.biggestSide,
          amount_usd: a.whale.biggestUsd, price: a.price,
        })
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
      const entrySnap = await fetchTicker(c.coin)
      const { error } = await supabase.from('kpk_signals').insert({
        coin: c.coin, signal: c.signal, score: c.score,
        quality: c.quality, price: c.price,
        entry_snapshot: entrySnap,
        entry_snapshot_at: new Date().toISOString(),
        components: c.components,
        score_band: c.scoreBand,
      })
      if (error) {
        errors.push(`${c.coin} insert: ${error.message}`)
        continue
      }
      inserted.push(`${c.coin} ${c.signal} ${c.score}`)
      try {
        await sendTelegram(c.coin, c.signal, c.quality, c.score, c.price, c.whale)
      } catch (te: any) {
        errors.push(`${c.coin} telegram: ${te.message}`)
      }
    } catch (e: any) {
      errors.push(`record ${c.coin}: ${e.message}`)
    }
  }

  // 2) Açık sinyalleri geçmiş mumlarla kapat.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const resolveFloor = new Date(
    Date.now() - (RESOLVE_WINDOW_HOURS + 6) * 60 * 60 * 1000
  ).toISOString()
  const { data: openSigs } = await supabase
    .from('kpk_signals')
    .select('id, coin, signal, price, created_at')
    .eq('result', 'bekliyor')
    .lt('created_at', oneHourAgo)
    .gte('created_at', resolveFloor)

  for (const row of openSigs ?? []) {
    try {
      const entry = Number(row.price)
      const signal = row.signal as 'BUY' | 'SELL'
      const createdAt = row.created_at as string

      const resolution = await resolveTPSLWithKlines(row.coin, signal, entry, createdAt)

      if (resolution.result) {
        const { error } = await supabase
          .from('kpk_signals')
          .update({ result: resolution.result, closed_at: resolution.closedAt })
          .eq('id', row.id)
        if (error) errors.push(`update ${row.id}: ${error.message}`)
        else {
          closed.push(`${row.coin} ${row.signal} → ${resolution.result}`)
          try {
            await sendResult(row.coin, row.signal, resolution.result, createdAt)
          } catch (te: any) {
            errors.push(`${row.coin} sonuç telegram: ${te.message}`)
          }
        }
      }
    } catch (e: any) {
      errors.push(`resolve ${row.coin}: ${e.message}`)
    }
  }

  console.log('kpk-signals-cron result', JSON.stringify({ inserted, closed, errors, whaleLogged, exchangeCompared, v2Report }))
  return { ok: true, inserted, closed, errors, whaleLogged, exchangeCompared, engineV2: v2Report }
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
