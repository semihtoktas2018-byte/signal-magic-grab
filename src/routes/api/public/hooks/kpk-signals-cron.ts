import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTPSLWithKlines } from '../kpk-signals-cron'

type Candle = {
  openTime: number
  high: number
  low: number
}

const BASE_TIME = new Date('2026-09-11T12:00:00Z').getTime()
const CREATED_AT = new Date(BASE_TIME).toISOString()

function candle(openTime: number, high: number, low: number): Candle {
  return { openTime, high, low }
}

function bybitKline(c: Candle): string[] {
  return [
    String(c.openTime),
    '0',
    String(c.high),
    String(c.low),
    '0',
    '0',
  ]
}

function mockBybit(candles: Candle[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        retCode: 0,
        result: {
          list: candles.map(bybitKline),
        },
      }),
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolveTPSLWithKlines - production implementation', () => {
  it('BUY: TP is resolved on the first candle that reaches TP', async () => {
    mockBybit([
      candle(BASE_TIME, 101, 99),
      candle(BASE_TIME + 60_000, 102.6, 99),
      candle(BASE_TIME + 120_000, 103, 97),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tuttu')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME + 60_000).toISOString(),
    )
  })

  it('BUY: SL is resolved on the first candle that reaches SL', async () => {
    mockBybit([
      candle(BASE_TIME, 101, 99),
      candle(BASE_TIME + 60_000, 101, 97.9),
      candle(BASE_TIME + 120_000, 103, 97),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tutmadi')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME + 60_000).toISOString(),
    )
  })

  it('SELL: TP is resolved on the first candle that reaches TP', async () => {
    mockBybit([
      candle(BASE_TIME, 101, 99),
      candle(BASE_TIME + 60_000, 100, 97.4),
      candle(BASE_TIME + 120_000, 103, 96),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'SELL',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tuttu')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME + 60_000).toISOString(),
    )
  })

  it('SELL: SL is resolved on the first candle that reaches SL', async () => {
    mockBybit([
      candle(BASE_TIME, 101, 99),
      candle(BASE_TIME + 60_000, 102.1, 99),
      candle(BASE_TIME + 120_000, 103, 97),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'SELL',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tutmadi')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME + 60_000).toISOString(),
    )
  })

  it('same candle TP and SL: uses conservative tutmadi result', async () => {
    mockBybit([
      candle(BASE_TIME, 102.6, 97.9),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tutmadi')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME).toISOString(),
    )
  })

  it('sorts reverse-order candles chronologically', async () => {
    mockBybit([
      candle(BASE_TIME + 120_000, 103, 99),
      candle(BASE_TIME + 60_000, 102.6, 99),
      candle(BASE_TIME, 101, 99),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tuttu')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME + 60_000).toISOString(),
    )
  })

  it('ignores candles before signal creation', async () => {
    const createdAtMs = BASE_TIME + 60_000

    mockBybit([
      candle(BASE_TIME, 102.6, 97.9),
      candle(createdAtMs, 101, 99),
      candle(createdAtMs + 60_000, 102.6, 99),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      new Date(createdAtMs).toISOString(),
    )

    expect(result.result).toBe('tuttu')
    expect(result.closedAt).toBe(
      new Date(createdAtMs + 60_000).toISOString(),
    )
  })

  it('returns null when neither TP nor SL is reached', async () => {
    mockBybit([
      candle(BASE_TIME, 102.4, 98.1),
      candle(BASE_TIME + 59 * 60_000, 102.4, 98.1),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBeNull()
    expect(result.closedAt).toBeNull()
  })

  it('does not use candles outside the 60-minute window', async () => {
    const outsideWindow = BASE_TIME + 60 * 60_000 + 60_000

    mockBybit([
      candle(outsideWindow, 102.6, 99),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBeNull()
    expect(result.closedAt).toBeNull()
  })

  it('treats the exact 60-minute boundary according to the resolver window', async () => {
    const boundary = BASE_TIME + 60 * 60_000

    mockBybit([
      candle(boundary, 102.6, 99),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBeNull()
    expect(result.closedAt).toBeNull()
  })

  it('propagates a Bybit fetch error instead of treating it as no-hit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new Error('Bybit unavailable'),
      ),
    )

    await expect(
      resolveTPSLWithKlines(
        'BTCUSDT',
        'BUY',
        100,
        CREATED_AT,
      ),
    ).rejects.toThrow('Bybit unavailable')
  })

  it('uses the required BUY TP/SL percentages', async () => {
    mockBybit([
      candle(BASE_TIME, 102.49, 98.01),
      candle(BASE_TIME + 60_000, 102.5, 98),
    ])

    const result = await resolveTPSLWithKlines(
      'BTCUSDT',
      'BUY',
      100,
      CREATED_AT,
    )

    expect(result.result).toBe('tutmadi')
    expect(result.closedAt).toBe(
      new Date(BASE_TIME + 60_000).toISOString(),
    )
  })
})
