import * as XLSX from "xlsx";
import path from "path";

const filePath = path.join(__dirname, "mideer-pi.xlsx");
const wb = XLSX.readFile(filePath);
console.log("Sheets:", wb.SheetNames);

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  rows.forEach((r, i) => console.log(i, JSON.stringify(r)));
}
