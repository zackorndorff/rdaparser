import { RDAFile, SEXPTYPE, RDA_Item_Flags, RDA_Item, LISTSXP, RDA_DataItem } from './parse.ts';

export class LoadError extends Error {}

function debug(...args) {
    //console.log(...args);
}

function expect_type(typ: SEXPTYPE, obj: RDA_Item, error_desc: string): RDA_Item {
    if (obj === null || obj === undefined) {
        throw new LoadError(`Expected item type ${SEXPTYPE[typ]} (${typ}), got null while parsing ${error_desc}`);
    }
    if (obj.flags.type !== typ) {
        throw new LoadError(`Expected item type ${SEXPTYPE[typ]} (${typ}), got ${SEXPTYPE[obj.flags.type]} (${obj.flags.type}) while parsing ${error_desc}`);
    }
    return obj;
}

const HANDLER_TABLE = {
    "data.frame": load_data_frame,
}

export function load_top_list(file: RDAFile): any {
    let top_level = new Map();
    debug("loading data");

    /*
     * We expect:
     * the top object to be a LISTSXP where each cons cell has a tag with a name
     */

    walk_list(file.top_obj, (i: RDA_Item, tag) => {
        const s = (expect_type(SEXPTYPE.CHARSXP, tag.s, "tibble tag symbol value") as RDA_DataItem).s;
        debug("parsing data named", s);
        top_level.set(s, load_item(i));
    });
    return top_level;
}

function load_item(obj: RDA_Item) {
    const class_list = strsxp_to_array(get_attrib_by_name(obj.attrib, "class", false));
    debug("object has type", SEXPTYPE[obj.flags.type]);
    debug("object has class list:", class_list);
    for (let klass of class_list) {
        if (HANDLER_TABLE.hasOwnProperty(klass)) {
            return HANDLER_TABLE[klass](obj);
        }
    }
    throw new LoadError(`No load handler for object with types ${JSON.stringify(class_list)}`);
}

function load_data_frame(df: RDA_Item): Map<string, any> {
    /*
     *  data.frame structure is:
     *      attribute LISTSXP of attribs
     *          where one of them is tagged with a REFSXP to a CHARSXP "names"
     *          with car of
     *              STRSXP, where each item is a column name
     *      a VECSXP of columns
     */
    // Load column names
    let names_attrib = get_attrib_by_name(df.attrib, "names", false);
    if (names_attrib === undefined) {
        // The inner data.frames have 'names' as a symbol, the outer one does
        // not. I have no idea why.
        names_attrib = get_attrib_by_name(df.attrib, "names", true);
    }

    const names_item = expect_type(SEXPTYPE.STRSXP, names_attrib, "data.frame names attribute") as RDA_DataItem;

    let column_names = [];
    for (let i = 0; i < names_item.s.length; i++) {
        const cur_charsxp = expect_type(SEXPTYPE.CHARSXP, names_item.s[i], "tibble column names charsxp #${i}") as RDA_DataItem;
        column_names.push(cur_charsxp.s);
    }
    debug("Found column names", column_names);

    // ignoring row.names for now, I just don't care yet

    const main_vecsxp = expect_type(SEXPTYPE.VECSXP, df, "tibble data vecsxp") as RDA_DataItem;

    //debug_print_attribs(main_vecsxp.attrib);

    // Data structure is going to be an ordered map of column name to list of
    // column data, since that's what it is in the file.
    // We'll construct objects for it at another layer.
    let data = new Map();
    for (let [column_idx, column_name] of column_names.entries()) {
        debug(`Loading column ${column_idx} "${column_name}"`);
        let col = main_vecsxp.s[column_idx];
        let col_data = [];
        if (col.flags.type !== SEXPTYPE.VECSXP) {
            if (col.hasOwnProperty("attrib") && col.attrib !== undefined && get_attrib_by_name(col.attrib, "class", false) !== undefined) {
                let class_list = strsxp_to_array(get_attrib_by_name(col.attrib, "class", false));
                // TODO better message
                console.log("WARNING: thing had class and we didn't expect it to", class_list);
            }
        }
        switch (col.flags.type) {
            case SEXPTYPE.STRSXP:
            {
                col_data = strsxp_to_array(col);
                break;
            }
            case SEXPTYPE.LGLSXP:
                for (let i of col.s) col_data.push(i);
                break;
            case SEXPTYPE.REALSXP:
                for (let i of col.s) col_data.push(i);
                break;
            case SEXPTYPE.INTSXP:
                for (let i of col.s) col_data.push(i);
                break;
            case SEXPTYPE.VECSXP:
                for (let i of col.s) {
                    col_data.push(load_item(i));
                }
                break;
            default:
                throw new LoadError(`Found unhandled column type ${SEXPTYPE[col.flags.type]} (${col.flags.type}) while loading column ${column_idx} "${column_name}"`);
                break;
        }
        data.set(column_name, col_data);
    }
    return data;
}

function walk_list(maybe_list: RDA_Item, callback): any {
    if (maybe_list.flags.type !== SEXPTYPE.LISTSXP) {
        throw new LoadError(`tried to walk list but type is ${SEXPTYPE[maybe_list.flags.type]} (${maybe_list.flags.type})`);
    }
    let list = maybe_list as LISTSXP
    // type of last cdr cell is NILVALUE_SXP
    while (list.flags.type === SEXPTYPE.LISTSXP) {
        let result = callback(list.car, list.tag);
        if (result !== undefined) {
            return result;
        } else {
            // @ts-ignore
            list = list.cdr;
        }
    }
}

function debug_print_attribs(attrib_list: LISTSXP) {
    debug("Attrib list:");
    walk_list(attrib_list, (i, tag) => {
        switch (tag.flags.type) {
            case SEXPTYPE.SYMSXP:
                let sym_str = (expect_type(SEXPTYPE.CHARSXP, tag.s, "attrib sym value") as RDA_DataItem).s;
                debug(`  SYM: ${sym_str}`, SEXPTYPE[i.flags.type]);
                break;
            case SEXPTYPE.CHARSXP:
                debug(`  ${tag.s}`, SEXPTYPE[i.flags.type]);
                break;
            default:
                throw new Error("bad " + SEXPTYPE[tag.flags.type]);
                break;
        }
    });
}

function get_attrib_by_name(attrib_list: RDA_Item, name: string, is_symbol: boolean): RDA_Item | undefined {
    return walk_list(attrib_list, (i, tag) => {
        switch (tag.flags.type) {
            case SEXPTYPE.SYMSXP:
                if (!is_symbol) return;
                let sym_str = expect_type(SEXPTYPE.CHARSXP, tag.s, "attrib sym value") as RDA_DataItem;
                if (sym_str.s == name) return i;
                break;
            case SEXPTYPE.CHARSXP:
                if (is_symbol) return;
                if (tag.s == name) return i;
                break;
        }
    });
}

function strsxp_to_array(list: RDA_Item): Array<string> {
    let di_list = expect_type(SEXPTYPE.STRSXP, list, "strsxp_to_array") as RDA_DataItem;
    return di_list.s.map((i) => (expect_type(SEXPTYPE.CHARSXP, i, "strsxp list member") as RDA_DataItem).s);
}
