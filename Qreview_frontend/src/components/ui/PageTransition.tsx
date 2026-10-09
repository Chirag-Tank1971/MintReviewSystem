import React from 'react';
import { m } from '../../animations';

interface PageTransitionProps {
  children: React.ReactNode;
  viewKey: string;
  className?: string;
}

/**
 * GPU-accelerated page entrance container with spring physics.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  viewKey,
  className = '',
}) => {
  return (
    <m.div
      key={viewKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full min-h-full ${className}`}
    >
      {children}
    </m.div>
  );
};
