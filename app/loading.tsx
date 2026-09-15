export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Cargando el menú de Yarumo Coffee">
      <section className="content" style={{ paddingTop: 48 }}>
        <div className="section-top">
          <div>
            <span className="skeleton-block" style={{ display: 'inline-block', width: 120, height: 14, marginBottom: 10 }} />
            <span className="skeleton-block" style={{ display: 'block', width: 220, height: 28 }} />
          </div>
          <span className="skeleton-block" style={{ display: 'block', width: 260, height: 44, borderRadius: 999 }} />
        </div>
        <div className="menu" style={{ marginTop: 28 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton-block skeleton-item" key={index} />
          ))}
        </div>
      </section>
    </main>
  )
}
