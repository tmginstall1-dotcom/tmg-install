import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type QuoteRequest } from "@shared/routes";

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
      return res.json(); // Array of QuoteResponse
    },
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
      return res.json(); // QuoteResponse
    },
    enabled: !!id,
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
    mutationFn: async ({ id, ...data }: { id: number | string, status: string, note?: string, photoUrl?: string, assignedStaffId?: number }) => {
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
    },
  });
}

export function useUpdateQuotePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paymentType, amount }: { id: number | string, paymentType: 'deposit'|'final', amount: string }) => {
      const url = buildUrl(api.quotes.updatePayment.path, { id });
      const res = await fetch(url, {
        method: api.quotes.updatePayment.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType, amount }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Payment failed");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.quotes.get.path, variables.id] });
      queryClient.invalidateQueries({ queryKey: [api.quotes.list.path] });
    },
  });
}

export function useUpdateQuoteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt, timeWindow }: { id: number | string, scheduledAt: string, timeWindow: string }) => {
      const url = buildUrl(api.quotes.updateBooking.path, { id });
      const res = await fetch(url, {
        method: api.quotes.updateBooking.method,
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
