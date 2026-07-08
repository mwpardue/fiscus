export function formatMinorAmount(amountMinor: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(amountMinor / 100);
}

export function formatMinorAmountForInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

export function parseMajorAmountToMinor(value: string) {
  return parseMajorAmount(value, false);
}

export function parseSignedMajorAmountToMinor(value: string) {
  return parseMajorAmount(value, true);
}

function parseMajorAmount(value: string, allowNegative: boolean) {
  const trimmed = value.trim();
  const pattern = allowNegative ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;

  if (!pattern.test(trimmed)) {
    return null;
  }

  const sign = trimmed.startsWith("-") ? -1 : 1;
  const normalized = trimmed.replace(/^-/, "");
  const [normalizedMajor, normalizedMinor = ""] = normalized.split(".");

  return sign * (
    Number(normalizedMajor) * 100 + Number(normalizedMinor.padEnd(2, "0"))
  );
}
