import Link from "next/link";

export default function HomePage() {
  return (
    <section className="reqgen-home" aria-labelledby="reqgen-home-title">
      <div className="reqgen-home__glow reqgen-home__glow--one" />
      <div className="reqgen-home__glow reqgen-home__glow--two" />

      <div className="reqgen-home__card">
        <div className="reqgen-home__logo-wrap">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" />
        </div>

        <div className="reqgen-home__copy">
          <span className="reqgen-home__eyebrow">Islamic Education Trust</span>
          <h1 id="reqgen-home-title">Welcome to ReqGen</h1>
          <p>A secure, simple and accountable request management system for IET staff.</p>
        </div>

        <div className="reqgen-home__actions">
          <Link href="/login" className="reqgen-home__primary" data-tip="Sign in securely with your ReqGen account.">
            <LockIcon />
            <span>Login</span>
          </Link>
          <Link href="/signup" className="reqgen-home__secondary" data-tip="Create a ReqGen account if registration is permitted.">
            <UserPlusIcon />
            <span>Sign Up</span>
          </Link>
        </div>

        <div className="reqgen-home__trust" aria-label="ReqGen principles">
          <span>Secure</span><i />
          <span>Reliable</span><i />
          <span>Accountable</span>
        </div>
      </div>
    </section>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 19a6 6 0 0 0-12 0" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}
