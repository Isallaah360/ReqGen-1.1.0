import Link from "next/link";

export default function AppPageFooter() {
  return (
    <footer className="rg-app-footer" aria-label="ReqGen footer">
      <div>
        <strong>ReqGen 1.1.0</strong>
        <span>Request Management System</span>
      </div>
      <div className="rg-app-footer-centre">
        <strong>Secure <b>•</b> Reliable <b>•</b> Accountable</strong>
        <span>© 2026 Islamic Education Trust. All rights reserved.</span>
      </div>
      <div className="rg-app-footer-links">
        <Link href="/about">About</Link>
        <Link href="/docs">Help &amp; Docs</Link>
        <span>Powered by Barderian Enterprises</span>
      </div>
    </footer>
  );
}
