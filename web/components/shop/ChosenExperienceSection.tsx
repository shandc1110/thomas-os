import { deerPathExperience } from "@/lib/content/deer-path";
import { deerPathStatementFont } from "@/lib/fonts/deer-path-statement";

/**
 * Chosen Experiences — Deer Path Photography.
 * Controlled editorial spread: LEFT story · RIGHT one cohesive DSC photography block.
 * Hero locked to DSC_2088.
 */
export function ChosenExperienceSection() {
  const content = deerPathExperience;
  const { hero, supportPrimary, supportSecondary } = content.images;

  return (
    <section
      id="chosen-experiences"
      aria-labelledby="chosen-experiences-heading"
      className="scroll-mt-24 border-b border-sand/50 bg-ivory"
    >
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 md:py-16 lg:px-10">
        <div className="grid items-start gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.75fr)] md:gap-8 lg:gap-10">
          {/* LEFT — editorial story */}
          <div className="md:max-w-md md:pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sage">
              {content.eyebrow}
            </p>

            <h2
              id="chosen-experiences-heading"
              className="mt-4 font-serif text-[1.7rem] font-medium leading-[1.12] tracking-[0.01em] text-charcoal lg:text-[1.95rem]"
            >
              {content.heading}
            </h2>

            {/* Emotional centre — handwritten script (not Playfair italic) */}
            <blockquote className="mt-9 border-0 p-0 md:mt-10">
              <p
                className={`${deerPathStatementFont.className} text-[2rem] leading-[1.12] text-charcoal sm:text-[2.25rem] lg:text-[2.75rem]`}
              >
                {content.statementLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </blockquote>

            <p className="mt-7 text-sm leading-relaxed text-muted md:mt-8">
              {content.support}
            </p>

            <p className="mt-5 text-xs tracking-[0.08em] text-muted">
              {content.attribution}
            </p>

            <div className="mt-8 md:mt-9">
              <a
                href={content.cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center border border-sand bg-transparent px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal transition hover:border-sage"
              >
                {content.cta.label}
                <span className="ml-2" aria-hidden="true">
                  →
                </span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>

          {/* RIGHT — cohesive photography composition */}
          <div className="min-w-0">
            {/* Mobile: hero first, then strongest supporting */}
            <div className="grid gap-2.5 md:hidden">
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.src}
                  alt={hero.alt}
                  className="aspect-[4/5] w-full object-cover object-[center_62%]"
                  decoding="async"
                  loading="lazy"
                />
              </figure>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={supportPrimary.src}
                  alt={supportPrimary.alt}
                  className="aspect-[5/6] w-full object-cover object-[center_32%]"
                  decoding="async"
                  loading="lazy"
                />
              </figure>
            </div>

            {/* Desktop: hero + stacked supports — shared edges, 12px gutters */}
            <div
              className="hidden h-[32rem] grid-cols-[1.6fr_1fr] gap-3 md:grid lg:h-[34rem]"
              aria-label="Deer Path Photography"
            >
              <figure className="h-full min-h-0 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hero.src}
                  alt={hero.alt}
                  className="h-full w-full object-cover object-[center_68%]"
                  decoding="async"
                  loading="lazy"
                />
              </figure>

              <div className="grid h-full min-h-0 min-w-0 grid-rows-[1.35fr_1fr] gap-3">
                <figure className="min-h-0 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={supportPrimary.src}
                    alt={supportPrimary.alt}
                    className="h-full w-full object-cover object-[center_30%]"
                    decoding="async"
                    loading="lazy"
                  />
                </figure>
                <figure className="min-h-0 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={supportSecondary.src}
                    alt={supportSecondary.alt}
                    className="h-full w-full object-cover object-[center_28%]"
                    decoding="async"
                    loading="lazy"
                  />
                </figure>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
