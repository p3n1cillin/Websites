"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Direction the element travels from. */
  from?: "up" | "down" | "left" | "right" | "none";
  className?: string;
  /** Render as a different element if needed. */
  as?: "div" | "section" | "li" | "article";
}

const OFFSET = 28;

export default function Reveal({
  children,
  delay = 0,
  from = "up",
  className,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();

  const initialOffset = reduce
    ? {}
    : {
        up: { y: OFFSET },
        down: { y: -OFFSET },
        left: { x: OFFSET },
        right: { x: -OFFSET },
        none: {},
      }[from];

  const MotionTag = motion[as];

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, ...initialOffset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}
