import { NextResponse } from "next/server";
import { signInUrl } from "@/lib/steam";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.redirect(signInUrl(new URL(request.url).origin));
}
