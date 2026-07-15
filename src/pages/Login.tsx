import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Building, Mail, Lock, User, AlertCircle } from "lucide-react";

export const Login: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      if (isRegistering) {
        if (!name.trim()) throw new Error("Please enter your name");
        await registerWithEmail(email, password, name);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      let friendlyMessage = err.message || "Authentication failed. Please check credentials.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        friendlyMessage = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "An account with this email already exists.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password should be at least 6 characters long.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      }
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-md">
            <Building className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Property Ledger</h1>
          <p className="text-sm text-muted-foreground">
            A premium rental management system for landlords.
          </p>
        </div>

        <Card className="border border-border shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold text-center">
              {isRegistering ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription className="text-center">
              {isRegistering 
                ? "Sign up to start managing your rental properties" 
                : "Sign in to access your properties and tenants"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div className="relative">
                  <Input
                    label="Full Name"
                    placeholder="John Doe"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                  />
                  <User className="absolute left-3 bottom-3 h-4 w-4 text-muted-foreground" />
                </div>
              )}

              <div className="relative">
                <Input
                  label="Email Address"
                  placeholder="name@example.com"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
                <Mail className="absolute left-3 bottom-3 h-4 w-4 text-muted-foreground" />
              </div>

              <div className="relative">
                <Input
                  label="Password"
                  placeholder="••••••••"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
                <Lock className="absolute left-3 bottom-3 h-4 w-4 text-muted-foreground" />
              </div>

              <Button 
                type="submit" 
                className="w-full font-semibold shadow" 
                isLoading={isLoading}
              >
                {isRegistering ? "Sign Up" : "Sign In"}
              </Button>
            </form>

            <div className="relative flex items-center justify-center my-4">
              <span className="absolute px-3 bg-card text-xs text-muted-foreground uppercase tracking-wider">
                Or continue with
              </span>
              <div className="w-full border-t border-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center space-x-2 font-medium"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="h-5 w-5 mr-1" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google Sign In</span>
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering 
                  ? "Already have an account? Sign In" 
                  : "Don't have an account? Sign Up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
