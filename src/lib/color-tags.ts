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
  | "alteraest-dark";

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
