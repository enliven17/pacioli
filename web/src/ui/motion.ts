import { useEffect, useRef, useState } from "react";

/**
 * Reveals every `[data-reveal]` element the first time it scrolls into view.
 * `data-reveal="up" | "left" | "right" | "scale"` picks the entrance, and
 * `style={{ "--delay": "120ms" }}` staggers siblings. Without JS or with
 * reduced motion, everything is simply visible.
 */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    const watch = () =>
      document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => observer.observe(el));
    watch();
    // Content rendered later (async data) is picked up too.
    const mutations = new MutationObserver(watch);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
}

/** True once the element has been at least `threshold` visible. */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Writes page scroll progress (0..1) to `--scroll` on <html>, for progress bars and parallax. */
export function useScrollVars() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      document.documentElement.style.setProperty("--scroll", String(max > 0 ? scrollY / max : 0));
      document.documentElement.style.setProperty("--scroll-y", `${scrollY}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
}
