"use client";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/** Cinematic scroll-reveal wrapper. Respects reduced motion. */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
  once = true,
  blur = false,
  scale = false,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
  blur?: boolean;
  scale?: boolean;
}) {
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: reduce ? 0 : y,
      ...(blur && !reduce ? { filter: "blur(10px)" } : {}),
      ...(scale && !reduce ? { scale: 0.95 } : {}),
    },
    show: {
      opacity: 1, y: 0,
      filter: "blur(0px)",
      scale: 1,
      transition: { duration: blur ? 0.9 : 0.7, ease: [0.16, 1, 0.3, 1], delay },
    },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container for grids. */
export function RevealGroup({ children, className, stagger = 0.08 }: { children: ReactNode; className?: string; stagger?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, y = 26 }: { children: ReactNode; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : y },
        show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
