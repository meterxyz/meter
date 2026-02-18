import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";

// POST /api/billing/setup-intent — create Stripe SetupIntent for saving a card
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Get user
    const { data: user } = await supabase
      .from("meter_users")
      .select("id, email, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { meter_user_id: userId },
      });
      customerId = customer.id;

      await supabase
        .from("meter_users")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { meter_user_id: userId },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    });
  } catch (err) {
    console.error("Setup intent error:", err);
    return NextResponse.json({ error: "Failed to create setup intent" }, { status: 500 });
  }
}
