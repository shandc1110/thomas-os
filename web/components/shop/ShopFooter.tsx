import Link from "next/link";
import { BrandLogo } from "@/components/shop/BrandLogo";
import { cbcV4Assets, cbcV4Brand } from "@/lib/brand/chosen-by-chloe";

export function ShopFooter() {
  return (
    <footer className="mt-8 border-t border-sand bg-ivory">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-14 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-4">
          <BrandLogo
            variant="primary-horizontal"
            className="h-10 w-auto max-w-[220px] object-contain object-left"
          />
          <p className="text-sm leading-relaxed text-muted">
            Chosen with a mother&apos;s heart.
            <br />
            For little lives.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal">
              Explore
            </p>
            <ul className="mt-3 space-y-2 text-muted">
              {cbcV4Brand.nav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-charcoal">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal">
              Account
            </p>
            <ul className="mt-3 space-y-2 text-muted">
              <li>
                <Link href="/checkout" className="hover:text-charcoal">
                  Basket
                </Link>
              </li>
              <li>
                <Link href="/admin/login" className="hover:text-charcoal">
                  Account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal">
              Contact
            </p>
            <ul className="mt-3 space-y-2 text-muted">
              <li>
                <a
                  href="mailto:dongchen@chosenbychloe.com"
                  className="hover:text-charcoal"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-sand/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 sm:flex-row">
          <p className="text-xs text-muted">
            © {new Date().getFullYear()} {cbcV4Brand.displayName}
          </p>
          {/* Secondary CC signature — small, never competing with wordmark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cbcV4Assets.ccSignature}
            alt={cbcV4Brand.ccAlt}
            className="h-6 w-auto opacity-70"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </footer>
  );
}
