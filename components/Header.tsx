"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Menu, Package } from "lucide-react";
import { useState } from "react";

export default function Header() {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center">
          <Package className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-sm">Asset Manager</span>
      </div>
    </header>
  );
}
