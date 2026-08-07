/**
 * Signal Engine V2 — ağırlıklı puanlama katmanı.
 *
 * Mevcut V1 `signalLogic` algoritmasına DOKUNMAZ. Aynı göstergeleri alır,
 * her göstergeyi 0..1 aralığında normalize eder ve ağırlıklı toplam üretir.
 * Sonuç yalnızca ek bilgi (raporlama / karşılaştırma) amaçlıdır.
 */

export interface V2Inputs {
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
}

export type V2Direction = 'BUY' | 'SELL' | 'WAIT'

export interface V2Factor {
  key: string
  label: string
  weight: number
  /** -1 (tam ayı) .. +1 (tam boğa) */
  value: number
  /** weight * value */
  contribution: number
}

export interface V2Result {
  version: 'v2'
  direction: V2Direction
  /** 0..100 yönlü güven skoru */
  score: number
  /** -100..100 boğa/ayı dengesi */
  bias: number
  quality: 'ULTRA' | 'GÜÇLÜ' | 'ORTA' | 'ZAYIF'
  factors: V2Factor[]
}

/** Ağırlıklar toplamı 1.0 olacak şekilde normalize edilmiştir. */
export const V2_WEIGHTS = {
  trend: 0.24,
  momentum: 0.2,
  rsi: 0.16,
  meanReversion: 0.12,
  volume: 0.1,
  whale: 0.18,
} as const

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n))

function trendScore(i: V2Inputs): number {
  if (!i.ema20 || !i.ema50) return 0
  const spread = (i.ema20 - i.ema50) / i.ema50
  const slope = i.ema20Prev ? (i.ema20 - i.ema20Prev) / i.ema20Prev : 0
  const position = i.ema20 ? (i.price - i.ema20) / i.ema20 : 0
  // spread ±1.5%, slope ±0.4%, position ±1% doygunluk noktaları
  return clamp(0.5 * clamp(spread / 0.015) + 0.3 * clamp(slope / 0.004) + 0.2 * clamp(position / 0.01))
}

function momentumScore(i: V2Inputs): number {
  if (i.macdHist === null || !i.price) return 0
  // histogramı fiyata göre normalize et (%0.3 doygunluk)
  return clamp((i.macdHist / i.price) / 0.003)
}

function rsiScore(i: V2Inputs): number {
  if (i.rsi === null) return 0
  // 30 altı boğa (dipten dönüş), 70 üstü ayı
  let v = clamp((50 - i.rsi) / 20)
  if (i.prevRsi !== null && i.prevRsi < 30 && i.rsi >= 30) v = clamp(v + 0.35)
  if (i.prevRsi !== null && i.prevRsi > 70 && i.rsi <= 70) v = clamp(v - 0.35)
  return v
}

function meanReversionScore(i: V2Inputs): number {
  if (i.bbPct === null) return 0
  // 0 = alt bant (boğa lehine), 1 = üst bant (ayı lehine)
  return clamp((0.5 - i.bbPct) * 2)
}

function volumeScore(i: V2Inputs, directionalBias: number): number {
  if (i.volRatio === null) return 0
  const strength = clamp((i.volRatio - 1) / 0.6, 0, 1)
  // hacim tek başına yön vermez; mevcut yönü teyit eder
  return clamp(strength * Math.sign(directionalBias))
}

function whaleScore(i: V2Inputs): number {
  const total = i.whaleBuyUsd + i.whaleSellUsd
  if (total <= 0) return 0
  return clamp((i.whaleBuyUsd - i.whaleSellUsd) / total)
}

function qualityOf(score: number): V2Result['quality'] {
  if (score >= 85) return 'ULTRA'
  if (score >= 72) return 'GÜÇLÜ'
  if (score >= 55) return 'ORTA'
  return 'ZAYIF'
}

export function scoreSignalV2(i: V2Inputs): V2Result {
  const trend = trendScore(i)
  const momentum = momentumScore(i)
  const rsiV = rsiScore(i)
  const mr = meanReversionScore(i)
  const whale = whaleScore(i)

  const preBias =
    V2_WEIGHTS.trend * trend +
    V2_WEIGHTS.momentum * momentum +
    V2_WEIGHTS.rsi * rsiV +
    V2_WEIGHTS.meanReversion * mr +
    V2_WEIGHTS.whale * whale

  const volume = volumeScore(i, preBias === 0 ? 1 : preBias)

  const factors: V2Factor[] = [
    { key: 'trend', label: 'Trend (EMA20/50)', weight: V2_WEIGHTS.trend, value: trend, contribution: V2_WEIGHTS.trend * trend },
    { key: 'momentum', label: 'Momentum (MACD)', weight: V2_WEIGHTS.momentum, value: momentum, contribution: V2_WEIGHTS.momentum * momentum },
    { key: 'rsi', label: 'RSI', weight: V2_WEIGHTS.rsi, value: rsiV, contribution: V2_WEIGHTS.rsi * rsiV },
    { key: 'meanReversion', label: 'Bollinger konumu', weight: V2_WEIGHTS.meanReversion, value: mr, contribution: V2_WEIGHTS.meanReversion * mr },
    { key: 'volume', label: 'Hacim teyidi', weight: V2_WEIGHTS.volume, value: volume, contribution: V2_WEIGHTS.volume * volume },
    { key: 'whale', label: 'Whale akışı', weight: V2_WEIGHTS.whale, value: whale, contribution: V2_WEIGHTS.whale * whale },
  ]

  const bias = clamp(factors.reduce((a, f) => a + f.contribution, 0)) * 100
  const score = Math.round(Math.abs(bias))
  const direction: V2Direction = score < 45 ? 'WAIT' : bias > 0 ? 'BUY' : 'SELL'

  return {
    version: 'v2',
    direction,
    score,
    bias: Math.round(bias),
    quality: direction === 'WAIT' ? 'ZAYIF' : qualityOf(score),
    factors: factors.map((f) => ({ ...f, contribution: Number(f.contribution.toFixed(4)), value: Number(f.value.toFixed(4)) })),
  }
}

/** V1 ile V2 uyumu: aynı yön → teyit, farklı → ihtilaf. */
export function agreementWithV1(v1Signal: string, v2: V2Result): 'confirm' | 'conflict' | 'neutral' {
  if (v2.direction === 'WAIT' || v1Signal === 'WAIT') return 'neutral'
  return v1Signal === v2.direction ? 'confirm' : 'conflict'
}
