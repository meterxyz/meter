"use client";

import { useState, useEffect } from "react";
import { useMeterStore } from "@/lib/store";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function CardFormInner() {
  const stripe = useStripe();
  const elements = useElements();
  const { userId, setCardOnFile } = useMeterStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw new Error(submitError.message);

      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (confirmError) throw new Error(confirmError.message);

      if (setupIntent?.status === "succeeded") {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, setupIntentId: setupIntent.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to confirm");
        setCardOnFile(true, data.cardLast4, data.cardBrand);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 max-w-sm">
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      <div className="mt-2 rounded-lg border border-border/30 px-3 py-2">
        <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
          No charge now. We verify your card and save it for billing.
          You&apos;re charged at $10 or monthly, whichever comes first.
        </p>
      </div>

      {error && (
        <p className="mt-2 font-mono text-[10px] text-red-400">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !stripe}
        className="mt-3 w-full rounded-lg bg-foreground py-2.5 font-mono text-xs text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Add Card & Start"}
      </button>
    </div>
  );
}

export function InlineCardForm() {
  const { userId } = useMeterStore();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    fetch("/api/billing/setup-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error || "Failed to initialize payment");
        }
      })
      .catch(() => setError("Failed to connect to payment service"));
  }, [userId]);

  if (error) {
    return (
      <p className="mt-3 font-mono text-[10px] text-red-400">{error}</p>
    );
  }

  if (!clientSecret) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <svg className="animate-spin h-3 w-3 text-muted-foreground" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-mono text-[10px] text-muted-foreground/50">Loading payment form...</span>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#ffffff",
            colorBackground: "#0a0a0a",
            colorText: "#ffffff",
            colorTextPlaceholder: "#666666",
            fontFamily: "ui-monospace, monospace",
            fontSizeBase: "13px",
            borderRadius: "8px",
          },
        },
      }}
    >
      <CardFormInner />
    </Elements>
  );
}
