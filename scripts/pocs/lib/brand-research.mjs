function stripScriptsAndStyles(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(text) {
  return decodeEntities(
    text
      .replace(/\s+/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .trim(),
  );
}

function extractMatches(html, pattern, limit = 30) {
  const values = [];
  const regex = new RegExp(pattern, "gis");
  let match;

  while ((match = regex.exec(html)) && values.length < limit) {
    const raw = match[1] ?? "";
    const text = cleanText(raw.replace(/<[^>]+>/g, " "));

    if (text) {
      values.push(text);
    }
  }

  return [...new Set(values)];
}

function extractMetaContent(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }

  return null;
}

function scorePath(pathname) {
  const highSignalPatterns = [
    /about/i,
    /pricing/i,
    /product/i,
    /products/i,
    /service/i,
    /services/i,
    /feature/i,
    /features/i,
    /solution/i,
    /solutions/i,
    /case-stud/i,
    /customers/i,
    /how-it-works/i,
  ];

  let score = 0;

  for (const pattern of highSignalPatterns) {
    if (pattern.test(pathname)) {
      score += 2;
    }
  }

  if (pathname === "/" || pathname === "") {
    score += 3;
  }

  if (pathname.split("/").length <= 3) {
    score += 1;
  }

  return score;
}

export function resolveBrandUrl() {
  const configuredUrl =
    process.env.BRAND_RESEARCH_URL?.trim() ||
    process.env.POC_BRAND_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://metis-ai-nine.vercel.app";

  try {
    return new URL(configuredUrl).toString();
  } catch {
    throw new Error(
      "Missing valid brand URL. Set BRAND_RESEARCH_URL or POC_BRAND_URL in .env.local.",
    );
  }
}

export async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "MetisAIPOC/0.1 (+brand-research)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    const html = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      html,
      contentType: response.headers.get("content-type"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function extractPageData(pageUrl, html) {
  const sanitizedHtml = stripScriptsAndStyles(html);
  const title = cleanText((sanitizedHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]+>/g, " "));
  const metaDescription =
    extractMetaContent(sanitizedHtml, "description") ||
    extractMetaContent(sanitizedHtml, "og:description");
  const h1 = extractMatches(sanitizedHtml, "<h1[^>]*>([\\s\\S]*?)<\\/h1>", 10);
  const h2 = extractMatches(sanitizedHtml, "<h2[^>]*>([\\s\\S]*?)<\\/h2>", 20);
  const paragraphs = extractMatches(sanitizedHtml, "<p[^>]*>([\\s\\S]*?)<\\/p>", 30);
  const listItems = extractMatches(sanitizedHtml, "<li[^>]*>([\\s\\S]*?)<\\/li>", 30);
  const ctas = [
    ...extractMatches(sanitizedHtml, "<a[^>]*>([\\s\\S]*?)<\\/a>", 50),
    ...extractMatches(sanitizedHtml, "<button[^>]*>([\\s\\S]*?)<\\/button>", 20),
  ]
    .filter((text) => text.length >= 2 && text.length <= 80)
    .slice(0, 20);

  const linkMatches = [...sanitizedHtml.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi)];
  const links = linkMatches
    .map((match) => match[1])
    .map((href) => {
      try {
        return new URL(href, pageUrl);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((url) => ["http:", "https:"].includes(url.protocol))
    .map((url) => url.toString());

  const bodyText = cleanText(
    sanitizedHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h1|h2|h3|section|article|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );

  return {
    pageUrl,
    title: title || null,
    metaDescription,
    h1,
    h2,
    paragraphs,
    listItems,
    ctas,
    links,
    bodyText,
  };
}

export function chooseHighSignalLinks(baseUrl, pageData, visitedUrls, maxLinks = 4) {
  const base = new URL(baseUrl);

  return [...new Set(pageData.links)]
    .filter((link) => {
      const url = new URL(link);
      return url.host === base.host;
    })
    .filter((link) => !visitedUrls.has(link))
    .map((link) => ({ link, pathname: new URL(link).pathname }))
    .filter(({ pathname }) => pathname && pathname !== "/")
    .filter(({ pathname }) => !/\.(png|jpg|jpeg|gif|svg|webp|pdf|zip)$/i.test(pathname))
    .sort((left, right) => scorePath(right.pathname) - scorePath(left.pathname))
    .slice(0, maxLinks)
    .map((item) => item.link);
}

export function buildBrandResearchBundle(pages, startUrl) {
  const pageSummaries = pages.map((page) => ({
    url: page.pageUrl,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1.slice(0, 5),
    h2: page.h2.slice(0, 8),
    ctas: page.ctas.slice(0, 10),
    paragraphCount: page.paragraphs.length,
  }));

  const bundleSections = [];

  for (const page of pages) {
    bundleSections.push(`URL: ${page.pageUrl}`);

    if (page.title) {
      bundleSections.push(`Title: ${page.title}`);
    }

    if (page.metaDescription) {
      bundleSections.push(`Meta description: ${page.metaDescription}`);
    }

    if (page.h1.length) {
      bundleSections.push(`H1: ${page.h1.join(" | ")}`);
    }

    if (page.h2.length) {
      bundleSections.push(`H2: ${page.h2.slice(0, 8).join(" | ")}`);
    }

    if (page.ctas.length) {
      bundleSections.push(`CTAs: ${page.ctas.slice(0, 10).join(" | ")}`);
    }

    if (page.paragraphs.length) {
      bundleSections.push(`Paragraphs: ${page.paragraphs.slice(0, 12).join(" ")}`);
    }

    if (page.listItems.length) {
      bundleSections.push(`List items: ${page.listItems.slice(0, 12).join(" | ")}`);
    }

    bundleSections.push("");
  }

  const bundleText = cleanText(bundleSections.join("\n"));
  const enoughSignal =
    pages.length >= 1 &&
    bundleText.length >= 1200 &&
    pageSummaries.some((page) => (page.h1?.length ?? 0) > 0 || (page.metaDescription?.length ?? 0) > 0);

  const qualityNotes = [];

  if (pages.length < 2) {
    qualityNotes.push("Only one page was captured.");
  }

  if (bundleText.length < 1200) {
    qualityNotes.push("Extracted text bundle is still thin.");
  }

  if (!pageSummaries.some((page) => page.metaDescription || page.h1.length)) {
    qualityNotes.push("Core messaging fields like H1/meta description were sparse.");
  }

  return {
    startUrl,
    pagesCrawled: pages.length,
    pageSummaries,
    bundleText,
    enoughSignal,
    qualityNotes,
  };
}
