import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_KEY } from "@/lib/auth";
import HomePage from "./components/HomePage";

export default async function Home() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get(AUTH_COOKIE_KEY)?.value;

  if (authToken) {
    redirect("/dashboard");
  }

  return <HomePage />;
}
