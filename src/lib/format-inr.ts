/** Display amounts as Indian Rupees; stored/API values are treated as INR. */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return INR.format(Number(value));
}
