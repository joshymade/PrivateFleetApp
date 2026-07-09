import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Loads" },
  { href: "/damage/capture", label: "Damage" },
  { href: "/damage/search", label: "Search" },
  { href: "/export", label: "Export" },
] as const;

export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1 pb-20">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around">
          {navItems.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex items-center justify-center px-2 py-3 text-sm font-medium text-zinc-700"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
