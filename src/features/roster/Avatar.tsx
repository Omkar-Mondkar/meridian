import React from "react";

interface AvatarProps {
  gender: "f" | "m";
  variant?: "standard" | "formal" | "executive";
  size?: number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Standard silhouettes (Casual / Shift Members)
───────────────────────────────────────────────────────────────────────────── */

function StandardMale({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="avatar"
      viewBox="0 0 38 38"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle cx={19} cy={19} r={19} fill="rgba(255,176,32,.12)" />
      <circle cx={19} cy={15} r={7} fill="#FFB020" />
      <path d="M6 34c0-8 6-13 13-13s13 5 13 13" fill="#FFB020" opacity={0.55} />
      <path
        d="M12 11c2-3 5-3 7-3s5 0 7 3c0-4-3-7-7-7s-7 3-7 7z"
        fill="#0B0E14"
        opacity={0.35}
      />
    </svg>
  );
}

function StandardFemale({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="avatar"
      viewBox="0 0 38 38"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle cx={19} cy={19} r={19} fill="rgba(201,79,217,.12)" />
      <circle cx={19} cy={15} r={7} fill="#c94fd9" />
      <path
        d="M6 34c0-8 6-13 13-13s13 5 13 13"
        fill="#c94fd9"
        opacity={0.55}
      />
      <path
        d="M11 12c0-6 4-9 8-9s8 3 8 9c0 2-1 3-1 3l-1-4-4 2-4-2-4 2-1-2z"
        fill="#0B0E14"
        opacity={0.35}
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Formal Attire — Tailored Suit & Blazer (Team Leader)
───────────────────────────────────────────────────────────────────────────── */

function FormalMale({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="avatar avatar-formal"
      viewBox="0 0 38 38"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* Background with cyan/amber operational accent */}
      <circle cx={19} cy={19} r={19} fill="rgba(79,217,208,.15)" />
      <circle
        cx={19}
        cy={19}
        r={18}
        fill="none"
        stroke="rgba(79,217,208,.3)"
        strokeWidth={1}
      />

      {/* Hair */}
      <path
        d="M12 11C12 5 26 5 26 11"
        fill="#0B0E14"
        opacity={0.35}
      />

      {/* Head */}
      <circle cx={19} cy={13.5} r={6.5} fill="#4FD9D0" />

      {/* Tailored Navy Suit Jacket */}
      <path
        d="M6 38 C6 25 13 21 19 21 C25 21 32 25 32 38 Z"
        fill="#141E33"
      />

      {/* White dress-shirt V */}
      <polygon points="19,21 15.5,29 22.5,29" fill="#E9EBEF" />
      <rect x={17.5} y={28} width={3} height={10} fill="#E9EBEF" />

      {/* Left Suit Lapel */}
      <path d="M6 38 L16 38 L16 23 L11 26 Z" fill="#1E2C48" />
      {/* Right Suit Lapel */}
      <path d="M32 38 L22 38 L22 23 L27 26 Z" fill="#1E2C48" />

      {/* Tie — Amber */}
      <polygon points="19,22 20.5,27 19,34 17.5,27" fill="#FFB020" />
      <polygon points="18.5,22 19.5,22 19.5,24 18.5,24" fill="#E09200" />
    </svg>
  );
}

function FormalFemale({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="avatar avatar-formal"
      viewBox="0 0 38 38"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* Background with cyan/magenta operational accent */}
      <circle cx={19} cy={19} r={19} fill="rgba(79,217,208,.15)" />
      <circle
        cx={19}
        cy={19}
        r={18}
        fill="none"
        stroke="rgba(79,217,208,.3)"
        strokeWidth={1}
      />

      {/* Hair styling */}
      <ellipse cx={19} cy={12} rx={8} ry={8.5} fill="#0B0E14" opacity={0.3} />

      {/* Head */}
      <circle cx={19} cy={13.5} r={6.5} fill="#4FD9D0" />

      {/* Tailored Indigo/Navy Blazer */}
      <path
        d="M6 38 C6 25 13 21 19 21 C25 21 32 25 32 38 Z"
        fill="#1C1838"
      />

      {/* Formal Light Blouse V */}
      <polygon points="19,21 14.5,29 23.5,29" fill="#E6EEF8" />
      <rect x={17.5} y={28} width={3} height={10} fill="#E6EEF8" />

      {/* Left Blazer Lapel */}
      <path d="M6 38 L16.5 38 L16.5 22.5 L11 25.5 Z" fill="#28224E" />
      {/* Right Blazer Lapel */}
      <path d="M32 38 L21.5 38 L21.5 22.5 L27 25.5 Z" fill="#28224E" />

      {/* Formal Collar Accent */}
      <path d="M14 23 L16.5 27 L19 23.5 L21.5 27 L24 23" fill="none" stroke="#4FD9D0" strokeWidth={0.8} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Executive Attire — Dark Formal Suit + Gold Pin (Principal)
───────────────────────────────────────────────────────────────────────────── */

function ExecutiveMale({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="avatar avatar-executive"
      viewBox="0 0 38 38"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* Executive Gold/Amber Halo Glow */}
      <circle cx={19} cy={19} r={19} fill="rgba(255,176,32,.2)" />
      <circle
        cx={19}
        cy={19}
        r={18}
        fill="none"
        stroke="rgba(255,176,32,.55)"
        strokeWidth={1.2}
      />

      {/* Hair */}
      <path d="M12 11C12 5 26 5 26 11" fill="#0B0E14" opacity={0.35} />

      {/* Head */}
      <circle cx={19} cy={13.5} r={6.5} fill="#FFB020" />

      {/* Charcoal Executive Suit */}
      <path
        d="M6 38 C6 25 13 21 19 21 C25 21 32 25 32 38 Z"
        fill="#0E1626"
      />

      {/* Crisp White Shirt V-Neck */}
      <polygon points="19,21 15.5,28 22.5,28" fill="#F0F3F8" />
      <rect x={17.5} y={27.5} width={3} height={11} fill="#F0F3F8" />

      {/* Left Suit Panel */}
      <path d="M6 38 L16.5 38 L16.5 22.5 L11 25.5 Z" fill="#18233C" />
      {/* Right Suit Panel */}
      <path d="M32 38 L21.5 38 L21.5 22.5 L27 25.5 Z" fill="#18233C" />

      {/* Formal Silk Amber Tie with knot */}
      <polygon points="18.5,22 19.5,22 20,24 18,24" fill="#D4920C" />
      <polygon points="19,23.5 20.5,28 19,35 17.5,28" fill="#FFB020" />

      {/* Executive Gold Lapel Pin */}
      <circle cx={13} cy={27.5} r={1.6} fill="#FFD700" />
      <circle cx={13} cy={27.5} r={0.8} fill="#B8860B" />
    </svg>
  );
}

function ExecutiveFemale({ size = 38 }: { size?: number }) {
  return (
    <svg
      className="avatar avatar-executive"
      viewBox="0 0 38 38"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {/* Executive Purple/Gold Halo Glow */}
      <circle cx={19} cy={19} r={19} fill="rgba(255,176,32,.2)" />
      <circle
        cx={19}
        cy={19}
        r={18}
        fill="none"
        stroke="rgba(255,176,32,.55)"
        strokeWidth={1.2}
      />

      {/* Hair styling */}
      <ellipse cx={19} cy={12} rx={8.2} ry={9} fill="#0B0E14" opacity={0.32} />

      {/* Head */}
      <circle cx={19} cy={13.5} r={6.5} fill="#FFB020" />

      {/* Deep Midnight Charcoal Executive Blazer */}
      <path
        d="M6 38 C6 25 13 21 19 21 C25 21 32 25 32 38 Z"
        fill="#120E24"
      />

      {/* Ivory Silk Blouse */}
      <polygon points="19,21 14.5,28 23.5,28" fill="#F5F0FF" />
      <rect x={17.5} y={27.5} width={3} height={11} fill="#F5F0FF" />

      {/* Left Blazer Panel */}
      <path d="M6 38 L16.5 38 L16.5 22.5 L11.5 25.5 Z" fill="#20183E" />
      {/* Right Blazer Panel */}
      <path d="M32 38 L21.5 38 L21.5 22.5 L26.5 25.5 Z" fill="#20183E" />

      {/* Gold Executive Brooch / Star Pin on left lapel */}
      <circle cx={13} cy={27.5} r={1.8} fill="#FFD700" />
      <circle cx={13} cy={27.5} r={0.9} fill="#B8860B" />
      <line x1={13} y1={25.2} x2={13} y2={29.8} stroke="#FFF5B0" strokeWidth={0.5} />
      <line x1={10.7} y1={27.5} x2={15.3} y2={27.5} stroke="#FFF5B0" strokeWidth={0.5} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Public Avatar Component
───────────────────────────────────────────────────────────────────────────── */

export function Avatar({ gender, variant = "standard", size = 38 }: AvatarProps) {
  if (variant === "executive") {
    return gender === "f" ? <ExecutiveFemale size={size} /> : <ExecutiveMale size={size} />;
  }
  if (variant === "formal") {
    return gender === "f" ? <FormalFemale size={size} /> : <FormalMale size={size} />;
  }
  return gender === "f" ? <StandardFemale size={size} /> : <StandardMale size={size} />;
}
