// Writes the sample supplier quote PDFs from the same data the app imports. Run: node tools/make-quotes.mjs
import { writeFileSync } from 'node:fs';
import { QUOTES, SUPPLIERS, INGREDIENTS } from '../js/data.js';

function pdf(ops) {
  const content = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const off = objs.map((o, i) => { const at = Buffer.byteLength(out, 'latin1'); out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const text = (x, y, size, str, bold) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${String(str).replace(/[\\()]/g, '\\$&')}) Tj ET`;
const rule = (y) => `0.75 G 50 ${y} m 545 ${y} l S`;

for (const q of QUOTES) {
  const sup = SUPPLIERS.find((s) => s.id === q.sup);
  const ops = [
    text(50, 780, 22, sup.name, true), text(50, 760, 10, `${sup.city}, Republic of Maldives  |  ${sup.phone}`),
    text(400, 780, 14, 'QUOTATION', true), text(400, 762, 10, `No. ${q.no}`), text(400, 748, 10, 'Valid for 14 days'),
    text(50, 716, 10, 'To: Kandu Café, Dhangethi, Alifu Dhaalu Atoll'), text(50, 702, 10, 'Delivery: next supply boat, freight included'),
    rule(684), text(50, 668, 10, 'Item', true), text(330, 668, 10, 'Unit', true), text(440, 668, 10, 'Price (MVR)', true), rule(660),
  ];
  let y = 642;
  for (const [id, price] of Object.entries(q.lines)) {
    const g = INGREDIENTS.find((x) => x.id === id);
    ops.push(text(50, y, 10, g.name), text(330, y, 10, `per ${g.unit === 'pcs' ? 'pc' : g.unit}`), text(440, y, 10, price.toFixed(2)));
    y -= 20;
  }
  ops.push(rule(y + 6), text(50, y - 16, 9, 'Prices exclude GST. Sample document for the Kandu Café demo. Supplier and prices are fictional.'));
  writeFileSync(new URL(`../${q.file}`, import.meta.url), pdf(ops));
  console.log('wrote', q.file);
}
