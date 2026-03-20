import Navbar from "./components/layout/Navbar";
import { Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";

import Home from "./pages/Home";
import Temple from "./pages/Temple";
import Visit from "./pages/Visit";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <LanguageProvider>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/temple" element={<Temple />} />
        <Route path="/visit" element={<Visit />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
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