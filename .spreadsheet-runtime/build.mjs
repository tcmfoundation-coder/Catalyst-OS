import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "file:///C:/Users/mukta/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = "C:/Users/mukta/Catalyst-OS/outputs/daily-life-routine-tracker";
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Daily Tracker");
sheet.showGridLines = false;
sheet.tabColor = "#0F766E";

sheet.getRange("A1").values = [["Daily Life Routine Tracker"]];
sheet.getRange("A2").values = [["Done / Skipped per routine."]];
sheet.getRange("A3").values = [["Month starting"]];
sheet.getRange("B3").values = [[new Date(Date.UTC(2026, 9, 1))]];
sheet.getRange("AF3").values = [["Month %"]];
sheet.getRange("AH3").formulas = [["=IF(COUNTIF(C7:AG18,\"<>\")=0,\"\",COUNTIF(C7:AG18,\"Done\")/COUNTIF(C7:AG18,\"<>\"))"]];
sheet.getRange("A5:B5").values = [["Routine", "Suggested time"]];
sheet.getRange("C5:AG5").formulas = [[...Array.from({length:31}, (_,i)=>`=IF(DAY(DATE(YEAR($B$3),MONTH($B$3)+1,0))>=${i+1},DATE(YEAR($B$3),MONTH($B$3),${i+1}),\"\")`)]];
sheet.getRange("AH5").values = [["Completion"]];
sheet.getRange("A6:B6").values = [["", ""]];
sheet.getRange("C6").formulas = [["=IF(C5=\"\",\"\",TEXT(C5,\"ddd\"))"]];
sheet.getRange("C6:AG6").fillRight();
sheet.getRange("AH6").values = [[""]];
const routines = [
  ["Wake up at target time", "Morning"],
  ["Drink water", "Morning"],
  ["Morning hygiene", "Morning"],
  ["Stretch or move", "Morning"],
  ["Eat a balanced breakfast", "Morning"],
  ["Plan the day", "Daytime"],
  ["Complete a focus session", "Daytime"],
  ["Take a proper break", "Daytime"],
  ["Read or learn something", "Anytime"],
  ["Tidy/reset your space", "Evening"],
  ["Journal or reflect", "Evening"],
  ["Wind down for sleep", "Evening"],
];
sheet.getRange("A7:B18").values = routines;
sheet.getRange("C7:AG18").dataValidation = { rule: { type: "list", values: ["Done", "Skipped"] } };
sheet.getRange("AH7").formulas = [["=IFERROR(COUNTIF(C7:AG7,\"Done\")/COUNTIF(C7:AG7,\"<>\"),\"\")"]];
sheet.getRange("AH7:AH18").fillDown();
sheet.getRange("A19:B19").values = [["Daily completion", ""]];
sheet.getRange("C19").formulas = [["=IF(COUNTIF(C7:C18,\"<>\")=0,\"\",COUNTIF(C7:C18,\"Done\")/COUNTIF(C7:C18,\"<>\"))"]];
sheet.getRange("C19:AG19").fillRight();
sheet.getRange("AH19").formulas = [["=IF(AH3=\"\",\"\",AH3)"]];

sheet.getRange("A1:AH19").format.font = { name: "Arial", size: 10, color: "#243247" };
sheet.getRange("A1").format.font = { name: "Arial", size: 16, bold: true, color: "#123B42" };
sheet.getRange("A2").format.font = { name: "Arial", size: 10, italic: true, color: "#5B6877" };
sheet.getRange("A1").format.rowHeight = 28;
sheet.getRange("A2").format.rowHeight = 22;
sheet.getRange("A3:AH3").format.verticalAlignment = "center";
sheet.getRange("A3").format.font = { bold: true, color: "#334155" };
sheet.getRange("AF3").format.font = { bold: true, color: "#334155" };
sheet.getRange("B3").format.fill = "#FFF2CC";
sheet.getRange("B3").format.numberFormat = "mmmm yyyy";
sheet.getRange("AH3").format.fill = "#E7F2F1";
sheet.getRange("AH3").format.font = { bold: true, color: "#0F766E" };
sheet.getRange("AH3").format.numberFormat = "0%";
sheet.getRange("A5:AH5").format = { fill: "#155E63", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("A5:B5").format.horizontalAlignment = "left";
sheet.getRange("A5:AH5").format.rowHeight = 26;
sheet.getRange("C5:AG5").format.numberFormat = "d";
sheet.getRange("A6:AH6").format = { fill: "#EDF4F3", font: { name: "Arial", size: 9, bold: true, color: "#45636A" }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("A7:B18").format.fill = "#F7F9FA";
sheet.getRange("B7:B18").format.font = { color: "#526171" };
sheet.getRange("C7:AG18").format = { fill: "#FFF9E8", horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("A19:AH19").format = { fill: "#DCEBE8", font: { bold: true, color: "#123B42" }, verticalAlignment: "center" };
sheet.getRange("C19:AH19").format.numberFormat = "0%";
sheet.getRange("AH7:AH18").format.numberFormat = "0%";
sheet.getRange("AH5:AH19").format.fill = "#EEF3F8";
sheet.getRange("AH5:AH6").format = { fill: "#155E63", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("AH19").format.fill = "#DCEBE8";
sheet.getRange("A5:AH19").format.verticalAlignment = "center";
sheet.getRange("A5:AH19").format.borders = { insideHorizontal: { style: "thin", color: "#E2E8F0" }, bottom: { style: "thin", color: "#C7D2DA" } };
sheet.getRange("C7:AG18").conditionalFormats.add("containsText", { text: "Done", format: { fill: "#DDF2E2", font: { color: "#276749", bold: true } } });
sheet.getRange("C7:AG18").conditionalFormats.add("containsText", { text: "Skipped", format: { fill: "#F1F3F5", font: { color: "#6B7280" } } });

sheet.getRange("A:A").format.columnWidth = 31;
sheet.getRange("B:B").format.columnWidth = 15;
sheet.getRange("C:AG").format.columnWidth = 6;
sheet.getRange("AH:AH").format.columnWidth = 13;
sheet.getRange("A7:AH19").format.rowHeight = 23;
sheet.freezePanes.freezeRows(6);
sheet.freezePanes.freezeColumns(2);

workbook.recalculate();
const inspection = await workbook.inspect({ kind: "table", range: "Daily Tracker!A1:AH19", include: "values,formulas", tableMaxRows: 20, tableMaxCols: 34, maxChars: 6000 });
console.log(inspection.ndjson);
const preview = await workbook.render({ sheetName: "Daily Tracker", range: "A1:AH19", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 300 }, summary: "formula error scan" });
console.log(errors.ndjson);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/daily-life-routine-tracker.xlsx`);
console.log(`Saved ${outputDir}/daily-life-routine-tracker.xlsx`);








