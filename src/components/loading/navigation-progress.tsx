"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const navigationStartEvent = "techspd:navigation-start";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const initialized = useRef(false);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setProgress(100);
    timers.current.push(
      window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220),
    );
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setProgress(14);
    timers.current.push(
      window.setTimeout(() => setProgress(42), 120),
      window.setTimeout(() => setProgress(68), 420),
      window.setTimeout(() => setProgress(82), 1000),
      window.setTimeout(finish, 12000),
    );
  }, [clearTimers, finish]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    finish();
  }, [finish, pathname, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;

      if (!anchor || anchor.target || anchor.download) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (
        destination.origin !== current.origin ||
        (destination.pathname === current.pathname &&
          destination.search === current.search)
      ) {
        return;
      }

      start();
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target;

      if (form instanceof HTMLFormElement && form.method.toLowerCase() === "get") {
        start();
      }
    }

    window.addEventListener(navigationStartEvent, start);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("popstate", start);

    return () => {
      clearTimers();
      window.removeEventListener(navigationStartEvent, start);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("popstate", start);
    };
  }, [clearTimers, start]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-label="Page loading"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={progress}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-primary/10"
      role="progressbar"
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_rgba(36,87,214,0.7)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export function announceNavigationStart() {
  window.dispatchEvent(new Event(navigationStartEvent));
}
