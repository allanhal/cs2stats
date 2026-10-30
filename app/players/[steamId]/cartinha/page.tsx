import { CartinhaView } from "@/components/cartinha-view";

export const dynamic = "force-dynamic";

export default async function CartinhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ steamId: string }>;
  searchParams: Promise<{ layout?: string; formato?: string }>;
}) {
  const { steamId } = await params;
  const { layout, formato } = await searchParams;

  return <CartinhaView steamId={steamId} layout={layout} formato={formato} />;
}
