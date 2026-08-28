"use client";

import { useEffect, useState } from "react";

function formatNow(date: Date) {
  return {
    date: date.toLocaleDateString("en-NG", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

export default function StaffFooter() {
  const [now, setNow] = useState(() => formatNow(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(formatNow(new Date())), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <footer className="gov-footer">
      <div className="gov-footer-main">
        <div className="gov-footer-brand">
          <img src="/iet-logo.png" alt="Islamic Education Trust logo" />
          <div>
            <strong>ReqGen</strong>
            <span>Islamic Education Trust (IET)</span>
          </div>
        </div>

        <div className="gov-footer-security">
          <strong>Secure <i>•</i> Reliable <i>•</i> Accountable</strong>
          <span>{now.date} · {now.time}</span>
        </div>

        <div className="gov-footer-developer">
          <div>
            <span>Developed by</span>
            <strong>Barderian Enterprises</strong>
            <div><a href="https://barderians.com.ng" target="_blank" rel="noreferrer">barderians.com.ng</a> · <a href="mailto:info@barderians.com.ng">info@barderians.com.ng</a></div>
          </div>
          <img src="/be-logo.png" alt="Barderian Enterprises logo" />
        </div>
      </div>
      <div className="gov-footer-bottom">© {new Date().getFullYear()} Islamic Education Trust. All rights reserved.</div>
    </footer>
  );
}
