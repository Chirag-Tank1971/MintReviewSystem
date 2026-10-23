/**
 * jsPDF + html2canvas are ~600 KB. Importing them statically put them on every page load
 * (the dashboard imports the letter/scheme exporters), so load them only when an export runs.
 */
export async function loadPdfLibs() {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  return { jsPDF, html2canvas };
}
