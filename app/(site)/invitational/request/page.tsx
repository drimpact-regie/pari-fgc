import { auth } from "@/lib/auth";
import InvitationalRequestForm from "@/components/InvitationalRequestForm";

export const dynamic = "force-dynamic";

export default async function InvitationalRequestPage() {
  const session = await auth();
  return <InvitationalRequestForm userName={session?.user ? (session.user.name ?? "") : null} />;
}
