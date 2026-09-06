import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CHATBOT_FEATURES, getChatbotSettings } from "@/lib/chatbotSettings";
import ChatbotFeatureToggle from "@/components/ChatbotFeatureToggle";

export const dynamic = "force-dynamic";

export default async function AdminChatbotPage() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/");
  }

  const settings = await getChatbotSettings();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Chatbot</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Active ou désactive chaque fonctionnalité du bot de chat Twitch (Impact&apos;O Bot). Ces
          réglages s&apos;appliquent à toutes les chaînes autorisées.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {CHATBOT_FEATURES.map((feature) => (
          <ChatbotFeatureToggle
            key={feature.key}
            featureKey={feature.key}
            label={feature.label}
            description={feature.description}
            enabled={settings[feature.key]}
          />
        ))}
      </div>
    </div>
  );
}
