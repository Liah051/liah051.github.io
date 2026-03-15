import { defineCollection, z } from "astro:content";

const glossary = defineCollection({
    type: "data",
    schema: z.object({
        term: z.string(),
        description: z.string(),
        url: z.string().optional().default("#"),
    }),
});

export const collections = {
    glossary,
};
