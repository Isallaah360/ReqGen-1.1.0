/**
 * ReqGen v3.1.2 loader: a slim strip in the IET logo colours sweeping left to
 * right across the top of the app while a page or action loads. Announces the
 * state to screen readers; still for users who prefer reduced motion.
 */
export default function ReqGenLoader({ title = "Loading…" }: { title?: string; detail?: string; skeleton?: boolean }) {
  return (
    <div className="rg-strip-loader" role="progressbar" aria-busy="true" aria-label={title}>
      <span />
    </div>
  );
}
