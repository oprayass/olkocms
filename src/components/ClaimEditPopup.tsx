"use client";
import { useState, useEffect } from "react";
import { X, FileText, Loader2, History } from "lucide-react";

interface Claim {
  id: string;
  trackingNo: string;
  darazOrderId: string | null;
  itemName: string | null;
  customerName: string | null;
  price: number | null;
  quantity: number;
  returnType: string | null;
  customerComment: string | null;
  qcComment?: string | null;
  claimStatus: string;
  itemCondition?: string | null;
  claimReason?: string | null;
  claimType?: string | null;
  claimedAmount?: number | null;
  receivedAmount?: number | null;
  claimDate?: string | null;
  claimNote?: string | null;
  claimDecision?: string | null;
}

interface Props {
  claim: Claim | null;
  onClose: () => void;
  onSaved: () => void;
}

const CONDITIONS = ["Good", "Damaged", "Wrong Item", "Missing Parts", "Used", "Other"];
const CLAIM_TYPES = ["Full", "Partial", "Percentage"];
const STATUSES = ["pending", "filed", "approved", "rejected"];
const DECISIONS = [
  { value: "undecided", label: "Undecided" },
  { value: "need", label: "Need to Claim" },
  { value: "not_needed", label: "Not Needed" },
];

export default function ClaimEditPopup({ claim, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<{ id: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string | null; createdAt: string }[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    qcComment: "",
    itemCondition: "",
    claimReason: "",
    claimType: "",
    claimedAmount: "",
    receivedAmount: "",
    claimStatus: "pending",
    claimDate: "",
    claimNote: "",
    claimDecision: "undecided",
  });

  useEffect(() => {
    if (claim) {
      setForm({
        qcComment: claim.qcComment || "",
        itemCondition: claim.itemCondition || "",
        claimReason: claim.claimReason || "",
        claimType: claim.claimType || "",
        claimedAmount: claim.claimedAmount != null ? String(claim.claimedAmount) : "",
        receivedAmount: claim.receivedAmount != null ? String(claim.receivedAmount) : "",
        claimStatus: claim.claimStatus || "pending",
        claimDate: claim.claimDate ? claim.claimDate.substring(0, 10) : "",
        claimNote: claim.claimNote || "",
        claimDecision: claim.claimDecision || "undecided",
      });
      setError("");
      // fetch history
      fetch(`/api/daraz/claim-log?claimId=${claim.id}`)
        .then((r) => r.json())
        .then((d) => setLogs(d.logs || []))
        .catch(() => setLogs([]));
    }
  }, [claim]);

  if (!claim) return null;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/daraz/returns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claim.id, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        onSaved();
        onClose();
      } else {
        setError(data.error || "Save failed");
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm";
  const labelCls = "text-xs text-gray-400 font-medium block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-white font-semibold">Claim Details</h3>
              <p className="text-gray-500 text-xs">Order #{claim.darazOrderId || "-"} · {claim.trackingNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Read-only context */}
          <div className="bg-gray-850 border border-gray-800 rounded-lg p-3 text-xs space-y-1">
            <p className="text-gray-400">Product: <span className="text-white">{claim.itemName || "N/A"}</span></p>
            <p className="text-gray-400">Customer: <span className="text-white">{claim.customerName || "N/A"}</span></p>
            <p className="text-gray-400">Return type: <span className="text-white">{claim.returnType || "-"}</span></p>
            <p className="text-gray-400">Item value: <span className="text-emerald-400">Rs {(claim.price || 0).toLocaleString()}</span> × {claim.quantity}</p>
            <p className="text-gray-400">Customer return reason: <span className="text-orange-300">{claim.customerComment || "—"}</span></p>
          </div>

          {/* Claim Decision — सबभन्दा माथि, महत्त्वपूर्ण */}
          <div>
            <label className={labelCls}>Claim Decision</label>
            <select className={inputCls} value={form.claimDecision}
              onChange={(e) => setForm({ ...form, claimDecision: e.target.value })}>
              {DECISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <p className="text-gray-600 text-xs mt-1">"Need to Claim" मार्क गरेपछि Claims page मा देखिन्छ।</p>
          </div>

          {form.claimDecision !== "not_needed" && (
          <>
          {/* QC reason (Daraz QC reason) */}
          <div>
            <label className={labelCls}>Daraz QC Reason (Seller Center बाट)</label>
            <input className={inputCls} value={form.qcComment}
              onChange={(e) => setForm({ ...form, qcComment: e.target.value })}
              placeholder="Seller Center को QC return reason..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Item Condition</label>
              <select className={inputCls} value={form.itemCondition}
                onChange={(e) => setForm({ ...form, itemCondition: e.target.value })}>
                <option value="">Select...</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Claim Type</label>
              <select className={inputCls} value={form.claimType}
                onChange={(e) => setForm({ ...form, claimType: e.target.value })}>
                <option value="">Select...</option>
                {CLAIM_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Claim Reason (हामीले किन claim गरेको)</label>
            <input className={inputCls} value={form.claimReason}
              onChange={(e) => setForm({ ...form, claimReason: e.target.value })}
              placeholder="e.g. Damaged on return, wrong item received..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Claimed Amount (Rs)</label>
              <input type="number" className={inputCls} value={form.claimedAmount}
                onChange={(e) => setForm({ ...form, claimedAmount: e.target.value })}
                placeholder="हामीले माग्यौं" />
            </div>
            <div>
              <label className={labelCls}>Received Amount (Rs)</label>
              <input type="number" className={inputCls} value={form.receivedAmount}
                onChange={(e) => setForm({ ...form, receivedAmount: e.target.value })}
                placeholder="Daraz ले दियो" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Claim Status</label>
              <select className={inputCls} value={form.claimStatus}
                onChange={(e) => setForm({ ...form, claimStatus: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Claim Date</label>
              <input type="date" className={inputCls} value={form.claimDate}
                onChange={(e) => setForm({ ...form, claimDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Note</label>
            <textarea className={inputCls} rows={2} value={form.claimNote}
              onChange={(e) => setForm({ ...form, claimNote: e.target.value })}
              placeholder="Extra notes..." />
          </div>
          </>
          )}

          {/* History timeline */}
          {logs.length > 0 && (
            <div className="border-t border-gray-800 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300 font-medium">History</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="text-xs text-gray-400 flex flex-wrap gap-1">
                    <span className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
                    <span className="text-blue-300">{log.changedBy || "unknown"}</span>
                    <span>changed</span>
                    <span className="text-white">{log.field}</span>
                    <span className="text-gray-600">{log.oldValue}</span>
                    <span>→</span>
                    <span className="text-emerald-300">{log.newValue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : "Save Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}