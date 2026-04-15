"use client";

import React from "react";

type BrandLogoVariant = "hero" | "nav";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  onClick?: () => void;
}

export default function BrandLogo({
  variant = "nav",
  className = "",
  onClick,
}: BrandLogoProps) {
  const isHero = variant === "hero";
  const rootClassName = [
    "brand-logo",
    isHero ? "brand-logo--hero" : "brand-logo--nav",
    onClick ? "cursor-pointer" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} onClick={onClick}>
      <span className="brand-logo__wordmark">
        <span className="brand-logo__pay">Pay</span>
        <span className="brand-logo__to">To</span>
        <span className="brand-logo__win">Win</span>
        <span className="brand-logo__tld">.cz</span>
      </span>
    </div>
  );
}
