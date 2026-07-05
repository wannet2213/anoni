"use client";

import { useEffect, useRef, useState } from "react";

export default function ScrollReveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
        visible
          ? "opacity-100 translate-y-0 blur-0"
          : "opacity-0 translate-y-16 blur-md"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
