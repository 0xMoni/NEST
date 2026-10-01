import { requireRole } from "@/lib/session";
import { Shell } from "@/components/Shell";

export default async function Home() {
  const me = await requireRole("admin");
  return (
    <Shell me={me} title="Overview" sub="Department setup and people.">
      <p style={{ color: "var(--ink-2)", maxWidth: "54ch", lineHeight: 1.6 }}>
        Signed in as <strong>{me.full_name}</strong>. The screens for this role are next — the
        navigation on the left shows what is coming.
      </p>
    </Shell>
  );
}
