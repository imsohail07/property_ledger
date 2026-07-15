import { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  updateDoc, 
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { generateInitialPayments } from "../services/paymentScheduler";

export interface Tenant {
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
  notes?: string;
}

export interface Unit {
  id: string; // matches unitNumber
  unitNumber: string;
  type: "house" | "shop";
  area: number;
  floor: number;
  notes: string;
  occupancyStatus: "vacant" | "occupied";
  tenant: Tenant | null;
  lastPaymentGeneratedMonth?: string;
}

export function useUnits(propertyId: string) {
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnits = async () => {
    if (!user || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const unitsRef = collection(db, `users/${user.uid}/properties/${propertyId}/units`);
      const snap = await getDocs(unitsRef);
      const unitsData: Unit[] = [];
      
      snap.forEach((doc) => {
        const data = doc.data();
        unitsData.push({
          id: doc.id,
          unitNumber: data.unitNumber,
          type: data.type,
          area: data.area,
          floor: data.floor,
          notes: data.notes || "",
          occupancyStatus: data.occupancyStatus,
          tenant: data.tenant,
          lastPaymentGeneratedMonth: data.lastPaymentGeneratedMonth
        });
      });
      
      // Sort units by number naturally (e.g. Unit 1, Unit 2, Unit 10)
      unitsData.sort((a, b) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true, sensitivity: 'base' }));
      
      setUnits(unitsData);
    } catch (err: any) {
      console.error("Error fetching units:", err);
      setError(err.message || "Failed to fetch units");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [user, propertyId]);

  const addTenantToUnit = async (unitId: string, tenantInput: Tenant) => {
    if (!user || !propertyId) throw new Error("Missing user or property context");
    
    // Call the scheduler to write all payments and update the unit document
    await generateInitialPayments(user.uid, propertyId, unitId, tenantInput);
    await fetchUnits();
  };

  const vacateUnitFromTenant = async (unitId: string) => {
    if (!user || !propertyId) throw new Error("Missing user or property context");
    
    const batch = writeBatch(db);
    const unitRef = doc(db, `users/${user.uid}/properties/${propertyId}/units/${unitId}`);
    
    const unitSnap = await getDoc(unitRef);
    if (!unitSnap.exists()) throw new Error("Unit not found");
    const unitData = unitSnap.data();
    const tenantName = unitData.tenant?.name || "Unknown Tenant";

    // Update Unit details to vacant
    batch.update(unitRef, {
      occupancyStatus: "vacant",
      tenant: null,
      lastPaymentGeneratedMonth: null
    });

    // Write Activity Log
    const logRef = doc(collection(db, `users/${user.uid}/activityLog`));
    batch.set(logRef, {
      action: "tenant_removed",
      details: `Tenant ${tenantName} vacated Unit ${unitId} in property.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    await fetchUnits();
  };

  const updateUnitNotes = async (unitId: string, notes: string) => {
    if (!user || !propertyId) throw new Error("Missing context");
    
    const unitRef = doc(db, `users/${user.uid}/properties/${propertyId}/units/${unitId}`);
    await updateDoc(unitRef, { notes });
    await fetchUnits();
  };

  return {
    units,
    loading,
    error,
    refresh: fetchUnits,
    addTenantToUnit,
    vacateUnitFromTenant,
    updateUnitNotes
  };
}
