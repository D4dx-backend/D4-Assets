"use client";

import { useSession } from "next-auth/react";
import Image from "next/image";

export default function Header() {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
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
    </header>
  );
}
