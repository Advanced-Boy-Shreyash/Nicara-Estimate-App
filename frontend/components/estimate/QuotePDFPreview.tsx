"use client";

import QuoteHeader from "@/components/estimate/QuoteHeader";
import QuoteTable, { type QuoteItem } from "@/components/estimate/QuoteTable";
import { generateEstimatePDF } from "@/lib/pdfGenerator";

/* ── Sample data matching sample template.xlsx ───────────────── */
const QUOTE_ITEMS: QuoteItem[] = [
  { siNo: 1, area: "Design", item: "Design", width: "-", height: "-", depth: "-", amount: 69606, specs: [] },
  { siNo: 2, area: "Drawing", item: "West Wall Beadings", width: "-", height: "-", depth: "-", amount: 8124, specs: [] },
  { siNo: 3, area: "Drawing", item: "East Wall TV Unit with ledge", width: "8'0\"", height: "1'0\"", depth: "1'3\"", amount: 116799,
    specs: ["Core Material(16mm BWP Ply): Austin Lincoln BWP", "Finishing - Laminate: Greenlam Off white", "Box Hinges: Hettich Onsys - 0 Crank Soft Close - 6 sets", "Draw Channels: Hettich Quadro - 18\" Soft Close - 3 sets", "Adhesive(Bonding): Fevicol Hi-Per", "Handles/Knobs: Handleless design", "Lights: Alt Profile Light", "Lights: Alt 5 amp driver With Sensors - 1 nos"] },
  { siNo: 4, area: "Suite 3", item: "Wardrobe", width: "8'0\"", height: "8'0\"", depth: "2'0\"", amount: 249989,
    specs: ["Core Material(16mm BWP Ply): Austin Lincoln BWP", "Core Material(08mm BWP Ply): Austin Lincoln BWP", "Box Hinges: Hettich Onsys - 0 Crank Soft Close - 12 sets", "Finishing - Laminate: Greenlam Off white Colour", "Inner Liner: Fabric 0.8mm thick", "Handles/Knobs: Foldable Handles INR 200 per piece", "Handles/Knobs: Handles INR 1000 per piece - 8 nos", "Accessories: Godrej Nuovo - Draw locks 25mm - 2 nos", "Lights: Alt Profile Light"] },
  { siNo: 5, area: "Suite 3", item: "Study and Dressing ledge with Mirror", width: "12'0\"", height: "0'1\"", depth: "1'3\"", amount: 82342,
    specs: ["Core Material(16mm BWP Ply): Austin Lincoln BWP", "Finishing - Laminate: Thermo Laminate Off white", "Draw Channels: Hettich Quadro - 18\" Soft Close - 2 sets", "Other Decoratives: Mirror with LED 1.5' x 4' - 1 nos"] },
  { siNo: 6, area: "Suite 3", item: "Bed back panel (Punning)", width: "-", height: "-", depth: "-", amount: 8220,
    specs: ["Other Decoratives: Teak Beading 1 1/2\" x 1\" With Putty and Paint"] },
  { siNo: 7, area: "Suite 1", item: "Wardrobe", width: "8'0\"", height: "8'0\"", depth: "2'0\"", amount: 267982,
    specs: ["Core Material(16mm BWP Ply): Austin Lincoln BWP", "Core Material(08mm BWP Ply): Austin Lincoln BWP", "Box Hinges: Hettich Onsys - 0 Crank Soft Close - 12 sets", "Finishing - Laminate: Greenlam Off white + Wooden Laminate", "Inner Liner: Fabric 0.8mm thick", "Lights: Alt Profile Light + 5 amp driver"] },
  { siNo: 8, area: "Suite 1", item: "TV console", width: "4'6\"", height: "0'10\"", depth: "1'3\"", amount: 39706, specs: [] },
  { siNo: 9, area: "Suite 1", item: "Bookshelf", width: "2'6\"", height: "6'6\"", depth: "1'3\"", amount: 80590, specs: [] },
  { siNo: 10, area: "Suite 1", item: "Dressing with Mirror", width: "2'0\"", height: "0'10\"", depth: "1'3\"", amount: 35747, specs: [] },
  { siNo: 11, area: "Suite 1", item: "Bed back Wall", width: "12'9\"", height: "9'0\"", depth: "-", amount: 24373, specs: [] },
  { siNo: 12, area: "Master Bedroom", item: "Bed back Wall", width: "4'6\"", height: "6'0\"", depth: "-", amount: 8124, specs: [] },
  { siNo: 13, area: "Master Bedroom", item: "Wardrobe", width: "9'0\"", height: "9'0\"", depth: "2'0\"", amount: 294259,
    specs: ["Core Material(16mm BWP Ply): Austin Lincoln BWP", "Core Material(08mm BWP Ply): Austin Lincoln BWP", "Box Hinges: Hettich Onsys - 0 Crank Soft Close - 14 sets", "Finishing - Laminate: Acrylic RM 6104 Fern"] },
  { siNo: 14, area: "Master Bedroom", item: "Walk in closet Wardrobe with Loft", width: "6'0\"", height: "9'0\"", depth: "2'0\"", amount: 157930, specs: [] },
  { siNo: 15, area: "Master Bedroom", item: "Dressing with Mirror", width: "2'0\"", height: "0'10\"", depth: "1'3\"", amount: 35747, specs: [] },
  { siNo: 16, area: "Master Bedroom", item: "WIC Profile Bifold Door", width: "4'0\"", height: "8'0\"", depth: "0'1\"", amount: 112147, specs: [] },
  { siNo: 17, area: "Master Bedroom", item: "Master wardrobe Profile Sliding door", width: "9'0\"", height: "9'0\"", depth: "0'1\"", amount: 39384, specs: [] },
  { siNo: 18, area: "Living", item: "Shoe Rack", width: "4'0\"", height: "3'6\"", depth: "1'3\"", amount: 51880, specs: [] },
  { siNo: 19, area: "Living", item: "Half height Wall", width: "5'0\"", height: "5'6\"", depth: "0'5\"", amount: 56460, specs: [] },
  { siNo: 20, area: "Suite 2", item: "Wardrobe", width: "7'0\"", height: "9'0\"", depth: "2'0\"", amount: 254540, specs: [] },
  { siNo: 21, area: "Suite 2", item: "Study and Dressing ledge with Mirror", width: "6'0\"", height: "0'1\"", depth: "1'3\"", amount: 55510, specs: [] },
  { siNo: 22, area: "Suite 2", item: "TV console unit", width: "4'6\"", height: "4'6\"", depth: "1'3\"", amount: 38655, specs: [] },
  { siNo: 23, area: "Suite 2", item: "Bed back Wall Panelling", width: "12'9\"", height: "9'0\"", depth: "-", amount: 24373, specs: [] },
  { siNo: 24, area: "Suite 2", item: "Bed back Wall", width: "12'0\"", height: "9'0\"", depth: "-", amount: 34122, specs: [] },
  { siNo: 25, area: "Living", item: "Crockery unit", width: "7'0\"", height: "9'0\"", depth: "1'6\"", amount: 314012,
    specs: ["Box Hinges: Hettich Onsys - 0 Crank Soft Close - 9 sets", "Draw Channels: Hettich Quadro - 18\" Soft Close - 3 sets", "Lights: Alt 5 amp driver With Sensors - 1 nos", "Finishing - Laminate: Greenlam Off white Colour", "Glass: Aluminium Profile with Glass Gold profile and plain glass - Tall Units"] },
  { siNo: 26, area: "Living 2", item: "Beading patti and wallpaper", width: "-", height: "-", depth: "-", amount: 15611, specs: [] },
  { siNo: 27, area: "Living 2", item: "TV console unit", width: "8'0\"", height: "1'6\"", depth: "1'3\"", amount: 49733, specs: [] },
  { siNo: 28, area: "Pooja Wall", item: "Arches", width: "4'6\"", height: "7'6\"", depth: "0'3\"", amount: 115477, specs: ["Finishing - Veneer", "Polishing: Melamine Matt Finish"] },
  { siNo: 29, area: "Pooja", item: "Pooja Unit", width: "4'6\"", height: "3'0\"", depth: "1'3\"", amount: 110964, specs: ["Finishing - Veneer", "Polishing: Melamine Matt Finish", "Inner Liner: Fabric 0.8mm thick"] },
  { siNo: 30, area: "Pooja", item: "Pooja Doors", width: "4'6\"", height: "7'0\"", depth: "0'2\"", amount: 59785, specs: ["Finishing - Veneer", "Handles: INR 2500 per piece - 2 nos"] },
  { siNo: 31, area: "Kitchen", item: "Base Wall and Loft", width: "26'6\"", height: "2'9\"", depth: "2'0\"", amount: 921471,
    specs: ["Accessories: Hettich Architech 4\" Tandem basket", "Accessories: Hettich Cutlery Tray", "Accessories: Sincore Sink and Tap upto INR 35,000", "Finishing - Laminate: Acrylic RM 6104 Fern", "Glass: Black Aluminium Profile with clear glass - 8 nos", "Lights: Alt 8 amp Drivers + Profile Light", "Handles: Ebco Aluminium Cabinet edge + Matt Black Gola Profile"] },
  { siNo: 32, area: "False Ceiling", item: "Plain Design", width: "-", height: "-", depth: "-", amount: 95580, specs: ["2400 sft approx. Billed as per actual at 33 rs per sft"] },
  { siNo: 33, area: "Electrical", item: "Electrical Works", width: "-", height: "-", depth: "-", amount: 107528, specs: ["Finolex Wiring, Looping and Chipping"] },
  { siNo: 34, area: "Wooden False Ceiling", item: "Wooden False Ceiling", width: "-", height: "-", depth: "-", amount: 57603, specs: ["Core Material(12mm BWP Ply): Austin Lincoln BWP", "Finishing - Veneer", "Polishing: Melamine Matt Finish"] },
  { siNo: 35, area: "Lights", item: "Lighting", width: "-", height: "-", depth: "-", amount: 95182, specs: ["Alt Profile Light - 50 rft", "Alt Down lights - 76 nos"] },
  { siNo: 36, area: "Painting", item: "Ceiling - Plain", width: "-", height: "-", depth: "-", amount: 114696, specs: ["Asian Paints Premium Emulsion 2 coats Putty + 2 coats paint for 2400 sft at 40rs per sft"] },
  { siNo: 37, area: "Painting", item: "Walls Plain", width: "-", height: "-", depth: "-", amount: 71685, specs: ["Asian Paints Premium Emulsion paper grinding, touch ups + 2 coat paint for 4500 sft at 14 rs per sft"] },
  { siNo: 38, area: "Site Management", item: "Basic Service Charges", width: "-", height: "-", depth: "-", amount: 49560, specs: [] },
  { siNo: 39, area: "Transport", item: "Transport and Hamali", width: "-", height: "-", depth: "-", amount: 63720, specs: [] },
  { siNo: 40, area: "Debris", item: "Debris Management", width: "-", height: "-", depth: "-", amount: 35400, specs: [] },
  { siNo: 41, area: "Deep Cleaning", item: "Deep Cleaning", width: "-", height: "-", depth: "-", amount: 28320, specs: [] },
  { siNo: 42, area: "Washrooms", item: "Glass Partitions", width: "-", height: "-", depth: "-", amount: 81774, specs: ["6' x 7' with sliding doors 8mm toughened plain glass with Saint Gobain Hardware - 3 nos"] },
];

const GRAND_TOTAL = 4618293;

interface QuotePDFPreviewProps {
  open: boolean;
  onClose: () => void;
}

export default function QuotePDFPreview({ open, onClose }: QuotePDFPreviewProps) {
  if (!open) return null;

  const handleDownloadPDF = () => {
    generateEstimatePDF({
      client: {
        customerName: "Ms X",
        projectName: "ABC Homes",
        apartment: "D2704",
        date: "6-May-2026",
      },
      items: QUOTE_ITEMS.map((q) => ({
        siNo: q.siNo,
        area: q.area,
        item: q.item,
        width: q.width,
        height: q.height,
        depth: q.depth,
        amount: q.amount,
        specs: q.specs,
      })),
      totalEstimate: GRAND_TOTAL,
      labourCash: 4537293,
      notes: [
        "This is an estimate. Quotation will be fixed after all the materials are selected",
        "No Changes will be done once the design and material specifications are finalized and agreed by the client",
      ],
      terms: [
        "2D drawings will be provided once the project execution is agreed by the client",
        "Variable Quantities and rates provided below, if exceeds the mentioned limits, should be borne by the client immediately",
      ],
      payments: [
        { no: 1, stage: "P1", amount: 70000, mode: "Bank" },
        { no: 2, stage: "P1", amount: 900000, mode: "Cash" },
        { no: 3, stage: "P2", amount: 1600000, mode: "Bank" },
        { no: 4, stage: "P2", amount: 1000000, mode: "Cash" },
        { no: 5, stage: "P3", amount: 1000000, mode: "Bank" },
        { no: 6, stage: "P3", amount: 48293, mode: "Cash" },
      ],
      materialSummary: { hardware: "Hettich", plywood: "Austin Lincoln" },
    });
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-surface-800/80 flex flex-col no-print" style={{ backdropFilter: "blur(6px)" }}>
      {/* Toolbar */}
      <div className="bg-nicara-dark px-6 py-3 flex justify-between items-center shrink-0 no-print">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-3 py-1.5 bg-transparent border border-surface-600 rounded-lg text-surface-300 cursor-pointer text-sm hover:bg-surface-700">← Back</button>
          <div>
            <div className="text-[14px] font-bold text-white">Quote Preview</div>
            <div className="text-[11px] text-surface-500">Sharma Residence — ABC Homes D2704</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={handleDownloadPDF} className="px-5 py-2 btn-gold rounded-xl text-[13px] font-bold border-none cursor-pointer flex items-center gap-2">
            📄 Download PDF
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[900px] mx-auto bg-white rounded-2xl shadow-2xl p-8 quote-page">
          <QuoteHeader
            clientName="Ms X"
            projectName="ABC Homes"
            apartment="D2704"
            date="6-May-2026"
            totalEstimate={GRAND_TOTAL}
            labourCash={4537293}
            notes={[
              "This is an estimate. Quotation will be fixed after all the materials are selected",
              "No Changes will be done once the design and material specifications are finalized and agreed by the client",
            ]}
            terms={[
              "2D drawings will be provided once the project execution is agreed by the client",
              "Variable Quantities and rates provided below, if exceeds the mentioned limits, should be borne by the client immediately",
            ]}
            paymentSchedule={[
              { no: 1, amount: 70000, mode: "Bank", stage: "P1" },
              { no: 2, amount: 900000, mode: "Cash", stage: "P1" },
              { no: 3, amount: 1600000, mode: "Bank", stage: "P2" },
              { no: 4, amount: 1000000, mode: "Cash", stage: "P2" },
              { no: 5, amount: 1000000, mode: "Bank", stage: "P3" },
              { no: 6, amount: 48293, mode: "Cash", stage: "P3" },
            ]}
            materialSummary={{ hardware: "Hettich", plywood: "Austin Lincoln" }}
          />

          <QuoteTable items={QUOTE_ITEMS} grandTotal={GRAND_TOTAL} />
        </div>
      </div>
    </div>
  );
}
