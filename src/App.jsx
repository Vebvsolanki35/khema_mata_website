import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Ticker from "./components/layout/Ticker";
import Footer from "./components/layout/Footer";
import FloatingButtons from "./components/layout/FloatingButtons";
import { LanguageProvider } from "./context/LanguageContext";
import Home from "./pages/Home";
import Temple from "./pages/Temple";
import History from "./pages/History";
import Visit from "./pages/Visit";
import Donation from "./pages/Donation";
import Facilities from "./pages/Facilities";
import Gallery from "./pages/Gallery";
import Darshan from "./pages/Darshan";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import Planner from "./pages/Planner";
import Calendar from "./pages/Calendar";
import Trust from "./pages/Trust";
import ProtectedRoute from "./components/ProtectedRoute";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [pathname]);
  return null;
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

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/temple" element={<Temple />} />
        <Route path="/history" element={<History />} />
        <Route path="/darshan" element={<Darshan />} />
        <Route path="/visit" element={<Visit />} />
        <Route path="/donation" element={<Donation />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/trust" element={<Trust />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/calendar" element={<Calendar />} />
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

      {!isAdmin && <Footer />}
    </LanguageProvider>
  );
}

export default App;
