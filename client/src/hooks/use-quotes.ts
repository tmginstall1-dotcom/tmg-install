import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type QuoteRequest } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

const TERMINAL_STATUSES = ['closed', 'cancelled'];
const PAYMENT_PENDING_STATUSES = ['deposit_requested', 'final_payment_requested'];

export function useQuotes(statusFilter?: string) {
  return useQuery({
    queryKey: [api.quotes.list.path, statusFilter],
    queryFn: async () => {
      const url = new URL(api.quotes.list.path, window.location.origin);
      if (statusFilter && statusFilter !== 'all') {
        url.searchParams.append('status', statusFilter);
      }
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    refetchInterval: (query) => {
      const data: any[] = query.state.data ?? [];
      const hasPaymentPending = Array.isArray(data) && data.some((q: any) => PAYMENT_PENDING_STATUSES.includes(q.status));
      if (hasPaymentPending) return 5_000;
      return 30_000;
    },
  });
}

export function useSchedule() {
  return useQuery({
    queryKey: ['/api/quotes/schedule'],
    queryFn: async () => {
      const res = await fetch('/api/quotes/schedule', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json() as Promise<{ pending: any[]; confirmed: any[] }>;
    },
    refetchInterval: 30_000,
  });
}

export function useQuote(id: string | number) {
  return useQuery({
    queryKey: [api.quotes.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.quotes.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch quote");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || TERMINAL_STATUSES.includes(data.status)) return false;
      if (PAYMENT_PENDING_STATUSES.includes(data.status)) return 5_000;
      return 15_000;
    },
  });
}

export function useCreateQuoteRequest() {
  return useMutation({
    mutationFn: async (data: QuoteRequest) => {
      const res = await fetch(api.quotes.createFromCustomer.path, {
        method: api.quotes.createFromCustomer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to submit request");
      }
      return res.json();
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number | string; status: string; note?: string; photoUrl?: string; assignedStaffId?: number; assignedTeamId?: number }) => {
      const url = buildUrl(api.quotes.updateStatus.path, { id });
      const res = await fetch(url, {
        method: api.quotes.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/schedule'] });
    },
  });
}

export function useUpdateQuotePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentType, amount }: { id: number | string; paymentType: 'deposit' | 'final'; amount: string }) => {
      const url = buildUrl(api.quotes.updatePayment.path, { id });
      const res = await fetch(url, {
        method: api.quotes.updatePayment.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType, amount }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Payment failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}

export function useRequestBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt, timeWindow }: { id: number | string; scheduledAt: string; timeWindow: string }) => {
      const res = await fetch(`/api/quotes/${id}/booking-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, timeWindow }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Booking request failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/schedule'] });
    },
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => {
      const res = await fetch(`/api/quotes/${id}/booking-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to confirm booking");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, data.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes/schedule'] });
    },
  });
}

export function useRescheduleBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt, timeWindow }: { id: number | string; scheduledAt: string; timeWindow: string }) => {
      const res = await fetch(`/api/quotes/${id}/booking-reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, timeWindow }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Reschedule failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}

export function useStaffArrived() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gpsLat, gpsLng, photoUrls, note }: { id: number | string; gpsLat: number; gpsLng: number; photoUrls: string[]; note?: string }) => {
      const res = await fetch(`/api/quotes/${id}/arrived`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gpsLat, gpsLng, photoUrls, note }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Check-in failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/quotes'] });
    },
  });
}

export function useStaffCompleted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gpsLat, gpsLng, photoUrls, note }: { id: number | string; gpsLat: number; gpsLng: number; photoUrls: string[]; note?: string }) => {
      const res = await fetch(`/api/quotes/${id}/completed-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gpsLat, gpsLng, photoUrls, note }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Check-out failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
      queryClient.invalidateQueries({ queryKey: ['/api/staff/quotes'] });
    },
  });
}

export function useEditQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number | string; customerUpdates?: any; quoteUpdates?: any; items?: any[] }) => {
      const res = await fetch(`/api/quotes/${id}/edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to edit quote");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, data.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}

export function useRequestFinalPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => {
      const res = await fetch(`/api/quotes/${id}/request-final-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to request final payment");
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}

export function useCloseQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number | string; reason?: string }) => {
      const res = await fetch(`/api/quotes/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to close case");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, data.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}

// Blocked Slots
export function useBlockedSlots() {
  return useQuery<{ id: number; date: string; timeSlot: string | null; reason: string | null }[]>({
    queryKey: ["/api/blocked-slots"],
    staleTime: 30_000,
  });
}

export function useCreateBlockedSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { date: string; timeSlot?: string | null; reason?: string }) => {
      const res = await apiRequest("POST", "/api/admin/blocked-slots", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/blocked-slots"] }),
  });
}

export function useDeleteBlockedSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/blocked-slots/${id}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/blocked-slots"] }),
  });
}

// Keep for backward compatibility
export function useUpdateQuoteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt, timeWindow }: { id: number | string; scheduledAt: string; timeWindow: string }) => {
      const res = await fetch(`/api/quotes/${id}/booking-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, timeWindow }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Booking failed");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}
