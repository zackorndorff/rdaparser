import {argv, exit} from "node:process";
import * as fs from "node:fs/promises";
import { parse, load_top_list } from "./index.ts";

if (argv[2] === undefined) {
    console.log("you must specify a .rda file to parse");
    exit(1);
}

console.log("parsing", argv[2]);

let data = await fs.readFile(argv[2], null);

console.log("length is", data.length);

//console.log(parse(data.buffer));
const parsed = parse(data.buffer);

const top_level = load_top_list(parsed);

for (let [name, value] of top_level.entries()) {
    console.log("got", name, "table with columns", Array.from(value.keys()).join(", "));
}

console.log("done");
