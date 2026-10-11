import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
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
  consent_marketing: boolean;
  consent_data_sharing_lenders: boolean;
  consent_crb_check: boolean;
  consent_analytics: boolean;
  consents_updated_at: string | null;
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
  const hashRecovery = /(?:^|[#&?])type=recovery(?:&|$)/.test(hash);
  const pkceCode = /[?&]code=/.test(search);
  return hashRecovery || pkceCode;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => hasRecoveryTokenInUrl());

  const fetchProfile = useCallback(async (userId: string): Promise<ProfileData | null> => {
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, kyc_status, phone, email, nrc_number, employer, employee_number, salary, nrc_verified, phone_verified, consent_accepted, consent_signed_at, consent_marketing, consent_data_sharing_lenders, consent_crb_check, consent_analytics, consents_updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      // Do not allow a delayed profile request to repopulate state after logout
      // or after another account has signed in.
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.id !== userId) return null;
      setProfile(data);
      return data;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<ProfileData | null> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, kyc_status, phone, email, nrc_number, employer, employee_number, salary, nrc_verified, phone_verified, consent_accepted, consent_signed_at, consent_marketing, consent_data_sharing_lenders, consent_crb_check, consent_analytics, consents_updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;
    setProfile(data);
    return data;
  }, []);

  const clearPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
        if (event === "SIGNED_OUT") setIsPasswordRecovery(false);
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (event === "SIGNED_IN") {
          localStorage.setItem("rb.sessionStart", Date.now().toString());
          localStorage.setItem("rb.lastActivity", Date.now().toString());
        }
        if (nextSession?.user) {
          const userId = nextSession.user.id;
          // Avoid awaiting Supabase calls inside onAuthStateChange; its auth lock
          // must be released before fetchProfile makes another auth request.
          setTimeout(() => { void fetchProfile(userId); }, 0);
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
        setLoading(false);
      }
    );

    void supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        const started = Number(localStorage.getItem("rb.sessionStart") || 0);
        if (!started) {
          localStorage.setItem("rb.sessionStart", Date.now().toString());
          localStorage.setItem("rb.lastActivity", Date.now().toString());
        }
        void fetchProfile(initialSession.user.id).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    try {
      // Explicit local scope guarantees this browser loses its session even if
      // global sign-out/revocation of other sessions is unavailable.
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) console.error("Supabase local sign-out reported an error:", error.message);
    } catch (error) {
      console.error("Supabase local sign-out failed:", error);
    } finally {
      // Fail closed in the UI: protected routes must not retain a stale user
      // while the auth event or a network request is delayed.
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfileLoading(false);
      setLoading(false);
      setIsPasswordRecovery(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem("rb.sessionStart");
        localStorage.removeItem("rb.lastActivity");
      }
    }
  };

  useIdleTimeout(!!session);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, profileLoading, isPasswordRecovery, clearPasswordRecovery, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
