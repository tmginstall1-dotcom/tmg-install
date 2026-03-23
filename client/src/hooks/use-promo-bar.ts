import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export interface PromoBarData {
  active: boolean;
  code: string;
  discount: number;
  maxUses: number;
  usesCount: number;
  remaining: number;
}

export function usePromoBar() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("promo_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const { data: promo } = useQuery<PromoBarData>({
    queryKey: ["/api/promo-bar"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const visible = !dismissed && (promo?.active ?? false) && (promo?.remaining ?? 1) > 0;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem("promo_dismissed", "1");
    } catch {
      // ignore
    }
  }

  return { visible, promo, dismiss };
}
