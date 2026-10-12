import { T } from '@/lib/i18n'

export default function VisitStrip() {
  return (
    <section className="visit-strip" id="visitanos" aria-label="Ubicación y horarios">
      <div>
        <span className="eyebrow"><T k="visit_eyebrow" /></span>
        <h2>
          <T k="visit_title_1" /><br />
          <em><T k="visit_title_2" /></em>
        </h2>
      </div>
      <div>
        <p>
          <T k="visit_address_line1" /><br />
          <T k="visit_address_line2" />
        </p>
        <a
          href="https://maps.app.goo.gl/yr8DTNsgNKm6NQb6A?g_st=iw"
          target="_blank"
          rel="noreferrer"
        >
          <T k="visit_maps_cta" />
        </a>
      </div>
    </section>
  )
}
