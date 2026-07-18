"use client";

import { useState } from "react";
import {
  COLOR_TAGS,
  getAppTheme,
  isColorTagToken
} from "@/lib/color-tags";

export function ColorTagPicker({
  defaultColorToken = "",
  themeToken
}: {
  defaultColorToken?: string | null;
  themeToken: string;
}) {
  const [selectedColorToken, setSelectedColorToken] = useState(
    isColorTagToken(defaultColorToken) ? defaultColorToken : ""
  );
  const activeTheme = getAppTheme(themeToken);

  return (
    <div className="grid min-w-0 gap-2 text-sm font-medium text-ink">
      <input name="colorToken" type="hidden" value={selectedColorToken} />
      <span>Color</span>
      <div className="grid min-w-0 grid-cols-9 justify-items-center gap-2 rounded border border-line bg-paper p-3 sm:justify-items-start sm:gap-3">
        <button
          aria-label="No color"
          className={
            selectedColorToken === ""
              ? "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-mint bg-white shadow-inner ring-2 ring-mint/30 sm:h-10 sm:w-10"
              : "relative flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white shadow-inner sm:h-10 sm:w-10"
          }
          style={{
            backgroundImage:
              "linear-gradient(135deg, transparent 45%, #b42318 47%, #b42318 53%, transparent 55%)"
          }}
          type="button"
          onClick={() => {
            setSelectedColorToken("");
          }}
        >
          {selectedColorToken === "" ? (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-mint text-[0.625rem] font-bold leading-none text-white">
              ✓
            </span>
          ) : null}
        </button>
        {COLOR_TAGS.map((tag) => {
          const selected = selectedColorToken === tag.token;

          return (
            <button
              aria-label={`Select ${tag.label}`}
              className={
                selected
                  ? "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm ring-4 ring-mint sm:h-10 sm:w-10"
                  : "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-sm sm:h-10 sm:w-10"
              }
              key={tag.token}
              style={{
                backgroundColor: activeTheme.colors[tag.token]
              }}
              type="button"
              onClick={() => {
                setSelectedColorToken(tag.token);
              }}
            >
              {selected ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-mint text-[0.625rem] font-bold leading-none text-white">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
