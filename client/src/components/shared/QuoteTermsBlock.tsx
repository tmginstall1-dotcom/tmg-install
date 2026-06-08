import { getQuoteTerms, QUOTE_TERMS_HEADING } from "@shared/terms";

/**
 * Standard quote / job terms, rendered from the single shared source
 * (`shared/terms.ts`) so every customer-facing surface shows identical wording.
 * Neutral gray styling sits well on the white quote, status, and invoice cards.
 */
export function QuoteTermsBlock({
  isRelocation = true,
  heading = true,
  className = "",
}: {
  isRelocation?: boolean;
  heading?: boolean;
  className?: string;
}) {
  const terms = getQuoteTerms({ isRelocation });
  return (
    <div className={className} data-testid="block-quote-terms">
      {heading && (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
          {QUOTE_TERMS_HEADING}
        </p>
      )}
      <ol className="space-y-1.5 list-decimal pl-4">
        {terms.map((t, i) => (
          <li key={i} className="text-[11px] text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">{t.title}.</span> {t.body}
          </li>
        ))}
      </ol>
    </div>
  );
}
