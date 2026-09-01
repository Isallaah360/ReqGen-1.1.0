"use client";

import Image from "next/image";
import { Globe2, Mail, ShieldCheck } from "lucide-react";

export default function ReqGenFooter() {
  return (
    <footer className="mock-footer" aria-label="ReqGen footer">
      <div className="mock-footer-brand">
        <Image src="/iet-logo.png" alt="Islamic Education Trust logo" width={46} height={46} />
        <div><strong>ReqGen 1.1.0</strong><span>Request Management System</span></div>
      </div>

      <div className="mock-footer-centre">
        <strong><ShieldCheck size={15} /> Secure <i>•</i> Reliable <i>•</i> Accountable</strong>
        <div>
          <a href="https://barderians.com.ng" target="_blank" rel="noreferrer"><Globe2 size={14} />barderians.com.ng</a>
          <span>|</span>
          <a href="mailto:info@barderians.com.ng"><Mail size={14} />info@barderians.com.ng</a>
        </div>
        <small>© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</small>
      </div>

      <div className="mock-footer-developer">
        <span>Powered by</span>
        <div><strong>BARDERIAN <em>ENTERPRISES</em></strong><Image src="/be-logo.png" alt="Barderian Enterprises logo" width={58} height={42} /></div>
      </div>
    </footer>
  );
}
