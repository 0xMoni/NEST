import { redirect } from "next/navigation";
import { requireSettledUser, homeFor } from "@/lib/session";

/** Not a page — the fork in the road. Everything that signs someone in
 *  sends them here, and their role decides where they actually land. */
export default async function Dashboard() {
  const me = await requireSettledUser();
  redirect(homeFor(me.role));
}
