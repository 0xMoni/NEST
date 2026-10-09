import { requireRole } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { QuizClient } from "./QuizClient";

export const metadata = { title: "Quiz | NEST" };

export default async function QuizPage() {
  const me = await requireRole("student");

  return (
    <Shell
      me={me}
      title="Quiz"
      sub="Test yourself on anything. The questions are written for you each time."
    >
      <QuizClient />
    </Shell>
  );
}
