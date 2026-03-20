import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-4 border border-orange-100"
      >
        <h1 className="text-2xl font-bold text-orange-700 text-center">🔐 Admin Login</h1>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold py-2 rounded-xl transition-colors"
        >
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const [messages, setMessages] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: msgs, error: msgErr }, { data: dons, error: donErr }] = await Promise.all([
        supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
        supabase.from("donations").select("*").order("created_at", { ascending: false }),
      ]);
      if (msgErr || donErr) {
        setFetchError((msgErr || donErr).message);
      } else {
        setMessages(msgs || []);
        setDonations(dons || []);
      }
      setLoadingData(false);
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const totalDonations = donations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500 font-semibold">Error loading data: {fetchError}</p>
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-orange-700">🛕 Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Contact Messages */}
      <section>
        <h2 className="text-xl font-bold text-orange-600 mb-3">📩 Contact Messages</h2>
        <div className="overflow-x-auto rounded-xl shadow border border-orange-100">
          <table className="w-full text-sm">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Message</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-400">No messages yet.</td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg.id} className="border-t border-gray-100 hover:bg-orange-50">
                    <td className="px-4 py-3">{msg.name}</td>
                    <td className="px-4 py-3">{msg.phone}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{msg.message}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Donations */}
      <section>
        <h2 className="text-xl font-bold text-orange-600 mb-1">💰 Donations</h2>
        <p className="text-gray-600 mb-3">
          Total: <span className="font-bold text-green-600">₹{totalDonations.toLocaleString()}</span>
        </p>
        <div className="overflow-x-auto rounded-xl shadow border border-orange-100">
          <table className="w-full text-sm">
            <thead className="bg-orange-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Donor Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount (₹)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {donations.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-gray-400">No donations yet.</td>
                </tr>
              ) : (
                donations.map((don) => (
                  <tr key={don.id} className="border-t border-gray-100 hover:bg-orange-50">
                    <td className="px-4 py-3">{don.donor_name}</td>
                    <td className="px-4 py-3 font-semibold">₹{Number(don.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {don.created_at ? new Date(don.created_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Admin() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}

export default Admin;
