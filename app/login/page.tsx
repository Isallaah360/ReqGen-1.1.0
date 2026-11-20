"use client";

import { LoginPageFor } from "./LoginView";

/** ReqGen sign-in. The screen itself lives in LoginView (shared with the hidden /console sign-in). */
export default function LoginPage() {
  return <LoginPageFor console={false} />;
}
