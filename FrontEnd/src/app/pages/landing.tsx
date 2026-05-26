import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { X, GraduationCap, Search, ChevronDown, ChevronUp, Award, FileText, DollarSign, Users, Calendar } from "lucide-react";
import { fetchScholarships, signIn, signUp, verifyOTP, resendOTP } from "../lib/api-client";
import { saveStoredUser, saveAuthToken } from "../lib/user-storage";

export function LandingPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<"signin" | "signup" | "explore" | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  
  // OTP verification state for sign in
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [otpError, setOtpError] = useState<string>("");
  
  // OTP verification state for sign up
  const [showSignUpOtpVerification, setShowSignUpOtpVerification] = useState(false);
  const [signUpOtpDigits, setSignUpOtpDigits] = useState(["", "", "", "", "", ""]);
  const [isSignUpVerifying, setIsSignUpVerifying] = useState(false);
  const [isRequestingSignUpOtp, setIsRequestingSignUpOtp] = useState(false);
  const [signUpUserId, setSignUpUserId] = useState<string>("");
  const [signUpMaskedEmail, setSignUpMaskedEmail] = useState<string>("");
  const [signUpOtpError, setSignUpOtpError] = useState<string>("");
  const [signUpFormError, setSignUpFormError] = useState<string>("");
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

  const handleApplyNow = () => {
    setActiveModal("signin");
  };

  const scrollToFeatures = () => {
    document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequestingOtp(true);
    setOtpError("");
    
    try {
      // Step 1: Send login request to get OTP
      const response = await signIn({ email: signInEmail, password: signInPassword });
      
      if (response.requiresOTP && response.userId) {
        setUserId(response.userId);
        setMaskedEmail(response.maskedEmail || signInEmail);
        setShowOtpVerification(true);
        // Focus first OTP input after a short delay
        setTimeout(() => {
          otpInputRefs[0].current?.focus();
        }, 100);
      } else {
        // If no OTP required, something is wrong
        setOtpError("Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setOtpError(error instanceof Error ? error.message : "Invalid email or password.");
    } finally {
      setIsRequestingOtp(false);
    }
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
      // Step 2: Verify OTP code
      const response = await verifyOTP(userId, otpCode);
      
      if (response.token && response.user) {
        // Save auth token and user
        saveAuthToken(response.token);
        saveStoredUser(response.user);
        
        // Navigate based on user type
        const userType = response.user.userType as string;
        if (userType === "admin") {
          navigate("/admin");
        } else if (userType === "provider") {
          navigate("/provider/dashboard");
        } else {
          navigate("/dashboard");
        }
        // Close the modal after successful navigation
        setActiveModal(null);
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      setOtpError(error instanceof Error ? error.message : "Invalid verification code.");
      // Clear OTP digits on error
      setOtpDigits(["", "", "", "", "", ""]);
      // Focus first input
      otpInputRefs[0].current?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!userId) return;
    
    setIsRequestingOtp(true);
    setOtpError("");
    
    try {
      await resendOTP(userId);
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
      // Create user first, then show OTP verification
      const response = await signUp({ 
        email: signUpEmail, 
        password: signUpPassword,
        fullName: signUpName 
      });
      
      if (response.user && response.user._id) {
        setSignUpUserId(response.user._id as string);
        setSignUpMaskedEmail(signUpEmail);
        setShowSignUpOtpVerification(true);
        // Focus first OTP input after a short delay
        setTimeout(() => {
          signUpOtpInputRefs[0].current?.focus();
        }, 100);
      } else {
        // If user created but needs OTP verification step
        setSignUpUserId(response.user?.userId as string || "");
        setSignUpMaskedEmail(signUpEmail);
        setShowSignUpOtpVerification(true);
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
        } else {
          navigate("/dashboard");
        }
        setActiveModal(null);
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
    if (!signUpUserId) return;
    
    setIsRequestingSignUpOtp(true);
    setSignUpOtpError("");
    
    try {
      await resendOTP(signUpUserId);
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
            <div className="flex gap-3">
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
        <div className="bg-blue-600 rounded-2xl p-10 flex flex-col lg:flex-row justify-between items-center gap-6 text-white">
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
      <footer className="text-center py-6 border-t border-slate-200 text-sm text-slate-400 bg-white">
        &copy; 2026 SCHOLAR Scholarship Management System. All rights reserved.
      </footer>

      {/* Sign In Modal */}
      {activeModal === "signin" && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"
          onClick={(e) => {
            handleOverlayClick(e, signInRef);
            if (signInRef.current && !signInRef.current.contains(e.target as Node)) {
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
            className="bg-white rounded-2xl p-8 w-full max-w-[400px] shadow-2xl relative"
          >
            <button
              onClick={() => {
                setActiveModal(null);
                setShowOtpVerification(false);
                setOtpDigits(["", "", "", "", "", ""]);
                setOtpError("");
                setUserId("");
                setMaskedEmail("");
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="h-6 w-6 text-white" />
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
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
                <div className="text-right">
                  <Link to="/auth/signin" className="text-sm text-blue-600 hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                  Login
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
                      className="w-12 h-12 text-center text-xl font-bold border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      required
                      disabled={isVerifying}
                    />
                  ))}
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isVerifying || isRequestingOtp || otpDigits.join("").length !== 6}
                >
                  {isVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Verifying...
                    </span>
                  ) : (
                    "Verify & Proceed"
                  )}
                </Button>
                
                {/* Resend Code Button */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isRequestingOtp}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 transition-colors"
                  >
                    {isRequestingOtp ? "Sending..." : "Resend Code"}
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
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
            handleOverlayClick(e, signUpRef);
            if (signUpRef.current && !signUpRef.current.contains(e.target as Node)) {
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
            className="bg-white rounded-2xl p-8 w-full max-w-[400px] shadow-2xl relative"
          >
            <button
              onClick={() => {
                setActiveModal(null);
                setShowSignUpOtpVerification(false);
                setSignUpOtpDigits(["", "", "", "", "", ""]);
                setSignUpOtpError("");
                setSignUpFormError("");
                setSignUpUserId("");
                setSignUpMaskedEmail("");
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="h-6 w-6 text-white" />
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
                    onChange={(e) => setSignUpName(e.target.value)}
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
                  <Input
                    type="password"
                    placeholder="Create a password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full"
                    required
                  />
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
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
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
                      className="w-12 h-12 text-center text-xl font-bold border border-slate-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                      required
                      disabled={isSignUpVerifying}
                    />
                  ))}
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSignUpVerifying || isRequestingSignUpOtp || signUpOtpDigits.join("").length !== 6}
                >
                  {isSignUpVerifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Verifying...
                    </span>
                  ) : (
                    "Verify & Proceed"
                  )}
                </Button>
                
                {/* Resend Code Button */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendSignUpOtp}
                    disabled={isRequestingSignUpOtp}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400 transition-colors"
                  >
                    {isRequestingSignUpOtp ? "Sending..." : "Resend Code"}
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => {
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
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Award className="h-5 w-5 text-blue-600" />
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
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-slate-600">Loading scholarships...</span>
                </div>
              ) : filteredScholarships.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No scholarships found matching your search.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredScholarships.map((scholarship, index) => {
                    const id = String(scholarship._id || scholarship.id || index);
                    const title = String(scholarship.name || scholarship.title || scholarship.scholarshipName || "Unnamed Scholarship");
                    const provider = String(scholarship.provider || scholarship.providerOffice || "Quezon City Government");
                    const description = String(scholarship.description || "");
                    const amount = (scholarship.amount || scholarship.scholarshipAmount) as string | number | undefined;
                    const deadline = (scholarship.deadline || scholarship.applicationDeadline) as string | undefined;
                    const isExpanded = expandedScholarship === id;
                    
                    // Requirements data
                    const educationLevel = (scholarship.requiredEducationLevel || scholarship.educationLevel || ["Any"]) as string[] | string;
                    const minGWA = (scholarship.minimumGWA || scholarship.requiredGWA) as string | undefined;
                    const requiredDocs = (scholarship.requiredDocuments || [
                      "Valid QCitizen ID",
                      "Transcript of Records",
                      "Certificate of Enrollment",
                      "Income Certification"
                    ]) as string[];
                    
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
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                          
                          {/* Quick Info Badges */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {amount ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                                <DollarSign className="h-3 w-3" />
                                {typeof amount === "number" ? `₱${amount.toLocaleString()}` : String(amount)}
                              </span>
                            ) : null}
                            {deadline ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                                <Calendar className="h-3 w-3" />
                                Deadline: {new Date(String(deadline)).toLocaleDateString()}
                              </span>
                            ) : null}
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              <Users className="h-3 w-3" />
                              {Array.isArray(educationLevel) ? educationLevel.join(", ") : String(educationLevel)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Expanded Requirements */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 p-4 bg-white">
                            <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              Requirements & Criteria
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Education Level */}
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Education Level</p>
                                <p className="text-sm text-slate-700">
                                  {Array.isArray(educationLevel) ? educationLevel.join(", ") : String(educationLevel)}
                                </p>
                              </div>
                              
                              {/* Minimum GWA */}
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase mb-1">Minimum GWA Required</p>
                                <p className="text-sm text-slate-700">
                                  {minGWA ? String(minGWA) : "Not specified"}
                                </p>
                              </div>
                            </div>
                            
                            {/* Required Documents */}
                            <div className="mt-4">
                              <p className="text-xs font-medium text-slate-500 uppercase mb-2">Required Documents</p>
                              <ul className="space-y-1.5">
                                {Array.isArray(requiredDocs) ? requiredDocs.map((doc, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-blue-500 mt-0.5">•</span>
                                    {doc}
                                  </li>
                                )) : (
                                  <li className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="text-blue-500 mt-0.5">•</span>
                                    Valid QCitizen ID
                                  </li>
                                )}
                              </ul>
                            </div>
                            
                            {/* Apply Button */}
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <Button
                                onClick={handleApplyNow}
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
    </div>
  );
}
