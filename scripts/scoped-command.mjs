const command = process.argv[2];
const messages = {
  "db:migrate":
    "M00: no database schema exists; migrations begin in the milestone that defines canonical persistence.",
  "db:validate": "M00: database boundary is documented; no migrations exist to validate.",
  "validation:technical": "M00: technical validation harness is scheduled for M08.",
  "validation:report": "M00: validation reporting is scheduled for M08 and M09.",
};

if (!(command in messages)) {
  throw new Error(`Unknown scoped command: ${command ?? "<missing>"}`);
}

console.log(messages[command]);
