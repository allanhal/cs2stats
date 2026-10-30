import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/origin";
import { signInUrl } from "@/lib/steam";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.redirect(signInUrl(publicOrigin(request)));
}
