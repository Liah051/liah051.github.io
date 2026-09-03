import fs from "node:fs";
import path from "node:path";

const HOST = "dialiah.com";
const KEY = "b6df38a14f7d4d239165fa4ab81a95df";
const KEY_LOCATION = "https://dialiah.com/b6df38a14f7d4d239165fa4ab81a95df.txt";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const distDir = path.resolve("dist");

if (!fs.existsSync(distDir)) {
  console.error(`[IndexNow] Error: dist directory does not exist at ${distDir}. Please build the project first.`);
  process.exit(1);
}

const sitemapFiles = new Set();

// 1. Parse sitemap-index.xml if it exists to discover child sitemap files
const indexPath = path.join(distDir, "sitemap-index.xml");
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, "utf-8");
  const locMatches = indexContent.matchAll(/<loc>(.*?)<\/loc>/g);
  for (const match of locMatches) {
    const locUrl = match[1].trim();
    try {
      const parsedUrl = new URL(locUrl);
      const filename = path.basename(parsedUrl.pathname);
      const childPath = path.join(distDir, filename);
      if (fs.existsSync(childPath)) {
        sitemapFiles.add(childPath);
      }
    } catch {
      // Ignore malformed URLs
    }
  }
}

// 2. Also scan dist/ for any sitemap*.xml files (except sitemap-index.xml)
const entries = fs.readdirSync(distDir);
for (const entry of entries) {
  if (entry.startsWith("sitemap") && entry.endsWith(".xml") && entry !== "sitemap-index.xml") {
    sitemapFiles.add(path.join(distDir, entry));
  }
}

if (sitemapFiles.size === 0) {
  console.error("[IndexNow] Error: No sitemap files found in dist directory.");
  process.exit(1);
}

console.log(`[IndexNow] Target sitemap files:`, Array.from(sitemapFiles).map(f => path.basename(f)));

const urls = new Set();

for (const file of sitemapFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const matches = content.matchAll(/<loc>(.*?)<\/loc>/g);
  for (const match of matches) {
    const url = match[1].trim();
    if (url && !url.endsWith(".xml") && (url.startsWith("http://") || url.startsWith("https://"))) {
      urls.add(url);
    }
  }
}

const urlList = Array.from(urls);

if (urlList.length === 0) {
  console.error("[IndexNow] Error: No page URLs found in sitemap files.");
  process.exit(1);
}

console.log(`[IndexNow] Successfully extracted ${urlList.length} URL(s) from sitemaps.`);

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urlList,
};

console.log(`[IndexNow] Sending POST request to ${INDEXNOW_ENDPOINT}...`);

try {
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 200 || response.status === 202) {
    console.log(`[IndexNow] Success! Response status: ${response.status} (${response.statusText})`);
  } else {
    const errorBody = await response.text();
    console.error(`[IndexNow] Failed with HTTP status ${response.status} (${response.statusText}):`);
    console.error(errorBody);
    process.exit(1);
  }
} catch (error) {
  console.error("[IndexNow] Error sending request:", error);
  process.exit(1);
}
