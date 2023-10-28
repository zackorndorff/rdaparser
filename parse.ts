"use strict";
export class ParseError extends Error {}

const customInspectSymbol = Symbol.for('nodejs.util.inspect.custom');

function debug(...args) {
    //console.log(...args);
}

export class RDAFile {
    magic_bytes: string
    version: number
    writer_version: RVersion
    min_reader_version: RVersion

    top_obj: RDA_Item

    ref_table: Array<RDA_Item>
}

// src/include/Rinternals.h
/*------ enum_SEXPTYPE ----- */
export enum SEXPTYPE {
    NILSXP	= 0,	/* nil = NULL */
    SYMSXP	= 1,	/* symbols */
    LISTSXP	= 2,	/* lists of dotted pairs */
    CLOSXP	= 3,	/* closures */
    ENVSXP	= 4,	/* environments */
    PROMSXP	= 5,	/* promises: [un]evaluated closure arguments */
    LANGSXP	= 6,	/* language constructs (special lists) */
    SPECIALSXP	= 7,	/* special forms */
    BUILTINSXP	= 8,	/* builtin non-special forms */
    CHARSXP	= 9,	/* "scalar" string type (internal only)*/
    LGLSXP	= 10,	/* logical vectors */
    INTSXP	= 13,	/* integer vectors */
    REALSXP	= 14,	/* real variables */
    CPLXSXP	= 15,	/* complex variables */
    STRSXP	= 16,	/* string vectors */
    DOTSXP	= 17,	/* dot-dot-dot object */
    ANYSXP	= 18,	/* make "any" args work */
    VECSXP	= 19,	/* generic vectors */
    EXPRSXP	= 20,	/* expressions vectors */
    BCODESXP	= 21,	/* byte code */
    EXTPTRSXP	= 22,	/* external pointer */
    WEAKREFSXP	= 23,	/* weak reference */
    RAWSXP	= 24,	/* raw bytes */
    S4SXP	= 25,	/* S4 non-vector */

    NEWSXP      = 30,   /* fresh node created in new page */
    FREESXP     = 31,   /* node released by GC */

    FUNSXP	= 99,	/* Closure or Builtin */

    /* "Administrative SXP values" from serialize.c */
    REFSXP            = 255,
    NILVALUE_SXP      = 254,
    GLOBALENV_SXP     = 253,
    UNBOUNDVALUE_SXP  = 252,
    MISSINGARG_SXP    = 251,
    BASENAMESPACE_SXP = 250,
    NAMESPACESXP      = 249,
    PACKAGESXP        = 248,
    PERSISTSXP        = 247,
    /* the following are speculative--we may or may not need them soon */
    CLASSREFSXP       = 246,
    GENERICREFSXP     = 245,
    BCREPDEF          = 244,
    BCREPREF          = 243,
    EMPTYENV_SXP	  = 242,
    BASEENV_SXP	  = 241,

    /* The following are needed to preserve attribute information on
       expressions in the constant pool of byte code objects. This is
       mainly for preserving source references attributes.  The original
       implementation of the sharing-preserving writing and reading of byte
       code objects did not account for the need to preserve attributes,
       so there is now a work-around using these SXP types to flag when
       the ATTRIB field has been written out. Object bits and S4 bits are
       still not preserved.  In the long run it might be better to change
       to a scheme in which all sharing is preserved and byte code objects
       don't need to be handled as a special case.  LT */
    ATTRLANGSXP       = 240,
    ATTRLISTSXP       = 239,

    ALTREP_SXP	  = 238,
};


// Parses magic bytes and returns file offset of following byte
function parse_magic(view: DataView, offset: number, obj: RDAFile): number {
    // First few bytes of the decompressed RDA are magic bytes
    // RDX2\n
    // where RD is for R Data or whatever
    // and the X is A, B, or X for what encoding type: ASCII, BINARY, or XDR.
    // We only support XDR, as it's the modern format.
    const magic_bytes = [offset, offset+1].map((i) => view.getUint8(i))
                           .map((ch) => String.fromCharCode(ch))
                           .join('');
    offset += 2;

    const EXPECTED_MAGIC = "RD";
    if (magic_bytes !== EXPECTED_MAGIC) {
        throw new ParseError(`Invalid magic bytes. Expected '${EXPECTED_MAGIC}', got '${magic_bytes}'`);
    }

    const EXPECTED_TYPE = "X";
    const file_type = String.fromCharCode(view.getUint8(offset++));
    if (file_type !== EXPECTED_TYPE) {
        throw new ParseError(`Unexpected RDA type. Expected '${EXPECTED_TYPE}' ,got '${file_type}'`);
    }

    const EXPECTED_VERSION = "2";
    const file_version = String.fromCharCode(view.getUint8(offset++));
    if (file_version !== EXPECTED_VERSION) {
        throw new ParseError(`Unsupported RDA version. Supported: '${EXPECTED_VERSION}', got '${file_version}'`);
    }

    const file_newline = String.fromCharCode(view.getUint8(offset++));
    if (file_newline !== "\n") {
        throw new ParseError("Missing newline at end of magic bytes.");
    }

    debug("Found magic bytes for RDA XDR version 2 file.");
    obj.magic_bytes = magic_bytes + file_type + file_version + file_newline;
    return offset;
}

function parse_format(view: DataView, offset: number, obj: RDAFile): number {
    const format = String.fromCharCode(view.getUint8(offset++));
    if (format !== "X") {
        throw new ParseError(`Format was '${format}'; only 'X' is supported.`);
    }
    const newline = String.fromCharCode(view.getUint8(offset++));
    if (newline !== "\n") {
        throw new ParseError(`Missing expected newline after format line (got ${newline}).`);
    }
    return offset;
}

export class RVersion {
    constructor(
        public major: number,
        public minor: number,
        public patch: number,
    ) {}
}

function decode_rversion(version: number): RVersion {
    const major = Math.floor(version / 65536);
    version %= 65536;
    const minor = Math.floor(version / 256);
    version %= 256;
    const patch = version;
    return new RVersion(major, minor, patch);
}

function parse_version(view: DataView, offset: number, obj: RDAFile): number {
    const version = view.getUint32(offset, false); offset += 4;
    if (version !== 2) {
        throw new ParseError(`File is version ${version.toString(16)}; only version 2 is supported.`);
    }
    obj.version = version;

    const writer_version = view.getUint32(offset, false); offset += 4;
    obj.writer_version = decode_rversion(writer_version);

    const min_reader_version = view.getUint32(offset, false); offset += 4;
    obj.min_reader_version = decode_rversion(min_reader_version);
    // TODO: validate min_reader_version

    return offset;
}

export class RDA_Item_Flags {
    levels: number
    has_tag: boolean
    has_attr: boolean
    is_object: boolean
    type: SEXPTYPE

    value: number

    constructor(value: number) {
        this.value = value;
        this.is_object = (value & (1 << 8)) !== 0;
        this.has_attr = (value & (1 << 9)) !== 0;
        this.has_tag = (value & (1 << 10)) !== 0;
        this.levels = value >> 12;
        this.type = value & 0xFF as SEXPTYPE;
        debug(`Found object of type ${SEXPTYPE[this.type]}`);
    }
    
    [customInspectSymbol](depth, options, inspect) {
        return `RDA_Item_Flags(type: ${SEXPTYPE[this.type]} (${this.type}), ${JSON.stringify(this)})`;
    }
}

export class RDA_Item {
    flags: RDA_Item_Flags
    attrib: RDA_Item | null
    tag: RDA_Item | null
}

export class LISTSXP extends RDA_Item {
    car: RDA_Item
    cdr: RDA_Item
}

function parse_listsxp(view: DataView, offset: number, obj: RDAFile, flags: RDA_Item_Flags): [number, LISTSXP] {
    let item = new LISTSXP();
    item.flags = flags;

    item.attrib = null;
    if (flags.has_attr) {
        let attrib;
        ([offset, attrib] = parse_item(view, offset, obj));
        item.attrib = attrib;
    }

    item.tag = null;
    if (flags.has_tag) {
        let tag;
        ([offset, tag] = parse_item(view, offset, obj));
        item.tag = tag;
    }

    let car, cdr;
    ([offset, car] = parse_item(view, offset, obj));
    item.car = car;

    ([offset, cdr] = parse_item(view, offset, obj));
    item.cdr = cdr;

    return [offset, item];
}

export class RDA_DataItem extends RDA_Item {
    s: any | null
}

function do_shared_parse(view: DataView, offset: number, obj: RDAFile, flags: RDA_Item_Flags, s: any): [number, RDA_DataItem] {
    let item = new RDA_DataItem;
    item.tag = null;
    item.flags = flags;
    item.s = s;

    if (flags.type === SEXPTYPE.CHARSXP) {
        // Apparently older versions of R had attributes here that are now stored elsewhere
        // So we ignore them, as R does.
        if (flags.has_attr) ([offset, ] = parse_item(view, offset, obj));
    } else {
        if (flags.has_attr) {
            let attrib;
            ([offset, attrib] = parse_item(view, offset, obj));
            item.attrib = attrib;
        }
    }
    return [offset, item];
}

class RDA_REFSXP extends RDA_Item {
    i: number
}

function parse_refsxp(view: DataView, offset: number, obj: RDAFile, flags: RDA_Item_Flags): [number, RDA_Item] {
    let i = flags.value >> 8;
    if (i == -1) {
        i = view.getUint32(offset, false); offset += 4;
    }
    let item = obj.ref_table[i-1]; // yes, -1, see GetReadRef.
    if (item === undefined) {
        throw new ParseError(`Missing REFSXP target ${i} (only ${obj.ref_table.length} so far).`);
    }
    return [offset, item];
}

let text_decoder = new TextDecoder('utf-8');
function parse_item(view: DataView, offset: number, obj: RDAFile): [number, RDA_Item] {
    const flags_int = view.getUint32(offset, false); offset += 4;
    let flags = new RDA_Item_Flags(flags_int);

    switch (flags.type) {
        case SEXPTYPE.NILVALUE_SXP://      return R_NilValue;
        case SEXPTYPE.EMPTYENV_SXP://	    return R_EmptyEnv;
        case SEXPTYPE.BASEENV_SXP://	    return R_BaseEnv;
        case SEXPTYPE.GLOBALENV_SXP://     return R_GlobalEnv;
        case SEXPTYPE.UNBOUNDVALUE_SXP://  return R_UnboundValue;
        case SEXPTYPE.MISSINGARG_SXP://    return R_MissingArg;
        {
            let item = new RDA_Item();
            item.flags = flags;
            item.attrib = null;
            item.tag = null;
            return [offset, item];
        }
        case SEXPTYPE.REFSXP:
            return parse_refsxp(view, offset, obj, flags);
        case SEXPTYPE.SYMSXP:
        {
            let item = new RDA_DataItem();
            item.flags = flags;
            // TODO what is attrib if not set
            let inner_item;
            ([offset, inner_item] = parse_item(view, offset, obj));
            obj.ref_table.push(inner_item);
            item.s = inner_item;
            return [offset, item];
        }
        case SEXPTYPE.LISTSXP:
            return parse_listsxp(view, offset, obj, flags);
        // These all have shared attribute parsing code
        case SEXPTYPE.CHARSXP:
        {
            let length = view.getInt32(offset, false); offset += 4;
            let s;
            if (length !== -1) {
                s = text_decoder.decode(view.buffer.slice(offset, offset+length)); offset += length;
            }
            return do_shared_parse(view, offset, obj, flags, s);
        }
        case SEXPTYPE.VECSXP:
        case SEXPTYPE.STRSXP: // TODO: figure out if actually same
        {
            let length = view.getInt32(offset, false); offset += 4;
            let s = [];
            for (let i = 0; i < length; i++) {
                let item;
                ([offset, item] = parse_item(view, offset, obj));
                s.push(item);
            }
            return do_shared_parse(view, offset, obj, flags, s);
        }
        case SEXPTYPE.INTSXP:
        case SEXPTYPE.LGLSXP: // TODO: disambiguate
        {
            let length = view.getInt32(offset, false); offset += 4;
            let s = [];
            for (let i = 0; i < length; i++) {
                // Values are big-endian; we cannot optimize with a Uint32Array.
                s.push(view.getInt32(offset, false)); offset += 4;
            }
            return do_shared_parse(view, offset, obj, flags, s);
        }
        case SEXPTYPE.REALSXP:
        {
            let length = view.getInt32(offset, false); offset += 4;
            let arr = new Float64Array(view.buffer.slice(offset, offset + length*8));
            offset += length*8;
            let s = Array.from(arr);
            return do_shared_parse(view, offset, obj, flags, s);
        }
        default:
            throw new ParseError(`Unsupported item type ${flags.type} (${SEXPTYPE[flags.type]})`);
    }
    throw new Error("should never get here");
}

export function parse(buffer: ArrayBuffer): RDAFile {
    let obj = new RDAFile();
    let view = new DataView(buffer);

    let offset = 0;
    offset = parse_magic(view, offset, obj);
    offset = parse_format(view, offset, obj);
    offset = parse_version(view, offset, obj);

    obj.ref_table = [];

    let item;
    ([offset, item] = parse_item(view, offset, obj));
    obj.top_obj = item;

    if (offset !== buffer.byteLength) {
        debug(`Warning: only parsed ${offset} bytes of ${buffer.byteLength} byte file.`);
    }

    return obj;
}
