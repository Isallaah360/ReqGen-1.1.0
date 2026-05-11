export type ExportColumn<T> = {
  header: string;
  value: (row: T, index: number) => string | number | null | undefined;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(name: string) {
  return name
    .trim()
    .replace(/[^a-z0-9\-_\s]/gi, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function exportTableToExcel<T>({
  fileName,
  sheetName,
  title,
  subtitle,
  columns,
  rows,
  footerRows,
}: {
  fileName: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  footerRows?: string[][];
}) {
  const now = new Date().toLocaleString();

  const headerHtml = columns
    .map(
      (c) =>
        `<th style="border:1px solid #000;background:#dbeafe;font-weight:bold;text-align:left;">${escapeHtml(
          c.header
        )}</th>`
    )
    .join("");

  const bodyHtml = rows
    .map((row, index) => {
      const cells = columns
        .map((c) => {
          const value = c.value(row, index);
          return `<td style="border:1px solid #000;">${escapeHtml(value)}</td>`;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  const footerHtml =
    footerRows && footerRows.length > 0
      ? footerRows
          .map((r) => {
            const cells = r
              .map(
                (cell) =>
                  `<td style="border:1px solid #000;font-weight:bold;background:#f8fafc;">${escapeHtml(
                    cell
                  )}</td>`
              )
              .join("");

            return `<tr>${cells}</tr>`;
          })
          .join("")
      : "";

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(sheetName.slice(0, 31))}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>

      <body>
        <table>
          <tr>
            <td colspan="${columns.length}" style="font-size:18px;font-weight:bold;text-align:center;">
              ISLAMIC EDUCATION TRUST
            </td>
          </tr>
          <tr>
            <td colspan="${columns.length}" style="font-size:14px;font-weight:bold;text-align:center;">
              ${escapeHtml(title)}
            </td>
          </tr>
          ${
            subtitle
              ? `<tr><td colspan="${columns.length}" style="font-size:11px;text-align:center;">${escapeHtml(
                  subtitle
                )}</td></tr>`
              : ""
          }
          <tr>
            <td colspan="${columns.length}" style="font-size:10px;text-align:center;">
              Generated: ${escapeHtml(now)}
            </td>
          </tr>
          <tr><td colspan="${columns.length}"></td></tr>
          <tr>${headerHtml}</tr>
          ${bodyHtml}
          ${footerHtml}
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${safeFileName(fileName)}.xls`;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printReport() {
  window.print();
}