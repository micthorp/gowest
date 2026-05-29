export function HeroBanner() {
  return (
    <div className="hero">
      <div className="hero-left" />
      <div className="hero-right" />

      {/* American stars */}
      <div className="hero-stars">
        {Array.from({ length: 15 }).map((_, i) => (
          <span key={i} className="star">★</span>
        ))}
      </div>

      <div className="hero-sun" />

      {/* Rays */}
      <svg className="hero-rays" viewBox="0 0 400 152" preserveAspectRatio="xMidYMid meet">
        <g opacity="0.18" stroke="#d4a017" strokeWidth="1">
          {[0,33,66,100,133,166,200,233,266,300,333,366,400].map((x, i) => (
            <line key={i} x1="200" y1="182" x2={x} y2="0" />
          ))}
        </g>
      </svg>

      <div className="hero-divide" />
      <div className="hero-wordmark">Go West</div>

      <svg
        className="hero-icons"
        viewBox="0 0 400 152"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* HAMMER & SICKLE — left */}
        <g transform="translate(28, 58)" opacity="0.92">
          <path d="M26 0 C14 -2, 2 8, 4 20 C5 26, 10 30, 16 28 C12 25, 10 19, 12 14 C14 9, 21 6, 26 8 Z" fill="#d4a017" />
          <rect x="13" y="24" width="3.5" height="13" rx="1.5" transform="rotate(42 13 24)" fill="#d4a017" />
          <rect x="20" y="8" width="14" height="7" rx="1.5" transform="rotate(-38 20 8)" fill="#d4a017" />
          <rect x="28" y="12" width="3" height="17" rx="1.2" transform="rotate(-38 28 12)" fill="#d4a017" />
        </g>

        {/* MARCHING FIGURES */}
        <g fill="#5a0000" opacity="0.88">
          <ellipse cx="148" cy="108" rx="6" ry="6.5" />
          <rect x="144" y="114" width="8" height="15" rx="2" />
          <rect x="142" y="129" width="5" height="17" rx="2" />
          <rect x="149" y="129" width="5" height="17" rx="2" />
          <rect x="152" y="108" width="20" height="4" rx="2" transform="rotate(-18 152 108)" />
          <rect x="135" y="118" width="9" height="3.5" rx="2" />
        </g>
        <g fill="#5a0000" opacity="0.72">
          <ellipse cx="172" cy="111" rx="5.5" ry="6" />
          <rect x="168" y="117" width="8" height="14" rx="2" />
          <rect x="166" y="131" width="5" height="15" rx="2" />
          <rect x="172" y="131" width="5" height="15" rx="2" />
          <rect x="160" y="117" width="8" height="3.5" rx="2" transform="rotate(10 160 117)" />
          <rect x="176" y="121" width="8" height="3.5" rx="2" transform="rotate(-8 176 121)" />
        </g>
        <g fill="#5a0000" opacity="0.55">
          <ellipse cx="193" cy="114" rx="4.5" ry="5" />
          <rect x="189" y="119" width="7" height="12" rx="2" />
          <rect x="188" y="131" width="4" height="14" rx="2" />
          <rect x="193" y="131" width="4" height="14" rx="2" />
        </g>
        <g fill="#5a0000" opacity="0.38">
          <ellipse cx="210" cy="117" rx="3.8" ry="4.2" />
          <rect x="207" y="121" width="6" height="11" rx="2" />
          <rect x="206" y="132" width="4" height="13" rx="2" />
          <rect x="210" y="132" width="4" height="13" rx="2" />
        </g>
        <g fill="#5a0000" opacity="0.2">
          <ellipse cx="224" cy="120" rx="3" ry="3.5" />
          <rect x="221" y="123" width="5" height="10" rx="2" />
          <rect x="220" y="133" width="3.5" height="12" rx="2" />
          <rect x="223" y="133" width="3.5" height="12" rx="2" />
        </g>

        {/* STATUE OF LIBERTY — right */}
        <g transform="translate(308, 40)" fill="#b0c8e8" opacity="0.72">
          <polygon points="22,0 19,12 25,12" />
          <polygon points="28,2 24,13 30,13" />
          <polygon points="16,2 13,13 19,13" />
          <polygon points="34,6 29,15 35,15" />
          <polygon points="10,6 8,15 14,15" />
          <ellipse cx="22" cy="19" rx="8" ry="9" />
          <rect x="30" y="8" width="3.5" height="18" rx="1.5" transform="rotate(18 30 8)" />
          <ellipse cx="40" cy="6" rx="3" ry="5" fill="#d4a017" opacity="1" />
          <rect x="14" y="27" width="16" height="26" rx="3" />
          <rect x="4" y="32" width="12" height="8" rx="1.5" transform="rotate(-15 4 32)" />
          <rect x="11" y="52" width="22" height="8" rx="1" />
          <rect x="8" y="59" width="28" height="7" rx="1" />
          <rect x="5" y="65" width="34" height="6" rx="1" />
        </g>
      </svg>

      <div className="hero-stripe-left" />
      <div className="hero-stripe-right" />
      <div className="hero-stripe-center" />
    </div>
  )
}
