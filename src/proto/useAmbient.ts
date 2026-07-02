import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ambient "attract mode" for interactive assets: the asset demos itself until
 * the reader interacts, then yields control; after `idleMs` without any
 * interaction it eases back into the self-demo.
 *
 * Guardrails: paused while the embed is offscreen (IntersectionObserver works
 * against the top-level viewport even in cross-origin iframes), and disabled
 * entirely under prefers-reduced-motion.
 */
export function useAmbient(idleMs = 9000) {
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;
  const [engaged, setEngaged] = useState(false);
  const [visible, setVisible] = useState(true);
  const timer = useRef(0);

  const notifyInteraction = useCallback(() => {
    setEngaged(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setEngaged(false), idleMs);
  }, [idleMs]);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(document.documentElement);
    return () => {
      io.disconnect();
      window.clearTimeout(timer.current);
    };
  }, []);

  return { ambient: !reduced && visible && !engaged, notifyInteraction };
}
