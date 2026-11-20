import Link from "next/link";
import Icon from "@/app/components/v4/Icon";

/**
 * v4.6.11: "The ReqGen app is available" — on the home and sign-in pages.
 * Hidden inside the app itself (html[data-app] .v4-web-only).
 */
export default function GetAppBanner() {
  return (
    <Link href="/app" className="v4-web-only v4-getapp-banner">
      <span className="v4-getapp-ic"><Icon name="smartphone" /></span>
      <span className="v4-getapp-t"><b>The ReqGen app is here</b><small>Download it for your Android phone</small></span>
      <Icon name="download" />
    </Link>
  );
}
