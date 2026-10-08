import { requireRole } from "@/lib/session";
import { RoadmapClient } from "./RoadmapClient";

export const metadata = { title: "Career Roadmap | NEST" };

export default async function RoadmapPage() {
  const me = await requireRole("student");
  return <RoadmapClient me={me} />;
}