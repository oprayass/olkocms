"use client";
import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";

const IMPORT_TYPES = [
  {
    key: "outbound",
    label: "Outbound Scan",
    desc: "Daraz_Order_Processing.xlsx — store बाट Daraz warehouse पठाएको records",
    color: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-500/20 text-blue-400",
  },
  {
    key: "inbound",
    label: "Delivery Failed / Inbound",
    desc: "Delivery_Failed.xlsx — failed delivery फिर्ता आएको records",
    color: "border-orange-500/30 bg-orange-500/5",
    badge: "bg-orange-500/20 text-orange-400",
  },
  {
    key: "claim",
    label: "Return & Claim",
    desc: "Return___Claim_.xlsx — return र claim records",
    color: "border-purple-500/30 bg-purple-500/5",
    badge: "bg-purple-500/20 text-purple-400",
  },
];

interface ImportResult {
  created: number;
  skipped: number;
  notFound: number;
  total: number;
  error?: string;
}

export default function ImportPage() {
  const [results, setResults] = useState<Record<string, ImportResult>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, File>>({});

  const handleFile = (type: string, f: File | null) => {
    if (!f) return;
    setFiles((prev) => ({ ...prev, [type]: f }));
  };

  const handleImport = async (type: string) => {
    const file = files[type];
    if (!file) return;
    setLoading(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      const res = await fetch("/api/daraz/import-scans", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults((prev) => ({ ...prev, [type]: data }));
    } catch {
      setResults((prev) => ({ ...prev, [type]: { created: 0, skipped: 0, notFound: 0, total: 0, error: "Network error" } }));
    }
    setLoading(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="w-6 h-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Excel Import</h1>
          <p className="text-gray-400 text-sm">One-time bulk import — Excel data लाई OlkoCMS मा भित्र्याउने</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">
        ⚠️ यो one-time import हो। Duplicate records automatically skip हुन्छन्। Import गरेपछि Alerts page मा "Run Reconciliation" थिच्नुहोस्।
      </div>

      <div className="space-y-4">
        {IMPORT_TYPES.map((t) => {
          const result = results[t.key];
          const isLoading = loading === t.key;
          const hasFile = !!files[t.key];

          return (
            <div key={t.key} className={`rounded-xl border p-5 space-y-4 ${t.color}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${t.badge}`}>{t.key}</span>
                    <span className="text-white font-semibold">{t.label}</span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">{t.desc}</p>
                </div>
                {result && !result.error && (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  {hasFile ? files[t.key].name : "Excel file छान्नुहोस्"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFile(t.key, e.target.files?.[0] ?? null)}
                  />
                </label>

                <button
                  onClick={() => handleImport(t.key)}
                  disabled={!hasFile || isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {isLoading ? "Importing..." : "Import गर्नुहोस्"}
                </button>
              </div>

              {result && (
                <div className={`rounded-lg p-3 text-xs space-y-1 ${result.error ? "bg-red-500/10 text-red-400" : "bg-gray-900 text-gray-300"}`}>
                  {result.error ? (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Error: {result.error}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-emerald-400 font-medium">✅ Import complete</div>
                      <div>Total rows: <span className="text-white">{result.total}</span></div>
                      <div>Created: <span className="text-emerald-400">{result.created}</span></div>
                      <div>Skipped (duplicate): <span className="text-gray-400">{result.skipped}</span></div>
                      <div>Order not found in DB: <span className="text-amber-400">{result.notFound}</span></div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400">
        <p className="font-medium text-gray-300 mb-2">Import गरेपछि:</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>तीनै files import गर्नुहोस्</li>
          <li><a href="/dashboard/daraz/alerts" className="text-blue-400 hover:underline">Alerts page</a> मा जानुहोस्</li>
          <li>"Run Reconciliation" थिच्नुहोस्</li>
          <li>Real alerts देखिनेछन्</li>
        </ol>
      </div>
    </div>
  );
}