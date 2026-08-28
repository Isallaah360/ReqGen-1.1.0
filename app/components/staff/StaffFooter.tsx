"use client";

export default function StaffFooter() {
  return (
    <footer className="mock-footer">
      <div className="mock-footer-brand">
        <img src="/iet-logo.png" alt="Islamic Education Trust logo" />
        <div><strong>ReqGen</strong><span>Request Management System</span></div>
      </div>
      <div className="mock-footer-centre">
        <strong>Secure <i>•</i> Reliable <i>•</i> Accountable</strong>
        <div><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">https://barderians.com.ng</a><span>|</span><a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></div>
        <small>© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</small>
      </div>
      <div className="mock-footer-developer"><span>Powered by</span><div><strong>BARDERIAN <em>ENTERPRISES</em></strong><img src="/be-logo.png" alt="Barderian Enterprises logo" /></div></div>
    </footer>
  );
}
