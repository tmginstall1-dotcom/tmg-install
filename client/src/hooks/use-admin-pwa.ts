import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const DISMISSED_KEY = "tmg_admin_pwa_dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function useAdminManifest() {
  const [location] = useLocation();

  useEffect(() => {
    const isAdmin = location.startsWith("/admin") && location !== "/admin/login";
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;

    if (isAdmin) {
      link.setAttribute("href", "/manifest-admin.json");
    } else {
      link.setAttribute("href", "/manifest.json");
    }

    return () => {
      link.setAttribute("href", "/manifest.json");
    };
  }, [location]);
}

export function useAdminInstallPrompt() {
  const [show, setShow] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    if (!location.startsWith("/admin") || location === "/admin/login") return;
    if (isInStandaloneMode()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (!isIos()) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, [location]);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  return { show, dismiss, isIos: isIos() };
}
