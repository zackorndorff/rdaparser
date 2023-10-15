# rdaparser-zack

Parse R RDA files in the X binary format. I believe this is the most common form
of RDA.

## Hacking

Type checking: `npx tsc --noEmit -p .`
Run the basic test (given a data file): `deno run --allow-read=path/to/your/file.rda test.js path/to/your/file.rda`
