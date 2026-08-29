export default function ReqGenLoading() {
  return (
    <section className="rg-route-transition" aria-live="polite" aria-busy="true">
      <div className="rg-route-transition__bar" />
      <div className="rg-route-transition__grid" aria-hidden="true"><i /><i /><i /><i /></div>
    </section>
  );
}
