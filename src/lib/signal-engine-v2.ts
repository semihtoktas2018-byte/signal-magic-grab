/**
 * Signal Engine V2 — Phase 1: ağırlıklı puanlama katmanı.
 *
 * Mevcut V1 `signalLogic` algoritmasına DOKUNMAZ. Aynı göstergeleri alır,
 * her göstergeyi -1..+1 aralığında normalize eder ve ağırlıklı toplam üretir.
 * Eksik gösterge varsa ağırlığı devre dışı bırakılır ve kalan ağırlıklar
 * otomatik olarak normalize edilir.
 *
 * Phase 1 kapsamı: yalnızca ek skor + karşılaştırma. BUY/SELL/WAIT kararı
 * hâlâ V1'e aittir.
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
  /** 0..100 Fear & Greed endeksi (yoksa null → ağırlık devre dışı) */
  fearGreed?: number | null
  /** Funding rate oranı, örn. 0.0001 (yoksa null → ağırlık devre dışı) */
  funding?: number | null
  /** Oynaklık yüzdesi (ör. ATR/price * 100). Yoksa null → ağırlık devre dışı */
  volatilityPct?: number | null
}

export type V2Direction = 'BUY' | 'SELL' | 'WAIT'

export interface V2Factor {
  key: string
  label: string
  /** Phase 1 tanımlı ham ağırlık */
  weight: number
  /** Eksik göstergeler çıkarıldıktan sonra uygulanan ağırlık */
  effectiveWeight: number
  available: boolean
  /** -1 (tam ayı) .. +1 (tam boğa) */
  value: number
  /** effectiveWeight * value */
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
  /** Mevcut göstergelerin ham ağırlık toplamı (0..1) */
  coverage: number
  factors: V2Factor[]
}

/** Phase 1 ağırlıkları (toplam 1.0). */
export const V2_WEIGHTS = {
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

/** Momentum = RSI + MACD birleşimi (mevcut olan(lar)ın ortalaması). */
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
    // Bollinger konumu momentum teyidi olarak zayıf ağırlıkla katılır
    parts.push(clamp((0.5 - i.bbPct) * 2) * 0.5)
  }
  if (!parts.length) return null
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length)
}

function volumeScore(i: V2Inputs, directionalBias: number): number | null {
  if (i.volRatio === null || i.volRatio === undefined) return null
  const strength = clamp((i.volRatio - 1) / 0.6, 0, 1)
  // hacim tek başına yön vermez; mevcut yönü teyit eder
  return clamp(strength * (directionalBias >= 0 ? 1 : -1))
}

function whaleScore(i: V2Inputs): number | null {
  const total = (i.whaleBuyUsd || 0) + (i.whaleSellUsd || 0)
  if (total <= 0) return null
  return clamp((i.whaleBuyUsd - i.whaleSellUsd) / total)
}

/** Funding + Fear & Greed birleşimi. */
function sentimentScore(i: V2Inputs): number | null {
  const parts: number[] = []
  if (i.fearGreed !== null && i.fearGreed !== undefined) {
    // aşırı korku (0) boğa lehine kontra fırsat, aşırı hırs (100) ayı lehine
    parts.push(clamp((50 - i.fearGreed) / 30))
  }
  if (i.funding !== null && i.funding !== undefined) {
    // pozitif funding = kalabalık long → temkinli (negatif skor)
    parts.push(clamp(-i.funding / 0.0005))
  }
  if (!parts.length) return null
  return clamp(parts.reduce((a, b) => a + b, 0) / parts.length)
}

/** Oynaklık yön vermez; aşırı oynaklıkta güveni düşürür. */
function volatilityScore(i: V2Inputs, directionalBias: number): number | null {
  if (i.volatilityPct === null || i.volatilityPct === undefined) return null
  const penalty = clamp((i.volatilityPct - 1.5) / 3, 0, 1) // %1.5 üstü riskli
  return clamp((1 - 2 * penalty) * (directionalBias >= 0 ? 1 : -1))
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
  const whale = whaleScore(i)
  const sentiment = sentimentScore(i)

  // Yön belirleyici çekirdek (hacim/oynaklık teyit faktörleri için)
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

  // Eksik göstergelerin ağırlığını at, kalanları otomatik normalize et
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

/** V1 ile V2 uyumu: aynı yön → teyit, farklı → ihtilaf. */
export function agreementWithV1(v1Signal: string, v2: V2Result): 'confirm' | 'conflict' | 'neutral' {
  if (v2.direction === 'WAIT' || v1Signal === 'WAIT') return 'neutral'
  return v1Signal === v2.direction ? 'confirm' : 'conflict'
}

export type V2Comparison = 'V2 Better' | 'V2 Same' | 'V2 Lower'

/** Karşılaştırma badge'i: V2 skoru V1'e göre daha yüksek / eşit / daha düşük. */
export function compareScores(v1Score: number, v2Score: number, tolerance = 3): V2Comparison {
  const diff = v2Score - v1Score
  if (Math.abs(diff) <= tolerance) return 'V2 Same'
  return diff > 0 ? 'V2 Better' : 'V2 Lower'
}
