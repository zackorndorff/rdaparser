import {argv, exit} from "node:process";
import * as fs from "node:fs/promises";
import {parse} from "./index.ts";

if (argv[2] === undefined) {
    console.log("you must specify a .rda file to parse");
    exit(1);
}

console.log("parsing", argv[2]);

let data = await fs.readFile(argv[2], null);

console.log("length is", data.length);

//console.log(parse(data.buffer));
parse(data.buffer);
console.log("done");
