import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  try {
    const { paymentMethodId } = await req.json();
    if (!paymentMethodId) {
      return NextResponse.json({ error: "paymentMethodId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: user } = await supabase
      .from("meter_users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 400 });
    }

    await stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const last4 = pm.card?.last4 ?? "0000";
    const brand = pm.card?.brand ?? "unknown";

    await supabase
      .from("meter_users")
      .update({ card_last4: last4, card_brand: brand, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return NextResponse.json({ success: true, cardLast4: last4, cardBrand: brand });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Set default card error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
