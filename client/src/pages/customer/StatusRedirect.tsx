import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function StatusRedirect() {
  const { refNo } = useParams<{ refNo: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!refNo) return;
    fetch(`/api/quotes/by-ref/${encodeURIComponent(refNo)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) {
          setLocation(`/quotes/${data.id}`, { replace: true });
        } else {
          setLocation("/", { replace: true });
        }
      })
      .catch(() => setLocation("/", { replace: true }));
  }, [refNo, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Redirecting to your quote...</p>
    </div>
  );
}
