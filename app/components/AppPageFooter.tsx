import { REQGEN_PRODUCT_LABEL } from "@/lib/version";

export default function AppPageFooter() {
  return (
    <footer className="rg-app-footer" aria-label="ReqGen footer">
      <div>
        <strong>{REQGEN_PRODUCT_LABEL}</strong>
        <span>Request Management System</span>
      </div>
      <div className="rg-app-footer-centre">
        <strong>Secure <b>•</b> Reliable <b>•</b> Accountable</strong>
        <span>© 2026 Islamic Education Trust. All rights reserved.</span>
      </div>
      <div className="rg-app-footer-links">
        <span>Powered by Barderian Enterprises</span>
      </div>
    </footer>
  );
}
