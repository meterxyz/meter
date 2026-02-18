import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase";
import { batchSettle, SettlementItem } from "@/lib/base";

export async function POST(req: NextRequest) {
  try {
    const { userId, stripeCustomerId, amount, messageIds, chargeIds } = await req.json();

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: "userId and positive amount required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Resolve Stripe customer ID
    let customerId = stripeCustomerId;
    if (!customerId) {
      const { data: user } = await supabase
        .from("meter_users")
        .select("stripe_customer_id")
        .eq("id", userId)
        .single();
      customerId = user?.stripe_customer_id;
    }

    if (!customerId) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 400 });
    }

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json({ error: "Stripe customer deleted" }, { status: 400 });
    }
    const defaultPm = customer.invoice_settings?.default_payment_method;
    if (!defaultPm) {
      return NextResponse.json({ error: "No payment method on file" }, { status: 400 });
    }

    // Create and confirm PaymentIntent
    const amountCents = Math.round(amount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: customerId,
      payment_method: typeof defaultPm === "string" ? defaultPm : defaultPm.id,
      confirm: true,
      off_session: true,
      description: `Meter settlement — ${(messageIds?.length ?? 0)} messages, ${(chargeIds?.length ?? 0)} card charges`,
      metadata: {
        meter_user_id: userId,
        message_count: String(messageIds?.length ?? 0),
        charge_count: String(chargeIds?.length ?? 0),
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment not succeeded", status: paymentIntent.status },
        { status: 402 }
      );
    }

    // Update messages in Supabase
    if (messageIds && messageIds.length > 0) {
      await supabase
        .from("chat_messages")
        .update({ settled: true, receipt_status: "settled" })
        .in("id", messageIds);
    }

    // Batch settle on Base
    const items: SettlementItem[] = [
      ...(messageIds ?? []).map((id: string) => ({ id, amount: 0, type: "usage" as const })),
      ...(chargeIds ?? []).map((id: string) => ({ id, amount: 0, type: "card" as const })),
    ];

    let txHash: string | undefined;
    try {
      txHash = await batchSettle(userId, items, amount);

      // Persist tx hash to settled messages
      if (txHash && messageIds && messageIds.length > 0) {
        await supabase
          .from("chat_messages")
          .update({ tx_hash: txHash })
          .in("id", messageIds);
      }
    } catch (err) {
      console.error("Base settlement failed (charge succeeded):", err);
    }

    // Get card info for history record
    const pmObj = typeof defaultPm === "string"
      ? await stripe.paymentMethods.retrieve(defaultPm)
      : defaultPm;
    const historyId = `stl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await supabase.from("settlement_history").insert({
      id: historyId,
      user_id: userId,
      amount,
      stripe_payment_intent_id: paymentIntent.id,
      tx_hash: txHash ?? null,
      message_count: messageIds?.length ?? 0,
      charge_count: chargeIds?.length ?? 0,
      card_last4: pmObj && "card" in pmObj ? pmObj.card?.last4 ?? null : null,
      card_brand: pmObj && "card" in pmObj ? pmObj.card?.brand ?? null : null,
      status: "succeeded",
    }).then(() => {}).catch((e) => console.error("Failed to write settlement history:", e));

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      txHash: txHash ?? null,
      amountCharged: amount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Settlement error:", message);

    if (message.includes("authentication_required") || message.includes("card_declined")) {
      return NextResponse.json({ error: "Payment failed: " + message }, { status: 402 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
