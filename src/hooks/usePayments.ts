import { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export interface Payment {
  id: string; // YYYY-MM
  month: string; // YYYY-MM
  expectedRent: number;
  maintenance: number;
  negotiationDiscount: number;
  lateFee: number;
  finalRent: number; // expectedRent + maintenance + lateFee - negotiationDiscount
  amountReceived: number;
  status: "pending" | "paid" | "partial" | "overdue";
  paymentDate: string | null;
  paymentMethod: "Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Other" | null;
  remarks: string | null;
  isFinalized: boolean;
}

export function usePayments(propertyId: string, unitId: string) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    if (!user || !propertyId || !unitId) return;
    setLoading(true);
    setError(null);
    try {
      const paymentsRef = collection(
        db, 
        `users/${user.uid}/properties/${propertyId}/units/${unitId}/payments`
      );
      const q = query(paymentsRef, orderBy("month", "asc"));
      const snap = await getDocs(q);
      
      const paymentsData: Payment[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          month: data.month,
          expectedRent: data.expectedRent || 0,
          maintenance: data.maintenance || 0,
          negotiationDiscount: data.negotiationDiscount || 0,
          lateFee: data.lateFee || 0,
          finalRent: data.finalRent || 0,
          amountReceived: data.amountReceived || 0,
          status: data.status || "pending",
          paymentDate: data.paymentDate || null,
          paymentMethod: data.paymentMethod || null,
          remarks: data.remarks || null,
          isFinalized: !!data.isFinalized
        });
      });
      
      setPayments(paymentsData);
    } catch (err: any) {
      console.error("Error fetching payments:", err);
      setError(err.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [user, propertyId, unitId]);

  const updatePayment = async (
    paymentId: string, 
    fields: Partial<Omit<Payment, "id" | "month">>
  ) => {
    if (!user || !propertyId || !unitId) throw new Error("Missing context");

    const paymentDocRef = doc(
      db, 
      `users/${user.uid}/properties/${propertyId}/units/${unitId}/payments/${paymentId}`
    );

    // Calculate final rent based on modifications
    const expected = fields.expectedRent !== undefined ? fields.expectedRent : 0;
    const maint = fields.maintenance !== undefined ? fields.maintenance : 0;
    const late = fields.lateFee !== undefined ? fields.lateFee : 0;
    const nego = fields.negotiationDiscount !== undefined ? fields.negotiationDiscount : 0;
    
    // finalRent = expected + maint + late - nego
    const calculatedFinal = expected + maint + late - nego;
    const received = fields.amountReceived !== undefined ? fields.amountReceived : 0;

    // Automatic status deduction if status is not explicitly set
    let computedStatus = fields.status;
    if (!computedStatus) {
      if (received >= calculatedFinal && calculatedFinal > 0) {
        computedStatus = "paid";
      } else if (received > 0 && received < calculatedFinal) {
        computedStatus = "partial";
      } else {
        // If received is 0, check if this payment month is in the past to mark overdue
        const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
        if (paymentId < currentMonth) {
          computedStatus = "overdue";
        } else {
          computedStatus = "pending";
        }
      }
    }

    const payload = {
      ...fields,
      finalRent: calculatedFinal,
      status: computedStatus,
    };

    await updateDoc(paymentDocRef, payload);

    // Log Activity
    await addDoc(collection(db, `users/${user.uid}/activityLog`), {
      action: "payment_edited",
      details: `Updated payment for ${paymentId} (Unit ${unitId}): Paid $${received} of $${calculatedFinal}. Status is ${computedStatus}.`,
      timestamp: serverTimestamp()
    });

    await fetchPayments();
  };

  return {
    payments,
    loading,
    error,
    refresh: fetchPayments,
    updatePayment
  };
}
