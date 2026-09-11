import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock types and interfaces
interface Candle {
  openTime: number
  high: number
  low: number
}

interface TPSLResolution {
  result: 'tuttu' | 'tutmadi' | null
  closedAt: string | null
}

// Helper function to simulate kline data
function createCandle(openTimeMs: number, high: number, low: number): Candle {
  return { openTime: openTimeMs, high, low }
}

// Mock resolver function (simplified version for testing)
async function mockResolveTPSLWithKlines(
  symbol: string,
  signal: 'BUY' | 'SELL',
  entryPrice: number,
  createdAtISO: string,
  klines: Candle[]
): Promise<TPSLResolution> {
  const createdAtMs = new Date(createdAtISO).getTime()
  const createdAtSec = Math.floor(createdAtMs / 1000)

  // Sort klines chronologically
  const sorted = [...klines].sort((a, b) => a.openTime - b.openTime)

  // Calculate TP/SL targets
  const tp = signal === 'BUY' ? entryPrice * 1.025 : entryPrice * 0.975
  const sl = signal === 'BUY' ? entryPrice * 0.98 : entryPrice * 1.02

  // Check chronologically through candles
  for (const candle of sorted) {
    if (candle.openTime < createdAtMs) continue // Skip candles before signal

    const tpHit = signal === 'BUY' ? candle.high >= tp : candle.low <= tp
    const slHit = signal === 'BUY' ? candle.low <= sl : candle.high >= sl

    if (tpHit && slHit) {
      // Both TP and SL in same candle: conservative approach → SL (tutmadi)
      return {
        result: 'tutmadi',
        closedAt: new Date(candle.openTime).toISOString(),
      }
    } else if (tpHit) {
      return {
        result: 'tuttu',
        closedAt: new Date(candle.openTime).toISOString(),
      }
    } else if (slHit) {
      return {
        result: 'tutmadi',
        closedAt: new Date(candle.openTime).toISOString(),
      }
    }
  }

  // No TP/SL hit in 60 minutes: return null
  return { result: null, closedAt: null }
}

describe('TP/SL Resolution with 1-minute Klines', () => {
  describe('BUY signals', () => {
    it('should detect TP hit first and return tuttu', async () => {
      // Setup: BUY at 100
      // TP = 100 * 1.025 = 102.5
      // SL = 100 * 0.98 = 98
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 101, 99.5, ), // Candle 1: no hit
        createCandle(baseTime + 60000, 102.6, 99.5), // Candle 2: TP hit first
        createCandle(baseTime + 120000, 103, 97.9), // Candle 3: would hit SL but TP already hit
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBe('tuttu')
      expect(result.closedAt).toBeTruthy()
    })

    it('should detect SL hit first and return tutmadi', async () => {
      // Setup: BUY at 100
      // TP = 100 * 1.025 = 102.5
      // SL = 100 * 0.98 = 98
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 101, 99.5), // Candle 1: no hit
        createCandle(baseTime + 60000, 101, 97.9), // Candle 2: SL hit first
        createCandle(baseTime + 120000, 102.6, 97.5), // Candle 3: would hit TP but SL already hit
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBe('tutmadi')
      expect(result.closedAt).toBeTruthy()
    })

    it('should return tutmadi when both TP and SL hit in same candle (conservative)', async () => {
      // Setup: BUY at 100
      // TP = 100 * 1.025 = 102.5
      // SL = 100 * 0.98 = 98
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 101, 99.5), // Candle 1: no hit
        createCandle(baseTime + 60000, 102.6, 97.9), // Candle 2: BOTH TP and SL hit
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBe('tutmadi') // Conservative: treat as loss
      expect(result.closedAt).toBeTruthy()
    })

    it('should return null when no TP/SL hit in 60 minutes', async () => {
      // Setup: BUY at 100
      // TP = 100 * 1.025 = 102.5
      // SL = 100 * 0.98 = 98
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 101, 99), // Candle 1: between SL and TP
        createCandle(baseTime + 60000, 102, 98.5), // Candle 2: between SL and TP
        createCandle(baseTime + 120000, 101.5, 98.8), // Candle 3: between SL and TP
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBeNull()
      expect(result.closedAt).toBeNull()
    })
  })

  describe('SELL signals', () => {
    it('should detect TP hit first and return tuttu', async () => {
      // Setup: SELL at 100
      // TP = 100 * 0.975 = 97.5
      // SL = 100 * 1.02 = 102
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 100.5, 98.5), // Candle 1: no hit
        createCandle(baseTime + 60000, 100, 97.4), // Candle 2: TP hit first (low <= 97.5)
        createCandle(baseTime + 120000, 102.5, 96), // Candle 3: would hit SL but TP already hit
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'SELL', entry, createdAt, klines)

      expect(result.result).toBe('tuttu')
      expect(result.closedAt).toBeTruthy()
    })

    it('should detect SL hit first and return tutmadi', async () => {
      // Setup: SELL at 100
      // TP = 100 * 0.975 = 97.5
      // SL = 100 * 1.02 = 102
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 100.5, 98.5), // Candle 1: no hit
        createCandle(baseTime + 60000, 102.5, 99), // Candle 2: SL hit first (high >= 102)
        createCandle(baseTime + 120000, 101, 97.4), // Candle 3: would hit TP but SL already hit
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'SELL', entry, createdAt, klines)

      expect(result.result).toBe('tutmadi')
      expect(result.closedAt).toBeTruthy()
    })

    it('should return tutmadi when both TP and SL hit in same candle (conservative)', async () => {
      // Setup: SELL at 100
      // TP = 100 * 0.975 = 97.5
      // SL = 100 * 1.02 = 102
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 100.5, 98.5), // Candle 1: no hit
        createCandle(baseTime + 60000, 102.5, 97.4), // Candle 2: BOTH SL and TP hit
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'SELL', entry, createdAt, klines)

      expect(result.result).toBe('tutmadi') // Conservative: treat as loss
      expect(result.closedAt).toBeTruthy()
    })

    it('should return null when no TP/SL hit in 60 minutes', async () => {
      // Setup: SELL at 100
      // TP = 100 * 0.975 = 97.5
      // SL = 100 * 1.02 = 102
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 101, 98), // Candle 1: between TP and SL
        createCandle(baseTime + 60000, 101.5, 98.5), // Candle 2: between TP and SL
        createCandle(baseTime + 120000, 100.5, 98.8), // Candle 3: between TP and SL
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'SELL', entry, createdAt, klines)

      expect(result.result).toBeNull()
      expect(result.closedAt).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should handle reverse-order klines correctly (chronologically sort)', async () => {
      // Setup: BUY at 100
      // TP = 102.5, SL = 98
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      // Klines in reverse order (as API might return them)
      const klines = [
        createCandle(baseTime + 120000, 103, 97.5), // Candle 3 (chronologically last)
        createCandle(baseTime + 60000, 102.6, 99.5), // Candle 2 (chronologically middle)
        createCandle(baseTime, 101, 99.5), // Candle 1 (chronologically first)
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      // Should detect TP hit in candle 2 despite reverse order
      expect(result.result).toBe('tuttu')
      expect(result.closedAt).toBeTruthy()
    })

    it('should skip candles before signal creation time', async () => {
      // Setup: BUY at 100
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime + 60000).toISOString() // Signal created 1 minute after base time

      const klines = [
        createCandle(baseTime, 102.6, 97.9), // Candle before signal: should be skipped
        createCandle(baseTime + 60000, 101, 99.5), // Candle at signal time: should be checked
        createCandle(baseTime + 120000, 102.6, 99.5), // Candle after signal: TP hits
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      // Should detect TP hit in candle 3 (skipped candle 1)
      expect(result.result).toBe('tuttu')
      expect(result.closedAt).toBeTruthy()
    })

    it('should handle empty klines array', async () => {
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()
      const klines: Candle[] = []

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBeNull()
      expect(result.closedAt).toBeNull()
    })

    it('should handle very tight TP/SL targets', async () => {
      // Entry: 100
      // BUY TP = 102.5 (2.5%), SL = 98 (2%)
      // Very tight range [98, 102.5]
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      const klines = [
        createCandle(baseTime, 102.4, 98.1), // Just inside both boundaries
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBeNull() // No hit yet
    })

    it('should return exact closed_at timestamp of the hit candle', async () => {
      const entry = 100
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()
      const hitCandleTime = baseTime + 180000 // 3 minutes after creation

      const klines = [
        createCandle(baseTime, 101, 99), // Candle 1
        createCandle(baseTime + 60000, 101, 99), // Candle 2
        createCandle(hitCandleTime, 102.6, 99), // Candle 3: TP hits
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBe('tuttu')
      expect(result.closedAt).toBe(new Date(hitCandleTime).toISOString())
    })
  })

  describe('Precision and floating point handling', () => {
    it('should correctly compare floating point prices at TP boundary', async () => {
      const entry = 100
      const tp = 100 * 1.025 // 102.5 (could have float precision issues)
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      // Test with high exactly at TP
      const klines = [
        createCandle(baseTime, tp, 99), // high === tp exactly
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBe('tuttu')
    })

    it('should correctly compare floating point prices at SL boundary', async () => {
      const entry = 100
      const sl = 100 * 0.98 // 98 (could have float precision issues)
      const baseTime = new Date('2026-09-11T12:00:00Z').getTime()
      const createdAt = new Date(baseTime).toISOString()

      // Test with low exactly at SL
      const klines = [
        createCandle(baseTime, 101, sl), // low === sl exactly
      ]

      const result = await mockResolveTPSLWithKlines('BTCUSDT', 'BUY', entry, createdAt, klines)

      expect(result.result).toBe('tutmadi')
    })
  })
})
