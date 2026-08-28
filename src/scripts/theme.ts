// Constants
const THEME = "theme";
const LIGHT = "light";
const DARK = "dark";

// Initial color scheme
// Can be "light", "dark", or empty string for system's prefers-color-scheme
const initialColorScheme = "light";

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

function hasManualPreference(): boolean {
  try {
    if (localStorage.getItem(THEME)) return true;
  } catch (e) {}
  if (getCookie(THEME)) return true;
  return false;
}

function getPreferTheme(): string {
  // get theme data from local storage or cookie (user's explicit choice)
  try {
    const currentTheme = localStorage.getItem(THEME);
    if (currentTheme) return currentTheme;
  } catch (e) {}

  const cookieTheme = getCookie(THEME);
  if (cookieTheme) return cookieTheme;

  // return initial color scheme if it is set (site default)
  if (initialColorScheme) return initialColorScheme;

  // return user device's prefer color scheme (system fallback)
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? DARK
    : LIGHT;
}

// Bypassing window.theme.themeValue to re-evaluate from storage (prevents race condition in WebView)
let themeValue = getPreferTheme();

function setPreference(): void {
  try {
    localStorage.setItem(THEME, themeValue);
  } catch (e) {}
  try {
    document.cookie = `${THEME}=${themeValue}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {}
  reflectPreference();
}

function reflectPreference(): void {
  document.firstElementChild?.setAttribute("data-theme", themeValue);

  document.querySelector("#theme-btn")?.setAttribute("aria-label", themeValue);

  // Get a reference to the body element
  const body = document.body;

  // Check if the body element exists before using getComputedStyle
  if (body) {
    // Get the computed styles for the body element
    const computedStyles = window.getComputedStyle(body);

    // Get the background color property
    const bgColor = computedStyles.backgroundColor;

    // Set the background color in <meta theme-color ... />
    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
}

// Update the global theme API
if (window.theme) {
  window.theme.themeValue = themeValue;
  window.theme.setPreference = setPreference;
  window.theme.reflectPreference = reflectPreference;
  window.theme.getTheme = () => themeValue;
  window.theme.setTheme = (val: string) => {
    themeValue = val;
    if (window.theme) window.theme.themeValue = val;
  };
} else {
  window.theme = {
    themeValue,
    setPreference,
    reflectPreference,
    getTheme: () => themeValue,
    setTheme: (val: string) => {
      themeValue = val;
      if (window.theme) window.theme.themeValue = val;
    },
  };
}

// Ensure theme is reflected (in case body wasn't ready when inline script ran)
reflectPreference();

function setThemeFeature(): void {
  // set on load so screen readers can get the latest value on the button
  reflectPreference();

  // now this script can find and listen for clicks on the control
  document.querySelector("#theme-btn")?.addEventListener("click", () => {
    themeValue = themeValue === LIGHT ? DARK : LIGHT;
    window.theme?.setTheme(themeValue);
    setPreference();
  });
}

// Set up theme features after page load
setThemeFeature();

// Runs on view transitions navigation
document.addEventListener("astro:after-swap", setThemeFeature);

// Set theme-color value before page transition
// to avoid navigation bar color flickering in Android dark mode
document.addEventListener("astro:before-swap", event => {
  const astroEvent = event;
  const bgColor = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");

  if (bgColor) {
    astroEvent.newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
});

// sync with system changes
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", ({ matches: isDark }) => {
    if (hasManualPreference()) return;
    themeValue = isDark ? DARK : LIGHT;
    window.theme?.setTheme(themeValue);
    reflectPreference();
  });
