import { PrimeView } from "@/components/prime-view";

export const dynamic = "force-dynamic";

export default async function PrimePage({
  params,
  searchParams,
}: {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ layout?: string; formato?: string }>;
}) {
  const { steamId } = await params;
  const { layout, formato } = await searchParams;

  return <PrimeView steamId={steamId} layout={layout} formato={formato} />;
}
