"use client";

/* ── Quote Header — matches the sample template.xlsx format ── */
interface QuoteHeaderProps {
  clientName: string;
  projectName: string;
  apartment: string;
  date: string;
  totalEstimate: number;
  labourCash: number;
  notes: string[];
  terms: string[];
  paymentSchedule: { no: number; amount: number; mode: string; stage: string }[];
  materialSummary: { hardware: string; plywood: string };
}

export default function QuoteHeader({
  clientName, projectName, apartment, date,
  totalEstimate, labourCash, notes, terms,
  paymentSchedule, materialSummary,
}: QuoteHeaderProps) {
  const fmt = (n: number) => "₹ " + n.toLocaleString("en-IN");

  return (
    <div className="print-avoid-break">
      {/* Company Header */}
      <div className="flex justify-between items-start mb-8 quote-header">
        <div>
          <div className="text-3xl font-black text-nicara-gold tracking-[0.15em]">NICARA</div>
          <div className="text-[10px] text-surface-500 tracking-[0.2em] uppercase mt-0.5">Interior Design & Build</div>
        </div>
        <div className="text-right text-[11px] text-surface-500">
          <div className="font-semibold text-nicara-dark">nicara.design</div>
          <div>nishanth@dwelltales.com</div>
          <div>8559901234</div>
        </div>
      </div>

      {/* Client Details */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-6">
        {[
          ["Customer Name", clientName],
          ["Project", projectName],
          ["Apartment", apartment],
          ["Date", date],
        ].map(([l, v]) => (
          <div key={l} className="flex gap-2 text-[12px]">
            <span className="text-surface-500 font-semibold min-w-[120px] uppercase text-[10px] tracking-wider">{l}</span>
            <span className="text-nicara-dark font-semibold">{v}</span>
          </div>
        ))}
      </div>

      {/* Estimate Total */}
      <div className="bg-nicara-dark rounded-xl p-5 mb-5 flex justify-between items-center">
        <div>
          <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Total Estimate</div>
          <div className="text-3xl font-black text-nicara-gold">{fmt(totalEstimate)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Labour to be paid in cash</div>
          <div className="text-lg font-bold text-surface-300">{fmt(labourCash)}</div>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-wider mb-2">Notes</div>
        <ol className="list-decimal pl-5 text-[11px] text-surface-600 space-y-1 m-0">
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ol>
      </div>

      {/* Terms */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-wider mb-2">Terms and Conditions</div>
        <ol className="list-decimal pl-5 text-[11px] text-surface-600 space-y-1 m-0">
          {terms.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      </div>

      {/* Payment Schedule */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-nicara-gold uppercase tracking-wider mb-2">Payment Terms and Conditions</div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-nicara-dark">
              {["#", "Stage", "Amount", "Mode"].map(h => (
                <th key={h} className="px-3 py-2 text-surface-300 font-semibold text-left text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paymentSchedule.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-surface-50" : "bg-white"}>
                <td className="px-3 py-1.5 text-surface-500">{row.no}</td>
                <td className="px-3 py-1.5 text-nicara-dark font-semibold">{row.stage}</td>
                <td className="px-3 py-1.5 text-nicara-gold font-bold">{fmt(row.amount)}</td>
                <td className="px-3 py-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.mode === "Bank" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                    {row.mode}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Material Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-3">
          <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-1">Hardware</div>
          <div className="text-[13px] font-bold text-nicara-dark">{materialSummary.hardware}</div>
        </div>
        <div className="bg-surface-50 border border-surface-200 rounded-xl p-3">
          <div className="text-[10px] text-surface-400 uppercase tracking-wider mb-1">Plywood</div>
          <div className="text-[13px] font-bold text-nicara-dark">{materialSummary.plywood}</div>
        </div>
      </div>
    </div>
  );
}
