/** The closed passport: a navy booklet with a gilt globe on the cover. A cut-out, so it takes a CSS drop shadow. */
export default function PassportBook() {
  return (
    <svg className="passport-book" viewBox="0 0 60 80" aria-hidden="true">
      {/* The page block, just showing along the fore edge and the foot. */}
      <rect x="6" y="5" width="51" height="72" rx="4" fill="#f0e9d6" stroke="#b7ab8d" />
      <rect x="3" y="3" width="51" height="72" rx="4" fill="#1b2f63" stroke="#0f1c40" strokeWidth="1.5" />
      <path d="M9 3v72" stroke="#0f1c40" strokeWidth="1.2" opacity="0.6" />
      <g fill="none" stroke="#e9c15a" strokeWidth="1.6">
        <circle cx="31" cy="34" r="12" />
        <ellipse cx="31" cy="34" rx="5" ry="12" />
        <path d="M19 34h24M21 27.5h20M21 40.5h20" />
      </g>
      <g fill="#e9c15a">
        <rect x="17" y="12" width="28" height="3" rx="1" />
        <rect x="20" y="56" width="22" height="2.4" rx="1" />
        <rect x="24" y="62" width="14" height="2.4" rx="1" />
      </g>
    </svg>
  );
}
