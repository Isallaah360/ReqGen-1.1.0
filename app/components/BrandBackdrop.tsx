/**
 * ReqGen v3.1.0 brand watermark: the real IET logo in a single IET orange,
 * faint, on every page (behind content; never intercepts clicks; hidden from
 * assistive technology).
 */
export default function BrandBackdrop() {
  return (
    <div className="rg-brand-backdrop" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/iet-watermark.png" alt="" width={1000} height={1000} decoding="async" />
    </div>
  );
}
