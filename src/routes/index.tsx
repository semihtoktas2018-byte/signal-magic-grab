import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KELTOŞ PARAYA KOŞ v5.0" },
      { name: "description", content: "Keltoş canlı kripto sinyalleri, paper trade ve backtest paneli." },
      { property: "og:title", content: "KELTOŞ PARAYA KOŞ" },
      { property: "og:description", content: "Canlı kripto sinyalleri, paper trade ve backtest." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/keltos.html"
      title="Keltoş Signal"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
