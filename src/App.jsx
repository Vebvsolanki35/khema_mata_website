import Navbar from "./components/layout/Navbar";
import Ticker from "./components/layout/Ticker";
import FloatingButtons from "./components/layout/FloatingButtons";
import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";

import Home from "./pages/Home";
import Temple from "./pages/Temple";
import History from "./pages/History";
import Visit from "./pages/Visit";
import Donation from "./pages/Donation";
import Facilities from "./pages/Facilities";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import Planner from "./pages/Planner";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <LanguageProvider>
      <Ticker />
      <Navbar />
      <FloatingButtons />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/temple" element={<Temple />} />
        <Route path="/history" element={<History />} />
        <Route path="/visit" element={<Visit />} />
        <Route path="/donation" element={<Donation />} />
        <Route path="/facilities" element={<Facilities />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/planner" element={<Planner />} />
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
    </LanguageProvider>
  );
}

export default App;