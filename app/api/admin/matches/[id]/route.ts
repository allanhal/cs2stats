import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteMatch } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const removed = await deleteMatch(id);
  return NextResponse.json({ ok: removed }, { status: removed ? 200 : 404 });
}
