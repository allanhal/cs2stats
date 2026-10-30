import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { DEMO_PREFIX, MAX_DEMO_BYTES, isDemoName } from "@/lib/objects";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(DEMO_PREFIX) || !isDemoName(pathname)) {
          throw new Error("Só aceitamos arquivos .dem ou .dem.zst");
        }
        return {
          allowedContentTypes: ["application/octet-stream", "application/x-demo"],
          maximumSizeInBytes: MAX_DEMO_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao autorizar o upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
