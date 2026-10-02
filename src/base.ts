
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

    error(msg: string): never;
    error(pos: Position | {pos: Position}, msg: string): never;
    error(pos: Position | {pos: Position} | string, msg?: string): never {
        if (typeof pos === 'string') {
            msg = pos;
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

    // there are never any padding bits except for in bool

    export type BaseObject = {const?: boolean, volatile?: boolean, align?: number};

    export const BOOL = {type: 'bool', size: 1} as const;
    export type Bool = BaseObject & typeof BOOL;

    export const CHAR = {type: 'char', size: 1} as const;
    export type Char = BaseObject & typeof CHAR;

    export const SIGNED_CHAR = {type: 'signed char', size: 1} as const;
    export type SignedChar = BaseObject & typeof SIGNED_CHAR;

    export const SHORT_INT = {type: 'short int', size: 1} as const;
    export type ShortInt = BaseObject & typeof SHORT_INT;

    export const INT = {type: 'int', size: 1} as const;
    export type Int = BaseObject & typeof INT;

    export const LONG_INT = {type: 'long int', size: 2} as const;
    export type LongInt = BaseObject & typeof LONG_INT;

    export const LONG_LONG_INT = {type: 'long long int', size: 4} as const;
    export type LongLongInt = BaseObject & typeof LONG_LONG_INT;

    export type BitInt = BaseObject & {type: '_BitInt', size: number, bits: number};
    export function _BitInt(bits: number): BitInt {
        return {type: '_BitInt', size: Math.ceil(bits / 16), bits};
    }

    export const BUILTIN_INT8 = {type: '__builtin_int8', size: 1} as const;
    export type BuiltinInt8 = BaseObject & typeof BUILTIN_INT8;

    export type SignedInteger = SignedChar | ShortInt | Int | LongInt | LongLongInt | BitInt | BuiltinInt8;
    export function isSignedInteger(type: Type): type is SignedInteger {
        return type.type === 'signed char' || type.type === 'short int' || type.type === 'int' || type.type === 'long int' || type.type === 'long long int' || type.type === '_BitInt' || type.type === '__builtin_int8';
    }

    export const UNSIGNED_CHAR = {type: 'unsigned char', size: 1} as const;
    export type UnsignedChar = BaseObject & typeof UNSIGNED_CHAR;

    export const UNSIGNED_SHORT_INT = {type: 'unsigned short int', size: 1} as const;
    export type UnsignedShortInt = BaseObject & typeof UNSIGNED_SHORT_INT;

    export const UNSIGNED_INT = {type: 'unsigned int', size: 1} as const;
    export type UnsignedInt = BaseObject & typeof UNSIGNED_INT;

    export const UNSIGNED_LONG_INT = {type: 'unsigned long int', size: 2} as const;
    export type UnsignedLongInt = BaseObject & typeof UNSIGNED_LONG_INT;

    export const UNSIGNED_LONG_LONG_INT = {type: 'unsigned long long int', size: 4} as const;
    export type UnsignedLongLongInt = BaseObject & typeof UNSIGNED_LONG_LONG_INT;

    export type UnsignedBitInt = BaseObject & {type: 'unsigned _BitInt', size: number, bits: number};
    export function unsigned_BitInt(bits: number): UnsignedBitInt {
        return {type: 'unsigned _BitInt', size: Math.ceil(bits / 16), bits};
    }

    export const BUILTIN_UINT8 = {type: '__builtin_uint8', size: 1} as const;
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
    export type Enumerated = BaseObject & {type: 'enum', size: number, tag?: string, backing: CompleteType, members: EnumeratedMember[]};
    export function createEnumerated(backing: CompleteType, members: EnumeratedMember[]): Enumerated {
        return {type: 'enum', size: backing.size, backing, members};
    }

    export type Integer = Char | SignedInteger | UnsignedInteger;
    export function isInteger(type: Type): type is Integer {
        return type.type === 'char' || isSignedInteger(type) || isUnsignedInteger(type);
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

    export type Array = BaseObject & {type: 'array', size: number, items: CompleteType, length: number};
    export function array(items: CompleteType, length: number): Array {
        return {type: 'array', size: items.size * length, items, length};
    }

    export type StructMember = {name: string | undefined, type: CompleteType, offset: number, bitField?: number};
    export type Struct = BaseObject & {type: 'struct', size: number, tag?: string, members: StructMember[]};

    export type UnionMember = {name: string | undefined, type: CompleteType, bitField?: number};
    export type Union = BaseObject & {type: 'union', size: number, tag?: string, members: UnionMember[]};
    export function union(members: UnionMember[]): Union {
        let size = 0;
        for (let member of members) {
            if (member.type.size > size) {
                size = member.type.size;
            }
        }
        return {type: 'union', size, members};
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

    export type IncompleteArray = BaseObject & {type: 'incomplete array', items: Type};

    export type IncompleteStruct = BaseObject & {type: 'incomplete struct', tag: string};

    export type IncompleteUnion = BaseObject & {type: 'incomplete union', tag: string};

    export type IncompleteType = IncompleteArray | IncompleteStruct | IncompleteUnion;
    export function isIncomplete(type: Type): type is IncompleteType {
        return type.type.startsWith('incomplete ');
    }

    export type DerivedDeclarator = Array | Function | Pointer | IncompleteArray;
    export function isDerivedDeclarator(type: Type): type is DerivedDeclarator {
        return type.type === 'array' || type.type === 'function' || type.type === 'pointer' || type.type === 'incomplete array';
    }

    export type CompleteType = Scalar | Array | Struct | Union;
    export function isComplete(type: Type): type is CompleteType {
        return !type.type.startsWith('incomplete ') && type.type !== 'function';
    }

    export type Object = IncompleteType | CompleteType;
    export function isObject(type: Type): type is Object {
        return type.type !== 'function';
    }

    export type Type = Object | Function;

    export function const_(type: Object): Object {
        type = structuredClone(type);
        type.const = true;
        return type;
    }

    export function volatile(type: Object): Object {
        type = structuredClone(type);
        type.volatile = true;
        return type;
    }

    export function toString(type: Type, full?: boolean, identifier?: string): string {
        let stack: DerivedDeclarator[] = [];
        while (isDerivedDeclarator(type)) {
            stack.unshift(type);
            if (type.type === 'pointer') {
                type = type.value;
            } else if (type.type === 'array' || type.type === 'incomplete array') {
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
                declarator += `[${type.length}]`;
            } else if (type.type === 'incomplete array') {
                declarator += '[]';
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

    export type IdentifierExpression = BaseExpression & {type: 'identifier-expression', name: string};
    export type IntegerConstant = BaseExpression & {type: 'integer-constant', value: bigint};
    export type FloatingConstant = BaseExpression & {type: 'floating-constant', value: number};
    export type CharacterConstant = BaseExpression & {type: 'character-constant', value: number};
    export type BooleanConstant = BaseExpression & {type: 'boolean-constant', value: boolean};
    export type NullptrConstant = BaseExpression & {type: 'nullptr-constant'};
    export type StringLiteral = BaseExpression & {type: 'string-literal', value: number[]};
    export type ParenthesizedExpression = BaseExpression & {type: 'parenthesized-expression', value: Expression};
    export type GenericSelectionExpression = BaseExpression & {type: 'generic-selection'};
    export type PrimaryExpression = IdentifierExpression | IntegerConstant | FloatingConstant | CharacterConstant | BooleanConstant | NullptrConstant | StringLiteral | ParenthesizedExpression | GenericSelectionExpression;

    export type IndexExpression = BaseExpression & {type: 'index-expression', value: PostfixExpression, index: Expression};
    export type FunctionCallExpression = BaseExpression & {type: 'function-call-expression', func: PostfixExpression, args: FullAssignmentExpression[]};
    export type MemberExpression = BaseExpression & {type: 'member-expression', value: PostfixExpression, op: '.' | '->', member: IdentifierExpression};
    export type ArithmeticPostfixExpression = BaseExpression & {type: 'arithmetic-postfix-expression', op: '++' | '--', value: PostfixExpression};
    // todo: finish
    export type CompoundLiteral = BaseExpression & {type: 'compound-literal'};
    export type PostfixExpression = PrimaryExpression | IndexExpression | FunctionCallExpression | MemberExpression | ArithmeticPostfixExpression | CompoundLiteral;

    export type ArithmeticUnaryExpression = BaseExpression & {type: 'arithmetic-unary-expression', op: '++' | '--', value: Expression};
    export type BasicUnaryExpression = BaseExpression & {type: 'basic-unary-expression', op: '&' | '*' | '+' | '-' | '~' | '!', value: CastExpression};
    export type SizeofValueExpression = BaseExpression & {type: 'sizeof-value-expression', value: UnaryExpression};
    export type SizeofTypeExpression = BaseExpression & {type: 'sizeof-type-expression', value: TypeName};
    export type AlignofExpression = BaseExpression & {type: 'alignof-expression', value: TypeName};
    export type UnaryExpression = PostfixExpression | ArithmeticUnaryExpression | BasicUnaryExpression | SizeofValueExpression | SizeofTypeExpression | AlignofExpression;

    export type CastExpression = BaseExpression & {type: 'cast-expression', castTo: TypeName, value: UnaryExpression};
    export type FullCastExpression = UnaryExpression | CastExpression;

    export type MultiplicativeExpression = BaseExpression & {type: 'multiplicative-expression', op: '*' | '/' | '%', left: FullMultiplicativeExpression, right: FullCastExpression};
    export type FullMultiplicativeExpression = FullCastExpression | MultiplicativeExpression;

    export type AdditiveExpression = BaseExpression & {type: 'additive-expression', op: '+' | '-', left: FullAdditiveExpression, right: FullMultiplicativeExpression};
    export type FullAdditiveExpression = FullMultiplicativeExpression | AdditiveExpression;

    export type ShiftExpression = BaseExpression & {type: 'shift-expression', op: '<<' | '>>', left: FullShiftExpression, right: FullAdditiveExpression};
    export type FullShiftExpression = FullAdditiveExpression | ShiftExpression;

    export type RelationalExpression = BaseExpression & {type: 'relational-expression', op: '<' | '>' | '<=' | '>=', left: FullRelationalExpression, right: FullShiftExpression};
    export type FullRelationalExpression = FullShiftExpression | RelationalExpression;

    export type EqualityExpression = BaseExpression & {type: 'equality-expression', op: '==' | '!=', left: FullEqualityExpression, right: FullRelationalExpression};
    export type FullEqualityExpression = FullRelationalExpression | EqualityExpression;

    export type BitwiseANDExpression = BaseExpression & {type: 'bitwise-and-expression', left: FullBitwiseANDExpression, right: FullEqualityExpression};
    export type FullBitwiseANDExpression = FullEqualityExpression | BitwiseANDExpression;

    export type BitwiseXORExpression = BaseExpression & {type: 'bitwise-xor-expression', left: FullBitwiseXORExpression, right: FullBitwiseANDExpression};
    export type FullBitwiseXORExpression = FullBitwiseANDExpression | BitwiseXORExpression;

    export type BitwiseORExpression = BaseExpression & {type: 'bitwise-or-expression', left: FullBitwiseORExpression, right: FullBitwiseXORExpression};
    export type FullBitwiseORExpression = FullBitwiseXORExpression | BitwiseORExpression;

    export type LogicalANDExpression = BaseExpression & {type: 'logical-and-expression', left: FullLogicalANDExpression, right: FullBitwiseORExpression};
    export type FullLogicalANDExpression = FullBitwiseORExpression | LogicalANDExpression;

    export type LogicalORExpression = BaseExpression & {type: 'logical-or-expression', left: FullLogicalORExpression, right: FullLogicalANDExpression};
    export type FullLogicalORExpression = FullLogicalANDExpression | LogicalORExpression;

    export type ConditionalExpression = BaseExpression & {type: 'conditional-expression', condition: FullLogicalORExpression, true: FullConditionalExpression, false: FullConditionalExpression};
    export type FullConditionalExpression = FullLogicalORExpression | ConditionalExpression;

    export type AssignmentExpression = BaseExpression & {type: 'conditional-expression', op: '=' | '*=' | '/=' | '%=' | '+=' | '-=' | '<<=' | '>>=' | '&=' | '^=' | '|=', lvalue: UnaryExpression, rvalue: FullAssignmentExpression};
    export type FullAssignmentExpression = FullConditionalExpression | AssignmentExpression;

    export type CommaExpression = BaseExpression & {type: 'comma-expression', left: Expression, right: AssignmentExpression};
    export type Expression = FullAssignmentExpression | CommaExpression;

    export type ExpressionStatement = BaseExpression & {type: 'expression-statement', value: Expression};
    export type Statement = ExpressionStatement;
    
    export type TypeName = BaseNode & {type: 'type-name', typeType: Type};

    export type Node = Expression | Statement;

}
