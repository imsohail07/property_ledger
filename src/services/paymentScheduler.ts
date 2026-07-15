import { 
  collection, 
  doc, 
  writeBatch, 
  getDocs, 
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

// Helper to parse "YYYY-MM" to year and month numbers
export function parseYearMonth(str: string): { year: number; month: number } {
  const [y, m] = str.split("-").map(Number);
  return { year: y, month: m };
}

// Helper to format year and month numbers to "YYYY-MM"
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Generate an array of "YYYY-MM" strings from start to end (inclusive)
export function getMonthsBetween(startStr: string, endStr: string): string[] {
  const months: string[] = [];
  const start = parseYearMonth(startStr);
  const end = parseYearMonth(endStr);
  
  let currentYear = start.year;
  let currentMonth = start.month;
  
  while (
    currentYear < end.year || 
    (currentYear === end.year && currentMonth <= end.month)
  ) {
    months.push(formatYearMonth(currentYear, currentMonth));
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  return months;
}

// Returns the current calendar month in "YYYY-MM" format
export function getCurrentMonthStr(): string {
  const now = new Date();
  return formatYearMonth(now.getFullYear(), now.getMonth() + 1);
}

interface TenantInput {
  name: string;
  phone: string;
  email?: string;
  startDate: string; // "YYYY-MM"
  endDate?: string;  // "YYYY-MM"
  isContinuing: boolean;
  rent: number;
  maintenance: number;
  advance: number;
  deposit?: number;
  photoURL?: string;
}

/**
 * Generates initial monthly payment records for a newly added tenant.
 * From tenant.startDate up to the current calendar month (or tenant.endDate if it comes first).
 */
export async function generateInitialPayments(
  userId: string,
  propertyId: string,
  unitId: string,
  tenant: TenantInput
) {
  const currentMonthStr = getCurrentMonthStr();
  
  // Decide the end month for initial generation
  let targetEndMonth = currentMonthStr;
  if (tenant.endDate && tenant.endDate < currentMonthStr) {
    targetEndMonth = tenant.endDate;
  }
  if (tenant.startDate > targetEndMonth) {
    // If tenant starts in the future, just generate for their start month
    targetEndMonth = tenant.startDate;
  }
  
  const monthsToGenerate = getMonthsBetween(tenant.startDate, targetEndMonth);
  const batch = writeBatch(db);
  
  const paymentsSubcollectionRef = collection(
    db, 
    `users/${userId}/properties/${propertyId}/units/${unitId}/payments`
  );
  
  monthsToGenerate.forEach((monthStr) => {
    const paymentDocRef = doc(paymentsSubcollectionRef, monthStr);
    
    // Status logic: past months with 0 paid are marked "pending" initially.
    // Dashboard or logic will render them as Overdue if they remain unpaid.
    batch.set(paymentDocRef, {
      month: monthStr,
      expectedRent: tenant.rent,
      maintenance: tenant.maintenance,
      negotiationDiscount: 0,
      lateFee: 0,
      finalRent: tenant.rent + tenant.maintenance,
      amountReceived: 0,
      status: "pending",
      paymentDate: null,
      paymentMethod: null,
      remarks: null,
      isFinalized: false
    });
  });
  
  // Set the tenant data and last generated month on the unit document
  const unitDocRef = doc(db, `users/${userId}/properties/${propertyId}/units/${unitId}`);
  batch.update(unitDocRef, {
    occupancyStatus: "occupied",
    tenant: tenant,
    lastPaymentGeneratedMonth: targetEndMonth
  });
  
  // Log the activity
  const logRef = doc(collection(db, `users/${userId}/activityLog`));
  batch.set(logRef, {
    action: "tenant_added",
    details: `Added tenant ${tenant.name} to Unit ${unitId} and generated ${monthsToGenerate.length} payment record(s).`,
    timestamp: serverTimestamp()
  });

  await batch.commit();
}

/**
 * Scans all properties and occupied units for continuing tenants,
 * and generates missing monthly payment records up to the current month.
 * This runs automatically when the landlord loads the app.
 */
export async function syncContinuingPayments(userId: string): Promise<number> {
  const currentMonthStr = getCurrentMonthStr();
  let generatedCount = 0;
  
  // Get all properties
  const propertiesRef = collection(db, `users/${userId}/properties`);
  const propertiesSnap = await getDocs(propertiesRef);
  
  for (const propertyDoc of propertiesSnap.docs) {
    const propertyId = propertyDoc.id;
    
    // Get units that are occupied and have continuing tenants
    const unitsRef = collection(db, `users/${userId}/properties/${propertyId}/units`);
    const unitsSnap = await getDocs(unitsRef);
    
    for (const unitDoc of unitsSnap.docs) {
      const unitData = unitDoc.data();
      const tenant = unitData.tenant;
      const lastGenerated = unitData.lastPaymentGeneratedMonth;
      
      // Sync only if occupied, continuing, and we have a gap between lastGenerated and currentMonthStr
      if (
        unitData.occupancyStatus === "occupied" && 
        tenant && 
        tenant.isContinuing && 
        lastGenerated && 
        lastGenerated < currentMonthStr
      ) {
        const nextMonthStart = getNextMonthStr(lastGenerated);
        const monthsToGenerate = getMonthsBetween(nextMonthStart, currentMonthStr);
        
        if (monthsToGenerate.length > 0) {
          const batch = writeBatch(db);
          const paymentsSubcolRef = collection(
            db, 
            `users/${userId}/properties/${propertyId}/units/${unitDoc.id}/payments`
          );
          
          monthsToGenerate.forEach((monthStr) => {
            const paymentDocRef = doc(paymentsSubcolRef, monthStr);
            batch.set(paymentDocRef, {
              month: monthStr,
              expectedRent: tenant.rent,
              maintenance: tenant.maintenance,
              negotiationDiscount: 0,
              lateFee: 0,
              finalRent: tenant.rent + tenant.maintenance,
              amountReceived: 0,
              status: "pending",
              paymentDate: null,
              paymentMethod: null,
              remarks: null,
              isFinalized: false
            });
          });
          
          // Update last generated month on Unit doc
          const unitDocRef = doc(db, `users/${userId}/properties/${propertyId}/units/${unitDoc.id}`);
          batch.update(unitDocRef, {
            lastPaymentGeneratedMonth: currentMonthStr
          });
          
          // Log the activity
          const logRef = doc(collection(db, `users/${userId}/activityLog`));
          batch.set(logRef, {
            action: "payments_auto_generated",
            details: `Auto-generated ${monthsToGenerate.length} payment record(s) for ${tenant.name} (Unit ${unitData.unitNumber}).`,
            timestamp: serverTimestamp()
          });
          
          await batch.commit();
          generatedCount += monthsToGenerate.length;
        }
      }
    }
  }
  
  return generatedCount;
}

// Helper to get the calendar month after a given month string
function getNextMonthStr(monthStr: string): string {
  const { year, month } = parseYearMonth(monthStr);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  return formatYearMonth(nextYear, nextMonth);
}
