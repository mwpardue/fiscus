import type React from "react";

export const fieldControlClass =
  "min-h-11 w-full min-w-0 rounded border border-line bg-white px-2 text-sm sm:min-h-12 sm:px-3 sm:text-base";

export const compactFieldControlClass =
  "min-h-11 min-w-0 rounded border border-line bg-white px-2 text-sm sm:min-h-12 sm:px-3 sm:text-base";

export const dateFieldControlClass =
  "block h-11 w-full min-w-0 max-w-full appearance-none overflow-hidden rounded border border-line bg-white px-2 text-left text-sm sm:h-12 sm:px-3 sm:text-base";

export const primaryActionClass =
  "min-h-12 rounded bg-mint px-4 font-semibold text-white disabled:opacity-60";

export const secondaryActionClass =
  "inline-flex min-h-12 items-center justify-center rounded border border-line bg-white px-4 font-semibold text-ink";

export function EventFormSection({
  children,
  description,
  title
}: {
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded border border-line bg-white p-3 sm:gap-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-700">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ChoiceButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "min-h-11 rounded border border-mint bg-mint px-2 text-sm font-semibold text-white sm:min-h-12 sm:px-3"
          : "min-h-11 rounded border border-line bg-white px-2 text-sm font-semibold text-gray-700 sm:min-h-12 sm:px-3"
      }
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AmountStatusPicker({
  defaultStatus = "fixed",
  disabled = false,
  hideLegend = false,
  legend = "Amount status"
}: {
  defaultStatus?: "fixed" | "estimated" | "unknown";
  disabled?: boolean;
  hideLegend?: boolean;
  legend?: string;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className={hideLegend ? "sr-only" : "text-sm font-semibold text-ink"}>
        {legend}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {(["fixed", "estimated", "unknown"] as const).map((status) => (
          <label className="grid cursor-pointer" key={status}>
            <input
              className="peer sr-only"
              defaultChecked={defaultStatus === status}
              disabled={disabled}
              name="amountStatus"
              type="radio"
              value={status}
            />
            <span className="flex min-h-11 items-center justify-center rounded border border-line bg-white px-2 text-xs font-semibold text-gray-700 peer-checked:border-mint peer-checked:bg-mint peer-checked:text-white peer-disabled:opacity-60 sm:min-h-12 sm:px-3 sm:text-sm">
              {status[0].toUpperCase()}
              {status.slice(1)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CurrencyAmountField({
  currencyCode,
  defaultValue,
  disabled = false,
  label,
  onChange,
  placeholder = "125.00",
  value
}: {
  currencyCode: string;
  defaultValue?: string;
  disabled?: boolean;
  label: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  value?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-ink">
      {label}
      <span className="grid min-h-12 grid-cols-[1fr_auto] overflow-hidden rounded border border-line bg-white">
        <input
          className="min-w-0 border-0 bg-transparent px-2 text-sm outline-none disabled:bg-paper sm:px-3 sm:text-base"
          defaultValue={defaultValue}
          disabled={disabled}
          inputMode="decimal"
          name="expectedAmount"
          onChange={onChange}
          placeholder={placeholder}
          value={value}
        />
        <span className="flex items-center border-l border-line bg-paper px-3 text-sm font-semibold text-gray-700">
          {currencyCode}
        </span>
      </span>
    </label>
  );
}

export function DatePreviewList({
  dates,
  description,
  emptyMessage = "Enter a first due date to preview the generated schedule."
}: {
  dates: string[];
  description: string;
  emptyMessage?: string;
}) {
  return (
    <section className="grid min-w-0 gap-3 rounded border border-mint/20 bg-mint/10 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Preview</h2>
        <p className="text-xs font-medium text-gray-700">{dates.length} dates</p>
      </div>
      <p className="text-sm text-gray-700">{description}</p>
      {dates.length > 0 ? (
        <ol className="grid max-h-56 gap-2 overflow-auto text-sm text-ink sm:grid-cols-2">
          {dates.map((date) => (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded border border-line bg-white px-2 py-2 sm:gap-3 sm:px-3"
              key={date}
            >
              <span className="rounded border border-line bg-paper px-2 py-1 text-xs font-semibold text-ink">
                {formatWeekday(date)}
              </span>
              <span className="min-w-0 text-sm font-semibold sm:text-base">
                {formatDisplayDate(date)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded border border-line bg-white px-3 py-2 text-sm text-gray-700">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(parseDateOnly(date));
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short"
  }).format(parseDateOnly(date));
}

function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
