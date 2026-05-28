"use client";
import Link from "next/link";
import { Package, RotateCcw, FileText, AlertTriangle } from "lucide-react";

const cards = [
  {
    title: "Outbound Scan",
    description: "Scan tracking numbers before sending to Daraz warehouse",
    href: "/dashboard/daraz/outbound",
    icon: Package,
    color: "text-orange-400",
    border: "border-orange-500/30 hover:border-orange-500/60",
    bg: "bg-orange-500/10",
  },
  {
    title: "Returns Scan",
    description: "Process returned or failed delivery items with tracking number",
    href: "/dashboard/daraz/returns",
    icon: RotateCcw,
    color: "text-amber-400",
    border: "border-amber-500/30 hover:border-amber-500/60",
    bg: "bg-amber-500/10",
  },
  {
    title: "Claims",
    description: "Manage and update claim status for returned items",
    href: "/dashboard/daraz/claims",
    icon: FileText,
    color: "text-violet-400",
    border: "border-violet-500/30 hover:border-violet-500/60",
    bg: "bg-violet-500/10",
  },
  {
    title: "Alerts",
    description: "View unresolved alerts and missing items",
    href: "/dashboard/daraz/alerts",
    icon: AlertTriangle,
    color: "text-red-400",
    border: "border-red-500/30 hover:border-red-500/60",
    bg: "bg-red-500/10",
  },
];

export default function DarazPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Daraz</h1>
        <p className="text-gray-400 text-sm mt-1">Warehouse & order management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <div className={`bg-gray-900 border ${card.border} rounded-xl p-6 cursor-pointer transition-all duration-200 hover:bg-gray-800/50`}>
                <div className={`inline-flex p-3 rounded-lg ${card.bg} mb-4`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <h2 className="text-white font-semibold text-lg">{card.title}</h2>
                <p className="text-gray-400 text-sm mt-1">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
