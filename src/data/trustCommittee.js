/**
 * Trust Committee roster.
 *
 * DESIGN RULES (per the brief)
 * - No personal detail, bio, qualification, achievement or designation is invented.
 * - Only entries with `published: true` are rendered on the site.
 * - Contact numbers/addresses are only rendered when explicitly marked
 *   `publicContact: true` (approval for public display).
 *
 * TO ADD A MEMBER
 * 1. Set `name`, `nameEn`, `nameGu` and `designation`.
 * 2. Add `photo` (drop the file in `public/assets/`) — `null` renders a silhouette.
 * 3. Optionally add `bio` / `bioEn` / `bioGu` and `videoUrl`.
 * 4. Flip `published` to true.
 *
 * The roles below are pre-created and left unpublished, so the moment you send
 * the verified details each card fills in without any code change.
 */

export const TRUST_ROLES = {
  president: "president",
  vicePresident: "vicePresident",
  secretary: "secretary",
  treasurer: "treasurer",
  member: "member",
};

export const TRUST_COMMITTEE = [
  {
    id: "president",
    role: TRUST_ROLES.president,
    order: 1,
    published: false,
    name: "", // <-- CONFIRM from the ID card
    nameEn: "",
    nameGu: "",
    designation: "", // <-- CONFIRM printed title
    photo: null, // e.g. "/assets/trust/president.jpg"
    bio: "", // <-- APPROVED BIO ONLY
    bioEn: "",
    bioGu: "",
    videoUrl: "", // optional introduction video
    phone: "", // only shown when publicContact is true
    publicContact: false,
  },
  {
    id: "vice-president",
    role: TRUST_ROLES.vicePresident,
    order: 2,
    published: false,
    name: "",
    nameEn: "",
    nameGu: "",
    designation: "",
    photo: null,
    bio: "",
    bioEn: "",
    bioGu: "",
    videoUrl: "",
    phone: "",
    publicContact: false,
  },
  {
    id: "secretary",
    role: TRUST_ROLES.secretary,
    order: 3,
    published: false,
    name: "",
    nameEn: "",
    nameGu: "",
    designation: "",
    photo: null,
    bio: "",
    bioEn: "",
    bioGu: "",
    videoUrl: "",
    phone: "",
    publicContact: false,
  },
  {
    id: "treasurer",
    role: TRUST_ROLES.treasurer,
    order: 4,
    published: false,
    name: "",
    nameEn: "",
    nameGu: "",
    designation: "",
    photo: null,
    bio: "",
    bioEn: "",
    bioGu: "",
    videoUrl: "",
    phone: "",
    publicContact: false,
  },
];

/** Only these appear on the live site. */
export const publishedCommittee = () =>
  TRUST_COMMITTEE.filter((m) => m.published).sort((a, b) => a.order - b.order);

export default TRUST_COMMITTEE;
