import type { Variants, Transition } from 'framer-motion';

/**
 * Standard Spring Physics Presets
 */
export const springSmooth: Transition = {
  type: 'spring',
  damping: 26,
  stiffness: 320,
};

export const springQuick: Transition = {
  type: 'spring',
  damping: 22,
  stiffness: 400,
};

export const springBouncy: Transition = {
  type: 'spring',
  damping: 18,
  stiffness: 300,
};

/**
 * Reusable Motion Variants
 */

// 1. Simple Fade In / Out
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// 2. Slide Up and Fade In (Pages, Cards, Drawers)
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: springSmooth },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// 3. Modal Backdrop & Card Pop-In
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

export const modalCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springSmooth },
  exit: { opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.15 } },
};

// 4. Staggered List Container & Items (Action queue rows, review cards)
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springSmooth },
};

// 5. Accordion Expand & Collapse
export const accordionVariants: Variants = {
  collapsed: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
    transition: { duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] },
  },
  expanded: {
    opacity: 1,
    height: 'auto',
    overflow: 'visible',
    transition: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] },
  },
};
