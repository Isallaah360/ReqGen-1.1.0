/**
 * ReqGen v3.0.10 brand backdrop: the IET emblem drawn in fine dots, in its own
 * colours, faint and twinkling (three dot groups fade in and out in turn).
 * Purely decorative: hidden from assistive technology, never intercepts clicks,
 * and still for users who prefer reduced motion.
 */
export default function BrandBackdrop() {
  return (
    <div className="rg-brand-backdrop" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`/brand/iet-dots-${i}.png`} alt="" width={1400} height={1400} decoding="async" />
      ))}
    </div>
  );
}
