import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import d2 from 'astro-d2';


import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkJoinCjkLines from "remark-join-cjk-lines";
import remarkStrongJsx from "./src/utils/remark-strong-jsx";

import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

import react from "@astrojs/react";
import iosBackNavFix from "@tinloof/astro-ios-backnav-fix";

function rehypeOptimizeImages() {
  return (tree: any) => {
    let imgIndex = 0;
    function visit(node: any) {
      if (!node) return;
      if (node.type === "element" && node.tagName === "img") {
        if (node.properties) {
          if (typeof node.properties.src === "string") {
            const src: string = node.properties.src;

            if (src.includes("res.cloudinary.com") && src.includes("/image/upload/")) {
              let fullSrc = src;
              let lightSrc = src;

              if (src.includes("/image/upload/f_auto,q_auto,w_1200/")) {
                fullSrc = src.replace(
                  "/image/upload/f_auto,q_auto,w_1200/",
                  "/image/upload/f_auto,q_auto/"
                );
                lightSrc = src;
              } else if (src.includes("/image/upload/f_auto,q_auto/")) {
                fullSrc = src;
                lightSrc = src.replace(
                  "/image/upload/f_auto,q_auto/",
                  "/image/upload/f_auto,q_auto,w_1200/"
                );
              } else {
                fullSrc = src.replace(
                  "/image/upload/",
                  "/image/upload/f_auto,q_auto/"
                );
                lightSrc = src.replace(
                  "/image/upload/",
                  "/image/upload/f_auto,q_auto,w_1200/"
                );
              }

              node.properties.src = lightSrc;
              node.properties["data-full-src"] = fullSrc;
              node.properties.dataFullSrc = fullSrc;
            } else {
              node.properties["data-full-src"] = src;
              node.properties.dataFullSrc = src;
            }

            const existingClasses = Array.isArray(node.properties.className)
              ? node.properties.className
              : typeof node.properties.className === "string"
              ? node.properties.className.split(" ")
              : typeof node.properties.class === "string"
              ? node.properties.class.split(" ")
              : [];

            if (!existingClasses.includes("cursor-zoom-in")) {
              existingClasses.push("cursor-zoom-in");
            }
            node.properties.className = existingClasses;
          }

          if (imgIndex === 0) {
            node.properties.loading = "eager";
          } else {
            node.properties.loading = "lazy";
          }
          node.properties.decoding = "async";
        }
        imgIndex++;
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
    }
    visit(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  integrations: [
    iosBackNavFix(),
    sitemap({
      filter: page => {
        const url = new URL(page);
        const cleanPath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
        if (!SITE.showArchives && cleanPath.endsWith("/archives")) {
          return false;
        }
        // Exclude pagination URLs like /posts/2, /posts/3, etc.
        if (/\/posts\/\d+$/.test(cleanPath)) {
          return false;
        }
        // Exclude tag-specific pages and their pagination (e.g., /tags/tag-name, /tags/tag-name/2)
        // Keep the main tags directory page (/tags) if it exists.
        if (cleanPath.startsWith("/tags/")) {
          return false;
        }
        return true;
      },
    }),
    mdx(),
    d2({
      theme: {
        default: '0',    // 明るいテーマ
        dark: '200',     // ダークモード用テーマ
      },
      inline: true,      // SVGをHTMLに直接埋め込む
      experimental: {
        useD2js: true,    // WASM版のD2を使用（アダプティブ・ダークモードに対応）
      },
    }),
    react()
  ],
  markdown: {
    remarkPlugins: [
      remarkStrongJsx,
      remarkToc,
      [remarkCollapse, { test: "Table of contents" }],
      remarkMath,
      remarkJoinCjkLines,
    ],
    rehypePlugins: [rehypeKatex, rehypeOptimizeImages],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
    fonts: [
      {
        name: "Google Sans Code",
        cssVariable: "--font-google-sans-code",
        provider: fontProviders.google(),
        fallbacks: ["monospace"],
        weights: [300, 400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
    ],
  },
});