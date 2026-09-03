import fs from "node:fs";
import path from "node:path";

const DEFAULT_HOST = "dialiah.com";
const KEY = "b6df38a14f7d4d239165fa4ab81a95df";
const INITIAL_KEY_LOCATION = `https://${DEFAULT_HOST}/${KEY}.txt`;

const ENDPOINTS = [
  "https://www.bing.com/indexnow",
  "https://api.indexnow.org/indexnow",
  "https://yandex.com/indexnow",
  "https://search.seznam.cz/indexnow",
];

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

const rawUrls = new Set();

for (const file of sitemapFiles) {
  const content = fs.readFileSync(file, "utf-8");
  const matches = content.matchAll(/<loc>(.*?)<\/loc>/g);
  for (const match of matches) {
    const url = match[1].trim();
    if (url && !url.endsWith(".xml") && (url.startsWith("http://") || url.startsWith("https://"))) {
      rawUrls.add(url);
    }
  }
}

if (rawUrls.size === 0) {
  console.error("[IndexNow] Error: No page URLs found in sitemap files.");
  process.exit(1);
}

console.log(`[IndexNow] Successfully extracted ${rawUrls.size} raw URL(s) from sitemaps.`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Follow redirects with redirect: 'manual' to find final canonical URL and host
 */
async function resolveKeyLocation(startUrl) {
  let currentUrl = startUrl;
  const maxRedirects = 5;

  for (let i = 0; i < maxRedirects; i++) {
    const res = await fetch(currentUrl, { redirect: "manual" });
    if ([301, 302, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error(`Received redirect status ${res.status} without Location header.`);
      }
      const nextUrl = new URL(location, currentUrl).toString();
      console.log(`[IndexNow] Redirect detected (${res.status}): ${currentUrl} -> ${nextUrl}`);
      currentUrl = nextUrl;
    } else if (res.ok) {
      const bodyText = await res.text();
      if (!bodyText.trim().includes(KEY)) {
        throw new Error(`Key file at ${currentUrl} returned HTTP 200, but content did not match key. Body: "${bodyText.trim()}"`);
      }
      return { finalUrl: currentUrl, res };
    } else {
      throw new Error(`HTTP status ${res.status} when fetching ${currentUrl}`);
    }
  }
  throw new Error(`Exceeded maximum redirect depth of ${maxRedirects} for ${startUrl}`);
}

// Verify key file and resolve canonical host
console.log(`[IndexNow] Verifying accessibility and resolving canonical host starting from ${INITIAL_KEY_LOCATION}...`);

let canonicalHost = DEFAULT_HOST;
let canonicalKeyLocation = INITIAL_KEY_LOCATION;
let verified = false;

for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const { finalUrl } = await resolveKeyLocation(INITIAL_KEY_LOCATION);
    const parsedFinal = new URL(finalUrl);
    canonicalHost = parsedFinal.hostname;
    canonicalKeyLocation = finalUrl;
    verified = true;
    console.log(`[IndexNow] Key file verified successfully! Canonical host: "${canonicalHost}", KeyLocation: "${canonicalKeyLocation}"`);
    break;
  } catch (err) {
    console.warn(`[IndexNow] Verification attempt ${attempt}/6 failed: ${err.message}`);
  }

  if (attempt < 6) {
    console.log(`[IndexNow] Waiting 10s for CDN propagation / network...`);
    await sleep(10000);
  }
}

if (!verified) {
  console.warn(`[IndexNow] Warning: Could not verify key file online. Fallback using default host "${DEFAULT_HOST}".`);
}

// Normalize all URLs in urlList to use canonical host
const normalizedUrls = Array.from(rawUrls).map((url) => {
  return url.replace(/^https?:\/\/[^\/]+/, `https://${canonicalHost}`);
});
const urlList = Array.from(new Set(normalizedUrls));

const payload = {
  host: canonicalHost,
  key: KEY,
  keyLocation: canonicalKeyLocation,
  urlList: urlList,
};

console.log("[IndexNow] Payload to send:");
console.log(JSON.stringify(payload, null, 2));

// Attempt POST to endpoints in order (Bing -> api.indexnow.org -> Yandex -> Seznam)
let overallSuccess = false;

for (const endpoint of ENDPOINTS) {
  console.log(`[IndexNow] Attempting POST request to endpoint: ${endpoint}...`);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 200 || response.status === 202) {
      const responseText = await response.text();
      console.log(`[IndexNow] Success! Response from ${endpoint}: Status ${response.status} (${response.statusText})`);
      if (responseText) {
        console.log(`[IndexNow] Response body:`, responseText);
      }
      overallSuccess = true;
      break;
    } else {
      const errorBody = await response.text();
      console.warn(`[IndexNow] Endpoint ${endpoint} returned HTTP status ${response.status} (${response.statusText}): ${errorBody}`);
    }
  } catch (error) {
    console.warn(`[IndexNow] Network error connecting to ${endpoint}:`, error.message);
  }

  console.log(`[IndexNow] Trying fallback endpoint...`);
}

if (!overallSuccess) {
  console.error("[IndexNow] Error: All IndexNow endpoints failed to accept submission.");
  process.exit(1);
}
