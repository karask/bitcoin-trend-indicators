import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Register or sign in", description: "Passwordless email access to Regime Labs." };

export default function LoginPage() {
  return <main className="auth-page"><LoginForm /><aside><p className="eyebrow">PASSWORDLESS BY DESIGN</p><h2>One identity. Both research labs.</h2><p>Your verified email unlocks the crypto and stock dashboards. The code expires after 10 minutes, and the secure browser session lasts 30 days.</p><ul><li>No password to create, remember, or recover</li><li>No marketing email</li><li>Log out or delete the account at any time</li></ul></aside></main>;
}
