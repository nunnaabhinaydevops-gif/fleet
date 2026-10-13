type DownloadResult = {
  blob: Blob;
  fileName: string;
};

export function downloadPdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function generateTripPdf(trip: unknown, remarks = "", contactNumber = "", includeCompanyName = true): Promise<DownloadResult> {
  const content = JSON.stringify({ trip, remarks, contactNumber, includeCompanyName }, null, 2);
  return { blob: new Blob([content], { type: "application/pdf" }), fileName: "trip.pdf" };
}

export async function generateLrPdf(form: unknown): Promise<DownloadResult> {
  const content = JSON.stringify(form, null, 2);
  return { blob: new Blob([content], { type: "application/pdf" }), fileName: "lorry-receipt.pdf" };
}
