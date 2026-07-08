"use client";

import { useRef, useState } from "react";
import type { MouseEvent } from "react";

const ACTION_WIDTH = 96;
const MAX_DRAG_OFFSET = 176;
const DRAG_START_THRESHOLD = 28;
const REVEAL_THRESHOLD = 76;
const EXECUTE_THRESHOLD = 160;
const EXIT_ANIMATION_MS = 220;
const COLLAPSE_ANIMATION_MS = 160;
const HORIZONTAL_INTENT_RATIO = 1.35;

export function SwipeableEventCard({
  animateLeadingAction = true,
  animateTrailingAction = true,
  children,
  leadingAction,
  trailingAction
}: {
  animateLeadingAction?: boolean;
  animateTrailingAction?: boolean;
  children: React.ReactNode;
  leadingAction?: React.ReactNode;
  trailingAction: React.ReactNode;
}) {
  const leadingActionRef = useRef<HTMLDivElement>(null);
  const trailingActionRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const isDragging = useRef(false);
  const allowActionClick = useRef(false);
  const pendingActionButton = useRef<HTMLButtonElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState<"left" | "right" | null>(null);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
    null
  );
  const [collapsing, setCollapsing] = useState(false);

  function clamp(value: number) {
    const maxOffset = leadingAction ? MAX_DRAG_OFFSET : 0;
    return Math.max(-MAX_DRAG_OFFSET, Math.min(maxOffset, value));
  }

  function close() {
    if (exitDirection) {
      return;
    }

    setOffset(0);
    setRevealed(null);
    isDragging.current = false;
  }

  function executeAction(direction: "left" | "right") {
    const actionRoot =
      direction === "right" ? leadingActionRef.current : trailingActionRef.current;
    const button = actionRoot?.querySelector("button");
    const shouldAnimate =
      direction === "right" ? animateLeadingAction : animateTrailingAction;

    if (button && !exitDirection) {
      pendingActionButton.current = button;

      if (!shouldAnimate) {
        close();
        allowActionClick.current = true;
        button.click();
        allowActionClick.current = false;
        return;
      }

      setRevealed(null);
      setExitDirection(direction);
      setOffset(direction === "right" ? window.innerWidth : -window.innerWidth);

      window.setTimeout(() => {
        setCollapsing(true);
      }, EXIT_ANIMATION_MS);

      window.setTimeout(() => {
        allowActionClick.current = true;
        pendingActionButton.current?.click();
        allowActionClick.current = false;
      }, EXIT_ANIMATION_MS + COLLAPSE_ANIMATION_MS);
    }
  }

  function handleActionClick(
    event: MouseEvent<HTMLDivElement>,
    direction: "left" | "right"
  ) {
    if (allowActionClick.current) {
      return;
    }

    if (!(event.target instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    executeAction(direction);
  }

  return (
    <div
      className={[
        "swipe-card",
        exitDirection ? "swipe-card-exiting" : "",
        collapsing ? "swipe-card-collapsing" : ""
      ].join(" ")}
    >
      <div
        className="swipe-actions swipe-actions-left"
        ref={leadingActionRef}
        onClickCapture={(event) => handleActionClick(event, "right")}
      >
        {leadingAction}
      </div>
      <div
        className="swipe-actions swipe-actions-right"
        ref={trailingActionRef}
        onClickCapture={(event) => handleActionClick(event, "left")}
      >
        {trailingAction}
      </div>
      <div
        className="swipe-card-content"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerCancel={close}
        onPointerDown={(event) => {
          if (exitDirection) {
            return;
          }

          startX.current = event.clientX;
          startY.current = event.clientY;
          startOffset.current = offset;
          isDragging.current = false;
        }}
        onPointerMove={(event) => {
          if (exitDirection) {
            return;
          }

          if (event.pointerType === "mouse" && event.buttons !== 1) {
            return;
          }

          const delta = event.clientX - startX.current;
          const verticalDelta = Math.abs(event.clientY - startY.current);
          const horizontalDelta = Math.abs(delta);

          if (!isDragging.current) {
            if (horizontalDelta < DRAG_START_THRESHOLD) {
              return;
            }

            if (horizontalDelta < verticalDelta * HORIZONTAL_INTENT_RATIO) {
              return;
            }

            isDragging.current = true;
          }

          setOffset(clamp(startOffset.current + delta));
        }}
        onPointerUp={() => {
          if (exitDirection) {
            return;
          }

          isDragging.current = false;

          if (offset > EXECUTE_THRESHOLD && leadingAction) {
            executeAction("right");
            return;
          }

          if (offset < -EXECUTE_THRESHOLD) {
            executeAction("left");
            return;
          }

          if (offset > REVEAL_THRESHOLD && leadingAction) {
            setOffset(ACTION_WIDTH);
            setRevealed("right");
            return;
          }

          if (offset < -REVEAL_THRESHOLD) {
            setOffset(-ACTION_WIDTH);
            setRevealed("left");
            return;
          }

          close();
        }}
      >
        {revealed ? (
          <button
            aria-label="Close swipe actions"
            className="swipe-close-catcher"
            type="button"
            onClick={close}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}
