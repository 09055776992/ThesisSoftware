import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { X, GraduationCap, Search, ChevronDown, ChevronUp, Award, FileText, Coins, Users, Calendar, Eye, EyeOff, ExternalLink, CheckCircle } from "lucide-react";
import { fetchScholarships, signIn, signUp, verifyOTP, resendOTP, fetchUserProfile } from "../lib/api-client";
import { saveStoredUser, saveAuthToken, clearStoredUser, buildNameFromEmail } from "../lib/user-storage";
import { PasswordStrengthIndicator } from "../components/password-strength";

// ---------------------------------------------------------------------------
// OTP Session Persistence (resilient against mobile app/tab switching)
// ---------------------------------------------------------------------------
interface PendingOtpSession {
  type: "signin" | "signup";
  userId: string;
  maskedEmail: string;
  expiresAt: number;
  resendCooldownEnd: number;
  name?: string;
  email?: string;
}

const OTP_STORAGE_KEY = "scholar_pending_otp";

function saveOtpSession(data: PendingOtpSession) {
  try {
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Error saving OTP session:", e);
  }
}

function clearOtpSession() {
  try {
    localStorage.removeItem(OTP_STORAGE_KEY);
  } catch (e) {
    console.error("Error clearing OTP session:", e);
  }
}

function getStoredOtpSession(): PendingOtpSession | null {
  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOtpSession;
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(OTP_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Countdown timer hook (matching sign-in.tsx)
// ---------------------------------------------------------------------------
function useCountdown(initial: number) {
  const [timeLeft, setTimeLeft] = useState(initial);

  const reset = (seconds?: number) => setTimeLeft(typeof seconds === "number" ? seconds : initial);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const formatted = `${Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0")}:${(timeLeft % 60).toString().padStart(2, "0")}`;

  return { timeLeft, formatted, reset };
}

export function LandingPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<"signin" | "signup" | "explore" | "terms" | "privacy" | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [isProviderAccount, setIsProviderAccount] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpName, setSignUpName] = useState("");
  
  // OTP verification state for sign in
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [otpError, setOtpError] = useState<string>("");
  const { timeLeft: signInTimeLeft, formatted: signInTimerDisplay, reset: resetSignInTimer } = useCountdown(600);
  const [signInResendCooldown, setSignInResendCooldown] = useState(0);
  
  // OTP verification state for sign up
  const [showSignUpOtpVerification, setShowSignUpOtpVerification] = useState(false);
  const [signUpOtpDigits, setSignUpOtpDigits] = useState(["", "", "", "", "", ""]);
  const [isSignUpVerifying, setIsSignUpVerifying] = useState(false);
  const [isRequestingSignUpOtp, setIsRequestingSignUpOtp] = useState(false);
  const [signUpUserId, setSignUpUserId] = useState<string>("");
  const [signUpMaskedEmail, setSignUpMaskedEmail] = useState<string>("");
  const [signUpOtpError, setSignUpOtpError] = useState<string>("");
  const [signUpFormError, setSignUpFormError] = useState<string>("");
  const { timeLeft: signUpTimeLeft, formatted: signUpTimerDisplay, reset: resetSignUpTimer } = useCountdown(600);
  const [signUpResendCooldown, setSignUpResendCooldown] = useState(0);

  // Resend cooldown countdowns
  useEffect(() => {
    if (signInResendCooldown <= 0) return;
    const t = setTimeout(() => setSignInResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [signInResendCooldown]);

  useEffect(() => {
    if (signUpResendCooldown <= 0) return;
    const t = setTimeout(() => setSignUpResendCooldown((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [signUpResendCooldown]);

  // Restore any pending OTP session from localStorage if tab was backgrounded / refreshed on mobile
  useEffect(() => {
    const saved = getStoredOtpSession();
    if (!saved) return;

    const remainingSecs = Math.max(0, Math.floor((saved.expiresAt - Date.now()) / 1000));
    const remainingCooldown = Math.max(0, Math.floor((saved.resendCooldownEnd - Date.now()) / 1000));

    if (remainingSecs <= 0) {
      clearOtpSession();
      return;
    }

    if (saved.type === "signin") {
      setActiveModal("signin");
      setUserId(saved.userId);
      setMaskedEmail(saved.maskedEmail);
      if (saved.email) setSignInEmail(saved.email);
      setShowOtpVerification(true);
      resetSignInTimer(remainingSecs);
      setSignInResendCooldown(remainingCooldown);
    } else if (saved.type === "signup") {
      setActiveModal("signup");
      setSignUpUserId(saved.userId);
      setSignUpMaskedEmail(saved.maskedEmail);
      if (saved.email) setSignUpEmail(saved.email);
      if (saved.name) setSignUpName(saved.name);
      setShowSignUpOtpVerification(true);
      resetSignUpTimer(remainingSecs);
      setSignUpResendCooldown(remainingCooldown);
    }
  }, []);
  const otpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  
  const signUpOtpInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  
  // Explore scholarships state
  const [scholarships, setScholarships] = useState<Array<Record<string, unknown>>>([]);
  const [filteredScholarships, setFilteredScholarships] = useState<Array<Record<string, unknown>>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingScholarships, setLoadingScholarships] = useState(false);
  const [expandedScholarship, setExpandedScholarship] = useState<string | null>(null);
  // Tracks which scholarship the guest clicked "Apply Now" on before being asked to sign in
  const [pendingScholarshipId, setPendingScholarshipId] = useState<string | null>(null);
  
  const signInRef = useRef<HTMLDivElement>(null);
  const signUpRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);

  // Fetch scholarships when explore modal opens
  useEffect(() => {
    if (activeModal === "explore") {
      loadScholarships();
    }
  }, [activeModal]);

  // Filter scholarships based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredScholarships(scholarships);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = scholarships.filter((s) => {
        const title = String(s.title || s.scholarshipName || "").toLowerCase();
        const provider = String(s.provider || s.providerOffice || "").toLowerCase();
        const description = String(s.description || "").toLowerCase();
        return title.includes(query) || provider.includes(query) || description.includes(query);
      });
      setFilteredScholarships(filtered);
    }
  }, [searchQuery, scholarships]);

  const loadScholarships = async () => {
    setLoadingScholarships(true);
    try {
      const response = await fetchScholarships();
      const data = response.data || [];
      setScholarships(data);
      setFilteredScholarships(data);
    } catch (error) {
      console.error("Failed to fetch scholarships:", error);
    } finally {
      setLoadingScholarships(false);
    }
  };

  // Close modal on Escape key or admin/provider shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveModal(null);
      // Close student modal when admin (Ctrl+Alt+A) or provider (Ctrl+Alt+P) shortcut fires
      if (e.ctrlKey && e.altKey && (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "p")) {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close modal when clicking outside
  const handleOverlayClick = (e: React.MouseEvent, modalRef: React.RefObject<HTMLDivElement | null>) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setActiveModal(null);
    }
  };

  const handleApplyNow = (scholarshipId: string) => {
    setPendingScholarshipId(scholarshipId);
    setActiveModal("signin");
  };

  const scrollToFeatures = () => {
    document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequestingOtp(true);
    setOtpError("");
    setSignInError("");
    setIsProviderAccount(false);
    
    try {
      // Step 1: Send login request to get OTP
      const response = await signIn({ email: signInEmail, password: signInPassword });
      
      if (response.requiresOTP && response.userId) {
        setUserId(response.userId);
        setMaskedEmail(response.maskedEmail || signInEmail);
        setShowOtpVerification(true);
        resetSignInTimer(600);
        setSignInResendCooldown(60);
        saveOtpSession({
          type: "signin",
          userId: response.userId,
          maskedEmail: response.maskedEmail || signInEmail,
          email: signInEmail,
          expiresAt: Date.now() + 600 * 1000,
          resendCooldownEnd: Date.now() + 60 * 1000,
        });
        // Focus first OTP input after a short delay
        setTimeout(() => {
          otpInputRefs[0].current?.focus();
        }, 100);
      } else if (response.token && response.user) {
        clearStoredUser();
        saveAuthToken(response.token);
        const user = response.user as Record<string, unknown>;
        saveStoredUser({ ...user, email: String(user.email || signInEmail).trim().toLowerCase() });
        const userType = String(user.userType || user.role || "student").toLowerCase();
        setActiveModal(null);
        navigate(userType === "admin" ? "/admin" : userType === "provider" ? "/provider/dashboard" : "/dashboard", { replace: true });
      } else {
        setOtpError("Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      const message = error instanceof Error ? error.message : "Invalid email or password.";
      setSignInError(message);
      setIsProviderAccount(message.includes("provider account"));
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const openProviderSignIn = () => {
    setActiveModal(null);
    window.dispatchEvent(new Event("scholar:open-provider-auth"));
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.slice(-1);
    if (!/^\d*$/.test(digit)) return;
    
    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = digit;
    setOtpDigits(newOtpDigits);
    
    // Auto-focus next input if current is filled
    if (digit && index < 5) {
      otpInputRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace to go back
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const newOtpDigits = [...otpDigits];
      newOtpDigits[index - 1] = "";
      setOtpDigits(newOtpDigits);
      otpInputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpDigits.join("");
    if (otpCode.length !== 6 || !userId) return;
    
    setIsVerifying(true);
    setOtpError("");
    
    try {
      const response = await verifyOTP(userId, otpCode);
      
      if (response.token && response.user) {
        const user = response.user as Record<string, unknown>;
        const normalizedEmail = String(user.email || signInEmail).trim().toLowerCase();

        // Wipe any stale session then persist the new one
        clearStoredUser();
        saveAuthToken(response.token);

        // Fetch the full profile so DashboardLayout always has a complete
        // user object (including email keyed correctly in the user map)
        let profileFromServer: Record<string, unknown> = {};
        try {
          const profileResult = await fetchUserProfile(normalizedEmail);
          profileFromServer = profileResult.user ?? {};
        } catch {
          // fall back to the signin payload
        }

        saveStoredUser({
          ...(profileFromServer as any),
          email: normalizedEmail,
          fullName:
            String(
              profileFromServer.fullName || user.fullName ||
              profileFromServer.userName || user.userName ||
              profileFromServer.name || user.name || ""
            ).trim() || buildNameFromEmail(normalizedEmail),
          phone: String(user.phone || profileFromServer.phone || ""),
          userType: String(user.userType || profileFromServer.userType || "") || "student",
        });

        // Navigate based on userType
        const userType = String(user.userType || profileFromServer.userType || "").toLowerCase();
        if (userType === "admin") {
          navigate("/admin");
        } else if (userType === "provider") {
          navigate("/provider/dashboard");
        } else if (pendingScholarshipId) {
          navigate(`/dashboard/scholarships?open=${pendingScholarshipId}`);
        } else {
          navigate("/dashboard");
        }

        clearOtpSession();
        setActiveModal(null);
        setPendingScholarshipId(null);
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      setOtpError(error instanceof Error ? error.message : "Invalid verification code.");
      setOtpDigits(["", "", "", "", "", ""]);
      otpInputRefs[0].current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!userId || signInResendCooldown > 0) return;
    
    setIsRequestingOtp(true);
    setOtpError("");
    
    try {
      await resendOTP(userId);
      resetSignInTimer(600);
      setSignInResendCooldown(60);
      saveOtpSession({
        type: "signin",
        userId,
        maskedEmail: maskedEmail || signInEmail,
        email: signInEmail,
        expiresAt: Date.now() + 600 * 1000,
        resendCooldownEnd: Date.now() + 60 * 1000,
      });
      // Clear OTP digits
      setOtpDigits(["", "", "", "", "", ""]);
      // Focus first input
      otpInputRefs[0].current?.focus();
    } catch (error) {
      console.error("Resend OTP error:", error);
      setOtpError(error instanceof Error ? error.message : "Failed to resend code.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequestingSignUpOtp(true);
    setSignUpOtpError("");
    setSignUpFormError("");
    
    try {
      // Start a pending signup; the backend creates the account after OTP verification.
      const response = await signUp({ 
        email: signUpEmail, 
        password: signUpPassword,
        fullName: signUpName 
      });
      
      if (response.user && response.user._id) {
        setSignUpUserId(response.user._id as string);
        setSignUpMaskedEmail(signUpEmail);
        setShowSignUpOtpVerification(true);
        resetSignUpTimer(600);
        setSignUpResendCooldown(60);
        saveOtpSession({
          type: "signup",
          userId: response.user._id as string,
          maskedEmail: signUpEmail,
          email: signUpEmail,
          name: signUpName,
          expiresAt: Date.now() + 600 * 1000,
          resendCooldownEnd: Date.now() + 60 * 1000,
        });
        // Focus first OTP input after a short delay
        setTimeout(() => {
          signUpOtpInputRefs[0].current?.focus();
        }, 100);
      } else {
        // If user created but needs OTP verification step
        const uid = (response.user?.userId as string) || "";
        setSignUpUserId(uid);
        setSignUpMaskedEmail(signUpEmail);
        setShowSignUpOtpVerification(true);
        resetSignUpTimer(600);
        setSignUpResendCooldown(60);
        saveOtpSession({
          type: "signup",
          userId: uid,
          maskedEmail: signUpEmail,
          email: signUpEmail,
          name: signUpName,
          expiresAt: Date.now() + 600 * 1000,
          resendCooldownEnd: Date.now() + 60 * 1000,
        });
        setTimeout(() => {
          signUpOtpInputRefs[0].current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error("Sign up error:", error);
      setSignUpFormError(error instanceof Error ? error.message : "Registration failed. Please try again.");
    } finally {
      setIsRequestingSignUpOtp(false);
    }
  };

  const handleSignUpOtpChange = (index: number, value: string) => {
    const digit = value.slice(-1);
    if (!/^\d*$/.test(digit)) return;
    
    const newOtpDigits = [...signUpOtpDigits];
    newOtpDigits[index] = digit;
    setSignUpOtpDigits(newOtpDigits);
    
    if (digit && index < 5) {
      signUpOtpInputRefs[index + 1].current?.focus();
    }
  };

  const handleSignUpOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !signUpOtpDigits[index] && index > 0) {
      const newOtpDigits = [...signUpOtpDigits];
      newOtpDigits[index - 1] = "";
      setSignUpOtpDigits(newOtpDigits);
      signUpOtpInputRefs[index - 1].current?.focus();
    }
  };

  const handleVerifySignUpOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = signUpOtpDigits.join("");
    if (otpCode.length !== 6 || !signUpUserId) return;
    
    setIsSignUpVerifying(true);
    setSignUpOtpError("");
    
    try {
      const response = await verifyOTP(signUpUserId, otpCode);
      
      if (response.token && response.user) {
        saveAuthToken(response.token);
        saveStoredUser(response.user);
        
        const userType = response.user.userType as string;
        if (userType === "admin") {
          navigate("/admin");
        } else if (userType === "provider") {
          navigate("/provider/dashboard");
        } else if (pendingScholarshipId) {
          navigate(`/dashboard/scholarships?open=${pendingScholarshipId}`);
        } else {
          navigate("/dashboard");
        }
        clearOtpSession();
        setActiveModal(null);
        setPendingScholarshipId(null);
      } else {
        setSignUpOtpError("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      setSignUpOtpError(error instanceof Error ? error.message : "Invalid verification code.");
      setSignUpOtpDigits(["", "", "", "", "", ""]);
      signUpOtpInputRefs[0].current?.focus();
    } finally {
      setIsSignUpVerifying(false);
    }
  };

  const handleResendSignUpOtp = async () => {
    if (!signUpUserId || signUpResendCooldown > 0) return;
    
    setIsRequestingSignUpOtp(true);
    setSignUpOtpError("");
    
    try {
      await resendOTP(signUpUserId);
      resetSignUpTimer(600);
      setSignUpResendCooldown(60);
      saveOtpSession({
        type: "signup",
        userId: signUpUserId,
        maskedEmail: signUpMaskedEmail || signUpEmail,
        email: signUpEmail,
        name: signUpName,
        expiresAt: Date.now() + 600 * 1000,
        resendCooldownEnd: Date.now() + 60 * 1000,
      });
      setSignUpOtpDigits(["", "", "", "", "", ""]);
      signUpOtpInputRefs[0].current?.focus();
    } catch (error) {
      console.error("Resend OTP error:", error);
      setSignUpOtpError(error instanceof Error ? error.message : "Failed to resend code.");
    } finally {
      setIsRequestingSignUpOtp(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 py-4 sticky top-0 z-50">
        <div className="max-w-[1140px] mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-800">
            <span>🎓</span>
            <span>SCHOLAR</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveModal("signin")}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-all"
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveModal("signup")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-all"
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 bg-[radial-gradient(100%_100%_at_top_right,#eff6ff_0%,#f8fafc_100%)]">
        <div className="max-w-[1140px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 items-center">
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight text-slate-800 mb-4">
              Find Options.
              <br />
              <span className="text-blue-600">Achieve Your Dreams.</span>
            </h1>
            <p className="text-lg text-slate-500 mb-8 max-w-lg">
              An intelligent platform matching Quezon City students with optimal scholarship opportunities based on academic and financial profiles.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveModal("explore")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                Explore Scholarships
              </button>
              <button
                onClick={() => setActiveModal("signup")}
                className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
          <div className="order-1 lg:order-2 flex justify-center">
            <img
              src="https://cdn-icons-png.flaticon.com/512/3135/3135755.png"
              alt="Scholarship Illustration"
              className="w-full max-w-[420px] h-auto"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features-section" className="py-16">
        <div className="max-w-[1140px] mx-auto px-6">
          <h2 className="text-center text-2xl lg:text-3xl font-bold text-slate-800 mb-10">
            Why Choose SCHOLAR?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Smart Matching</h3>
              <p className="text-sm text-slate-500">
                Instantly find the single best scholarship tailored to your GWA and household income.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">📁</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Profile Vault</h3>
              <p className="text-sm text-slate-500">
                Upload your requirements once to your profile and enjoy one-click automated application tracking.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Explainable AI</h3>
              <p className="text-sm text-slate-500">
                Understand clear, step-by-step SHAP visual breakdowns explaining exactly why you matched.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-3">📹</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Easy Screening</h3>
              <p className="text-sm text-slate-500">
                Submit dynamic video interview clips smoothly with zero administrative meeting friction.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-[1140px] mx-auto px-6 pb-20">
        <div className="bg-blue-600 rounded-2xl p-6 md:p-10 flex flex-col lg:flex-row justify-between items-center gap-6 text-white">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl lg:text-3xl font-bold mb-1">Your future starts here.</h2>
            <p className="text-base opacity-90">
              Join SCHOLAR today and secure your educational funding automatically.
            </p>
          </div>
          <button
            onClick={() => setActiveModal("signup")}
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold whitespace-nowrap hover:bg-slate-100 transition-all"
          >
            Sign Up Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12 text-slate-600">
        <div className="max-w-[1140px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Column 1: Brand & Overview */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                <GraduationCap className="size-6 text-blue-600" />
                <span>SCHOLAR</span>
              </div>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                Intelligent scholarship matching and automated verification system designed to empower students and scholarship providers across Quezon City.
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Quick Links
              </h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <button
                    onClick={() => setActiveModal("signin")}
                    className="hover:text-blue-600 transition-colors"
                  >
                    Sign In
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal("signup")}
                    className="hover:text-blue-600 transition-colors"
                  >
                    Create Account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal("terms")}
                    className="hover:text-blue-600 transition-colors text-left"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal("privacy")}
                    className="hover:text-blue-600 transition-colors text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Contact & Support */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Contact & Support
              </h4>
              <p className="text-sm text-slate-500 mb-3 leading-relaxed">
                For official city inquiries, citizen assistance, and government services:
              </p>
              <a
                href="https://qceservices.quezoncity.gov.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-sm font-medium transition-all group"
              >
                <span>QC E-Services Portal</span>
                <ExternalLink className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="text-xs text-slate-400 mt-2">
                Official Quezon City Government Portal
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>&copy; 2026 SCHOLAR Scholarship Management System. All rights reserved.</p>
            <p>In coordination with Quezon City Youth Development Office (QCYDO)</p>
          </div>
        </div>
      </footer>

      {/* Sign In Modal */}
      {activeModal === "signin" && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={(e) => {
            if (signInRef.current && !signInRef.current.contains(e.target as Node)) {
              clearOtpSession();
              setActiveModal(null);
              setShowOtpVerification(false);
              setOtpDigits(["", "", "", "", "", ""]);
              setOtpError("");
              setUserId("");
              setMaskedEmail("");
            }
          }}
        >
          <div
            ref={signInRef}
            className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-[400px] mx-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                clearOtpSession();
                setActiveModal(null);
                setShowOtpVerification(false);
                setOtpDigits(["", "", "", "", "", ""]);
                setOtpError("");
                setUserId("");
                setMaskedEmail("");
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 transition-colors touch-manipulation"
            >
              <X className="size-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="size-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="size-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {showOtpVerification ? "Security Verification" : "Welcome Back"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {showOtpVerification 
                  ? "Enter the 6-digit OTP code sent to your registered email or device." 
                  : "Sign in to access your scholarship portal"}
              </p>
            </div>

            {!showOtpVerification ? (
              // Sign In Form
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Input
                      type={showSignInPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className="w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
                      aria-label={showSignInPassword ? "Hide password" : "Show password"}
                    >
                      {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <Link
                    to={`/auth/forgot-password${signInEmail ? `?email=${encodeURIComponent(signInEmail)}` : ""}`}
                    className="text-sm text-blue-600 hover:underline touch-manipulation"
                    onClick={() => setActiveModal(null)}
                  >
                    Forgot Password?
                  </Link>
                </div>
                {signInError && (
                  <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600">
                    <p>{signInError}</p>
                    {isProviderAccount && (
                      <button
                        type="button"
                        onClick={openProviderSignIn}
                        className="font-semibold text-blue-700 underline hover:text-blue-800"
                      >
                        Continue to Provider Login
                      </button>
                    )}
                  </div>
                )}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 touch-manipulation" disabled={isRequestingOtp}>
                  {isRequestingOtp ? "Signing in..." : "Login"}
                </Button>
              </form>
            ) : (
              // OTP Verification Panel
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* Masked Email Display */}
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Verification code sent to
                  </p>
                  <p className="text-sm font-medium text-slate-800 mt-1">
                    {maskedEmail || signInEmail}
                  </p>
                </div>
                
                {/* Error Message */}
                {otpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 text-center">
                    {otpError}
                  </div>
                )}
                
                <div className="flex justify-center gap-2">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={otpInputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="size-12 text-center text-xl font-bold border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      required
                      disabled={isVerifying}
                    />
                  ))}
                </div>

                {/* Countdown Timer */}
                <div className="text-center">
                  {signInTimeLeft > 0 ? (
                    <p className="text-sm text-slate-500">
                      Code expires in{" "}
                      <span className={`font-mono font-semibold ${signInTimeLeft <= 60 ? "text-red-500" : "text-slate-700"}`}>
                        {signInTimerDisplay}
                      </span>{" "}
                      ⏱
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 font-medium">Code has expired. Please resend.</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isVerifying || isRequestingOtp || otpDigits.join("").length !== 6 || signInTimeLeft <= 0}
                >
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span>
                      Verifying...
                    </span>
                  ) : (
                    "Verify & Proceed"
                  )}
                </Button>
                
                {/* Resend Code */}
                <div className="text-center text-sm text-slate-600">
                  Didn't receive a code?{" "}
                  {signInResendCooldown > 0 ? (
                    <span className="text-slate-400 font-mono">
                      Resend in {signInResendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isRequestingOtp}
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline disabled:text-slate-400 transition-colors"
                    >
                      {isRequestingOtp ? "Sending..." : "Resend Code"}
                    </button>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    clearOtpSession();
                    setShowOtpVerification(false);
                    setOtpDigits(["", "", "", "", "", ""]);
                    setOtpError("");
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Back to Login
                </button>
              </form>
            )}

            {!showOtpVerification && (
              <p className="text-center text-sm text-slate-500 mt-4">
                Don't have an account?{" "}
                <button
                  onClick={() => setActiveModal("signup")}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign Up
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sign Up Modal */}
      {activeModal === "signup" && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={(e) => {
            if (signUpRef.current && !signUpRef.current.contains(e.target as Node)) {
              clearOtpSession();
              setActiveModal(null);
              setShowSignUpOtpVerification(false);
              setSignUpOtpDigits(["", "", "", "", "", ""]);
              setSignUpOtpError("");
              setSignUpUserId("");
              setSignUpMaskedEmail("");
            }
          }}
        >
          <div
            ref={signUpRef}
            className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-[400px] mx-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                clearOtpSession();
                setActiveModal(null);
                setShowSignUpOtpVerification(false);
                setSignUpOtpDigits(["", "", "", "", "", ""]);
                setSignUpOtpError("");
                setSignUpFormError("");
                setSignUpUserId("");
                setSignUpMaskedEmail("");
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 transition-colors touch-manipulation"
            >
              <X className="size-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="size-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="size-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {showSignUpOtpVerification ? "Verify Your Email" : "Create Account"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {showSignUpOtpVerification 
                  ? "Enter the 6-digit OTP code sent to your email to complete registration." 
                  : "Join SCHOLAR and find your perfect scholarship"}
              </p>
            </div>

            {!showSignUpOtpVerification ? (
              // Sign Up Form
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <Input
                    type="text"
                    placeholder="Enter your full name"
                    value={signUpName}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^a-zA-Z\s\-'.]/g, "");
                      setSignUpName(cleaned);
                    }}
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <Input
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="Create a password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className="w-full pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
                      aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                    >
                      {showSignUpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <PasswordStrengthIndicator password={signUpPassword} className="mt-2" />
                </div>
                {signUpFormError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                    <p>{signUpFormError}</p>
                    {signUpFormError.toLowerCase().includes("already") && (
                      <p className="mt-1">
                        <button
                          type="button"
                          onClick={() => setActiveModal("signin")}
                          className="font-semibold underline text-red-700 hover:text-red-800"
                        >
                          Sign in instead
                        </button>
                      </p>
                    )}
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isRequestingSignUpOtp}
                >
                  {isRequestingSignUpOtp ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span>
                      Creating Account...
                    </span>
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </form>
            ) : (
              // OTP Verification Panel
              <form onSubmit={handleVerifySignUpOtp} className="space-y-6">
                {/* Masked Email Display */}
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Verification code sent to
                  </p>
                  <p className="text-sm font-medium text-slate-800 mt-1">
                    {signUpMaskedEmail || signUpEmail}
                  </p>
                </div>
                
                {/* Error Message */}
                {signUpOtpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 text-center">
                    {signUpOtpError}
                  </div>
                )}
                
                <div className="flex justify-center gap-2">
                  {signUpOtpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={signUpOtpInputRefs[index]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleSignUpOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleSignUpOtpKeyDown(index, e)}
                      className="size-12 text-center text-xl font-bold border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      required
                      disabled={isSignUpVerifying}
                    />
                  ))}
                </div>

                {/* Countdown Timer */}
                <div className="text-center">
                  {signUpTimeLeft > 0 ? (
                    <p className="text-sm text-slate-500">
                      Code expires in{" "}
                      <span className={`font-mono font-semibold ${signUpTimeLeft <= 60 ? "text-red-500" : "text-slate-700"}`}>
                        {signUpTimerDisplay}
                      </span>{" "}
                      ⏱
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 font-medium">Code has expired. Please resend.</p>
                  )}
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSignUpVerifying || isRequestingSignUpOtp || signUpOtpDigits.join("").length !== 6 || signUpTimeLeft <= 0}
                >
                  {isSignUpVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full size-4 border-b-2 border-white"></span>
                      Verifying...
                    </span>
                  ) : (
                    "Verify & Proceed"
                  )}
                </Button>
                
                {/* Resend Code */}
                <div className="text-center text-sm text-slate-600">
                  Didn't receive a code?{" "}
                  {signUpResendCooldown > 0 ? (
                    <span className="text-slate-400 font-mono">
                      Resend in {signUpResendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendSignUpOtp}
                      disabled={isRequestingSignUpOtp}
                      className="text-blue-600 hover:text-blue-700 font-medium hover:underline disabled:text-slate-400 transition-colors"
                    >
                      {isRequestingSignUpOtp ? "Sending..." : "Resend Code"}
                    </button>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    clearOtpSession();
                    setShowSignUpOtpVerification(false);
                    setSignUpOtpDigits(["", "", "", "", "", ""]);
                    setSignUpOtpError("");
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Back to Registration
                </button>
              </form>
            )}

            {!showSignUpOtpVerification && (
              <p className="text-center text-sm text-slate-500 mt-4">
                Already have an account?{" "}
                <button
                  onClick={() => setActiveModal("signin")}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Explore Scholarships Modal */}
      {activeModal === "explore" && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => handleOverlayClick(e, exploreRef)}
        >
          <div
            ref={exploreRef}
            className="bg-white rounded-2xl w-full max-w-[850px] max-h-[85vh] shadow-2xl relative flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Award className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Explore Scholarships</h2>
                    <p className="text-sm text-slate-500">Discover available scholarship opportunities in Quezon City</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="text-slate-500 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="size-5" />
                </button>
              </div>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search scholarships..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>

            {/* Scholarships List */}
            <div className="overflow-y-auto flex-1 p-6">
              {loadingScholarships ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full size-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-slate-600">Loading scholarships...</span>
                </div>
              ) : filteredScholarships.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="size-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No scholarships found matching your search.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredScholarships.map((scholarship, index) => {
                    // Handle MongoDB ObjectId which may be { $oid: "..." } or a plain string
                    const rawId = scholarship._id || scholarship.id;
                    const id = rawId && typeof rawId === "object" && (rawId as Record<string, unknown>).$oid
                      ? String((rawId as Record<string, unknown>).$oid)
                      : String(rawId || index);
                    const title = String(scholarship.name || scholarship.title || scholarship.scholarshipName || "Unnamed Scholarship");
                    const provider = String(scholarship.provider || scholarship.providerOffice || "Quezon City Government");
                    const description = String(scholarship.description || "");
                    const amount = (scholarship.amount || scholarship.scholarshipAmount) as string | number | undefined;
                    const deadline = (scholarship.deadline || scholarship.applicationDeadline) as string | undefined;
                    const isExpanded = expandedScholarship === id;
                    
                    // Requirements data
                    const educationLevel = (scholarship.requiredEducationLevel || scholarship.educationLevel || ["Any"]) as string[] | string;
                    const rawMinGpa = scholarship.minimumGPA ?? scholarship.minimumGpa ?? scholarship.minimumGWA ?? scholarship.requiredGWA ?? (scholarship.eligibilityCriteria as Record<string, unknown> | undefined)?.minGPA ?? (scholarship.eligibilityCriteria as Record<string, unknown> | undefined)?.minGwa;
                    const minGWA = rawMinGpa ? String(rawMinGpa) : null;
                    const specificCriteria = (Array.isArray(scholarship.specificCriteria) ? scholarship.specificCriteria : []) as string[];
                    const generalDocs = (Array.isArray(scholarship.generalDocuments) ? scholarship.generalDocuments : []) as string[];
                    const requiredDocs = (Array.isArray(scholarship.requiredDocuments) ? scholarship.requiredDocuments : []) as string[];
                    
                    return (
                      <div key={id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                        {/* Scholarship Header */}
                        <div className="p-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
                              <p className="text-sm text-slate-500 mt-1">{provider}</p>
                              {description && (
                                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => setExpandedScholarship(isExpanded ? null : id)}
                              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-lg transition-colors"
                            >
                              <span>📋 View Requirements</span>
                              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            </button>
                          </div>
                          
                          {/* Quick Info Badges */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {amount ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                <Coins className="size-3" />
                                {typeof amount === "number" ? `₱${amount.toLocaleString()}` : String(amount)}
                              </span>
                            ) : null}
                            {deadline ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                <Calendar className="size-3" />
                                Deadline: {new Date(String(deadline)).toLocaleDateString()}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              <Users className="size-3" />
                              {Array.isArray(educationLevel) ? educationLevel.join(", ") : String(educationLevel)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Expanded Requirements */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 p-5 bg-white space-y-5">
                            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                              <FileText className="size-4 text-blue-600" />
                              Requirements & Eligibility Criteria
                            </h4>

                            {/* Specific Eligibility Criteria */}
                            {specificCriteria.length > 0 && (
                              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <CheckCircle className="size-3.5 text-green-600" />
                                  Specific Criteria
                                </p>
                                <ul className="space-y-1.5">
                                  {specificCriteria.map((criterion, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                                      <span className="text-green-600 mt-0.5">•</span>
                                      <span>{criterion}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Education Level & Minimum GPA */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Education Level</p>
                                <p className="text-sm font-medium text-slate-800">
                                  {Array.isArray(educationLevel) ? educationLevel.join(", ") : String(educationLevel)}
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Minimum GWA Required</p>
                                <p className="text-sm font-medium text-slate-800">
                                  {minGWA ? minGWA : "None required"}
                                </p>
                              </div>
                            </div>

                            {/* General Documents (Required by all) */}
                            {generalDocs.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                                  General Documents (Required for ALL applicants)
                                </p>
                                <ul className="space-y-1.5">
                                  {generalDocs.map((doc, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                      <span className="text-amber-500 mt-0.5">•</span>
                                      <span>{doc}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Scholarship-Specific Required Documents */}
                            {requiredDocs.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                                  Scholarship-Specific Documents
                                </p>
                                <ul className="space-y-1.5">
                                  {requiredDocs.map((doc, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                      <span className="text-blue-500 mt-0.5">•</span>
                                      <span>{doc}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Apply Button */}
                            <div className="pt-4 border-t border-slate-100">
                              <Button
                                onClick={() => handleApplyNow(id)}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                Apply Now
                              </Button>
                              <p className="text-xs text-center text-slate-500 mt-2">
                                You need to sign in to apply for this scholarship
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Terms of Service Modal */}
      {activeModal === "terms" && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-[540px] shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 touch-manipulation"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="size-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <GraduationCap className="size-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Terms of Service</h2>
                <p className="text-sm text-slate-500">General terms for using SCHOLAR.</p>
              </div>
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-slate-600 divide-y divide-slate-100">
              <div className="pt-2">
                <h3 className="font-semibold text-slate-900 mb-1">Using SCHOLAR</h3>
                <p>
                  SCHOLAR helps students discover and manage scholarship opportunities. You are responsible for providing accurate information and keeping your account credentials private.
                </p>
              </div>

              <div className="pt-4">
                <h3 className="font-semibold text-slate-900 mb-1">Applications and information</h3>
                <p>
                  Scholarship requirements, deadlines, and decisions are provided by the relevant scholarship provider. Always review the provider's instructions before submitting an application.
                </p>
              </div>

              <div className="pt-4">
                <h3 className="font-semibold text-slate-900 mb-1">Acceptable use</h3>
                <p>
                  Do not submit fraudulent documents, impersonate another person, interfere with the service, or use SCHOLAR for unlawful purposes.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {activeModal === "privacy" && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-[540px] shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 touch-manipulation"
              aria-label="Close modal"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="size-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <GraduationCap className="size-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Privacy Policy</h2>
                <p className="text-sm text-slate-500">How SCHOLAR handles information in the application.</p>
              </div>
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-slate-600 divide-y divide-slate-100">
              <div className="pt-2">
                <h3 className="font-semibold text-slate-900 mb-1">Information we use</h3>
                <p>
                  SCHOLAR uses account, academic, contact, and application information to provide matching, application tracking, notifications, and related platform features.
                </p>
              </div>

              <div className="pt-4">
                <h3 className="font-semibold text-slate-900 mb-1">Uploaded documents</h3>
                <p>
                  Documents are used to support scholarship applications and eligibility workflows. Only upload documents that belong to you or that you are authorized to provide.
                </p>
              </div>

              <div className="pt-4">
                <h3 className="font-semibold text-slate-900 mb-1">Your choices</h3>
                <p>
                  You may review and update profile information through the application. Contact the system administrator if you need help correcting or removing information.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
