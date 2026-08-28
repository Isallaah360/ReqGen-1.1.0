"use client";

export default function StaffFooter() {
  return (
    <footer className="gov-footer">
      <div className="gov-footer-main">
        <div className="gov-footer-brand">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" />
          <div>
            <strong>ReqGen</strong>
            <span>Request Management System</span>
          </div>
        </div>

        <div className="gov-footer-security">
          <strong>Secure <i>•</i> Reliable <i>•</i> Accountable</strong>
          <div className="gov-footer-contact">
            <a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a>
            <span>•</span>
            <a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a>
          </div>
          <span>© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</span>
        </div>

        <div className="gov-footer-developer">
          <div>
            <span>Powered by</span>
            <strong>Barderian Enterprises</strong>
          </div>
          <img src="/be-logo.png" alt="Barderian Enterprises logo" />
        </div>
      </div>
    </footer>
  );
}
