import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Star, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, MessageSquare,
} from "lucide-react";

type Review = {
  id: number;
  author: string;
  location: string | null;
  rating: number;
  text: string;
  reviewDate: string | null;
  source: string | null;
  featured: boolean;
  sortOrder: number;
};

type ReviewsResponse = {
  reviews: Review[];
  ratingValue: string;
  ratingCount: string;
};

const SOURCES = [
  { value: "google", label: "Google" },
  { value: "facebook", label: "Facebook" },
  { value: "manual", label: "Other / Manual" },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm tracking-tight" aria-label={`${rating} stars`}>
      {"★".repeat(rating)}<span className="text-black/15">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function ReviewModal({
  review,
  onClose,
  onSave,
  saving,
}: {
  review: Partial<Review> | null;
  onClose: () => void;
  onSave: (data: Partial<Review>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Review>>({
    author: review?.author ?? "",
    location: review?.location ?? "",
    rating: review?.rating ?? 5,
    text: review?.text ?? "",
    reviewDate: review?.reviewDate ?? "",
    source: review?.source ?? "google",
    featured: review?.featured !== false,
    sortOrder: review?.sortOrder ?? 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-none border border-black/12 w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
          <h2 className="text-base font-semibold text-[#0A0A0A]">{review?.id ? "Edit Review" : "Add Review"}</h2>
          <button onClick={onClose} className="text-black/45 hover:text-black/65">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Customer Name</Label>
              <Input
                data-testid="input-review-author"
                value={form.author}
                onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                placeholder="e.g. Michelle T."
                className="h-9 text-sm border-black/20"
              />
            </div>
            <div>
              <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Location</Label>
              <Input
                data-testid="input-review-location"
                value={form.location ?? ""}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Tampines EC"
                className="h-9 text-sm border-black/20"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Review Text</Label>
            <Textarea
              data-testid="input-review-text"
              value={form.text}
              onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              rows={4}
              placeholder="What the customer said..."
              className="text-sm border-black/20 resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Rating</Label>
              <select
                data-testid="select-review-rating"
                value={form.rating}
                onChange={e => setForm(f => ({ ...f, rating: parseInt(e.target.value) }))}
                className="w-full h-9 px-3 border border-black/20 rounded-lg text-sm focus:ring-2 focus:ring-[#0A0A0A] outline-none bg-white"
              >
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Date</Label>
              <Input
                data-testid="input-review-date"
                value={form.reviewDate ?? ""}
                onChange={e => setForm(f => ({ ...f, reviewDate: e.target.value }))}
                placeholder="2026-03-15"
                className="h-9 text-sm border-black/20"
              />
            </div>
            <div>
              <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Source</Label>
              <select
                data-testid="select-review-source"
                value={form.source ?? "google"}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full h-9 px-3 border border-black/20 rounded-lg text-sm focus:ring-2 focus:ring-[#0A0A0A] outline-none bg-white"
              >
                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Sort Order</Label>
              <Input
                data-testid="input-review-sort"
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="h-9 text-sm border-black/20"
              />
            </div>
            <button
              data-testid="toggle-review-featured"
              type="button"
              onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
              className="flex items-center gap-2 text-sm text-black/70 h-9"
            >
              {form.featured
                ? <ToggleRight className="w-5 h-5 text-[#0A0A0A]" />
                : <ToggleLeft className="w-5 h-5 text-black/45" />}
              {form.featured ? "Shown on site" : "Hidden"}
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-black/8 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-sm">Cancel</Button>
          <Button
            data-testid="button-save-review"
            size="sm"
            disabled={saving || !form.author?.trim() || !form.text?.trim()}
            onClick={() => onSave(form)}
            className="h-9 px-4 text-sm bg-[#0A0A0A] hover:bg-black text-white"
          >
            {saving ? "Saving..." : "Save Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewsManager() {
  const { toast } = useToast();
  const [editReview, setEditReview] = useState<Partial<Review> | null | false>(false);
  const [ratingValue, setRatingValue] = useState("");
  const [ratingCount, setRatingCount] = useState("");

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["/api/admin/reviews"],
  });

  useEffect(() => {
    if (data) {
      setRatingValue(data.ratingValue);
      setRatingCount(data.ratingCount);
    }
  }, [data]);

  const reviews = data?.reviews ?? [];

  const createMutation = useMutation({
    mutationFn: (d: Partial<Review>) => apiRequest("POST", "/api/admin/reviews", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      setEditReview(false);
      toast({ title: "Review added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<Review> }) => apiRequest("PATCH", `/api/admin/reviews/${id}`, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      setEditReview(false);
      toast({ title: "Review updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/reviews/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Review deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const ratingMutation = useMutation({
    mutationFn: (d: { ratingValue: string; ratingCount: string }) => apiRequest("POST", "/api/admin/review-rating", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({ title: "Rating updated", description: "The star rating shown across the site has been saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFeatured = (r: Review) => updateMutation.mutate({ id: r.id, d: { featured: !r.featured } });

  const handleSave = (d: Partial<Review>) => {
    if ((editReview as Review)?.id) {
      updateMutation.mutate({ id: (editReview as Review).id, d });
    } else {
      createMutation.mutate(d);
    }
  };

  const featuredCount = reviews.filter(r => r.featured).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28">
      {editReview !== false && (
        <ReviewModal
          review={editReview}
          onClose={() => setEditReview(false)}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <div className="mb-6">
        <h1 className="text-xl font-black uppercase tracking-tight text-[#0A0A0A] flex items-center gap-2">
          <Star className="w-5 h-5" /> Reviews
        </h1>
        <p className="text-sm text-black/55 mt-1">
          Manage the real customer reviews and the star rating shown on your public pages and in Google rich results.
        </p>
      </div>

      {/* Aggregate rating */}
      <div className="bg-white border border-black/12 rounded-none mb-6">
        <div className="px-5 py-4 border-b border-black/8">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">Overall Star Rating</h2>
          <p className="text-xs text-black/55 mt-0.5">Set these to match your real Google Business Profile rating and review count. Used in the rich-result snippet.</p>
        </div>
        <div className="px-5 py-4 flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Average rating</Label>
            <Input
              data-testid="input-rating-value"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={ratingValue}
              onChange={e => setRatingValue(e.target.value)}
              className="h-9 w-28 text-sm border-black/20"
            />
          </div>
          <div>
            <Label className="text-xs text-black/55 uppercase tracking-wide font-semibold mb-1.5 block">Review count</Label>
            <Input
              data-testid="input-rating-count"
              type="number"
              min="0"
              value={ratingCount}
              onChange={e => setRatingCount(e.target.value)}
              className="h-9 w-28 text-sm border-black/20"
            />
          </div>
          <Button
            data-testid="button-save-rating"
            size="sm"
            disabled={ratingMutation.isPending}
            onClick={() => ratingMutation.mutate({ ratingValue, ratingCount })}
            className="h-9 px-4 text-sm bg-[#0A0A0A] hover:bg-black text-white"
          >
            {ratingMutation.isPending ? "Saving..." : "Save Rating"}
          </Button>
        </div>
      </div>

      {/* Reviews list */}
      <div className="bg-white border border-black/12 rounded-none overflow-hidden">
        <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-[#0A0A0A]">Customer Reviews</h2>
            <p className="text-xs text-black/55 mt-0.5">{featuredCount} shown · {reviews.length} total</p>
          </div>
          <Button
            data-testid="button-add-review"
            size="sm"
            onClick={() => setEditReview({})}
            className="h-9 px-4 text-sm bg-[#0A0A0A] hover:bg-black text-white gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Review
          </Button>
        </div>

        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-black/45">Loading...</div>
        ) : reviews.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-black/55">No reviews yet</p>
            <p className="text-xs text-black/45 mt-1">Add your real Google reviews so they show on your site.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/8">
            {reviews.map(r => (
              <div key={r.id} data-testid={`review-row-${r.id}`} className={`px-5 py-3.5 ${!r.featured ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Stars rating={r.rating} />
                      <span className="text-sm font-medium text-[#0A0A0A]">{r.author}</span>
                      {r.location && <span className="text-xs text-black/45">{r.location}</span>}
                      {r.reviewDate && <span className="text-xs text-black/35">· {r.reviewDate}</span>}
                      {!r.featured && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#EBE9E2] text-black/55">Hidden</span>}
                    </div>
                    <p className="text-sm text-black/65 mt-1 leading-relaxed">{r.text}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      data-testid={`toggle-featured-review-${r.id}`}
                      onClick={() => toggleFeatured(r)}
                      className="p-1.5 rounded-lg hover:bg-[#EBE9E2] text-black/45 hover:text-black/65 transition-colors"
                      title={r.featured ? "Hide from site" : "Show on site"}
                    >
                      {r.featured ? <ToggleRight className="w-4 h-4 text-blue-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      data-testid={`edit-review-${r.id}`}
                      onClick={() => setEditReview(r)}
                      className="p-1.5 rounded-lg hover:bg-[#EBE9E2] text-black/45 hover:text-black/65 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      data-testid={`delete-review-${r.id}`}
                      onClick={() => { if (confirm("Delete this review?")) deleteMutation.mutate(r.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-black/45 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
