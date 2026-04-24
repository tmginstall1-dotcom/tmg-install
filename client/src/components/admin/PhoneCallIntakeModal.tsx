import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Sparkles, Loader2, AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface IntakeResponse {
  quoteId: number;
  referenceNo: string;
  confidence: number;
  missingFacts: string[];
  extractedFacts: Record<string, unknown>;
}

const SAMPLE_PLACEHOLDER = `Example:

Caller said her name is Sarah, lives at Blk 123 Tampines St 11 #08-456. She bought a 4-door wardrobe and queen bed frame from Taobao, arriving next Tuesday. Wants us to come on Wednesday afternoon to assemble both. Lift available. Confirmed she's OK with $250 estimate. Asked for WhatsApp follow-up.`;

export function PhoneCallIntakeModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [callerPhone, setCallerPhone] = useState("+65 ");
  const [callerName, setCallerName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [durationMin, setDurationMin] = useState("");

  const reset = () => {
    setCallerPhone("+65 ");
    setCallerName("");
    setTranscript("");
    setDurationMin("");
  };

  const handleClose = () => {
    if (mutation.isPending) return;
    reset();
    onClose();
  };

  const mutation = useMutation({
    mutationFn: async (): Promise<IntakeResponse> => {
      const durationSec = durationMin ? Math.round(parseFloat(durationMin) * 60) : null;
      const res = await apiRequest("POST", "/api/phone/intake", {
        callerPhone: callerPhone.trim(),
        callerName: callerName.trim() || null,
        transcript: transcript.trim(),
        durationSec,
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Refresh the quote list so the new draft appears immediately
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });

      const missingNote = data.missingFacts.length > 0
        ? ` (still need: ${data.missingFacts.join(", ")})`
        : "";

      toast({
        title: "Draft quote created from call",
        description: `${data.referenceNo} — ${Math.round(data.confidence * 100)}% AI confidence${missingNote}. Opening for review…`,
      });

      reset();
      onClose();
      // Navigate to the new quote so admin can review/edit immediately
      if (data.quoteId) setLocation(`/admin/quotes/${data.quoteId}`);
    },
    onError: (err: any) => {
      toast({
        title: "Could not create quote from call",
        description: err?.message || "Please check the phone number and transcript and try again.",
        variant: "destructive",
      });
    },
  });

  const phoneOk      = callerPhone.trim().replace(/[^0-9]/g, "").length >= 6;
  const transcriptOk = transcript.trim().length >= 20;
  const canSubmit    = phoneOk && transcriptOk && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-phone-intake">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-purple-100 text-purple-700">
              <Phone className="w-4 h-4" />
            </span>
            Log a Phone Call
          </DialogTitle>
          <DialogDescription>
            Paste your call notes or a recording transcript. The AI will extract the customer's
            details, items, address and schedule, then create a draft quote in your review queue —
            exactly like a website or WhatsApp submission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Caller phone + name + duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="caller-phone" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Caller phone <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="caller-phone"
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="+65 9123 4567"
                disabled={mutation.isPending}
                data-testid="input-caller-phone"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="caller-name" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Caller name <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="caller-name"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                placeholder="Sarah Tan"
                disabled={mutation.isPending}
                data-testid="input-caller-name"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="duration" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Call length in minutes <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="duration"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="3.5"
              disabled={mutation.isPending}
              data-testid="input-call-duration"
              className="mt-1 max-w-[200px]"
            />
          </div>

          {/* Transcript */}
          <div>
            <Label htmlFor="transcript" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Call transcript / notes <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={SAMPLE_PLACEHOLDER}
              disabled={mutation.isPending}
              rows={9}
              data-testid="input-call-transcript"
              className="mt-1 resize-y font-mono text-[13px] leading-relaxed"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              {transcript.trim().length} chars — the more detail you include (address, items, floor, lift,
              preferred date), the better the AI can pre-fill the draft.
            </p>
          </div>

          {/* Helper card */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3 flex gap-2.5">
            <Sparkles className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <p className="text-[12.5px] text-purple-900 leading-relaxed">
              <strong>What happens next:</strong> AI reads the transcript, extracts service type, items,
              address, floor / lift and schedule, then creates a draft quote tagged
              <span className="inline-flex items-center px-1.5 py-px mx-1 rounded bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200">📞 Call</span>
              that you can review and send — same flow as web and WhatsApp leads.
            </p>
          </div>

          {/* Validation hint */}
          {!transcriptOk && transcript.length > 0 && (
            <div className="flex items-center gap-2 text-[12px] text-amber-700">
              <AlertCircle className="w-3.5 h-3.5" />
              Transcript needs at least 20 characters so the AI has something to work with.
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending}
            data-testid="button-cancel-phone-intake"
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-submit-phone-intake"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting & creating draft…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Extract & create draft quote
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
