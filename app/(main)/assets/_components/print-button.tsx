"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="mt-3 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
    >
      🖨 พิมพ์ QR Code
    </button>
  );
}
