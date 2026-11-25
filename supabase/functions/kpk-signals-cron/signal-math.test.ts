import {
  calculateBollingerPct,
  calculateEma,
  calculateMacdHistogram,
  calculatePerformanceSummary,
  calculateRelativeVolumeRatio,
  calculateRsi,
  calculateV1Signal,
  calculateV2Signal,
  compareSignalScores,
  compareV1V2,
  evaluateCandleOutcome,
  getTradeLevels,
  resolveSignalFromCandles,
} from "../../../src/lib/signal-math.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function equal<T>(actual: T, expected: T, message: string): void {
  assert(Object.is(actual, expected), `${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function near(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-10, `${message}: expected ${expected}, got ${actual}`);
}

Deno.test("BUY and SELL target/stop levels use the configured percentages", () => {
  const buy = getTradeLevels("BUY", 100);
  near(buy.target, 102.5, "BUY target");
  near(buy.stop, 98, "BUY stop");
  const sell = getTradeLevels("SELL", 100);
  near(sell.target, 97.5, "SELL target");
  near(sell.stop, 102, "SELL stop");
});

Deno.test("invalid entry prices are rejected", () => {
  let threw = false;
  try { getTradeLevels("BUY", 0); } catch { threw = true; }
  assert(threw, "zero entry must throw");
});

Deno.test("candle resolver handles TP, SL, both-hit and no-hit cases", () => {
  equal(evaluateCandleOutcome("BUY", 100, 103, 99), "tuttu", "BUY TP");
  equal(evaluateCandleOutcome("BUY", 100, 101, 97), "tutmadi", "BUY SL");
  equal(evaluateCandleOutcome("BUY", 100, 103, 97), "tutmadi", "same-candle both-hit uses conservative SL");
  equal(evaluateCandleOutcome("BUY", 100, 101, 99), null, "no level touched");
  equal(evaluateCandleOutcome("SELL", 100, 103, 97), "tutmadi", "SELL both-hit uses conservative SL");
  equal(evaluateCandleOutcome("SELL", 100, 98, 97), "tuttu", "SELL TP");
});

Deno.test("performance excludes pending and expired signals from hit rate and EV", () => {
  const summary = calculatePerformanceSummary([
    { signal: "BUY", result: "tuttu" },
    { signal: "BUY", result: "tutmadi" },
    { signal: "SELL", result: "tuttu" },
    { signal: "SELL", result: "bekliyor" },
    { signal: "SELL", result: "suresi_doldu" },
  ]);
  equal(summary.total, 5, "total count");
  equal(summary.closed, 3, "closed count");
  equal(summary.wins, 2, "wins");
  equal(summary.losses, 1, "losses");
  equal(summary.pending, 1, "pending");
  equal(summary.expired, 1, "expired");
  near(summary.winRatePct ?? -1, (2 / 3) * 100, "hit rate");
  near(summary.grossTheoreticalEvPct ?? -1, ((2 * 0.025 - 1 * 0.02) / 3) * 100, "gross EV");
  equal(summary.byDirection.BUY.closed, 2, "BUY closed count");
  equal(summary.byDirection.SELL.closed, 1, "SELL closed count");
});

Deno.test("performance returns null rates when there are no closed signals", () => {
  const summary = calculatePerformanceSummary([
    { signal: "BUY", result: "bekliyor" },
    { signal: "SELL", result: "suresi_doldu" },
  ]);
  equal(summary.winRatePct, null, "no-sample hit rate");
  equal(summary.grossTheoreticalEvPct, null, "no-sample EV");
});

Deno.test("RSI zero is treated as a valid value, not missing data", () => {
  const result = calculateV1Signal({
    price: 105,
    prevPrice: 99,
    rsi: 0,
    prevRsi: 10,
    ema20: 100,
    ema50: 98,
    ema20Prev: 99,
    macdHist: 1,
    bbPct: 0.1,
    volumeRatio: 1.5,
    whaleBuyUsd: 500_000,
    whaleSellUsd: 100_000,
  });
  equal(result.signal, "BUY", "RSI zero should still calculate a signal");
  assert(result.score > 0, "RSI zero should not force a zero score");
});

Deno.test("missing RSI remains WAIT", () => {
  const result = calculateV1Signal({
    price: 105, prevPrice: 99, rsi: null, prevRsi: null,
    ema20: 100, ema50: 98, ema20Prev: 99, macdHist: 1,
    bbPct: 0.1, volumeRatio: 1.5, whaleBuyUsd: 500_000, whaleSellUsd: 100_000,
  });
  equal(result.signal, "WAIT", "missing RSI");
});

Deno.test("EMA follows the configured recursive smoothing", () => {
  const values = calculateEma([10, 11, 12], 2);
  near(values[0], 10, "EMA first value");
  near(values[1], 10 + 2 / 3, "EMA second value");
  near(values[2], 10 + 14 / 9, "EMA third value");
});

Deno.test("RSI distinguishes rising, falling and flat markets", () => {
  const rising = calculateRsi([1, 2, 3, 4, 5], 4);
  const falling = calculateRsi([5, 4, 3, 2, 1], 4);
  const flat = calculateRsi([5, 5, 5, 5, 5], 4);
  equal(rising[4], 100, "all gains RSI");
  equal(falling[4], 0, "all losses RSI");
  equal(flat[4], 50, "flat market RSI");
  equal(calculateRsi([1, 2, 3], 4).every((value) => value === null), true, "insufficient RSI history");
});

Deno.test("MACD histogram is neutral for a flat series and positive for a rising series", () => {
  const flat = new Array(50).fill(100);
  const rising = Array.from({ length: 50 }, (_, index) => 100 + index);
  near(calculateMacdHistogram(flat), 0, "flat MACD");
  assert(calculateMacdHistogram(rising) > 0, "rising series should have positive MACD histogram");
});

Deno.test("Bollinger position handles flat and insufficient data", () => {
  equal(calculateBollingerPct(new Array(20).fill(100)), 0.5, "flat Bollinger position");
  equal(calculateBollingerPct([100, 101], 20), null, "insufficient Bollinger history");
  const pct = calculateBollingerPct(Array.from({ length: 20 }, (_, index) => 100 + index));
  assert(pct !== null && pct > 0.5, "rising series should be above the Bollinger midline");
});

Deno.test("relative volume compares the current bar to prior bars only", () => {
  const ratio = calculateRelativeVolumeRatio([...new Array(20).fill(10), 30], 20);
  equal(ratio, 3, "current volume divided by previous 20-bar average");
  equal(calculateRelativeVolumeRatio(new Array(20).fill(10), 20), null, "insufficient baseline");
  equal(calculateRelativeVolumeRatio([...new Array(20).fill(0), 10], 20), null, "zero baseline");
});

Deno.test("V2 reports actual factor coverage and normalizes only available weights", () => {
  const result = calculateV2Signal({
    price: 105, prevPrice: 104, rsi: 42, prevRsi: 39,
    ema20: 103, ema20Prev: 102, ema50: 100,
    macdHist: 0.5, bbPct: 0.7, volRatio: 1.6,
    whaleBuyUsd: 0, whaleSellUsd: 0,
    fearGreed: null, funding: null, volatilityPct: 1.2,
  });
  equal(result.coverage, 0.75, "coverage without whale and sentiment");
  equal(result.factors.find((factor) => factor.key === "sentiment")?.available, false, "sentiment unavailable flag");
  const effectiveWeight = result.factors.reduce((sum, factor) => sum + factor.effectiveWeight, 0);
  near(effectiveWeight, 1, "normalized available weights");
});

Deno.test("V2 uses Fear & Greed when it is actually supplied", () => {
  const result = calculateV2Signal({
    price: 105, prevPrice: 104, rsi: 42, prevRsi: 39,
    ema20: 103, ema20Prev: 102, ema50: 100,
    macdHist: 0.5, bbPct: 0.7, volRatio: 1.6,
    whaleBuyUsd: 0, whaleSellUsd: 0,
    fearGreed: 20, funding: null, volatilityPct: 1.2,
  });
  equal(result.factors.find((factor) => factor.key === "sentiment")?.available, true, "sentiment availability");
  equal(result.coverage, 0.85, "coverage with Fear & Greed");
});

Deno.test("V2 returns WAIT with zero coverage when all factors are unavailable", () => {
  const result = calculateV2Signal({
    price: 100, prevPrice: 100, rsi: null, prevRsi: null,
    ema20: 0, ema20Prev: 0, ema50: 0,
    macdHist: null, bbPct: null, volRatio: null,
    whaleBuyUsd: 0, whaleSellUsd: 0,
    fearGreed: null, funding: null, volatilityPct: null,
  });
  equal(result.coverage, 0, "zero coverage");
  equal(result.direction, "WAIT", "zero coverage direction");
  equal(result.score, 0, "zero coverage score");
});

Deno.test("V1/V2 comparison and score tolerance are deterministic", () => {
  const buy = calculateV2Signal({
    price: 110, prevPrice: 109, rsi: 20, prevRsi: 25,
    ema20: 108, ema20Prev: 107, ema50: 100,
    macdHist: 1, bbPct: 0.1, volRatio: 2,
    whaleBuyUsd: 500_000, whaleSellUsd: 10_000,
    fearGreed: 15, funding: -0.0001, volatilityPct: 1,
  });
  equal(compareV1V2("BUY", buy), "confirm", "matching direction");
  equal(compareV1V2("SELL", buy), "conflict", "opposite direction");
  equal(compareV1V2("WAIT", buy), "neutral", "V1 WAIT direction");
  equal(compareSignalScores(70, 72), "V2 Same", "within tolerance");
  equal(compareSignalScores(70, 75), "V2 Better", "V2 higher");
  equal(compareSignalScores(75, 70), "V2 Lower", "V2 lower");
});

const FIFTEEN_MINUTES = 15 * 60 * 1000;

Deno.test("historical resolver ignores candles before the signal and closes on first valid target", () => {
  const result = resolveSignalFromCandles("BUY", 100, 1_000, 2 * FIFTEEN_MINUTES, [
    { openTime: 0, high: 110, low: 90 },
    { openTime: FIFTEEN_MINUTES, high: 103, low: 99 },
    { openTime: 2 * FIFTEEN_MINUTES, high: 104, low: 99 },
  ]);
  equal(result.result, "tuttu", "first target hit");
  equal(result.closedAtMs, 2 * FIFTEEN_MINUTES, "target candle close timestamp");
});

Deno.test("historical resolver refuses a hit when prior candle coverage has a gap", () => {
  const result = resolveSignalFromCandles("BUY", 100, 1_000, 3 * FIFTEEN_MINUTES, [
    { openTime: 2 * FIFTEEN_MINUTES, high: 103, low: 99 },
  ]);
  equal(result.result, null, "missing earlier candle blocks resolution");
  equal(result.closedAtMs, null, "no false close timestamp");
});

Deno.test("historical resolver treats same-candle TP and SL as a stop", () => {
  const result = resolveSignalFromCandles("BUY", 100, 1_000, 2 * FIFTEEN_MINUTES, [
    { openTime: FIFTEEN_MINUTES, high: 103, low: 97 },
  ]);
  equal(result.result, "tutmadi", "same-candle collision");
});

Deno.test("historical resolver does not use an unfinished candle or expire early", () => {
  const result = resolveSignalFromCandles("BUY", 100, 1_000, 1_000_000, [
    { openTime: FIFTEEN_MINUTES, high: 103, low: 99 },
  ]);
  equal(result.result, null, "unfinished candle is ignored");
});

Deno.test("48-hour expiry requires complete 15-minute candle coverage", () => {
  const createdAt = 1_000;
  const endAt = createdAt + 48 * 60 * 60 * 1000;
  const completeCandles = [];
  for (let time = FIFTEEN_MINUTES; time + FIFTEEN_MINUTES <= endAt; time += FIFTEEN_MINUTES) {
    completeCandles.push({ openTime: time, high: 101, low: 99 });
  }
  const complete = resolveSignalFromCandles("BUY", 100, createdAt, endAt + 1, completeCandles);
  equal(complete.result, "suresi_doldu", "complete 48-hour history expires");
  equal(complete.closedAtMs, endAt, "expiry timestamp");

  const incomplete = resolveSignalFromCandles("BUY", 100, createdAt, endAt + 1, completeCandles.slice(1));
  equal(incomplete.result, null, "missing candle prevents expiry classification");
});

Deno.test("V2 volume and volatility cannot invent a direction without core factors", () => {
  const result = calculateV2Signal({
    price: 100, prevPrice: 100, rsi: null, prevRsi: null,
    ema20: 0, ema20Prev: 0, ema50: 0,
    macdHist: null, bbPct: null, volRatio: 2,
    whaleBuyUsd: 0, whaleSellUsd: 0,
    fearGreed: null, funding: null, volatilityPct: 1,
  });
  equal(result.coverage, 0, "confirmatory-only inputs have no coverage");
  equal(result.direction, "WAIT", "confirmatory-only inputs must wait");
});

Deno.test("V2 neutral core bias does not turn positive volume into a BUY signal", () => {
  const result = calculateV2Signal({
    price: 100, prevPrice: 100, rsi: 50, prevRsi: 50,
    ema20: 100, ema20Prev: 100, ema50: 100,
    macdHist: 0, bbPct: 0.5, volRatio: 2,
    whaleBuyUsd: 0, whaleSellUsd: 0,
    fearGreed: null, funding: null, volatilityPct: 1.5,
  });
  equal(result.direction, "WAIT", "neutral core remains neutral");
  equal(result.factors.find((factor) => factor.key === "volume")?.value, 0, "neutral volume contribution");
  equal(result.factors.find((factor) => factor.key === "volatility")?.value, 0, "neutral volatility contribution");
});

Deno.test("V2 includes a valid funding rate in the sentiment factor", () => {
  const result = calculateV2Signal({
    price: 105, prevPrice: 104, rsi: 45, prevRsi: 44,
    ema20: 103, ema20Prev: 102, ema50: 100,
    macdHist: 0.2, bbPct: 0.6, volRatio: 1.2,
    whaleBuyUsd: 0, whaleSellUsd: 0,
    fearGreed: null, funding: -0.0001, volatilityPct: 1.2,
  });
  equal(result.factors.find((factor) => factor.key === "sentiment")?.available, true, "funding makes sentiment available");
  equal(result.coverage, 0.85, "trend, momentum, volume, sentiment and volatility coverage");
});
