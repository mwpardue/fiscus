export type ColorTagToken =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink";

export type ThemeToken =
  | "alteraest-light"
  | "alteraest-dark"
  | "catppuccin-mocha"
  | "catppuccin-latte"
  | "tokyo-night"
  | "gruvbox-dark"
  | "dracula"
  | "nord"
  | "solarized-dark";

export type ColorTag = {
  token: ColorTagToken;
  label: string;
};

export type ResolvedColorTag = ColorTag & {
  background: string;
  foreground: string;
};

export type AppTheme = {
  token: ThemeToken;
  label: string;
  colors: Record<ColorTagToken, string>;
  foreground: string;
};

export const DEFAULT_THEME_TOKEN: ThemeToken = "alteraest-light";
export const DEFAULT_COLOR_TAG_TOKEN: ColorTagToken = "blue";

export const COLOR_TAGS: ColorTag[] = [
  { token: "red", label: "Red" },
  { token: "orange", label: "Orange" },
  { token: "yellow", label: "Yellow" },
  { token: "green", label: "Green" },
  { token: "teal", label: "Teal" },
  { token: "blue", label: "Blue" },
  { token: "purple", label: "Purple" },
  { token: "pink", label: "Pink" }
];

export const APP_THEMES: AppTheme[] = [
  {
    token: "alteraest-light",
    label: "Alteraest Light",
    foreground: "#ffffff",
    colors: {
      red: "#ed8796",
      orange: "#f5a97f",
      yellow: "#eed49f",
      green: "#a6da95",
      teal: "#8bd5ca",
      blue: "#2F6BF6",
      purple: "#c6a0f6",
      pink: "#f5bde6"
    }
  },
  {
    token: "alteraest-dark",
    label: "Alteraest Dark",
    foreground: "#11182A",
    colors: {
      red: "#ed8796",
      orange: "#f5a97f",
      yellow: "#eed49f",
      green: "#a6da95",
      teal: "#8bd5ca",
      blue: "#4C8DFF",
      purple: "#c6a0f6",
      pink: "#f5bde6"
    }
  },
  {
    token: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    foreground: "#1e1e2e",
    colors: {
      red: "#f38ba8",
      orange: "#fab387",
      yellow: "#f9e2af",
      green: "#a6e3a1",
      teal: "#94e2d5",
      blue: "#89b4fa",
      purple: "#cba6f7",
      pink: "#f5c2e7"
    }
  },
  {
    token: "catppuccin-latte",
    label: "Catppuccin Latte",
    foreground: "#eff1f5",
    colors: {
      red: "#d20f39",
      orange: "#fe640b",
      yellow: "#df8e1d",
      green: "#40a02b",
      teal: "#179299",
      blue: "#1e66f5",
      purple: "#8839ef",
      pink: "#ea76cb"
    }
  },
  {
    token: "tokyo-night",
    label: "Tokyo Night",
    foreground: "#1a1b26",
    colors: {
      red: "#f7768e",
      orange: "#ff9e64",
      yellow: "#e0af68",
      green: "#9ece6a",
      teal: "#73daca",
      blue: "#7aa2f7",
      purple: "#bb9af7",
      pink: "#ff007c"
    }
  },
  {
    token: "gruvbox-dark",
    label: "Gruvbox Dark",
    foreground: "#282828",
    colors: {
      red: "#fb4934",
      orange: "#fe8019",
      yellow: "#fabd2f",
      green: "#b8bb26",
      teal: "#8ec07c",
      blue: "#83a598",
      purple: "#d3869b",
      pink: "#fb4934"
    }
  },
  {
    token: "dracula",
    label: "Dracula",
    foreground: "#282a36",
    colors: {
      red: "#ff5555",
      orange: "#ffb86c",
      yellow: "#f1fa8c",
      green: "#50fa7b",
      teal: "#8be9fd",
      blue: "#6272a4",
      purple: "#bd93f9",
      pink: "#ff79c6"
    }
  },
  {
    token: "nord",
    label: "Nord",
    foreground: "#2e3440",
    colors: {
      red: "#bf616a",
      orange: "#d08770",
      yellow: "#ebcb8b",
      green: "#a3be8c",
      teal: "#8fbcbb",
      blue: "#5e81ac",
      purple: "#b48ead",
      pink: "#bf616a"
    }
  },
  {
    token: "solarized-dark",
    label: "Solarized Dark",
    foreground: "#002b36",
    colors: {
      red: "#dc322f",
      orange: "#cb4b16",
      yellow: "#b58900",
      green: "#859900",
      teal: "#2aa198",
      blue: "#268bd2",
      purple: "#6c71c4",
      pink: "#d33682"
    }
  }
];

export function getAppTheme(token: string | null | undefined) {
  return (
    APP_THEMES.find((theme) => theme.token === token) ??
    APP_THEMES.find((theme) => theme.token === DEFAULT_THEME_TOKEN)!
  );
}

export function isColorTagToken(token: string | null | undefined): token is ColorTagToken {
  return COLOR_TAGS.some((tag) => tag.token === token);
}

export function isThemeToken(token: string | null | undefined): token is ThemeToken {
  return APP_THEMES.some((theme) => theme.token === token);
}

export function getColorTag(
  colorToken: string | null | undefined,
  themeToken: string | null | undefined = DEFAULT_THEME_TOKEN
): ResolvedColorTag {
  const resolvedColorToken = isColorTagToken(colorToken)
    ? colorToken
    : DEFAULT_COLOR_TAG_TOKEN;

  const theme = getAppTheme(themeToken);
  const tag = COLOR_TAGS.find(
    (colorTag) => colorTag.token === resolvedColorToken
  )!;

  return {
    ...tag,
    background: theme.colors[resolvedColorToken],
    foreground: theme.foreground
  };
}
