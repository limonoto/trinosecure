import { redirect } from "next/navigation";

// Auth is disabled — redirect directly to the app.
export default function SignInPage() {
  redirect("/");
}
