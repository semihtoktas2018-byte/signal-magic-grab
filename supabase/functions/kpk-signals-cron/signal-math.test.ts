import {
  calculatePerformanceSummary,
  calculateV1Signal,
  evaluateCandleOutcome,
  getTradeLevels,
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
