import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getValidAccessToken } from "@/lib/oauth";

export async function POST(req: NextRequest) {
  try {
    const { userId, workspaceId, amount, currency } = await req.json();

    if (!userId || !workspaceId) {
      return NextResponse.json(
        { error: "userId and workspaceId required" },
        { status: 400 }
      );
    }

    // Get the user's connected Stripe access token
    const tokenRecord = await getValidAccessToken(userId, "stripe", workspaceId);
    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Stripe not connected. Connect your Stripe account first." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(tokenRecord.accessToken, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });

    // If no amount specified, check balance and pay out the full available balance
    const balance = await stripe.balance.retrieve();
    const cur = currency ?? "usd";
    const available = balance.available.find((b) => b.currency === cur);

    if (!available || available.amount <= 0) {
      return NextResponse.json(
        {
          error: `No available balance to pay out (${cur.toUpperCase()})`,
          available: balance.available.map((b) => ({
            amount: b.amount / 100,
            currency: b.currency,
          })),
        },
        { status: 400 }
      );
    }

    // Use the requested amount (in dollars) or the full available balance
    const payoutAmountCents = amount
      ? Math.min(Math.round(amount * 100), available.amount)
      : available.amount;

    if (payoutAmountCents <= 0) {
      return NextResponse.json(
        { error: "Payout amount must be greater than zero" },
        { status: 400 }
      );
    }

    const payout = await stripe.payouts.create({
      amount: payoutAmountCents,
      currency: cur,
      description: "Meter-initiated payout",
    });

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: payout.amount / 100,
        currency: payout.currency,
        status: payout.status,
        arrival_date: payout.arrival_date,
        description: payout.description,
        method: payout.method,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Payout error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!userId || !workspaceId) {
    return NextResponse.json(
      { error: "userId and workspaceId required" },
      { status: 400 }
    );
  }

  try {
    const tokenRecord = await getValidAccessToken(userId, "stripe", workspaceId);
    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Stripe not connected. Connect your Stripe account first." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(tokenRecord.accessToken, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });

    // Return current balance and recent payouts
    const [balance, payouts] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 10 }),
    ]);

    return NextResponse.json({
      balance: {
        available: balance.available.map((b) => ({
          amount: b.amount / 100,
          currency: b.currency,
        })),
        pending: balance.pending.map((b) => ({
          amount: b.amount / 100,
          currency: b.currency,
        })),
      },
      recentPayouts: payouts.data.map((p) => ({
        id: p.id,
        amount: p.amount / 100,
        currency: p.currency,
        status: p.status,
        arrival_date: p.arrival_date,
        created: p.created,
        description: p.description,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Payout info error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
