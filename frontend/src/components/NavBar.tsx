import Link from "next/link";

type ActivePage = "overview" | "explore" | "facilities";

interface Props {
  active: ActivePage;
}

export function NavBar({ active }: Props) {
  const link = (page: ActivePage, href: string, label: string) =>
    active === page
      ? <Link href={href} className="text-stone-50 border-b border-sage-500 pb-0.5 whitespace-nowrap">{label}</Link>
      : <Link href={href} className="hover:text-stone-50 transition-colors whitespace-nowrap">{label}</Link>;

  return (
    <nav className="bg-stone-900 text-stone-50 px-4 py-4 sm:px-6 sm:py-6 md:px-12 lg:px-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-sage-500 rounded-full" />
          <Link href="/">
            <span className="font-serif text-xl font-bold tracking-tight text-stone-50">PolluWatch.</span>
          </Link>
        </div>
        <div className="flex gap-5 sm:gap-8 text-xs font-medium uppercase tracking-widest text-stone-400">
          {link("overview",    "/",           "Overview")}
          {link("explore",     "/explore",    "Air Quality")}
          {link("facilities",  "/facilities", "Facilities")}
        </div>
      </div>
    </nav>
  );
}
