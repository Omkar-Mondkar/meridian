import React from "react";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 36, className = "" }: BrandLogoProps) {
  return (
    <div
      className={`brand-logo-wrap ${className}`}
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          {/* Background Squircle Gradient */}
          <linearGradient id="logoBg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1C2436" />
            <stop offset="100%" stopColor="#0B0F19" />
          </linearGradient>

          {/* Golden Solar Gradient for Meridian M */}
          <linearGradient id="meridianGold" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFE072" />
            <stop offset="40%" stopColor="#FFB020" />
            <stop offset="100%" stopColor="#FF6B35" />
          </linearGradient>

          {/* Cyan High-Tech Accent */}
          <linearGradient id="meridianCyan" x1="8" y1="28" x2="28" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4FD9D0" />
            <stop offset="100%" stopColor="#2BB8B0" />
          </linearGradient>

          {/* Radial Core Glow */}
          <radialGradient id="coreGlow" cx="18" cy="18" r="8" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFB020" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FFB020" stopOpacity="0" />
          </radialGradient>

          {/* Border Stroke Gradient */}
          <linearGradient id="borderGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255, 176, 32, 0.6)" />
            <stop offset="50%" stopColor="rgba(255, 255, 255, 0.15)" />
            <stop offset="100%" stopColor="rgba(79, 217, 208, 0.4)" />
          </linearGradient>

          {/* Filter for subtle glow */}
          <filter id="logoGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#FFB020" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Squircle Base Frame */}
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="9"
          fill="url(#logoBg)"
          stroke="url(#borderGrad)"
          strokeWidth="1.2"
        />

        {/* Ambient Telemetry Core Glow */}
        <circle cx="18" cy="18" r="6" fill="url(#coreGlow)" />

        {/* Outer Celestial Meridian Arc (Tilted Latitude Ring) */}
        <ellipse
          cx="18"
          cy="18"
          rx="12"
          ry="5.5"
          transform="rotate(-26 18 18)"
          stroke="rgba(79, 217, 208, 0.35)"
          strokeWidth="1"
          strokeDasharray="1.5 2.5"
        />

        {/* Equatorial Longitude Arc */}
        <path
          d="M 8 18 C 8 11.5 12.5 7 18 7 C 23.5 7 28 11.5 28 18"
          stroke="url(#meridianCyan)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Precision Meridian "M" Crest / Trading Vertex Wings */}
        <path
          d="M 9.5 25.5 L 9.5 13.5 L 18 21.5 L 26.5 13.5 L 26.5 25.5"
          stroke="url(#meridianGold)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#logoGlow)"
        />

        {/* Inner Precision Diamond Nexus */}
        <path
          d="M 18 10.5 L 21 14.5 L 18 18.5 L 15 14.5 Z"
          fill="url(#meridianGold)"
          opacity="0.95"
        />

        {/* Center Real-Time Signal Pulse */}
        <circle cx="18" cy="14.5" r="1.2" fill="#FFFFFF" />

        {/* Bottom Horizon Base Ticks */}
        <line x1="13" y1="26" x2="23" y2="26" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" strokeLinecap="round" />
        <circle cx="18" cy="26" r="1" fill="#4FD9D0" />
      </svg>
    </div>
  );
}
