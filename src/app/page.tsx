import { redirect } from "next/navigation";

export default function Home() {
  // Nothing lives at the root yet. Once role gating lands in phase 01 this
  // becomes the dispatcher that sends each role to its own dashboard.
  redirect("/login");
}
