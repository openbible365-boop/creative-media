"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface NavbarProps {
  breadcrumbs?: BreadcrumbItem[];
}

export function Navbar({ breadcrumbs }: NavbarProps) {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-30">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <Image src="/logo.png" alt="Creative Media" width={28} height={28} className="flex-shrink-0" />
            <h1 className="text-lg font-bold text-brand-700">Creative Media</h1>
          </Link>

          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="text-gray-500 hover:text-brand-500 transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-gray-900 font-medium truncate">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-sm text-gray-700 hidden sm:inline">
                {user.name}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
