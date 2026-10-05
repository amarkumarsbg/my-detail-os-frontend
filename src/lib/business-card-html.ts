import { escapeHtml } from "./tax-invoice-format";

type BusinessCardSnapshot = {
  front: HTMLElement;
  back: HTMLElement;
  title: string;
};

async function embedAsset(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load business card artwork");
  const asset = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not embed business card artwork"));
    };
    reader.onerror = () => reject(new Error("Could not embed business card artwork"));
    reader.readAsDataURL(asset);
  });
}

function snapshotFace(source: HTMLElement, families: Set<string>): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement | SVGElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<HTMLElement | SVGElement>("*")];
  originals.forEach((original, index) => {
    const computed = getComputedStyle(original);
    families.add(computed.fontFamily);
    copies[index].removeAttribute("style");
    for (let indexProperty = 0; indexProperty < computed.length; indexProperty++) {
      const property = computed.item(indexProperty);
      if (!property.startsWith("--")) {
        copies[index].style.setProperty(property, computed.getPropertyValue(property));
      }
    }
  });
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.transform = "none";
  clone.style.transformOrigin = "top left";
  clone.style.backfaceVisibility = "visible";
  clone.style.transition = "none";
  clone.style.animation = "none";
  clone.removeAttribute("tabindex");
  return clone;
}

async function embedFonts(families: Set<string>): Promise<string> {
  const fonts: string[] = [];
  async function visit(rules: CSSRuleList, baseUrl: string): Promise<void> {
    for (const rule of Array.from(rules)) {
      if (rule.type === CSSRule.FONT_FACE_RULE) {
        const font = rule as CSSFontFaceRule;
        const family = font.style.getPropertyValue("font-family").replace(/^['"]|['"]$/g, "");
        if (![...families].some((used) => used.includes(family))) continue;
        let css = font.cssText;
        const urls = [...css.matchAll(/url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/g)];
        for (const match of urls) {
          const src = match[1] ?? match[2] ?? match[3].trim();
          const embedded = await embedAsset(new URL(src, baseUrl).href);
          css = css.replace(match[0], `url("${embedded}")`);
        }
        fonts.push(css);
      } else if ("cssRules" in rule) {
        await visit((rule as CSSGroupingRule).cssRules, baseUrl);
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    await visit(rules, sheet.href || document.baseURI);
  }
  return fonts.join("\n");
}

export async function buildBusinessCardHtml(snapshot: BusinessCardSnapshot): Promise<string> {
  if (document.fonts) await document.fonts.ready;
  const computed = getComputedStyle(snapshot.front);
  const width = Number.parseFloat(computed.width) || snapshot.front.offsetWidth || 440;
  const height = Number.parseFloat(computed.height) || snapshot.front.offsetHeight || width * 2 / 3.5;
  const families = new Set<string>();
  const faces = [snapshotFace(snapshot.front, families), snapshotFace(snapshot.back, families)];
  const assets = new Map<string, Promise<string>>();
  for (const face of faces) {
    face.style.width = `${width}px`;
    face.style.height = `${height}px`;
    for (const image of Array.from(face.querySelectorAll("img"))) {
      const src = image.src;
      if (!assets.has(src)) assets.set(src, embedAsset(src));
      image.src = await assets.get(src)!;
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.removeAttribute("loading");
    }
  }
  const fonts = await embedFonts(families);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(snapshot.title)} - Business Card</title>
<style>
${fonts}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100svh;display:grid;place-items:center;padding:32px 24px;background:#eef1f5}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;width:100%;max-width:${width * 2 + 24}px;align-items:start}
.card-frame{width:100%;max-width:${width}px;height:${height}px;min-width:0}
@media(max-width:${width * 2 + 72}px){.cards{grid-template-columns:minmax(0,1fr);max-width:${width}px}}
@media print{body{min-height:0;padding:0;background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}.cards{grid-template-columns:repeat(2,minmax(0,1fr));max-width:${width * 2 + 24}px}.card-frame{break-inside:avoid}}
</style>
</head>
<body>
<main class="cards" aria-label="Business card front and back">
${faces.map((face) => `<div class="card-frame">${face.outerHTML}</div>`).join("\n")}
</main>
<script>
document.querySelectorAll('.card-frame').forEach(function(frame){
  var card=frame.firstElementChild;
  function fit(){var scale=Math.min(1,frame.clientWidth/${width});card.style.transform='scale('+scale+')';frame.style.height=(${height}*scale)+'px';}
  new ResizeObserver(fit).observe(frame);
  fit();
});
</script>
</body>
</html>`;
}