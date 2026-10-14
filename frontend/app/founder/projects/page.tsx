import { redirect } from "next/navigation";

export default function FounderProjectsRedirect() {
  redirect("/founder/dashboard?tab=projects");
}
