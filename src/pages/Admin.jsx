import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import TabNotices from "../components/admin/TabNotices";
import TabVolunteers from "../components/admin/TabVolunteers";

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

function TabMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setMessages(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">लोड हो रहा है…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="overflow-x-auto rounded-xl shadow border border-orange-100">
      <table className="w-full text-sm">
        <thead className="bg-orange-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">नाम</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">फोन</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">संदेश</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700">दिनांक</th>
          </tr>
        </thead>
        <tbody>
          {messages.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400">कोई संदेश नहीं।</td></tr>
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
  );
}

function TabDonations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from("donations").select("*").order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setDonations(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-gray-500">लोड हो रहा है…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const total = donations.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  return (
    <>
      <p className="text-gray-600 mb-3">
        कुल दान: <span className="font-bold text-green-600">₹{total.toLocaleString()}</span>
      </p>
      <div className="overflow-x-auto rounded-xl shadow border border-orange-100">
        <table className="w-full text-sm">
          <thead className="bg-orange-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">दाता का नाम</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">राशि (₹)</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">दिनांक</th>
            </tr>
          </thead>
          <tbody>
            {donations.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">कोई दान नहीं।</td></tr>
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
    </>
  );
}

function TabAnnouncements() {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchList = () => {
    supabase.from("announcements").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setList(data || []));
  };

  useEffect(fetchList, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("announcements").insert({ title, message, type, date });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setTitle(""); setMessage(""); setType("info"); setDate("");
    fetchList();
  };

  const handleDelete = async (id) => {
    await supabase.from("announcements").delete().eq("id", id);
    fetchList();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="bg-orange-50 rounded-xl p-4 space-y-3 border border-orange-100">
        <h3 className="font-bold text-orange-700">नई घोषणा जोड़ें</h3>
        <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="शीर्षक" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <textarea required value={message} onChange={e => setMessage(e.target.value)} placeholder="संदेश" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <div className="flex gap-2 flex-wrap">
          <select value={type} onChange={e => setType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="info">सूचना</option>
            <option value="event">कार्यक्रम</option>
            <option value="alert">चेतावनी</option>
          </select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
          {saving ? "सहेज रहे हैं…" : "जोड़ें"}
        </button>
      </form>
      <div className="space-y-2">
        {list.length === 0 ? <p className="text-gray-400 text-sm">कोई घोषणा नहीं।</p> : list.map(item => (
          <div key={item.id} className="flex justify-between items-start bg-white rounded-xl p-3 shadow-sm border border-orange-100">
            <div>
              <p className="font-semibold text-sm text-orange-700">{item.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{item.message}</p>
              <p className="text-xs text-gray-400 mt-1">{item.type} · {item.date || "—"}</p>
            </div>
            <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0">हटाएं</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const WA_GROUPS = [
  { key: "temple_update", label: "🛕 मंदिर अपडेट ग्रुप" },
  { key: "solanki_kul", label: "👥 सोलंकी कुल समूह" },
  { key: "tirtha_yatra", label: "🚗 तीर्थ यात्रा ग्रुप" },
  { key: "navratri", label: "🎉 नवरात्रि ग्रुप" },
];

function TabWhatsApp() {
  const [links, setLinks] = useState({
    temple_update: "",
    solanki_kul: "",
    tirtha_yatra: "",
    navratri: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("whatsapp_groups")
      .select("key, link")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLinks((prev) => {
            const updated = { ...prev };
            data.forEach((row) => {
              if (row.key in updated) updated[row.key] = row.link || "";
            });
            return updated;
          });
        }
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    const upserts = WA_GROUPS.map((g) => ({
      key: g.key,
      name: g.label,
      link: links[g.key],
    }));
    const { error: err } = await supabase
      .from("whatsapp_groups")
      .upsert(upserts, { onConflict: "key" });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setMsg("✅ सहेजा गया!");
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <form onSubmit={handleSave} className="bg-orange-50 rounded-xl p-5 space-y-4 border border-orange-100 max-w-lg">
      <h3 className="font-bold text-orange-700">WhatsApp ग्रुप लिंक</h3>
      {WA_GROUPS.map((g) => (
        <div key={g.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{g.label}</label>
          <input
            value={links[g.key]}
            onChange={(e) => setLinks((prev) => ({ ...prev, [g.key]: e.target.value }))}
            placeholder="https://chat.whatsapp.com/…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      ))}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {msg && <p className="text-green-600 text-sm font-semibold">{msg}</p>}
      <button
        type="submit"
        disabled={saving}
        className="bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors"
      >
        {saving ? "सहेज रहे हैं…" : "सभी सेव करें"}
      </button>
    </form>
  );
}

function TabGallery() {
  const [list, setList] = useState([]);
  const [imageUrl, setImageUrl] = useState("");
  const [imageTitle, setImageTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchList = () => {
    supabase.from("gallery_images").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setList(data || []));
  };

  useEffect(fetchList, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("gallery_images").insert({ image_url: imageUrl, title: imageTitle });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setImageUrl(""); setImageTitle("");
    fetchList();
  };

  const handleDelete = async (id) => {
    await supabase.from("gallery_images").delete().eq("id", id);
    fetchList();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="bg-orange-50 rounded-xl p-4 space-y-3 border border-orange-100">
        <h3 className="font-bold text-orange-700">नई गैलरी छवि जोड़ें</h3>
        <input required value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <input required value={imageTitle} onChange={e => setImageTitle(e.target.value)} placeholder="शीर्षक" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
          {saving ? "सहेज रहे हैं…" : "जोड़ें"}
        </button>
      </form>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.length === 0 ? <p className="text-gray-400 text-sm col-span-3">कोई छवि नहीं।</p> : list.map(item => (
          <div key={item.id} className="relative rounded-xl overflow-hidden shadow-sm border border-orange-100">
            <img src={item.image_url} alt={item.title} className="w-full h-28 object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 flex justify-between items-center">
              <span className="text-white text-xs truncate">{item.title}</span>
              <button onClick={() => handleDelete(item.id)} className="text-red-300 hover:text-red-500 text-xs ml-1 shrink-0">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabContent() {
  const [upi1, setUpi1] = useState("");
  const [upi2, setUpi2] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from("site_content").select("key, value").in("key", ["upi_id_1", "upi_id_2"])
      .then(({ data }) => {
        (data || []).forEach(row => {
          if (row.key === "upi_id_1") setUpi1(row.value || "");
          if (row.key === "upi_id_2") setUpi2(row.value || "");
        });
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    await Promise.all([
      supabase.from("site_content").upsert({ key: "upi_id_1", value: upi1 }, { onConflict: "key" }),
      supabase.from("site_content").upsert({ key: "upi_id_2", value: upi2 }, { onConflict: "key" }),
    ]);
    setSaving(false);
    setMsg("✅ सहेजा गया!");
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <form onSubmit={handleSave} className="bg-orange-50 rounded-xl p-5 space-y-4 border border-orange-100 max-w-md">
      <h3 className="font-bold text-orange-700">UPI ID सेटिंग्स</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID 1</label>
        <input value={upi1} onChange={e => setUpi1(e.target.value)} placeholder="example@upi" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID 2</label>
        <input value={upi2} onChange={e => setUpi2(e.target.value)} placeholder="example2@upi" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>
      {msg && <p className="text-green-600 text-sm font-semibold">{msg}</p>}
      <button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors">
        {saving ? "सहेज रहे हैं…" : "सहेजें"}
      </button>
    </form>
  );
}

const TABS = [
  { id: "messages", label: "📩 संदेश" },
  { id: "donations", label: "💰 दान" },
  { id: "announcements", label: "📢 घोषणाएं" },
  { id: "whatsapp", label: "💬 WhatsApp ग्रुप" },
  { id: "gallery", label: "🖼️ गैलरी" },
  { id: "content", label: "⚙️ सामग्री" },
  { id: "notices", label: "📌 लाइव सूचनाएं" },
  { id: "volunteers", label: "🙋 सेवा आवेदन" },
];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("messages");

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-orange-700">🛕 Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            style={activeTab === tab.id
              ? { backgroundColor: "#ea580c", color: "white" }
              : { backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section>
        {activeTab === "messages" && <TabMessages />}
        {activeTab === "donations" && <TabDonations />}
        {activeTab === "announcements" && <TabAnnouncements />}
        {activeTab === "whatsapp" && <TabWhatsApp />}
        {activeTab === "gallery" && <TabGallery />}
        {activeTab === "content" && <TabContent />}
        {activeTab === "notices" && <TabNotices />}
        {activeTab === "volunteers" && <TabVolunteers />}
      </section>
    </main>
  );
}

function Admin() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
