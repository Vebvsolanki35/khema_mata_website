import { useLanguage } from "../context/useLanguage";
import { publishedCommittee } from "../data/trustCommittee";

const ROLE_ICONS = {
  president: "👑",
  vicePresident: "🎖️",
  secretary: "📝",
  treasurer: "💰",
  member: "🙏",
};

function MemberCard({ member, roleLabel, tr, language }) {
  const name =
    language === "en"
      ? member.nameEn || member.name
      : language === "gu"
        ? member.nameGu || member.name
        : member.name;
  const bio =
    language === "en"
      ? member.bioEn || member.bio
      : language === "gu"
        ? member.bioGu || member.bio
        : member.bio;

  return (
    <article
      className="temple-card rounded-2xl p-5 text-center flex flex-col items-center"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(212,175,55,0.4)",
      }}
    >
      <div
        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden mb-4 flex items-center justify-center shrink-0"
        style={{
          backgroundColor: "var(--cream)",
          border: "3px solid var(--gold)",
        }}
      >
        {member.photo ? (
          <img
            src={member.photo}
            alt={name || roleLabel}
            width={112}
            height={112}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl opacity-60" aria-hidden="true">
            🧑‍🤝‍🧑
          </span>
        )}
      </div>

      <h3
        className="font-bold text-base sm:text-lg mb-0.5"
        style={{ color: "var(--maroon)", fontFamily: "'Tiro Devanagari Hindi', serif" }}
      >
        {name}
      </h3>

      <p
        className="text-xs font-bold px-3 py-1 rounded-full mb-3"
        style={{ backgroundColor: "var(--gold)", color: "var(--maroon)" }}
      >
        {ROLE_ICONS[member.role] || "🙏"} {roleLabel}
      </p>

      {bio && (
        <p className="text-sm leading-relaxed mb-3" style={{ color: "#4A3728" }}>
          {bio}
        </p>
      )}

      {member.publicContact && member.phone && (
        <a
          href={`tel:${member.phone.replace(/\s/g, "")}`}
          className="text-sm font-semibold"
          style={{ color: "var(--saffron)" }}
        >
          📞 {member.phone}
        </a>
      )}

      {member.videoUrl && (
        <a
          href={member.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-sm font-bold px-4 py-2 rounded-full inline-block"
          style={{ backgroundColor: "var(--maroon)", color: "var(--gold)" }}
        >
          ▶ {tr.videoIntro}
        </a>
      )}
    </article>
  );
}

/**
 * Trust Committee section.
 *
 * Only members flagged `published: true` in src/data/trustCommittee.js are shown.
 * No placeholder identities, names, bios or photographs are fabricated — if
 * nothing is published yet the section shows an honest "being confirmed" notice.
 */
function TrustCommittee({ showPendingNotice = true }) {
  const { t, language } = useLanguage();
  const tr = t.trust;
  const members = publishedCommittee();

  return (
    <section
      className="py-14 px-4"
      style={{ backgroundColor: "var(--cream)" }}
      aria-labelledby="trust-committee-heading"
    >
      <div className="max-w-6xl mx-auto">
        <h2
          id="trust-committee-heading"
          className="section-title text-2xl md:text-3xl font-bold"
        >
          🏛️ {tr.title}
        </h2>
        <p className="text-center -mt-4 mb-8 text-sm" style={{ color: "#6B5B4B" }}>
          {tr.subtitle}
        </p>

        {members.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                roleLabel={tr[m.role]}
                tr={tr}
                language={language}
              />
            ))}
          </div>
        ) : (
          showPendingNotice && (
            <div
              className="max-w-2xl mx-auto text-center rounded-2xl px-6 py-10"
              style={{
                backgroundColor: "#FFFFFF",
                border: "2px dashed rgba(212,175,55,0.7)",
              }}
            >
              <div className="text-4xl mb-3" aria-hidden="true">
                📋
              </div>
              <p
                className="text-sm sm:text-base leading-relaxed mb-6"
                style={{ color: "#4A3728" }}
              >
                {tr.pendingNotice}
              </p>
              <ul className="flex flex-wrap justify-center gap-2">
                {[tr.president, tr.vicePresident, tr.secretary, tr.treasurer].map((role) => (
                  <li
                    key={role}
                    className="text-xs font-bold px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "var(--cream)", color: "var(--maroon)", border: "1px solid rgba(212,175,55,0.5)" }}
                  >
                    {role}
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
    </section>
  );
}

export default TrustCommittee;
