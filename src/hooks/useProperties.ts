import { useState, useEffect } from "react";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  writeBatch, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export interface UnitInput {
  unitNumber: string;
  type: "house" | "shop";
  area: number | "";
  floor: number | "";
  notes: string;
  bhk?: string;
}

export interface PropertyInput {
  name: string;
  location: string;
  address: string;
  coverPhoto: string;
  type: "house" | "shop";
  units: UnitInput[];
}

export interface Property extends Omit<PropertyInput, "units"> {
  id: string;
  totalUnits: number;
  occupiedUnitsCount: number;
  vacantUnitsCount: number;
  lastUpdated: any;
}

export function useProperties() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const propertiesRef = collection(db, `users/${user.uid}/properties`);
      const q = query(propertiesRef, orderBy("lastUpdated", "desc"));
      const querySnapshot = await getDocs(q);
      
      const propertiesData: Property[] = [];
      
      for (const propertyDoc of querySnapshot.docs) {
        const data = propertyDoc.data();
        const propertyId = propertyDoc.id;
        
        // Fetch unit counts for each property to display on the card
        const unitsRef = collection(db, `users/${user.uid}/properties/${propertyId}/units`);
        const unitsSnap = await getDocs(unitsRef);
        
        let occupied = 0;
        let vacant = 0;
        
        unitsSnap.forEach((doc) => {
          const unit = doc.data();
          if (unit.occupancyStatus === "occupied") {
            occupied++;
          } else {
            vacant++;
          }
        });
        
        propertiesData.push({
          id: propertyId,
          name: data.name,
          location: data.location,
          address: data.address,
          coverPhoto: data.coverPhoto || "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80",
          type: data.type,
          totalUnits: unitsSnap.size,
          occupiedUnitsCount: occupied,
          vacantUnitsCount: vacant,
          lastUpdated: data.lastUpdated
        });
      }
      
      setProperties(propertiesData);
    } catch (err: any) {
      console.error("Error fetching properties:", err);
      setError(err.message || "Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const addProperty = async (input: PropertyInput) => {
    if (!user) throw new Error("User not authenticated");
    
    const batch = writeBatch(db);
    const propertiesRef = collection(db, `users/${user.uid}/properties`);
    const newPropertyDocRef = doc(propertiesRef);
    
    // Set Property Document
    batch.set(newPropertyDocRef, {
      name: input.name,
      location: input.location,
      address: input.address,
      coverPhoto: input.coverPhoto,
      type: input.type,
      lastUpdated: serverTimestamp()
    });

    // Set Unit Documents
    input.units.forEach((unit) => {
      const unitDocRef = doc(collection(db, `users/${user.uid}/properties/${newPropertyDocRef.id}/units`), unit.unitNumber);
      batch.set(unitDocRef, {
        unitNumber: unit.unitNumber,
        type: unit.type,
        area: Number(unit.area),
        floor: Number(unit.floor),
        notes: unit.notes,
        occupancyStatus: "vacant",
        tenant: null
      });
    });

    // Write Activity Log
    const logRef = doc(collection(db, `users/${user.uid}/activityLog`));
    batch.set(logRef, {
      action: "property_created",
      details: `Created property ${input.name} with ${input.units.length} units.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    await fetchProperties();
  };

  const updateProperty = async (propertyId: string, updates: Partial<Omit<Property, "id">>) => {
    if (!user) throw new Error("User not authenticated");
    
    const propertyDocRef = doc(db, `users/${user.uid}/properties/${propertyId}`);
    await updateDoc(propertyDocRef, {
      ...updates,
      lastUpdated: serverTimestamp()
    });
    
    // Log Activity
    await addDoc(collection(db, `users/${user.uid}/activityLog`), {
      action: "property_updated",
      details: `Updated property info for ${updates.name || propertyId}.`,
      timestamp: serverTimestamp()
    });

    await fetchProperties();
  };

  const deleteProperty = async (propertyId: string) => {
    if (!user) throw new Error("User not authenticated");
    
    const propertyDocRef = doc(db, `users/${user.uid}/properties/${propertyId}`);
    const propertySnap = await getDoc(propertyDocRef);
    const propertyName = propertySnap.exists() ? propertySnap.data().name : propertyId;
    
    // 1. Fetch all units
    const unitsRef = collection(db, `users/${user.uid}/properties/${propertyId}/units`);
    const unitsSnap = await getDocs(unitsRef);
    
    // 2. We will batch delete payments, units, and then the property
    const batch = writeBatch(db);
    
    for (const unitDoc of unitsSnap.docs) {
      const paymentsRef = collection(db, `users/${user.uid}/properties/${propertyId}/units/${unitDoc.id}/payments`);
      const paymentsSnap = await getDocs(paymentsRef);
      
      // Delete all payments
      paymentsSnap.forEach((payDoc) => {
        batch.delete(doc(db, `users/${user.uid}/properties/${propertyId}/units/${unitDoc.id}/payments/${payDoc.id}`));
      });
      
      // Delete unit
      batch.delete(doc(db, `users/${user.uid}/properties/${propertyId}/units/${unitDoc.id}`));
    }
    
    // Delete property document
    batch.delete(propertyDocRef);
    
    // Log Activity
    const logRef = doc(collection(db, `users/${user.uid}/activityLog`));
    batch.set(logRef, {
      action: "property_deleted",
      details: `Deleted property ${propertyName} and all associated units/payment schedules.`,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    await fetchProperties();
  };

  return {
    properties,
    loading,
    error,
    refresh: fetchProperties,
    addProperty,
    updateProperty,
    deleteProperty
  };
}
