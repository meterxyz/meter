import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";

// POST /api/billing/confirm — after Stripe confirms the card, save details
export async function POST(req: NextRequest) {
  try {
    const { userId, setupIntentId } = await req.json();
    if (!userId || !setupIntentId) {
      return NextResponse.json({ error: "userId and setupIntentId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Retrieve the SetupIntent to get payment method details
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ["payment_method"],
    });

    if (setupIntent.status !== "succeeded") {
      return NextResponse.json({ error: "SetupIntent not succeeded" }, { status: 400 });
    }

    const pm = setupIntent.payment_method;
    if (!pm || typeof pm === "string") {
      return NextResponse.json({ error: "Payment method not found" }, { status: 400 });
    }

    const card = pm.card;
    const last4 = card?.last4 ?? "0000";
    const brand = card?.brand ?? "unknown";

    // Set as default payment method on customer
    if (setupIntent.customer && typeof setupIntent.customer === "string") {
      await stripe.customers.update(setupIntent.customer, {
        invoice_settings: { default_payment_method: pm.id },
      });
    }

    // Save card details to our DB
    await supabase
      .from("meter_users")
      .update({
        card_last4: last4,
        card_brand: brand,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return NextResponse.json({
      success: true,
      cardLast4: last4,
      cardBrand: brand,
    });
  } catch (err) {
    console.error("Confirm billing error:", err);
    return NextResponse.json({ error: "Failed to confirm card" }, { status: 500 });
  }
}
