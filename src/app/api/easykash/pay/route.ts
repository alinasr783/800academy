import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

const EASYKASH_API_KEY = "3qjfyybxg9iw5lft";
const EASYKASH_PAY_URL = "https://back.easykash.net/api/directpayv1/pay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { offer_ids, redirect_url } = body;

    if (!offer_ids || !Array.isArray(offer_ids) || offer_ids.length === 0) {
      return NextResponse.json({ error: "Missing offer_ids" }, { status: 400 });
    }

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Fetch the offers to get total price
    const { data: offers, error: offersError } = await admin
      .from("subject_offers")
      .select("id, label, price_cents, currency, expires_at, subject_id, subjects(title, slug)")
      .in("id", offer_ids);

    if (offersError || !offers || offers.length === 0) {
      return NextResponse.json({ error: "Offers not found" }, { status: 404 });
    }

    const totalCents = offers.reduce((sum: number, o: any) => sum + o.price_cents, 0);
    const totalAmount = totalCents / 100;
    const currency = offers[0].currency || "EGP";

    // Build metadata for the transaction
    const offerDetails = offers.map((o: any) => ({
      offer_id: o.id,
      subject_id: o.subject_id,
      label: o.label,
      subject_title: o.subjects?.title ?? "",
      price_cents: o.price_cents,
      expires_at: o.expires_at,
    }));

    const metadata = {
      type: "subscription",
      offer_ids,
      offers: offerDetails,
      buyer_email: user.email || "",
      buyer_name: user.user_metadata?.full_name || user.email || "800 Academy Student",
    };

    // Create transaction record
    const { data: transaction, error: txError } = await admin
      .from("transactions")
      .insert({
        amount: totalAmount,
        currency,
        status: "pending",
        type: "subscription",
        user_id: user.id,
        metadata,
        response_data: {},
      })
      .select("id, reference_number")
      .single();

    if (txError || !transaction) {
      console.error("Transaction creation error:", txError);
      return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
    }

    const customerReference = Number(transaction.reference_number);

    // Build the callback redirect URL
    const baseUrl = redirect_url || `${req.nextUrl.origin}/checkout/callback`;

    // Call EasyKash Pay API
    const easykashPayload = {
      amount: totalAmount,
      currency,
      paymentOptions: [2, 4], // Card + Mobile Wallet
      cashExpiry: 24,
      name: metadata.buyer_name,
      email: metadata.buyer_email,
      mobile: "01000000000",
      redirectUrl: baseUrl,
      customerReference,
    };

    const response = await fetch(EASYKASH_PAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: EASYKASH_API_KEY,
      },
      body: JSON.stringify(easykashPayload),
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("EasyKash invalid JSON:", text);
      return NextResponse.json({ error: "Payment gateway error" }, { status: 502 });
    }

    if (data.redirectUrl) {
      let paymentUrl = String(data.redirectUrl).trim().replace(/`/g, "");
      if (paymentUrl.startsWith("/")) {
        paymentUrl = `https://www.easykash.net${paymentUrl}`;
      }

      // Update transaction with easykash response
      await admin
        .from("transactions")
        .update({ response_data: data })
        .eq("id", transaction.id);

      return NextResponse.json({
        url: paymentUrl,
        transactionId: transaction.id,
        referenceNumber: customerReference,
      });
    }

    const errorMsg = data.message || data.error || "Unknown payment error";
    console.error("EasyKash error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 502 });
  } catch (err: any) {
    console.error("Pay route error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
