"use client";

import React from "react";

export function AmbientBackground({ primary, alt }: { primary: string; alt: string }) {
  const [showAlt, setShowAlt] = React.useState(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      // 35–50 s s jemnou náhodou
      const delay = 35_000 + Math.random() * 15_000;
      timer = setTimeout(() => {
        setShowAlt((prev) => !prev);
        schedule();
      }, delay);
    }
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{ background: primary, transition: "opacity 6s ease-in-out", opacity: showAlt ? 0 : 1 }}
      />
      <div
        className="fixed inset-0 -z-10"
        style={{ background: alt, transition: "opacity 6s ease-in-out", opacity: showAlt ? 1 : 0 }}
      />
    </>
  );
}
