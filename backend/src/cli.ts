import { readFileSync } from "fs";
import { analyze } from "./analyze";
const file = process.argv[2];
if (!file) {
  console.error("usage: npm run analyze -- ../sample-data/critical.json");
  process.exit(1);
}
const r = analyze(JSON.parse(readFileSync(file, "utf8")));
console.log(
  `${r.environment}: ${r.resources} resources, ${r.findings.length} findings, ${r.paths.length} attack paths`,
);
for (const p of r.paths)
  console.log(
    `${p.id} [${p.risk.severity.toUpperCase()} ${p.risk.score}] ${p.nodes.join(" -> ")}`,
  );
