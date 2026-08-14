export const cleanTitle = (title: string, categoryId?: string) => {
  if (categoryId === "astralparty") {
    return title
      .replace(/^【アスパ】\s*/, "")
      .replace(/\s*[｜|]\s*アストラルパーティー$/, "");
  }
  return title;
};
