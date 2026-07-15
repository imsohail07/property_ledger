import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Define TypeScript interfaces for the parameters
interface PropertyData {
  name: string;
  location: string;
  address: string;
  type: string;
}

interface TenantData {
  name: string;
  phone: string;
  email?: string;
  startDate: string;
  endDate?: string;
  isContinuing: boolean;
  rent: number;
  maintenance: number;
  advance: number;
  deposit?: number;
}

interface UnitData {
  unitNumber: string;
  type: string;
  area: number;
  floor: number;
  tenant?: TenantData | null;
}

interface PaymentRecord {
  month: string;
  expectedRent: number;
  maintenance: number;
  negotiationDiscount: number;
  lateFee: number;
  finalRent: number;
  amountReceived: number;
  status: "pending" | "paid" | "partial" | "overdue";
  paymentDate: string | null;
  paymentMethod: string | null;
  remarks: string | null;
  isFinalized: boolean;
}

export function generateLedgerPDF(
  property: PropertyData,
  unit: UnitData,
  tenant: TenantData,
  payments: PaymentRecord[]
) {
  // Create a new jsPDF document (Portrait, A4, millimeters)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const now = new Date();
  const downloadDateTime = `${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

  // Color Palette
  const colors = {
    primary: [30, 41, 59],     // Dark Slate (#1E293B)
    textDark: [15, 23, 42],    // Slate-900
    textMuted: [100, 116, 139], // Slate-500
    bgLight: [248, 250, 252],  // Slate-50
    border: [226, 232, 240],   // Slate-200
  };


  // --- 1. HEADER SECTION ---
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, 210, 25, "F");

  // Logo / Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("RentLedger AI", 14, 16);

  // Download timestamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 240);
  doc.text(`Generated: ${downloadDateTime}`, 140, 15);

  let currentY = 32;

  // --- 2. SUMMARY GRID: PROPERTY & UNIT & TENANT DETAILS ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text("Ledger Metadata", 14, currentY);
  currentY += 4;

  // Metadata Box Background
  doc.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.roundedRect(14, currentY, 182, 38, 2, 2, "FD");

  // Property Details (Left Column)
  doc.setFontSize(9);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text("PROPERTY DETAILS", 18, currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text(`Name: `, 18, currentY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(property.name, 35, currentY + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text(`Location: `, 18, currentY + 17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(property.location, 35, currentY + 17);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text(`Address: `, 18, currentY + 22);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  const addressLines = doc.splitTextToSize(property.address, 55);
  doc.text(addressLines, 35, currentY + 22);

  // Unit Details (Middle Column)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text("UNIT DETAILS", 100, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Unit Number:", 100, currentY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(unit.unitNumber, 128, currentY + 12);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Type:", 100, currentY + 17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(unit.type === "house" ? "Residential (House)" : "Commercial (Shop)", 128, currentY + 17);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Floor & Area:", 100, currentY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Floor ${unit.floor} / ${unit.area} Sq.Ft.`, 128, currentY + 22);

  // Tenant Details (Right Column)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text("TENANT DETAILS", 150, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Name:", 150, currentY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(tenant.name, 168, currentY + 12);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Phone:", 150, currentY + 17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(tenant.phone, 168, currentY + 17);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Start Date:", 150, currentY + 22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(tenant.startDate, 168, currentY + 22);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("End Date:", 150, currentY + 27);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(tenant.isContinuing ? "Continuing" : tenant.endDate || "-", 168, currentY + 27);

  currentY += 44;

  // --- 3. RENTAL RATES & FINANCIAL SUMMARY CARDS ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text("Agreement Details & Financial Summary", 14, currentY);
  currentY += 4;

  // Summary box
  doc.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  doc.roundedRect(14, currentY, 182, 22, 2, 2, "FD");

  // Agreements detail row
  doc.setFontSize(9);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  
  doc.setFont("helvetica", "normal");
  doc.text("Monthly Rent:", 18, currentY + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Rs. ${tenant.rent.toLocaleString()}`, 42, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Maintenance:", 18, currentY + 12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Rs. ${tenant.maintenance.toLocaleString()}`, 42, currentY + 12);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Advance / Deposit:", 18, currentY + 18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Rs. ${(tenant.advance + (tenant.deposit || 0)).toLocaleString()}`, 42, currentY + 18);

  // Financial aggregates calculation
  const totalExpected = payments.reduce((sum, p) => sum + p.finalRent, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amountReceived, 0);
  const totalPending = totalExpected - totalPaid;

  // Aggregate columns
  doc.setFont("helvetica", "normal");
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Total Expected:", 95, currentY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Rs. ${totalExpected.toLocaleString()}`, 95, currentY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Total Received:", 135, currentY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 120, 60); // Green
  doc.text(`Rs. ${totalPaid.toLocaleString()}`, 135, currentY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text("Pending Balance:", 170, currentY + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  if (totalPending > 0) {
    doc.setTextColor(200, 30, 30); // Red
  } else {
    doc.setTextColor(0, 120, 60);
  }
  doc.text(`Rs. ${totalPending.toLocaleString()}`, 170, currentY + 14);

  currentY += 28;

  // --- 4. RENT LEDGER TABLE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text("Payment History Ledger", 14, currentY);
  currentY += 4;

  // Format table data
  const tableRows = payments.map((p) => {
    // Format month e.g., "2026-07" to "Jul 2026"
    let formattedMonth = p.month;
    try {
      const [year, month] = p.month.split("-").map(Number);
      const dateObj = new Date(year, month - 1, 1);
      formattedMonth = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } catch (e) {
      // Fallback
    }

    return [
      formattedMonth,
      `Rs. ${p.expectedRent.toLocaleString()}`,
      p.negotiationDiscount > 0 ? `-Rs. ${p.negotiationDiscount.toLocaleString()}` : "Rs. 0",
      `Rs. ${p.maintenance.toLocaleString()}`,
      p.lateFee > 0 ? `+Rs. ${p.lateFee.toLocaleString()}` : "Rs. 0",
      `Rs. ${p.finalRent.toLocaleString()}`,
      `Rs. ${p.amountReceived.toLocaleString()}`,
      p.paymentMethod || "-",
      p.paymentDate || "-",
      p.status.toUpperCase(),
    ];
  });

  // Generate Table using autotable
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "Month",
        "Expected Rent",
        "Discount",
        "Maint.",
        "Late Fee",
        "Final Rent",
        "Amount Paid",
        "Method",
        "Pay Date",
        "Status",
      ],
    ],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: function (data: any) {
      // Color code status column
      if (data.section === "body" && data.column.index === 9) {
        const text = data.cell.text[0];
        if (text === "PAID") {
          data.cell.styles.textColor = [0, 120, 60]; // Green
          data.cell.styles.fontStyle = "bold";
        } else if (text === "OVERDUE") {
          data.cell.styles.textColor = [200, 30, 30]; // Red
          data.cell.styles.fontStyle = "bold";
        } else if (text === "PARTIAL") {
          data.cell.styles.textColor = [30, 80, 200]; // Blue
          data.cell.styles.fontStyle = "bold";
        } else if (text === "PENDING") {
          data.cell.styles.textColor = [200, 120, 0]; // Orange
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer: page numbers and signature
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
    
    // Page count on right
    doc.text(
      `Page ${i} of ${totalPages}`,
      180,
      287
    );

    // Brand mark on left
    doc.text(
      "Generated by RentLedger AI - Professional Property Ledgers",
      14,
      287
    );
  }

  // Save the PDF
  const filename = `${tenant.name.replace(/\s+/g, "_")}_Ledger_${now.getFullYear()}_${now.getMonth() + 1}.pdf`;
  doc.save(filename);
}
