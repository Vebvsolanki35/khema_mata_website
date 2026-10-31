import { Component, Suspense, lazy, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Ticker from "./components/layout/Ticker";
import Footer from "./components/layout/Footer";
import FloatingButtons from "./components/layout/FloatingButtons";
import BottomNav from "./components/layout/BottomNav";
import { LanguageProvider } from "./context/LanguageContext";
import Home from "./pages/Home";
import Parivaar from "./pages/Parivaar";
import ProtectedRoute from "./components/ProtectedRoute";

const Temple = lazy(() => import("./pages/Temple"));
const History = lazy(() => import("./pages/History"));
const Donation = lazy(() => import("./pages/Donation"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Contact = lazy(() => import("./pages/Contact"));
const Admin = lazy(() => import("./pages/Admin"));
const Trust = lazy(() => import("./pages/Trust"));

/**
 * Scrolls to the top on route change, but honours a `#hash` so deep links such
 * as `/parivaar#register` (Home action cards, More sheet, footer) land on the
 * right section instead of the top of a very long page.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const behavior = prefersReducedMotion ? "auto" : "smooth";

    if (hash) {
      const id = decodeURIComponent(hash.replace(/^#/, ""));
      // Wait one frame so lazily-loaded pages have rendered their sections.
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
      }, 80);
      return () => window.clearTimeout(timer);
    }

    window.scrollTo({ top: 0, behavior });
    return undefined;
  }, [pathname, hash]);
  return null;
}

function RouteFallbackSkeleton() {
  return (
    <div
      className="max-w-5xl mx-auto px-4 py-10 space-y-4 animate-pulse"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-28 rounded-2xl"
        style={{ backgroundColor: "rgba(139,26,26,0.12)" }}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-20 rounded-xl"
            style={{ backgroundColor: "rgba(212,175,55,0.18)" }}
          />
        ))}
      </div>
      <div
        className="h-64 rounded-2xl"
        style={{ backgroundColor: "rgba(212,175,55,0.12)" }}
      />
    </div>
  );
}

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected rendering error.",
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.pathname !== this.props.pathname && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="max-w-3xl mx-auto my-12 px-4">
          <div
            className="rounded-2xl p-6 text-center space-y-3 shadow"
            style={{
              backgroundColor: "#FFF8F0",
              border: "2px solid var(--gold)",
              color: "var(--maroon)",
            }}
            role="alert"
          >
            <h2 className="text-xl font-bold">
              ⚠️ Page Error: {this.state.errorMessage}
            </h2>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: "" })}
              className="px-5 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
            >
              Reload Section
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { pathname } = useLocation();
  // The admin console keeps its own chrome — no public nav, ticker, footer or
  // floating donation/WhatsApp buttons there.
  const isAdmin = pathname.startsWith("/admin");
  return (
    <LanguageProvider>
      <ScrollToTop />
      {!isAdmin && <Ticker />}
      {!isAdmin && <Navbar />}
      {!isAdmin && <FloatingButtons />}

      <PageErrorBoundary pathname={pathname}>
        <Suspense fallback={<RouteFallbackSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/temple" element={<Temple />} />
            <Route path="/history" element={<History />} />
            <Route path="/donation" element={<Donation />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/trust" element={<Trust />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/parivaar" element={<Parivaar />} />
            <Route path="/admin/login" element={<Admin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </PageErrorBoundary>

      {!isAdmin && <Footer />}
      {!isAdmin && <BottomNav />}
    </LanguageProvider>
  );
}

export default App;
