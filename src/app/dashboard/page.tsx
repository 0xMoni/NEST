import { redirect } from "next/navigation";
import { requireUser, homeFor } from "@/lib/session";

/** Not a page — the fork in the road. Everything that signs someone in
 *  sends them here, and their role decides where they actually land. */
export default async function Dashboard() {
  const me = await requireUser();
  redirect(homeFor(me.role));
}
