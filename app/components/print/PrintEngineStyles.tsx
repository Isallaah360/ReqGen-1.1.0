export default function PrintEngineStyles() {
  return <style jsx global>{`
    .iet-print-document{background:#fff;color:#0f172a;font-family:Arial,Helvetica,sans-serif;margin:0 auto;box-sizing:border-box;min-height:297mm;padding:12mm 12mm 16mm;position:relative}
    .iet-print-portrait{width:210mm}.iet-print-landscape{width:297mm;min-height:210mm}
    .iet-print-header{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #0f3d5e;padding-bottom:9px}
    .iet-print-brand{display:flex;align-items:center;gap:12px}.iet-print-org{font-size:17px;font-weight:900;color:#0f3d5e;letter-spacing:.25px}.iet-print-system{font-size:11px;font-weight:800;color:#b45309;margin-top:2px}.iet-print-address{font-size:9px;color:#475569;margin-top:3px}
    .iet-print-meta{font-size:8.5px;line-height:1.55;text-align:right;max-width:78mm}
    .iet-print-title-block{text-align:center;padding:10px 0 8px}.iet-print-title-block h1{font-size:17px;line-height:1.2;margin:0;color:#0f172a;text-transform:uppercase}.iet-print-title-block p{font-size:9.5px;color:#475569;margin:4px 0 0}
    .iet-print-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:5px 0 9px}.iet-print-summary-card{border:1px solid #cbd5e1;border-radius:5px;padding:6px;background:#f8fafc}.iet-print-summary-card span{display:block;font-size:7.5px;text-transform:uppercase;font-weight:800;color:#64748b}.iet-print-summary-card strong{display:block;font-size:12px;margin-top:2px;color:#0f3d5e}
    .iet-print-section{margin-top:7px}.iet-print-table{width:100%;border-collapse:collapse;table-layout:auto;font-size:7.6px}.iet-print-table th{background:#0f3d5e;color:#fff;padding:5px 4px;border:1px solid #0b304b;text-transform:uppercase;font-size:7px}.iet-print-table td{padding:4px;border:1px solid #cbd5e1;vertical-align:top;overflow-wrap:anywhere}.iet-print-table tbody tr:nth-child(even){background:#f8fafc}.iet-print-empty{text-align:center;padding:16px!important;color:#64748b}
    .iet-print-notes-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.iet-print-notes-grid>div{border:1px solid #cbd5e1;border-radius:5px;padding:7px;break-inside:avoid}.iet-print-notes-grid h2{font-size:9px;text-transform:uppercase;color:#0f3d5e;margin:0 0 4px}.iet-print-notes-grid ol{margin:0;padding-left:16px;font-size:8px;line-height:1.45}
    .iet-print-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px;break-inside:avoid}.iet-print-signatures div{border-top:1px solid #334155;padding-top:4px;text-align:center}.iet-print-signatures span{display:block;font-size:7px;text-transform:uppercase;color:#64748b}.iet-print-signatures b{font-size:8px}
    .iet-print-footer{position:absolute;left:12mm;right:12mm;bottom:6mm;border-top:1px solid #94a3b8;padding-top:4px;display:flex;justify-content:space-between;font-size:7px;color:#475569}.iet-page-number:after{content:" " counter(page)}
    @media print{
      @page{size:A4 portrait;margin:0}.iet-print-landscape{@page{size:A4 landscape;margin:0}}
      html,body{background:#fff!important}.no-print,[data-print-hide="true"]{display:none!important}.print-only{display:block!important}
      .iet-print-document{box-shadow:none!important;margin:0!important;page-break-after:always}.iet-print-table thead{display:table-header-group}.iet-print-table tr,.iet-print-summary-card,.iet-print-notes-grid>div{break-inside:avoid}
    }
    @media screen{.print-only{display:none}.iet-print-document{box-shadow:0 24px 60px rgba(15,23,42,.14);margin:20px auto}}
  `}</style>;
}
