# rdaparser-zack

Parse R RDA files in the X binary format. I believe this is the most common form
of RDA.

## Hacking

Type checking: `npx tsc --noEmit -p .`
Run the basic test (given a data file): `deno run --allow-read=path/to/your/file.rda --allow-write=./out.csv test.js path/to/your/file.rda`
Or with node: `npx tsc && node test.js path/to/your/file.rda`
