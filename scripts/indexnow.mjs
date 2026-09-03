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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Verify key file accessibility on deployed site with retry mechanism for CDN propagation
console.log(`[IndexNow] Verifying accessibility of key file at ${KEY_LOCATION}...`);
let keyFileOk = false;
for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const res = await fetch(KEY_LOCATION);
    if (res.ok) {
      const text = await res.text();
      if (text.trim().includes(KEY)) {
        console.log(`[IndexNow] Key file verified successfully on deployed host.`);
        keyFileOk = true;
        break;
      } else {
        console.warn(`[IndexNow] Key file fetched but content did not match key. Response: "${text.trim()}"`);
      }
    } else {
      console.warn(`[IndexNow] Key file returned HTTP ${res.status}. (Attempt ${attempt}/6)`);
    }
  } catch (err) {
    console.warn(`[IndexNow] Failed to fetch key file: ${err.message}. (Attempt ${attempt}/6)`);
  }

  if (attempt < 6) {
    console.log(`[IndexNow] Waiting 10s for GitHub Pages CDN propagation...`);
    await sleep(10000);
  }
}

if (!keyFileOk) {
  console.warn(`[IndexNow] Warning: Could not verify key file online. Proceeding with IndexNow notification...`);
}

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList: urlList,
};

console.log(`[IndexNow] Sending POST request to ${INDEXNOW_ENDPOINT}...`);

let success = false;
for (let attempt = 1; attempt <= 3; attempt++) {
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
      success = true;
      break;
    } else {
      const errorBody = await response.text();
      console.error(`[IndexNow] Attempt ${attempt}/3 failed with HTTP status ${response.status} (${response.statusText}):`);
      console.error(errorBody);
    }
  } catch (error) {
    console.error(`[IndexNow] Attempt ${attempt}/3 network error:`, error);
  }

  if (attempt < 3) {
    console.log(`[IndexNow] Waiting 10s before retry...`);
    await sleep(10000);
  }
}

if (!success) {
  process.exit(1);
}
