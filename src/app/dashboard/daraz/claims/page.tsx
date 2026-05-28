"use client";
import { useState, useEffect } from "react";
import { FileText, RefreshCw, ChevronDown } from "lucide-react";

interface Claim {
  id: string;
  trackingNo: string;
  itemName: string | null;
  price: number | null;
  customerName: string | null;
  quantity: number;
  returnType: string | null;
  staffClaim: string | null;
  claimResult: string | null;
  claimStatus: string;
  scannedBy: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  submitted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchClaims = async () => {
    setLoading(true);
    const res = await fetch("/api/daraz/claims");
    const data = await res.json();
    setClaims(data);
    setLoading(false);
  };

  useEffect(() => { fetchClaims(); }, []);

  const updateStatus = async (id: string, claimStatus: string, claimResult: string) => {
    setUpdating(id);
    await fetch("/api/daraz/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, claimStatus, claimResult }),
    });
    await fetchClaims();
    setUpdating(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Claims</h1>
            <p className="text-gray-400 text-sm">Manage return claims and status</p>
          </div>
        </div>
        <button onClick={fetchClaims} className="text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : claims.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">No claims yet</div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div key={claim.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/30"
                onClick={() => setExpanded(expanded === claim.id ? null : claim.id)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-white font-mono text-sm">{claim.trackingNo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[claim.claimStatus] || STATUS_COLORS.pending}`}>
                    {claim.claimStatus}
                  </span>
                  {claim.returnType && <span className="text-gray-500 text-xs">{claim.returnType}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{new Date(claim.createdAt).toLocaleDateString()}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expanded === claim.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expanded === claim.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {claim.itemName && <div><span className="text-gray-500">Item:</span> <span className="text-white">{claim.itemName}</span></div>}
                    {claim.price && <div><span className="text-gray-500">Price:</span> <span className="text-white">Rs. {claim.price}</span></div>}
                    {claim.customerName && <div><span className="text-gray-500">Customer:</span> <span className="text-white">{claim.customerName}</span></div>}
                    <div><span className="text-gray-500">Qty:</span> <span className="text-white">{claim.quantity}</span></div>
                    {claim.scannedBy && <div><span className="text-gray-500">By:</span> <span className="text-white">{claim.scannedBy}</span></div>}
                  </div>

                  {claim.staffClaim && (
                    <div><span className="text-gray-500 text-xs">Notes:</span> <p className="text-white text-sm mt-1">{claim.staffClaim}</p></div>
                  )}

                  <div className="flex gap-2 flex-wrap pt-2">
                    {["pending", "submitted", "approved", "rejected"].map((status) => (
                      <button
                        key={status}
                        onClick={() => updateStatus(claim.id, status, claim.claimResult || "")}
                        disabled={updating === claim.id || claim.claimStatus === status}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                          claim.claimStatus === status
                            ? "bg-violet-500 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
