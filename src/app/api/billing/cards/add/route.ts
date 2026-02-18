import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: user } = await supabase
      .from("meter_users")
      .select("id, email, stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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
    const message = err instanceof Error ? err.message : String(err);
    console.error("Add card error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
