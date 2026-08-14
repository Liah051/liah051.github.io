interface Window {
  theme?: {
    themeValue: string;
    setPreference: () => void;
    reflectPreference: () => void;
    getTheme: () => string;
    setTheme: (val: string) => void;
  };
}

declare namespace JSX {
  interface IntrinsicElements {
    Word: any;
    InlineImage: any;
  }
}

declare module "remark-join-cjk-lines";

