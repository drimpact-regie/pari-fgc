"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ChatbotFeatureKey } from "@/lib/chatbotSettings";

export default function ChatbotFeatureToggle({
  featureKey,
  label,
  description,
  enabled,
}: {
  featureKey: ChatbotFeatureKey;
  label: string;
  description: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);

    await fetch("/api/admin/chatbot-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [featureKey]: !enabled }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="card p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={loading}
        className="shrink-0 relative rounded-full transition-colors"
        style={{
          width: 44,
          height: 24,
          background: enabled ? "var(--accent)" : "var(--surface-alt)",
          border: "1px solid var(--border)",
          opacity: loading ? 0.6 : 1,
        }}
        title={enabled ? "Cliquer pour désactiver" : "Cliquer pour activer"}
      >
        <span
          className="absolute rounded-full transition-transform"
          style={{
            width: 18,
            height: 18,
            top: 2,
            left: 2,
            background: "#fff",
            transform: enabled ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}
