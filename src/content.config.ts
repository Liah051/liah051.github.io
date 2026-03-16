import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/content/blog";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      thumbnail: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
      category_id: z.string(),
      group: z.string().optional(),
      order: z.number().default(999).optional(),
      wordlist: z.boolean().default(false).optional(),
      terms: z.array(z.string()).optional(),
    }),
});

const glossary = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/glossary" }),
  schema: z.object({
    term: z.string(),
    description: z.string(),
    url: z.string().optional(),
  }),
});

export const collections = { blog, glossary };
