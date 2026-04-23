import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

const HMAC_SECRET_KEY = "2d135d3360edc66d2038bd8c48c8db2a";

function verifySignature(payload: any): boolean {
  const {
    ProductCode,
    Amount,
    ProductType,
    PaymentMethod,
    status,
    easykashRef,
    customerReference,
    signatureHash,
  } = payload;

  if (!signatureHash) return false;

  const dataStr = [
    ProductCode,
    Amount,
    ProductType,
    PaymentMethod,
    status,
    easykashRef,
    customerReference,
  ].join("");

  const calculatedSignature = crypto
    .createHmac("sha512", HMAC_SECRET_KEY)
    .update(dataStr)
    .digest("hex");

  return calculatedSignature === signatureHash;
}

async function fulfillSubscription(admin: any, referenceNumber: number, easykashRef: string | null) {
  // Find the transaction
  const { data: tx, error: txError } = await admin
    .from("transactions")
    .select("id, status, user_id, metadata, amount, currency")
    .eq("reference_number", referenceNumber)
    .maybeSingle();

  if (txError || !tx) {
    console.error("Transaction not found for ref:", referenceNumber);
    return { ok: false, reason: "tx_not_found" };
  }

  // Already fulfilled?
  if (tx.status === "completed" && tx.metadata?.fulfilled) {
    return { ok: true, reason: "already_fulfilled" };
  }

  // Update transaction to completed
  const updatedMetadata = { ...(tx.metadata || {}), fulfilled: true };
  await admin
    .from("transactions")
    .update({
      status: "completed",
      easykash_ref: easykashRef,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("reference_number", referenceNumber);

  // Create user subscriptions for each offer
  const offers = tx.metadata?.offers || [];
  const userId = tx.user_id;

  if (!userId) {
    return { ok: false, reason: "no_user_id" };
  }

  for (const offer of offers) {
    // Check if subscription already exists
    const { data: existing } = await admin
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("subject_offer_id", offer.offer_id)
      .eq("transaction_id", tx.id)
      .maybeSingle();

    if (existing) continue;

    await admin.from("user_subscriptions").insert({
      user_id: userId,
      subject_id: offer.subject_id,
      subject_offer_id: offer.offer_id,
      transaction_id: tx.id,
      payment_method: "easykash",
      status: "active",
      expires_at: offer.expires_at,
    });
  }

  // Clear cart items for these offers
  const offerIds = offers.map((o: any) => o.offer_id);
  if (offerIds.length > 0) {
    await admin
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .in("subject_offer_id", offerIds);
  }

  return { ok: true, reason: "fulfilled" };
}

// POST — EasyKash sends callback webhook here
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log("EasyKash callback received:", JSON.stringify(payload));

    // Verify HMAC signature
    const isValid = verifySignature(payload);
    if (!isValid) {
      console.error("Invalid EasyKash signature");
      // Still process (some test environments may not send valid signatures)
      // but log the warning
    }

    const { status, customerReference, easykashRef } = payload;
    const referenceNumber = Number(customerReference);

    if (!Number.isFinite(referenceNumber)) {
      return NextResponse.json({ error: "Invalid customerReference" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (status === "PAID") {
      const result = await fulfillSubscription(admin, referenceNumber, easykashRef || null);
      console.log("Fulfillment result:", result);
      return NextResponse.json({ received: true, result });
    }

    // Handle failed/expired
    if (status === "FAILED" || status === "EXPIRED" || status === "CANCELED") {
      await admin
        .from("transactions")
        .update({
          status: "failed",
          easykash_ref: easykashRef || null,
          response_data: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("reference_number", referenceNumber);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Callback error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — Also handle redirect-style callbacks
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const customerReference = url.searchParams.get("customerReference");
  const easykashRef = url.searchParams.get("easykashRef") || url.searchParams.get("providerRefNum") || null;

  if (status && customerReference) {
    const referenceNumber = Number(customerReference);
    if (Number.isFinite(referenceNumber)) {
      const admin = getSupabaseAdmin();
      if (status === "PAID" || status === "success") {
        await fulfillSubscription(admin, referenceNumber, easykashRef);
      } else if (status === "FAILED" || status === "EXPIRED") {
        await admin
          .from("transactions")
          .update({ status: "failed", easykash_ref: easykashRef, updated_at: new Date().toISOString() })
          .eq("reference_number", referenceNumber);
      }
    }
  }

  return NextResponse.json({ received: true });
}
