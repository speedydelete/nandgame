
import * as fs from 'node:fs/promises';


export interface SimplePosition {
    file: string;
    line: number;
    col: number;
}

export function simplePositionToString(pos: SimplePosition): string {
    return `${pos.file}:${pos.line}:${pos.col}`;
}

export interface MacroPositionData {
    name: string;
    pos: SimplePosition;
}

export interface Position {
    file: string;
    line: number;
    col: number;
    func?: string;
    macro?: MacroPositionData[];
}

export const PLACEHOLDER_POSITION: Position = {file: '/this_file_does_not_exist.txt', line: 1, col: 0};


export class CError extends Error {

    name: string = 'CError';
    [Symbol.toStringTag]: string = 'CError';

}


export abstract class BaseDoer {

    files: Map<string, Uint8Array>;

    constructor(from?: BaseDoer) {
        if (from) {
            this.files = from.files;
        } else {
            this.files = new Map();
        }
    }

    async getFile(name: string): Promise<Uint8Array> {
        let value = this.files.get(name);
        if (value !== undefined) {
            return value;
        } else {
            let value = new Uint8Array(await fs.readFile(name));
            this.files.set(name, value);
            return value;
        }
    }

    abstract getCurrentPosition(): Position;

    error(pos: Position | {pos: Position} | undefined, msg: string): never {
        if (pos === undefined) {
            pos = this.getCurrentPosition();
        } else if ('pos' in pos) {
            pos = pos.pos;
        }
        let trace: string[] = [];
        let value = `at `;
        if (pos.func) {
            value += `${pos.func} at `;
        }
        value += simplePositionToString(pos);
        trace.push(value);
        if (pos.macro) {
            for (let value of pos.macro) {
                trace.push(`at expansion of macro '${value.name}' at ${simplePositionToString(value.pos)}`);
            }
        }
        let text = `Error: ${msg}\n${trace.map(x => `    ${x}`).join('\n')}`;
        throw new CError(text);
    }

}


export abstract class BaseSimpleDoer extends BaseDoer {

    currentPos: Position;

    constructor(from?: BaseDoer) {
        super(from);
        this.currentPos = undefined as unknown as Position;
    }

    getCurrentPosition(): Position {
        return this.currentPos;
    }

}


export type BaseToken = {pos: Position};

export const EOF = Symbol();
export type EOF = typeof EOF;

export abstract class BaseParser<Token extends BaseToken, Matcher extends EOF | unknown> extends BaseDoer {

    tokens: Token[];
    pos: number;

    constructor(from?: BaseDoer) {
        super(from);
        this.tokens = [];
        this.pos = 0;
    }

    getCurrentPosition(): Position {
        if (this.tokens[this.pos] === undefined) {
            return this.tokens[this.tokens.length - 1].pos;
        } else {
            return this.tokens[this.pos].pos;
        }
    }

    abstract peek(): Token;
    abstract peekOrEOF(): Token | EOF;
    abstract advance(): Token;
    abstract advanceOrEOF(): Token | EOF;

    abstract _match(token: Token | EOF, matcher: Matcher): boolean;

    match(...data: Matcher[]): boolean {
        for (let i = 0; i < data.length; i++) {
            let token = (this.tokens[this.pos + i] ?? EOF) as Token | EOF;
            if (!this._match(token, data[i])) {
                return false;
            }
        }
        return true;
    }

    abstract _expect(token: Token | EOF, matcher: Matcher): void;

    expect(...data: Matcher[]): void {
        for (let i = 0; i < data.length; i++) {
            let token = (this.tokens[this.pos + i] ?? EOF) as Token | EOF;
            this._expect(token, data[i]);
        }
    }

    abstract eat(value: Matcher): Token;

    isAtEnd(): boolean {
        return this.pos >= this.tokens.length;
    }

    try<T, U extends any[]>(func: (this: this, ...args: U) => T, ...args: U): T | undefined {
        try {
            return func.apply(this, args);
        } catch (error) {
            if (error instanceof CError) {
                return undefined;
            } else {
                throw error;
            }
        }
    }

    tryVoid<T extends any[]>(func: (this: this, ...args: T) => void, ...args: T): boolean {
        try {
            func.apply(this, args);
            return true;
        } catch (error) {
            if (error instanceof CError) {
                return false;
            } else {
                throw error;
            }
        }
    }

}


export namespace t {

    export type BaseObject = {const?: boolean, volatile?: boolean, align?: number};

    export const BOOL = {type: 'bool', size: 1, bits: 1} as const;
    export type Bool = BaseObject & typeof BOOL;

    // char is signed
    export const CHAR = {type: 'char', size: 1, bits: 16} as const;
    export type Char = BaseObject & typeof CHAR;

    export const SIGNED_CHAR = {type: 'signed char', size: 1, bits: 16} as const;
    export type SignedChar = BaseObject & typeof SIGNED_CHAR;

    export const SHORT_INT = {type: 'short int', size: 1, bits: 16} as const;
    export type ShortInt = BaseObject & typeof SHORT_INT;

    export const INT = {type: 'int', size: 1, bits: 16} as const;
    export type Int = BaseObject & typeof INT;

    export const LONG_INT = {type: 'long int', size: 2, bits: 32} as const;
    export type LongInt = BaseObject & typeof LONG_INT;

    export const LONG_LONG_INT = {type: 'long long int', size: 4, bits: 64} as const;
    export type LongLongInt = BaseObject & typeof LONG_LONG_INT;

    export type BitInt = BaseObject & {type: '_BitInt', size: number, bits: number};
    export function _BitInt(bits: number): BitInt {
        return {type: '_BitInt', size: Math.ceil(bits / 16), bits};
    }

    export const BUILTIN_INT8 = {type: '__builtin_int8', size: 1, bits: 8} as const;
    export type BuiltinInt8 = BaseObject & typeof BUILTIN_INT8;

    export type SignedInteger = SignedChar | ShortInt | Int | LongInt | LongLongInt | BitInt | BuiltinInt8;
    export function isSignedInteger(type: Type): type is SignedInteger {
        return type.type === 'signed char' || type.type === 'short int' || type.type === 'int' || type.type === 'long int' || type.type === 'long long int' || type.type === '_BitInt' || type.type === '__builtin_int8';
    }

    export const UNSIGNED_CHAR = {type: 'unsigned char', size: 1, bits: 16} as const;
    export type UnsignedChar = BaseObject & typeof UNSIGNED_CHAR;

    export const UNSIGNED_SHORT_INT = {type: 'unsigned short int', size: 1, bits: 16} as const;
    export type UnsignedShortInt = BaseObject & typeof UNSIGNED_SHORT_INT;

    export const UNSIGNED_INT = {type: 'unsigned int', size: 1, bits: 16} as const;
    export type UnsignedInt = BaseObject & typeof UNSIGNED_INT;

    export const UNSIGNED_LONG_INT = {type: 'unsigned long int', size: 2, bits: 32} as const;
    export type UnsignedLongInt = BaseObject & typeof UNSIGNED_LONG_INT;

    export const UNSIGNED_LONG_LONG_INT = {type: 'unsigned long long int', size: 4, bits: 64} as const;
    export type UnsignedLongLongInt = BaseObject & typeof UNSIGNED_LONG_LONG_INT;

    export type UnsignedBitInt = BaseObject & {type: 'unsigned _BitInt', size: number, bits: number};
    export function unsigned_BitInt(bits: number): UnsignedBitInt {
        return {type: 'unsigned _BitInt', size: Math.ceil(bits / 16), bits};
    }

    export const BUILTIN_UINT8 = {type: '__builtin_uint8', size: 1, bits: 8} as const;
    export type BuiltinUint8 = BaseObject & typeof BUILTIN_UINT8;

    export type UnsignedInteger = Bool | UnsignedChar | UnsignedShortInt | UnsignedInt | UnsignedLongInt | UnsignedLongLongInt | UnsignedBitInt | BuiltinUint8;
    export function isUnsignedInteger(type: Type): type is SignedInteger {
        return type.type === 'unsigned char' || type.type === 'unsigned short int' || type.type === 'unsigned int' || type.type === 'unsigned long int' || type.type === 'unsigned long long int' || type.type === 'unsigned _BitInt' || type.type === '__builtin_uint8';
    }

    export const FLOAT = {type: 'float', size: 2} as const;
    export type Float = BaseObject & typeof FLOAT;

    export const DOUBLE = {type: 'double', size: 4} as const;
    export type Double = BaseObject & typeof DOUBLE;

    export const LONG_DOUBLE = {type: 'long double', size: 4} as const;
    export type LongDouble = BaseObject & typeof LONG_DOUBLE;

    export const BUILTIN_FLOAT16 = {type: '__builtin_float16', size: 1} as const;
    export type BuiltinFloat16 = BaseObject & typeof BUILTIN_FLOAT16;

    export type Floating = Float | Double | LongDouble | BuiltinFloat16;
    export function isFloating(type: Type): type is Floating {
        return type.type === 'float' || type.type === 'double' || type.type === 'long double' || type.type === '__builtin_float16';
    }

    export type Basic = Char | SignedInteger | UnsignedInteger | Floating;
    export function isBasic(type: Type): type is Basic {
        return type.type === 'char' || isSignedInteger(type) || isUnsignedInteger(type) || isFloating(type);
    }

    export type Character = Char | SignedChar | UnsignedChar;
    export function isCharacter(type: Type): type is Floating {
        return type.type === 'char' || type.type === 'signed char' || type.type === 'unsigned char';
    }

    export type EnumeratedMember = {name: string, value: bigint};
    export type Enumerated = BaseObject & {type: 'enum', size: number, tag?: string, underlying: Char | SignedInteger | UnsignedInteger, members: EnumeratedMember[]};
    export function createEnumerated(underlying: Char | SignedInteger | UnsignedInteger, members: EnumeratedMember[]): Enumerated {
        return {type: 'enum', size: underlying.size, underlying, members};
    }

    export type Integer = Char | SignedInteger | UnsignedInteger | Enumerated;
    export function isInteger(type: Type): type is Integer {
        return type.type === 'char' || isSignedInteger(type) || isUnsignedInteger(type) || type.type === 'enum';
    }

    export type Real = Integer | Floating;
    export function isReal(type: Type): type is Real {
        return isInteger(type) || isFloating(type);
    }

    export type Arithmetic = Integer | Floating;
    export function isArithmetic(type: Type): type is Arithmetic {
        return isInteger(type) || isFloating(type);
    }

    export const VOID = {type: 'void'} as const;
    export type Void = BaseObject & typeof VOID;

    export type SizedArray = BaseObject & {type: 'array', size: number, items: CompleteType, length: number};
    export type VariableLengthArray = BaseObject & {type: 'array', size: undefined, items: CompleteType, length: '*' | a.Expression};
    export type IncompleteArray = BaseObject & {type: 'array', size: undefined, items: CompleteType, length: undefined};
    export type Array = SizedArray | VariableLengthArray | IncompleteArray;
    export function array(items: CompleteType, length: number | undefined | '*' | a.Expression): Array {
        let size: number | undefined = undefined;
        if (typeof items.size === 'number' && typeof length === 'number') {
            size = items.size * length;
        }
        return {type: 'array', size, items, length} as Array;
    }

    export type MemberType = Exclude<CompleteType, VariableLengthArray | IncompleteArray>;
    export function isMemberType(type: Type): type is MemberType {
        return isComplete(type) && !(type.type === 'array' && type.size === undefined);
    }

    // bit field offsets are represented by fractions
    export type StructMember = {name: string, type: MemberType, offset: number, bitField?: number} | {name: undefined, type: Struct | Union, offset: number, bitField?: number};
    export type ParamStructMember = {name: string, type: MemberType, bitField?: number} | {name: undefined, type: Struct | Union, bitField?: number};
    export type Struct = BaseObject & {type: 'struct', size: number, tag?: string, members: StructMember[], flexible?: IncompleteArray};
    export function struct(members: ParamStructMember[], flexible?: IncompleteArray, tag?: string): Struct {
        let size = 0;
        let outMembers: StructMember[] = [];
        for (let i = 0; i < members.length; i++) {
            let member = Object.assign(structuredClone(members[i]), {offset: 0}) as StructMember;
            if (member.bitField !== undefined) {
                // extract all bit field members
                // and prepare the next iteration of the outer loop to be on
                // the next non-bitfield member/member that doesn't fit in 16 bits
                let bits = 0;
                i--;
                while (true) {
                    i++;
                    let member = Object.assign(structuredClone(members[i]), {offset: 0}) as StructMember;
                    let field = member.bitField;
                    if (field === undefined || (bits + field) > 16) {
                        i--;
                        break;
                    }
                    bits += field;
                    member.offset = size;
                    size += field / 16;
                    outMembers.push(member);
                }
                size = Math.ceil(size);
            } else {
                member.offset = size;
                size += member.type.size;
                outMembers.push(member);
            }
        }
        return {
            type: 'struct',
            size,
            tag,
            members: outMembers,
            flexible,
        };
    }

    export type UnionMember = {name: string, type: MemberType, bitField?: number} | {name: undefined, type: Struct | Union, bitField?: number};
    export type Union = BaseObject & {type: 'union', size: number, tag?: string, members: UnionMember[]};
    export function union(members: UnionMember[], tag?: string): Union {
        let size = 0;
        for (let member of members) {
            if (member.type.size > size) {
                size = member.type.size;
            }
        }
        return {type: 'union', size, tag, members};
    }

    export type Parameter = {name?: string, type: Type};
    export type Function = {type: 'function', returnType: Type, params: Parameter[], variadic?: boolean};
    export function function_(returnType: Type, params: Parameter[], variadic?: boolean): Function {
        return {type: 'function', returnType, params, variadic};
    }

    export type Pointer = BaseObject & {type: 'pointer', size: 1, value: Type, restrict?: boolean};
    export function pointer(value: Type): Pointer {
        return {type: 'pointer', size: 1, value};
    }

    export const NULLPTR = {type: 'nullptr_t', size: 1} as const;
    export type Nullptr = BaseObject & typeof NULLPTR;

    export type Scalar = Arithmetic | Pointer | Nullptr;
    export function isScalar(type: Type): type is Scalar {
        return isArithmetic(type) || type.type === 'pointer' || type.type === 'nullptr_t';
    }

    export type IncompleteStruct = BaseObject & {type: 'incomplete struct', tag: string};

    export type IncompleteUnion = BaseObject & {type: 'incomplete union', tag: string};

    export type IncompleteType = Void | IncompleteArray | IncompleteStruct | IncompleteUnion;
    export function isIncomplete(type: Type): type is IncompleteType {
        return type.type === 'void' || (type.type === 'array' && type.length === undefined) || type.type === 'incomplete struct' || type.type === 'incomplete union';
    }

    export type DerivedDeclarator = Array | Function | Pointer;
    export function isDerivedDeclarator(type: Type): type is DerivedDeclarator {
        return type.type === 'array' || type.type === 'function' || type.type === 'pointer';
    }

    export type CompleteType = Scalar | SizedArray | VariableLengthArray | Struct | Union;
    export function isComplete(type: Type): type is CompleteType {
        return !type.type.startsWith('incomplete ') && type.type !== 'function';
    }

    export type Object = IncompleteType | CompleteType;
    export function isObject(type: Type): type is Object {
        return type.type !== 'function';
    }

    export type Type = Object | Function;

    export function const_<T extends Object>(type: T): T {
        type = structuredClone(type);
        type.const = true;
        return type;
    }

    export function volatile<T extends Object>(type: T): T {
        type = structuredClone(type);
        type.volatile = true;
        return type;
    }

    export function copyQualifiers<T extends Object>(from: Object, to: T): T {
        to = structuredClone(to);
        if (from.const) {
            to.const = from.const;
        }
        if (from.volatile) {
            to.volatile = from.volatile;
        }
        if (from.align) {
            to.align = from.align;
        }
        if (from.type === 'pointer' && to.type === 'pointer' && from.restrict) {
            to.restrict = from.restrict;
        }
        return to;
    }

    // this is like `isSignedInteger` but works on enums and includes `char`
    export function isSigned(type: Integer): type is SignedInteger | Char | (Enumerated & {underlying: SignedInteger | Char}) {
        if (type.type === 'enum') {
            type = type.underlying;
        }
        return isSignedInteger(type) || type.type === 'char';
    }

    // same as `isUnsignedInteger` but works on enums
    export function isUnsigned(type: Integer): type is UnsignedInteger | (Enumerated & {underlying: SignedInteger | UnsignedInteger}) {
        if (type.type === 'enum') {
            type = type.underlying;
        }
        return isUnsignedInteger(type);
    }

    export function toSigned(type: Integer): SignedInteger {
        if (type.type === 'enum') {
            type = type.underlying;
        }
        let out: SignedInteger;
        if (type.type === 'bool') {
            throw new Error(`This error should not occur, please report it (attempt to convert bool to signed)`);
        } else if (type.type === '__builtin_uint8') {
            out = BUILTIN_INT8;
        } else if (type.type === 'char' || type.type === 'unsigned char') {
            out = SIGNED_CHAR;
        } else if (type.type === 'unsigned short int') {
            out = SHORT_INT;
        } else if (type.type === 'unsigned int') {
            out = INT;
        } else if (type.type === 'unsigned long int') {
            out = LONG_INT;
        } else if (type.type === 'unsigned long long int') {
            out = SIGNED_CHAR;
        } else if (type.type === 'unsigned _BitInt') {
            out = _BitInt(type.bits);
        } else {
            out = type;
        }
        return copyQualifiers(type, out);
    }

    export function toUnsigned(type: Integer): UnsignedInteger {
        if (type.type === 'enum') {
            type = type.underlying;
        }
        let out: UnsignedInteger;
        if (type.type === '__builtin_int8') {
            out = BUILTIN_UINT8;
        } else if (type.type === 'char' || type.type === 'signed char') {
            out = UNSIGNED_CHAR;
        } else if (type.type === 'short int') {
            out = UNSIGNED_SHORT_INT;
        } else if (type.type === 'int') {
            out = UNSIGNED_INT;
        } else if (type.type === 'long int') {
            out = UNSIGNED_LONG_INT;
        } else if (type.type === 'long long int') {
            out = UNSIGNED_CHAR;
        } else if (type.type === '_BitInt') {
            out = unsigned_BitInt(type.bits);
        } else {
            out = type;
        }
        return copyQualifiers(type, out);
    }

    export function toString(type: Type, full?: boolean, identifier?: string): string {
        let stack: DerivedDeclarator[] = [];
        while (isDerivedDeclarator(type)) {
            stack.unshift(type);
            if (type.type === 'pointer') {
                type = type.value;
            } else if (type.type === 'array') {
                type = type.items;
            } else {
                type = type.returnType;
            }
        }
        let specifier: string;
        if (isBasic(type) || type.type === 'nullptr_t') {
            if (type.type === '_BitInt' || type.type === 'unsigned _BitInt') {
                specifier = `${type.type}(${type.bits})`;
            } else {
                specifier = type.type;
            }
        } else if (type.type === 'void') {
            return `void`;
        } else if (type.type === 'struct' || type.type === 'union') {
            if (type.tag && !full) {
                specifier = `${type.type} ${type.tag}`;
            } else if (type.members.length === 0) {
                specifier = `${type.type} {}`;
            } else {
                specifier = `${type.type} {\n`;
                for (let member of type.members) {
                    let str = `${toString(member.type, full, identifier)} ${member.name}`;
                    if (member.bitField !== undefined) {
                        str += ` : ${member.bitField}`;
                    }
                    specifier += `    ${str};\n`;
                }
                specifier += `}`;
            }
        } else if (type.type === 'incomplete struct' || type.type === 'incomplete union') {
            specifier = `${type.type} ${type.tag}`;
        } else {
            throw new Error(`This error should not occur, please report it (invalid type)`);
        }
        let declarator = identifier ?? '';
        for (let i = 0; i < stack.length; i++) {
            let type = stack[i];
            if (type.type === 'pointer') {
                let value = `*`;
                if (type.const) {
                    value += ` const`;
                }
                if (type.restrict) {
                    value += ` restrict`;
                }
                if (type.align) {
                    value += ` alignas(${type.align})`;
                }
                if (declarator === '') {
                    declarator = value;
                } else {
                    declarator = `${value} ${declarator}`;
                }
                if (stack[i + 1]?.type !== 'pointer') {
                    declarator = `(${declarator})`;
                }
            } else if (type.type === 'array') {
                if (typeof type.length === 'number') {
                    declarator += `${type.length}`;
                } else if (type.length === undefined) {
                    declarator += `[]`;
                } else {
                    declarator += `[*]`;
                }
            } else if (type.type === 'function') {
                declarator += `(`;
                for (let i = 0; i < type.params.length; i++) {
                    let param = type.params[i];
                    declarator += toString(param.type, full, param.name);
                    if (i !== type.params.length - 1 || type.variadic) {
                        declarator += `, `;
                    }
                }
                if (type.variadic) {
                    declarator += '...';
                }
                declarator += `)`;
            } else {
                throw new Error(`This error should not occur, please report it (invalid type)`);
            }
        }
        return `${specifier} ${declarator}`;
    }

    export function isSame(x: Type, y: Type): boolean {
        if (x.type === 'function' || y.type === 'function') {
            if (!(x.type === 'function' && y.type === 'function')) {
                return false;
            }
            return isSame(x.returnType, y.returnType)
                && x.params.length === y.params.length
                && x.params.map((p, i) => isSame(p.type, (y as Function).params[i].type))
                && x.variadic === y.variadic
            ;
        }
        if (x.const !== y.const || x.volatile !== y.volatile || x.align !== y.align) {
            return false;
        }
        if (x.type === 'enum' || y.type === 'enum') {
            if (x.type === 'enum' && y.type === 'enum') {
                if (!isSame(x.underlying, y.underlying)) {
                    return false;
                }
                if (x.members.length !== y.members.length) {
                    return false;
                }
                for (let member of x.members) {
                    if (!y.members.some(m => m.name === member.name && m.value === member.value)) {
                        return false;
                    }
                }
                return true;
            }
            if (x.type === 'enum') {
                x = x.underlying;
            }
            if (y.type === 'enum') {
                y = y.underlying;
            }
        }
        if (x.type !== y.type) {
            return false;
        } else if ((x.type === '_BitInt' || x.type === 'unsigned _BitInt') && (y.type === '_BitInt' || y.type === 'unsigned _BitInt')) {
            return x.bits === y.bits;
        } else if (isBasic(x) || x.type === 'nullptr_t' || x.type === 'void' || isBasic(y) || y.type === 'nullptr_t' || y.type === 'void') {
            return true;
        } else if (x.type === 'pointer' && y.type === 'pointer') {
            return isSame(x.value, y.value);
        } else if (x.type === 'array' && y.type === 'array') {
            if (!isSame(x.items, y.items)) {
                return false;
            }
            if (typeof x.length === 'object' && typeof y.length === 'object') {
                // for VLAs we just assume they are
                return true;
            } else {
                return x.length === y.length;
            }
        } else if ((x.type === 'struct' && y.type === 'struct') || (x.type === 'union' && y.type === 'union')) {
            if (x.tag !== y.tag || x.members.length !== y.members.length) {
                return false;
            }
            for (let i = 0; i < x.members.length; i++) {
                let xm = x.members[i];
                let ym = y.members[i];
                if (xm.name !== ym.name || xm.bitField !== ym.bitField) {
                    return false;
                }
                if (!isSame(xm.type, ym.type)) {
                    return false;
                }
            }
            return true;
        } else if (x.type === 'incomplete struct' && y.type === 'incomplete struct') {
            return x.tag === y.tag;
        } else if (x.type === 'incomplete union' && y.type === 'incomplete union') {
            return x.tag === y.tag;
        } else {
            throw new Error(`This error should not occur, please report it (invalid type)`);
        }
    }

    export function isCompatible(x: Type, y: Type): boolean {
        if (x.type === 'function' || y.type === 'function') {
            if (!(x.type === 'function' && y.type === 'function')) {
                return false;
            }
            return isCompatible(x.returnType, y.returnType)
                && x.params.length === y.params.length
                && x.params.map((p, i) => isCompatible(p.type, (y as Function).params[i].type))
                && x.variadic === y.variadic
            ;
        }
        if (x.const !== y.const || x.volatile !== y.volatile || x.align !== y.align) {
            return false;
        }
        if (x.type === 'enum' || y.type === 'enum') {
            if (x.type === 'enum' && y.type === 'enum') {
                if (!isCompatible(x.underlying, y.underlying)) {
                    return false;
                }
                if (x.members.length !== y.members.length) {
                    return false;
                }
                for (let member of x.members) {
                    if (!y.members.some(m => m.name === member.name && m.value === member.value)) {
                        return false;
                    }
                }
                return true;
            }
            if (x.type === 'enum') {
                x = x.underlying;
            }
            if (y.type === 'enum') {
                y = y.underlying;
            }
        }
        if (x.type !== y.type) {
            return false;
        } else if ((x.type === '_BitInt' || x.type === 'unsigned _BitInt') && (y.type === '_BitInt' || y.type === 'unsigned _BitInt')) {
            return x.bits === y.bits;
        } else if (isBasic(x) || x.type === 'nullptr_t' || x.type === 'void' || isBasic(y) || y.type === 'nullptr_t' || y.type === 'void') {
            return true;
        } else if (x.type === 'pointer' && y.type === 'pointer') {
            if (x.restrict !== y.restrict) {
                return false;
            }
            return isCompatible(x.value, y.value);
        } else if (x.type === 'array' && y.type === 'array') {
            if (!isCompatible(x.items, y.items)) {
                return false;
            }
            if (typeof x.length === 'object' && typeof y.length === 'object') {
                // for VLAs we just assume they are
                return true;
            } else if (x.length === undefined || y.length === undefined) {
                // incomplete types are compatible with their completed forms
                return true;
            } else {
                return x.length === y.length;
            }
        } else if (x.type === 'struct' && y.type === 'struct') {
            if (x.members.length !== y.members.length) {
                return false;
            }
            for (let i = 0; i < x.members.length; i++) {
                let xm = x.members[i];
                let ym = y.members[i];
                if (xm.name !== ym.name || xm.bitField !== ym.bitField) {
                    return false;
                }
                if (!isCompatible(xm.type, ym.type)) {
                    return false;
                }
            }
            if (x.flexible || y.flexible) {
                if (!(x.flexible && y.flexible)) {
                    return false;
                }
                if (!isCompatible(x.flexible, y.flexible)) {
                    return false;
                }
            }
            return true;
        } else if (x.type === 'union' && y.type === 'union') {
            if (x.members.length !== y.members.length) {
                return false;
            }
            for (let i = 0; i < x.members.length; i++) {
                let xm = x.members[i];
                let ym = y.members[i];
                if (xm.name !== ym.name || xm.bitField !== ym.bitField) {
                    return false;
                }
                if (!isCompatible(xm.type, ym.type)) {
                    return false;
                }
            }
            return true;
        } else if (x.type === 'incomplete struct' && y.type === 'incomplete struct') {
            return x.tag === y.tag;
        } else if (x.type === 'incomplete union' && y.type === 'incomplete union') {
            return x.tag === y.tag;
        } else {
            throw new Error(`This error should not occur, please report it (invalid type)`);
        }
    }

    export function createComposite(x: Type, y: Type): false | Type {
        if (!isCompatible(x, y)) {
            return false;
        }
        if (isBasic(x) || x.type === 'enum' || x.type === 'nullptr_t' || isBasic(y) || y.type === 'enum' || y.type === 'nullptr_t') {
            return x;
        } else if (x.type === 'pointer' && y.type === 'pointer') {
            let type = createComposite(x.value, y.value);
            if (!type) {
                throw new Error(`This error should not occur, please report it (typesAreCompatible is broken)`);
            }
            return copyQualifiers(x, pointer(type));
        } else if (x.type === 'array' && y.type === 'array') {
            let length: number | undefined | '*' | a.Expression;
            if (x.length === undefined) {
                length = y.length;
            } else if (y.length === undefined) {
                length = x.length;
            } else {
                // they're compatible, so this works
                // for VLAs this does just use x instead, but it's undefined behavior anyway
                length = x.length;
            }
            let type = createComposite(x.items, y.items);
            if (!type || !isComplete(type)) {
                throw new Error(`This error should not occur, please report it (typesAreCompatible is broken)`);
            }
            return copyQualifiers(x, array(type, length));
        } else if (x.type === 'struct' && y.type === 'struct') {
            let members: ParamStructMember[] = [];
            for (let i = 0; i < x.members.length; i++) {
                let member = x.members[i];
                let type = createComposite(member.type, y.members[i].type);
                if (!type || !isMemberType(type)) {
                    throw new Error(`This error should not occur, please report it (typesAreCompatible is broken)`);
                }
                members.push({name: member.name, type, bitField: member.bitField} as ParamStructMember);
            }
            let flexible: Struct['flexible'] = undefined;
            if (x.flexible && y.flexible) {
                let value = createComposite(x.flexible, y.flexible);
                if (!flexible) {
                    throw new Error(`This error should not occur, please report it (typesAreCompatible is broken)`);
                }
                flexible = value as Struct['flexible'];
            }
            return copyQualifiers(x, struct(members, flexible, x.tag));
        } else if (x.type === 'union' && y.type === 'union') {
            let members: UnionMember[] = [];
            for (let i = 0; i < x.members.length; i++) {
                let member = x.members[i];
                let type = createComposite(member.type, y.members[i].type);
                if (!type || !isMemberType(type)) {
                    throw new Error(`This error should not occur, please report it (typesAreCompatible is broken)`);
                }
                members.push({name: member.name, type, bitField: member.bitField} as UnionMember);
            }
            return copyQualifiers(x, union(members, x.tag));
        } else if (x.type === 'incomplete struct' && y.type === 'incomplete struct') {
            return x;
        } else if (x.type === 'incomplete union' && y.type === 'incomplete union') {
            return x;
        } else {
            throw new Error(`This error should not occur, please report it (invalid type)`);
        }
    }

    export function isCastAllowed(from: Type, to: Type): boolean {
        if (to.type === 'bool') {
            return true;
        } else if (isReal(to)) {
            return isReal(from);
        } else if (to.type === 'void') {
            return true;
        } else if (to.type === 'pointer' || to.type === 'nullptr_t') {
            return from.type === 'pointer' || from.type === 'nullptr_t';
        } else {
            return isCompatible(to, from);
        }
    }

    export function getIntegerConversionRank(type: Integer): number {
        if (type.type === 'enum') {
            type = type.underlying;
        }
        if (type.type === 'bool') {
            return 0;
        } else if (type.type === '_BitInt' || type.type === 'unsigned _BitInt') {
            return type.bits;
        } else if (type.type === '__builtin_int8' || type.type === '__builtin_uint8') {
            return 8.1;
        } else if (type.type === 'char' || type.type === 'signed char' || type.type === 'unsigned char') {
            return 16.1;
        } else if (type.type === 'short int' || type.type === 'unsigned short int') {
            return 16.2;
        } else if (type.type === 'int' || type.type === 'unsigned int') {
            return 16.3;
        } else if (type.type === 'long int' || type.type === 'unsigned long int') {
            return 32.1;
        } else if (type.type === 'long long int' || type.type === 'unsigned long long int') {
            return 64.1;
        } else {
            throw new Error(`This error should not occur, please report it (invalid type)`);
        }
    }

    export function applyIntegerPromotions(type: Integer): Integer {
        if (type.type === '_BitInt' || type.type === 'unsigned _BitInt') {
            return type;
        } else if (type.type === 'char' || type.type === 'signed char' || type.type === 'short int') {
            return INT;
        } else if (type.type === 'unsigned char' || type.type === 'unsigned short int') {
            return UNSIGNED_INT;
        } else {
            return type;
        }
    }

    export function findCommonRealType(x: Arithmetic, y: Arithmetic): Arithmetic {
        if (x.type === 'long double' || y.type === 'long double') {
            return LONG_DOUBLE;
        } else if (x.type === 'double' || y.type === 'double') {
            return DOUBLE;
        } else if (x.type === 'float' || y.type === 'float') {
            return FLOAT;
        } else if (x.type === '__builtin_float16' || y.type === '__builtin_float16') {
            return BUILTIN_FLOAT16;
        }
        if (x.type === 'enum') {
            x = x.underlying;
        }
        if (y.type === 'enum') {
            y = y.underlying;
        }
        x = applyIntegerPromotions(x);
        y = applyIntegerPromotions(y);
        if (isSame(x, y)) {
            return x;
        }
        if ((isSigned(x) && isSigned(y)) || (isUnsigned(x) && isUnsigned(y))) {
            return getIntegerConversionRank(x) > getIntegerConversionRank(y) ? x : y;
        }
        let unsigned = (isUnsigned(x) ? x : y) as UnsignedInteger;
        let signed = (isUnsigned(x) ? x : y) as SignedInteger;
        if (getIntegerConversionRank(unsigned) > getIntegerConversionRank(signed)) {
            return unsigned;
        } else if (signed.bits > unsigned.bits) {
            return signed;
        } else {
            return toUnsigned(signed);
        }
    }

}

export type Type = t.Type;


export interface VariableData {
    type: Type;
}

export class Scope {

    isTopOfFunction: boolean;
    parent: Scope | undefined;
    variables: Map<string, VariableData>;
    typedefs: Map<string, Type>;
    labels: Map<string, a.Statement>;

    constructor(isTopOfFunction: boolean, parent?: Scope) {
        this.isTopOfFunction = isTopOfFunction;
        this.parent = parent;
        this.variables = new Map();
        this.typedefs = new Map();
        this.labels = new Map();
    }

    getVariable(name: string): VariableData | undefined {
        let value = this.variables.get(name);
        if (value) {
            return value;
        } else if (this.parent) {
            return this.parent.getVariable(name);
        } else {
            return undefined;
        }
    }

    setVariable(name: string, value: VariableData): void {
        this.variables.set(name, value);
    }

    getLabel(name: string): a.Statement | undefined {
        if (this.isTopOfFunction) {
            let value = this.labels.get(name);
            if (value) {
                return value;
            }
        }
        if (this.parent) {
            return this.parent.getLabel(name);
        } else {
            return undefined;
        }
    }

    setLabel(name: string, value: a.Statement): void {
        this.labels.set(name, value);
    }

    getTypedef(name: string): Type | undefined {
        let value = this.typedefs.get(name);
        if (value) {
            return value;
        } else if (this.parent) {
            return this.parent.getTypedef(name);
        } else {
            return undefined;
        }
    }

    setTypedef(name: string, value: Type): void {
        this.typedefs.set(name, value);
    }

}


export namespace a {

    export type BaseNode = {pos: Position};

    export type BaseExpression = BaseNode & {exprType: Type};

    // primary
    export type IdentifierExpression = BaseExpression & {type: 'identifier-expression', name: string, variable: VariableData};
    export type IntegerConstant = BaseExpression & {type: 'integer-constant', value: bigint};
    export type FloatingConstant = BaseExpression & {type: 'floating-constant', value: number};
    export type CharacterConstant = BaseExpression & {type: 'character-constant', value: number};
    export type BooleanConstant = BaseExpression & {type: 'boolean-constant', value: boolean};
    export type NullptrConstant = BaseExpression & {type: 'nullptr-constant'};
    export type StringLiteral = BaseExpression & {type: 'string-literal', value: number[]};
    export type GenericSelectionExpression = BaseExpression & {type: 'generic-selection'};

    // postfix
    export type IndexExpression = BaseExpression & {type: 'index-expression', value: Expression, index: Expression};
    export type FunctionCallExpression = BaseExpression & {type: 'function-call-expression', func: Expression, args: Expression[]};
    export type MemberExpression = BaseExpression & {type: 'member-expression', value: Expression, op: '.' | '->', member: IdentifierExpression, isBitField: boolean};
    export type ArithmeticPostfixExpression = BaseExpression & {type: 'arithmetic-postfix-expression', op: '++' | '--', value: Expression};
    // todo: finish
    export type CompoundLiteral = BaseExpression & {type: 'compound-literal'};

    // unary
    export type ArithmeticUnaryExpression = BaseExpression & {type: 'arithmetic-unary-expression', op: '++' | '--', value: Expression};
    export type BasicUnaryExpression = BaseExpression & {type: 'basic-unary-expression', op: '&' | '*' | '+' | '-' | '~' | '!', value: Expression};
    export type SizeofValueExpression = BaseExpression & {type: 'sizeof-value-expression', value: Expression};
    export type SizeofTypeExpression = BaseExpression & {type: 'sizeof-type-expression', value: TypeName};
    export type AlignofExpression = BaseExpression & {type: 'alignof-expression', value: TypeName};
    export type CastExpression = BaseExpression & {type: 'cast-expression', castTo: Type | TypeName, value: Expression};

    // arithmetic
    export type MultiplicativeExpression = BaseExpression & {type: 'multiplicative-expression', op: '*' | '/' | '%', left: Expression, right: Expression};
    export type AdditiveExpression = BaseExpression & {type: 'additive-expression', op: '+' | '-', left: Expression, right: Expression};
    export type ShiftExpression = BaseExpression & {type: 'shift-expression', op: '<<' | '>>', left: Expression, right: Expression};

    // comparison
    export type RelationalExpression = BaseExpression & {type: 'relational-expression', op: '<' | '>' | '<=' | '>=', left: Expression, right: Expression};
    export type EqualityExpression = BaseExpression & {type: 'equality-expression', op: '==' | '!=', left: Expression, right: Expression};

    // bitwise/logical
    export type BitwiseANDExpression = BaseExpression & {type: 'bitwise-and-expression', left: Expression, right: Expression};
    export type BitwiseXORExpression = BaseExpression & {type: 'bitwise-xor-expression', left: Expression, right: Expression};
    export type BitwiseORExpression = BaseExpression & {type: 'bitwise-or-expression', left: Expression, right: Expression};
    export type LogicalANDExpression = BaseExpression & {type: 'logical-and-expression', left: Expression, right: Expression};
    export type LogicalORExpression = BaseExpression & {type: 'logical-or-expression', left: Expression, right: Expression};
    export type ConditionalExpression = BaseExpression & {type: 'conditional-expression', condition: Expression, true: Expression, false: Expression};

    // misc
    export type AssignmentExpression = BaseExpression & {type: 'conditional-expression', op: '=' | '*=' | '/=' | '%=' | '+=' | '-=' | '<<=' | '>>=' | '&=' | '^=' | '|=', lvalue: Expression, rvalue: Expression};
    export type CommaExpression = BaseExpression & {type: 'comma-expression', left: Expression, right: AssignmentExpression};

    export type Expression = IdentifierExpression | IntegerConstant | FloatingConstant | CharacterConstant | BooleanConstant | NullptrConstant | StringLiteral | GenericSelectionExpression | IndexExpression | FunctionCallExpression | MemberExpression | ArithmeticPostfixExpression | CompoundLiteral | ArithmeticUnaryExpression | BasicUnaryExpression | SizeofValueExpression | SizeofTypeExpression | AlignofExpression | CastExpression | MultiplicativeExpression | AdditiveExpression | ShiftExpression | RelationalExpression | EqualityExpression | BitwiseANDExpression | BitwiseXORExpression | BitwiseORExpression | LogicalANDExpression | LogicalORExpression | ConditionalExpression | AssignmentExpression | CommaExpression;

    export type IntegerExpression = Expression & {exprType: t.Integer};
    export function isIntegerExpression(value: Expression): value is IntegerExpression {
        return t.isInteger(value.exprType);
    }

    export type Lvalue = (IdentifierExpression | MemberExpression | IndexExpression | (CastExpression & {value: Lvalue}) | (BasicUnaryExpression & {op: '*'})) & {exprType: t.Object};

    export function isLvalue(value: Expression): value is Lvalue {
        if (!t.isObject(value.exprType)) {
            return false;
        }
        return Boolean(false
            || value.type === 'identifier-expression'
            || value.type === 'member-expression'
            || value.type === 'index-expression'
            || (value.type === 'cast-expression' && isLvalue(value.value))
            || (value.type === 'basic-unary-expression' && value.op === '*')
        );
    }

    export function isModifiableLvalue(value: Expression): boolean {
        return isLvalue(value) && !value.exprType.const;
    }

    export function isBitField(value: Expression): boolean {
        if (value.type === 'member-expression') {
            return value.isBitField;
        } else if (value.type === 'cast-expression') {
            return isBitField(value.value);
        } else {
            return false;
        }
    }

    export type ExpressionStatement = BaseExpression & {type: 'expression-statement', value: Expression};
    export type Statement = ExpressionStatement;
    
    export type TypeName = BaseNode & {type: 'type-name', typeType: Type};

    export type Node = Expression | Statement | TypeName;

}
