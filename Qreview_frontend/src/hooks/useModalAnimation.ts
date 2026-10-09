import { useState, useEffect, useRef, useCallback } from 'react';

interface UseModalAnimationOptions {
  isOpen?: boolean;
  onClose: () => void;
  duration?: number;
}

/**
 * Custom hook to coordinate smooth enter & exit animations for modals and drawers.
 * Automatically delays unmounting / parent onClose until the exit animation finishes (~180ms).
 */
export function useModalAnimation({
  isOpen = true,
  onClose,
  duration = 180,
}: UseModalAnimationOptions) {
  const [isClosing, setIsClosing] = useState(false);
  const [isMounted, setIsMounted] = useState(isOpen);
  const prevIsOpenRef = useRef(isOpen);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track parent-initiated isOpen transitions (e.g. if parent turns isOpen from true to false externally)
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      // Opening transition
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setIsMounted(true);
      setIsClosing(false);
    } else if (wasOpen && !isOpen) {
      // Parent changed isOpen to false directly
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      setIsClosing(true);
      closeTimeoutRef.current = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
      }, duration);
    }
  }, [isOpen, duration]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
      onCloseRef.current();
    }, duration);
  }, [isClosing, duration]);


  return {
    isMounted,
    isClosing,
    handleClose,
    backdropClass: isClosing ? 'modal-backdrop-exit' : 'modal-backdrop-enter',
    cardClass: isClosing ? 'modal-card-exit' : 'modal-card-enter',
    drawerRightClass: isClosing ? 'drawer-right-exit' : 'drawer-right-enter',
    drawerLeftClass: isClosing ? 'drawer-left-exit' : 'drawer-left-enter',
  };
}
