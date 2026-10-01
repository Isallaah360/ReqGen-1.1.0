"use client";

import Image from "next/image";
import { Globe2, Mail, ShieldCheck } from "lucide-react";
import { REQGEN_PRODUCT_LABEL } from "@/lib/version";

export default function ReqGenFooter() {
  return (
    <footer className="mock-footer" aria-label="ReqGen footer">
      <div className="mock-footer-brand rg-footer-client">
        <Image src="/iet-logo-mark.png" alt="Islamic Education Trust logo" width={60} height={60} className="rg-footer-logo" />
        <div><span>Made for the</span><strong>Islamic Education Trust</strong><small>{REQGEN_PRODUCT_LABEL}</small></div>
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
        <div><strong>BARDERIAN <em>ENTERPRISES</em></strong><Image src="/be-logo.png" alt="Barderian Enterprises logo" width={60} height={60} className="rg-footer-logo" /></div>
      </div>
    </footer>
  );
}
