import { useState, useEffect } from "react";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: any;
}

export function useActivityLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const logsRef = collection(db, `users/${user.uid}/activityLog`);
      const q = query(logsRef, orderBy("timestamp", "desc"), limit(50));
      const snap = await getDocs(q);
      
      const logsData: ActivityLog[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        logsData.push({
          id: doc.id,
          action: data.action,
          details: data.details,
          timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
        });
      });
      setLogs(logsData);
    } catch (e) {
      console.error("Error fetching activity logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  return {
    logs,
    loading,
    refresh: fetchLogs
  };
}
