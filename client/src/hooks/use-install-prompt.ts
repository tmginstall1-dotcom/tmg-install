import { useState, useEffect } from "react";

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pwa-dismissed") === "1");

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const dismiss = () => {
    sessionStorage.setItem("pwa-dismissed", "1");
    setDismissed(true);
  };

  const ua = navigator.userAgent;
  const isIOS     = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
  const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
  const isAndroid = /android/i.test(ua);

  // iOS Safari: needs manual share-sheet steps
  const showIOSGuide     = isIOS && isSafari && !installed;
  // Android Chrome / other browsers: native 1-click prompt available
  const canNativeInstall = !!prompt;

  const showBanner = !installed && !dismissed && (canNativeInstall || showIOSGuide);

  return { prompt, installed, dismissed, install, dismiss, showIOSGuide, canNativeInstall, showBanner, isIOS, isAndroid };
}
