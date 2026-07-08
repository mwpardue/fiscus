"use client";

import { useState } from "react";
import {
  COLOR_TAGS,
  getAppTheme,
  isColorTagToken,
  type ColorTagToken
} from "@/lib/color-tags";

export function ColorTagPicker({
  defaultColorToken = "",
  themeToken
}: {
  defaultColorToken?: string | null;
  themeToken: string;
}) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedColorToken, setSelectedColorToken] = useState(
    isColorTagToken(defaultColorToken) ? defaultColorToken : ""
  );
  const activeTheme = getAppTheme(themeToken);

  return (
    <>
      <input name="colorToken" type="hidden" value={selectedColorToken} />
      <button
        aria-expanded={colorPickerOpen}
        aria-label="Choose color"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-paper shadow-sm"
        type="button"
        onClick={() => setColorPickerOpen((open) => !open)}
      >
        <span
          className={
            selectedColorToken
              ? "block h-7 w-7 rounded-full border-2 border-white shadow-sm ring-2 ring-line"
              : "block h-7 w-7 rounded-full border-2 border-line bg-white shadow-inner"
          }
          style={{
            backgroundColor: selectedColorToken
              ? activeTheme.colors[selectedColorToken as ColorTagToken]
              : undefined
          }}
        />
      </button>
      {colorPickerOpen ? (
        <div className="col-span-full grid min-w-full grid-cols-5 gap-3 rounded border border-line bg-paper p-3 sm:grid-cols-9">
          <button
            aria-label="No color"
            className={
              selectedColorToken === ""
                ? "aspect-square rounded-full border-2 border-mint bg-white shadow-inner ring-2 ring-mint/30"
                : "aspect-square rounded-full border border-line bg-white shadow-inner"
            }
            style={{
              backgroundImage:
                "linear-gradient(135deg, transparent 45%, #b42318 47%, #b42318 53%, transparent 55%)"
            }}
            type="button"
            onClick={() => {
              setSelectedColorToken("");
            }}
          />
          {COLOR_TAGS.map((tag) => {
            const selected = selectedColorToken === tag.token;

            return (
              <button
                aria-label={`Select ${tag.label}`}
                className={
                  selected
                    ? "aspect-square rounded-full border-2 border-white shadow-sm ring-4 ring-mint"
                    : "aspect-square rounded-full border-2 border-white shadow-sm"
                }
                key={tag.token}
                style={{
                  backgroundColor: activeTheme.colors[tag.token]
                }}
                type="button"
                onClick={() => {
                  setSelectedColorToken(tag.token);
                }}
              />
            );
          })}
        </div>
      ) : null}
    </>
  );
}
