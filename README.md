# rdaparser

Parse R RDA files in the X binary format. I believe this is the most common form
of RDA.

## Disclaimer

I made this because I needed to parse a serialized
[Tibble](https://github.com/tidyverse/tibble/). It probably doesn't work for
anything else. It might work for your tibble, but you'll probably have to do
some modifications depending on what data types are in your columns.

I have successfully parsed (most of) the
[https://github.com/wjakethompson/taylor](https://github.com/wjakethompson/taylor)
dataset: it's the reason this code exists. 

I don't know R. I just wanted the data and I hacked at this code until it worked
for me. It's open source mostly so I can link to it on Github; I have no plans
to fix bugs, of which there are likely many.

The `parse` exported function is likely more robust than the `load_top_list`
function. 

## Usage

You need to bz2-decompress the data first. I used
[https://github.com/sheetjs/bz2](https://github.com/sheetjs/bz2).
Then call 
```javascript
import { parse, load_top_list } from 'rdaparser';
// Use bz2 to decompress the data into a TypedArray called decompressed
const parsed = parse(decompressed.buffer);
const loaded = load_top_list(parsed);
// loaded is a Map from string name to R data variable
// Or more likely, it threw some exception and you get to hack at this until it
// works for _your_ use case too :)
```

## Hacking

Type checking: `npx tsc --noEmit -p .`  
Run the basic test (given a data file): `deno run --allow-read=path/to/your/file.rda --allow-write=./out.csv test.js path/to/your/file.rda`  
Or with node: `npx tsc && node test.js path/to/your/file.rda`  

## License

MIT. Have fun.

Except for the enum I copy-pasted from the R source code and hacked up a bit:
that retains its original license. A minified version of it is probably fair use
anyway.
