import type { APIRoute } from "astro";
import { generateOgImageForCategory } from "@/utils/generateOgImages";

export async function getStaticPaths() {
  const toppagesGlob = import.meta.glob("./*.astro", { eager: true });
  return Object.values(toppagesGlob)
    .map((mod: any) => {
      const meta = mod.metadata;
      if (!meta) return null;
      return {
        params: { category: meta.id },
        props: { title: meta.title, description: meta.description },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description } = props as { title: string; description: string };
  const buffer = await generateOgImageForCategory(title, description);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
};
