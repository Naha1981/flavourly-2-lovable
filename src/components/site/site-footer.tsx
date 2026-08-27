import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo size="md" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The AI revenue employee for South African restaurants. Answers the phone at 2am,
              remembers every VIP, fills quiet Tuesdays.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Built in Johannesburg by NahaLabs.</p>
          </div>

          <FooterCol
            title="Product"
            links={[
              { label: "Overview", to: "/product" },
              { label: "Pricing", to: "/pricing" },
              { label: "Customer stories", to: "/stories" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { label: "About", to: "/company" },
              { label: "Contact sales", to: "/contact" },
              { label: "Sign in", to: "/login" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacy", to: "/legal/privacy" },
              { label: "Terms", to: "/legal/terms" },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Flavourly by NahaLabs. All rights reserved.</p>
          <p>Prices in ZAR, excluding VAT.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div>
      <h3 className="font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-4 grid gap-2.5">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-sm text-foreground/80 transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
