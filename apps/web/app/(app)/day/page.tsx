import { redirect } from "next/navigation";
import { todayInAppTz } from "../../../lib/day";

export const dynamic = "force-dynamic";

// Bare /day (from the nav) jumps to today.
export default function DayIndex() {
  redirect(`/day/${todayInAppTz()}`);
}
