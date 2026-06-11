import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface ProfileData {
  full_name: string | null;
  kyc_status: string | null;
  phone: string | null;
  email: string | null;
  nrc_number: string | null;
  employer: string | null;
  employee_number: string | null;
  salary: number | null;
  nrc_verified: boolean;
  phone_verified: boolean;
  consent_accepted: boolean;
  consent_signed_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: ProfileData | null;
  loading: boolean;
  profileLoading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<ProfileData | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,
  isPasswordRecovery: false,
  clearPasswordRecovery: () => {},
  signOut: async () => {},
  refreshProfile: async () => null,
});

// Detect recovery token in the URL BEFORE the Supabase client parses it away.
// This lets us flip into recovery mode immediately on first paint so no other
// route redirects the user into an authenticated area.
// Supports both hash-based (legacy) and query parameter (PKCE) flows.
const hasRecoveryTokenInUrl = (): boolean => {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  // Legacy hash-based recovery: type=recovery in hash
  const hashRecovery = /(?:^|[#&?])type=recovery(?:&|$)/.test(hash);
  // Query parameter PKCE flow: code parameter present
  const pkceCode = /[?&]code=/.test(search);
  return hashRecovery || pkceCode;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  // Seed from URL so the first render already knows we're in recovery mode.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => hasRecoveryTokenInUrl());

  const fetchProfile = useCallback(async (userId: string): Promise<ProfileData | null> => {
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, kyc_status, phone, email, nrc_number, employer, employee_number, salary, nrc_verified, phone_verified, consent_accepted, consent_signed_at")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(data);
      return data;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<ProfileData | null> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      return fetchProfile(currentUser.id);
    }
    return null;
  }, [fetchProfile]);

  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setIsPasswordRecovery(true);
        }
        if (event === "SIGNED_OUT") {
          setIsPasswordRecovery(false);
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoading, isPasswordRecovery, clearPasswordRecovery, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);