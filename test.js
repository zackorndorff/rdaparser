import {argv, exit, stdout} from "node:process";
import * as fs from "node:fs/promises";
import { parse, load_top_list } from "./index.js";

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
    await make_csv(value, await fs.open("out.csv", "w"));
}

console.log("done");

function escape(s) {
    if (s === null || s === undefined) s = "";
    s = s.toString();
    s = s.replace("\\", "\\\\")
    s = s.replace("\"", "\\\"");
    return '"' + s + '"';
}

async function make_csv(data, file) {
    let length = data.values().next().value.length;
    for (let col of data.values()) {
        if (col.length !== length) {
            throw new Error('mismatched columns');
        }
    }
    await file.write(Array.from(data.keys()).map(escape).join(",") + '\n');

    let columns_list = Array.from(data.keys());
    for (let i = 0; i < length; i++) {
        for (let [j, key] of columns_list.entries()) {
            if (j !== 0) await file.write(",");
            await file.write(escape(data.get(key)[i]));
        }
        await file.write("\n");
    }
}
