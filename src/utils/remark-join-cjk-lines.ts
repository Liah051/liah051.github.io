import { visit, SKIP } from "unist-util-visit";

const cjk_ranges = [
  "2e80-2eff", // CJK Radicals Supplement
  "2f00-2fdf", // Kangxi Radicals
  "3040-309f", // Hiragana
  "30a0-30ff", // Katakana
  "3100-312f", // Bopomofo
  "3200-32ff", // Enclosed CJK Letters and Months
  "3400-4dbf", // CJK Unified Ideographs Extension A
  "4e00-9fff", // CJK Unified Ideographs
  "f900-faff", // CJK Compatibility Ideographs
  "3000-303f", // CJK Symbols and Punctuation
  "FF00-FFEE", // Halfwidth and Fullwidth Forms
];

const range = (str: string) => str.split("-").map(c => `\\u${c}`).join("-");
const CJK = cjk_ranges.map(range).join("");
const regex = new RegExp(`([${CJK}])(\\s*\\n+\\s*)([${CJK}])`, "gm");

export default function remarkJoinCjkLines() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      // 引用 (blockquote) の内部では CJK 行結合を行わず、改行を維持する
      if (node.type === "blockquote") {
        return SKIP;
      }
      if (node.type === "text") {
        node.value = node.value.replace(regex, "$1$3");
      }
    });
  };
}
