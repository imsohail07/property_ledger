import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../services/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize user profile settings inside Firestore on first register
  const syncUserProfile = async (firebaseUser: User, name?: string) => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (!docSnap.exists()) {
      await setDoc(userDocRef, {
        profile: {
          displayName: name || firebaseUser.displayName || "Landlord",
          email: firebaseUser.email,
          createdAt: new Date().toISOString()
        },
        settings: {
          theme: "light"
        }
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Async background sync of user profile
        try {
          await syncUserProfile(currentUser);
        } catch (error) {
          console.error("Error syncing user profile:", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(result.user);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string) => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Update display name inside Firebase Auth
      await updateProfile(result.user, { displayName: name });
      // Create user profile record in Firestore
      await syncUserProfile(result.user, name);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
