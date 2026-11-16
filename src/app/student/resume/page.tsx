import { requireRole } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { ResumeClient } from "./ResumeClient";

export const metadata = {
  title: "ATS Resume Scorer & Market Review | NEST",
};

export default async function ResumePage() {
  const me = await requireRole("student");

  return (
    <Shell
      me={me}
      title="ATS Resume Scorer"
      sub="Instant algorithmic review: ATS score, current package vs potential CTC bracket, power verb upgrades, and visual benchmark against top 1% market resumes."
      wide
    >
      <ResumeClient me={me} />
    </Shell>
  );
}
