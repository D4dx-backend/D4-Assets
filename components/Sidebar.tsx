"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  Users,
  UserCircle,
  Tag,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/movements", label: "Movements", icon: ArrowLeftRight },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNavItems = [
  { href: "/users", label: "Users", icon: Users },
  { href: "/persons", label: "Persons", icon: UserCircle },
  { href: "/categories", label: "Categories", icon: Tag },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();
  const isAdmin = session?.user?.role === "admin";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 min-h-screen">
        <div className="p-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/icons/logo.jpeg"
                alt="Asset Manager"
                width={32}
                height={32}
                className="rounded-lg shadow-sm"
              />
              <span className="font-bold text-gray-900 dark:text-white text-sm">Asset Manager</span>
            </div>
            <button
              onClick={toggle}
              title="Toggle dark mode"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {isAdmin && (
            <>
              <div className="pt-3 pb-1">
                <p className="px-3 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Admin</p>
              </div>
              {adminNavItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-100 dark:border-slate-700">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav – scrollable, shows all items */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-50 safe-bottom">
        <div className="flex overflow-x-auto scrollbar-hide py-1 px-1 gap-1">
          {[...navItems, ...(isAdmin ? adminNavItems : [])].map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-16 py-1.5 rounded-xl transition-colors",
                  active
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
              </Link>
            );
          })}
          {/* Dark mode toggle in mobile nav */}
          <button
            onClick={toggle}
            className="flex flex-col items-center justify-center gap-0.5 flex-shrink-0 w-16 py-1.5 rounded-xl transition-colors text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="text-[10px] font-medium leading-tight">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function NavLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
}) {
  const Icon = item.icon;
  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        active
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
          : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </Link>
  );
}
