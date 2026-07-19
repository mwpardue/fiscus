"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";

export function EventSelectionActions({
  action,
  hasEvents,
  returnTo
}: {
  action: (formData: FormData) => void | Promise<void>;
  hasEvents: boolean;
  returnTo: string;
}) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isSelecting) {
      document
        .querySelectorAll<HTMLElement>("[data-event-selection-card]")
        .forEach((card) => {
          card.classList.remove(
            "event-selection-card-active",
            "event-selection-card-selected"
          );
          card.removeAttribute("aria-pressed");
          card.removeAttribute("role");
        });
      setSelectedIds([]);
      return;
    }

    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-event-selection-card]")
    );

    cards.forEach((card) => {
      card.classList.add("event-selection-card-active");
      card.setAttribute("aria-pressed", "false");
      card.setAttribute("role", "button");
    });

    function toggleCard(card: HTMLElement) {
      const id = card.dataset.eventId;

      if (!id) {
        return;
      }

      setSelectedIds((currentIds) => {
        const isSelected = currentIds.includes(id);
        const nextIds = isSelected
          ? currentIds.filter((currentId) => currentId !== id)
          : [...currentIds, id];

        card.classList.toggle("event-selection-card-selected", !isSelected);
        card.setAttribute("aria-pressed", String(!isSelected));

        return nextIds;
      });
    }

    function handleClick(event: Event) {
      const card =
        event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : null;

      if (!card) {
        return;
      }

      event.preventDefault();
      toggleCard(card);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const card =
        event.currentTarget instanceof HTMLElement
          ? event.currentTarget
          : null;

      if (!card) {
        return;
      }

      event.preventDefault();
      toggleCard(card);
    }

    cards.forEach((card) => {
      card.addEventListener("click", handleClick, { capture: true });
      card.addEventListener("keydown", handleKeyDown);
    });

    return () => {
      cards.forEach((card) => {
        card.removeEventListener("click", handleClick, { capture: true });
        card.removeEventListener("keydown", handleKeyDown);
        card.classList.remove("event-selection-card-active");
        card.removeAttribute("role");
      });
    };
  }, [isSelecting]);

  return (
    <div className="flex flex-wrap gap-2">
      {selectedIds.length > 0 ? (
        <form action={action} className="contents">
          <input name="returnTo" type="hidden" value={returnTo} />
          {selectedIds.map((id) => (
            <input key={id} name="ids" type="hidden" value={id} />
          ))}
          <button className="inline-flex min-h-11 items-center rounded border border-danger/30 bg-white px-4 text-sm font-semibold text-danger">
            Delete selected
          </button>
        </form>
      ) : null}
      {hasEvents ? (
        <button
          className="inline-flex min-h-11 items-center rounded border border-line bg-white px-4 text-sm font-semibold text-ink"
          type="button"
          onClick={() => {
            setIsSelecting((value) => !value);
          }}
        >
          {isSelecting ? "Cancel" : "Select"}
        </button>
      ) : null}
      <Link
        className="inline-flex min-h-11 items-center rounded border border-line bg-white px-4 text-sm font-semibold text-ink"
        href={"/events/rules" as Route}
      >
        Rules
      </Link>
      <Link
        className="inline-flex min-h-11 items-center rounded bg-mint px-4 text-sm font-semibold text-white"
        href="/events/new"
      >
        New
      </Link>
    </div>
  );
}
