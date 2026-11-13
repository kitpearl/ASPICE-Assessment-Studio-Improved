import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const [,, inPath, outPath] = process.argv;
const buf = readFileSync(inPath);
const pages = [];
const data = await pdfParse(buf, {
  pagerender: (pageData) => pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false }).then((tc) => {
    let last = null; let out = "";
    for (const it of tc.items) {
      if (last && Math.abs(last.transform[5] - it.transform[5]) > 2) out += "\n";
      else if (last && it.transform[4] - (last.transform[4] + last.width) > 2) out += " ";
      out += it.str; last = it;
    }
    pages.push(out);
    return out;
  }),
});
const joined = pages.map((p, i) => `\n<!-- Page ${i + 1} -->\n${p}`).join("\n");
writeFileSync(outPath, joined, "utf8");
console.log("pages", data.numpages, "chars", joined.length);
