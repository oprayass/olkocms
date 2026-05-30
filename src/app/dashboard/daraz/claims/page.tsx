"use client";
import { useState, useEffect } from "react";
import { FileText, RefreshCw, ChevronDown, Search } from "lucide-react";
import ClaimEditPopup from "@/components/ClaimEditPopup";

interface Claim {
  id: string;
  trackingNo: string;
  darazOrderId: string | null;
  itemName: string | null;
  price: number | null;
  customerName: string | null;
  quantity: number;
  returnType: string | null;
  customerComment: string | null;
  qcComment: string | null;
  claimStatus: string;
  itemCondition: string | null;
  claimReason: string | null;
  claimType: string | null;
  claimedAmount: number | null;
  receivedAmount: number | null;
  claimDate: string | null;
  claimNote: string | null;
  claimDecision: string | null;
  storeId: string | null;
  scannedBy: string | null;
  createdAt: string;
  orderDate: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  filed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  submitted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editClaim, setEditClaim] = useState<Claim | null>(null);

  const fetchClaims = async () => {
    setLoading(true);
    const res = await fetch("/api/daraz/claims?decision=need");
    const data = await res.json();
    setClaims(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchClaims(); }, []);

  const filtered = claims.filter((c) => {
    const matchSearch =
      (c.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      c.trackingNo.toLowerCase().includes(search.toLowerCase()) ||
      (c.darazOrderId || "").includes(search);
    const matchStatus = statusFilter === "all" || c.claimStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  // Summary
  const totalClaimed = filtered.reduce((s, c) => s + (c.claimedAmount || 0), 0);
  const totalReceived = filtered.reduce((s, c) => s + (c.receivedAmount || 0), 0);
  const pendingCount = filtered.filter((c) => c.claimStatus === "pending" || c.claimStatus === "filed").length;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Claims</h1>
            <p className="text-gray-400 text-sm">Items marked "Need to Claim" — financial tracking</p>
          </div>
        </div>
        <button onClick={fetchClaims} className="text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">To Claim</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Claimed</p>
          <p className="text-2xl font-bold text-violet-400">Rs {totalClaimed.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Received</p>
          <p className="text-2xl font-bold text-emerald-400">Rs {totalReceived.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search customer, order or tracking..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-white text-sm">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="filed">Filed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
          No claims marked yet. Returns List मा गएर "Need to Claim" मार्क गर्नुहोस्।
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((claim) => (
            <div key={claim.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/30"
                onClick={() => setExpanded(expanded === claim.id ? null : claim.id)}>
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-white font-mono text-sm shrink-0">{claim.trackingNo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${STATUS_COLORS[claim.claimStatus] || STATUS_COLORS.pending}`}>
                    {claim.claimStatus}
                  </span>
                  <span className="text-gray-400 text-xs truncate">{claim.itemName || claim.returnType}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {claim.claimedAmount != null && (
                    <span className="text-violet-400 text-xs">Claim: Rs {claim.claimedAmount.toLocaleString()}</span>
                  )}
                  {claim.receivedAmount != null && (
                    <span className="text-emerald-400 text-xs">Got: Rs {claim.receivedAmount.toLocaleString()}</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expanded === claim.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expanded === claim.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500">Order ID:</span> <span className="text-white font-mono text-xs">{claim.darazOrderId || "-"}</span></div>
                    <div><span className="text-gray-500">Customer:</span> <span className="text-white">{claim.customerName || "N/A"}</span></div>
                    <div><span className="text-gray-500">Return type:</span> <span className="text-white">{claim.returnType || "-"}</span></div>
                    <div><span className="text-gray-500">Item value:</span> <span className="text-white">Rs {(claim.price || 0).toLocaleString()} × {claim.quantity}</span></div>
                    <div><span className="text-gray-500">Condition:</span> <span className="text-white">{claim.itemCondition || "-"}</span></div>
                    <div><span className="text-gray-500">Claim type:</span> <span className="text-white">{claim.claimType || "-"}</span></div>
                    <div><span className="text-gray-500">Claimed:</span> <span className="text-violet-300">Rs {(claim.claimedAmount || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Received:</span> <span className="text-emerald-300">Rs {(claim.receivedAmount || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Claim date:</span> <span className="text-white">{claim.claimDate ? new Date(claim.claimDate).toLocaleDateString() : "-"}</span></div>
                  </div>

                  <div className="space-y-1 text-sm border-t border-gray-800 pt-3">
                    <div><span className="text-gray-500">Customer reason:</span> <span className="text-orange-300">{claim.customerComment || "—"}</span></div>
                    <div><span className="text-gray-500">QC reason:</span> <span className="text-blue-300">{claim.qcComment || "—"}</span></div>
                    <div><span className="text-gray-500">Claim reason:</span> <span className="text-white">{claim.claimReason || "—"}</span></div>
                    {claim.claimNote && <div><span className="text-gray-500">Note:</span> <span className="text-gray-300">{claim.claimNote}</span></div>}
                  </div>

                  <div className="pt-2">
                    <button onClick={() => setEditClaim(claim)}
                      className="px-4 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-700 text-white">
                      Edit Claim
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editClaim && (
        <ClaimEditPopup
          claim={editClaim as any}
          onClose={() => setEditClaim(null)}
          onSaved={() => fetchClaims()}
        />
      )}
    </div>
  );
}