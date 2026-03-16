import { getCollection } from "astro:content";

let glossaryCache: any[] | null = null;

export async function getGlossary() {
    if (glossaryCache) return glossaryCache;
    glossaryCache = await getCollection("glossary");
    return glossaryCache;
}
