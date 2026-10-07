
import {Position, BaseDoer, BaseToken, EOF, BaseParser, t, Type, Scope, Code, CodeTemplateParameter, code} from './c_base.js';
import {SYMBOLS, CSymbol, CharacterLiteralPrefix, PreToken} from './preprocessor.js';


export const KEYWORDS = new Set(['alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'char', 'const', 'constexpr', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'false', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'nullptr', 'register', 'restrict', 'short', 'signed', 'sizeof', 'static', 'static_assert', 'struct', 'switch', 'thread_local', 'true', 'typedef', 'typeof', 'typeof_unqual', 'union', 'unsigned', 'void', 'volatile', 'while', '_Atomic', '_BitInt', '_Complex', '_Countof', '_Decimal128', '_Decimal32', '_Decimal64', '_Generic', '_Imaginary', '_Noreturn', '_Alignas', '_Alignof', '_Bool', '_Static_assert', '_Thread_local'] as const);

export type Keyword = typeof KEYWORDS extends Set<infer T> ? T : never;

export type KeywordToken<T extends Keyword = Keyword> = BaseToken & {type: 'keyword', value: T, raw: string};
export type IdentifierToken = BaseToken & {type: 'identifier', value: string};
export type IntegerLiteralSuffix = 'l' | 'll' | 'wb' | 'u' | 'ul' | 'ull' | 'uwb';
export type IntegerLiteralToken = BaseToken & {type: 'integer-literal', value: bigint, suffix?: IntegerLiteralSuffix, raw: string};
export type FloatingLiteralSuffix = 'f' | 'l' | 'df' | 'dd' | 'dl';
export type FloatingLiteralToken = BaseToken & {type: 'floating-literal', value: number, suffix?: FloatingLiteralSuffix, raw: string};
export type CharacterLiteralToken = BaseToken & {type: 'character-literal', value: number, prefix?: CharacterLiteralPrefix, raw: string};
export type StringLiteralToken = BaseToken & {type: 'string-literal', value: number[], prefix?: CharacterLiteralPrefix, raw: string};
export type SymbolToken<T extends CSymbol = CSymbol> = BaseToken & {type: 'symbol', value: T, raw: string};

export type Token = KeywordToken | IdentifierToken | IntegerLiteralToken | FloatingLiteralToken | CharacterLiteralToken | StringLiteralToken | SymbolToken;

export const STRING_TOKEN_NAMES: {[K in Token['type']]: string} = {
    'keyword': 'keyword',
    'identifier': 'identifier',
    'integer-literal': 'integer literal',
    'floating-literal': 'floating-point literal',
    'character-literal': 'character literal',
    'string-literal': 'string literal',
    'symbol': 'symbol',
};

export function getTokenRaw(token: Token): string {
    if (token.type === 'keyword' || token.type === 'integer-literal' || token.type === 'floating-literal' || token.type === 'character-literal' || token.type === 'string-literal' || token.type === 'symbol') {
        return token.raw;
    } else {
        return token.value;
    }
}

export function rawStringifyTokens(tokens: Token[]): string {
    return tokens.map(getTokenRaw).toString();
}

export function tokenToString(token: Token | EOF): string {
    if (token === EOF) {
        return `end of file`;
    } else {
        return `${STRING_TOKEN_NAMES[token.type]} '${getTokenRaw(token)}'`;
    }
}


type Matcher = 
    | EOF
    | Token['type']
    | Keyword
    | CSymbol
    | `identifier ${string}`
    | Matcher[]
;

type MatcherReturnType<T extends Matcher> =
    T extends EOF ? EOF :
    T extends Token['type'] ? Extract<Token, {type: T}> :
    T extends Keyword ? KeywordToken :
    T extends CSymbol ? SymbolToken<T> :
    T extends `identifier ${string}` ? IdentifierToken :
    // T extends (infer U)[] ? MatcherReturnType<U> :
    T extends any[] ? Token :
    never
;

function matcherToString(matcher: Matcher): string {
    if (matcher === EOF) {
        return `end of file`;
    } else if (typeof matcher === 'string') {
        if (KEYWORDS.has(matcher as Keyword)) {
            return `keyword '${matcher}'`;
        } else if (SYMBOLS.has(matcher as CSymbol)) {
            return `symbol '${matcher}'`;
        } else if (matcher.startsWith('identifier ')) {
            return `identifier '${matcher.slice('identifier '.length)}'`;
        } else {
            return STRING_TOKEN_NAMES[matcher as Token['type']];
        }
    } else {
        let out = matcher.map(matcherToString);
        if (out.length === 0) {
            return `nothing`;
        } else if (out.length === 1) {
            return out[0];
        } else if (out.length === 2) {
            return `${out[0]} or ${out[1]}`;
        } else {
            return `${out.slice(0, -1).join(', ')}, or ${out[out.length - 1]}`;
        }
    }
}


export class Tokenizer extends BaseDoer {

    getCurrentPosition(): Position {
        throw new Error(`This error should not occur, please report it (Tokenizer.getCurrentPosition() called)`);
    }

    readonly KEYWORD_ALIASES: {[key: string]: Keyword} = Object.assign(Object.create(null), {
        '_Alignas': 'alignas',
        '_Alignof': 'alignof',
        '_Bool': 'bool',
        '_Static_assert': 'static_assert',
        '_Thread_local': 'thread_local',
    } satisfies {[key: string]: Keyword});

    readonly INTEGER_DECIMAL_LITERAL_REGEX = /^([1-9]('?[0-9])*)$/u;
    readonly INTEGER_OCTAL_LITERAL_REGEX = /^(0('?[0-7]*))$/u;
    readonly INTEGER_HEXADECIMAL_LITERAL_REGEX = /^(0[xX][0-9a-fA-F]('?[0-9a-fA-F])*)$/u;
    readonly INTEGER_BINARY_LITERAL_REGEX = /^(0[bB][01]('?[01])*)$/u;
    readonly INTEGER_LITERAL_SUFFIX_REGEX = /([uU](l|L|ll|LL|wb|WB|)|(l|L|ll|LL|wb|WB)[uU]?)$/u;

    // digit-sequence: ([0-9]('?[0-9])*)
    // exponent-part: ([eE][+-]?([0-9]('?[0-9])*))
    readonly DECIMAL_FLOATING_LITERAL_REGEX = /^((([0-9]('?[0-9])*)?\.([0-9]('?[0-9])*)|([0-9]('?[0-9])*)\.)([eE][+-]?([0-9]('?[0-9])*))|([0-9]('?[0-9])*)([eE][+-]?([0-9]('?[0-9])*)))$/u;
    // hexadecimal-digit-sequence: ([0-9a-fA-F]('?[0-9a-fA-F])*)
    // hexadecimal-fractional-literal: ([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.
    // binary-exponent-part: ([pP][+-]?([0-9]('?[0-9])*))
    readonly HEXADECIMAL_FLOATING_LITERAL_REGEX = /^(0[xX](([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.)([pP][+-]?([0-9]('?[0-9])*)))$/u;
    readonly FLOATING_LITERAL_SUFFIX_REGEX = /(f|l|F|L|df|dd|dl|DF|DD|DL)$/u;

    // resolved after preprocessing, during translation phase 7
    // because they behave differently under stringization
    readonly SYMBOL_ALIASES: {[key: string]: CSymbol} = Object.assign(Object.create(null), {
        '<:': '[',
        ':>': ']',
        '<%': '{',
        '%>': '}',
        '%:': '#',
        '%:%:': '##',
    }) satisfies {[key: string]: CSymbol};

    convertFromPreprocessing(tokens: PreToken[]): Token[] {
        let out: Token[] = [];
        for (let token of tokens) {
            let pos = token.pos;
            if (token.type === 'whitespace') {
                continue;
            } else if (token.type === 'header-name') {
                throw new Error(`This error should not occur, please report it (header name token present after preprocesing)`);
            } else if (token.type === 'identifier') {
                if (KEYWORDS.has(token.value as Keyword)) {
                    let value = token.value as Keyword;
                    if (value in this.KEYWORD_ALIASES) {
                        value = this.KEYWORD_ALIASES[value];
                    }
                    out.push({pos, type: 'keyword', value, raw: token.value});
                } else {
                    out.push({pos, type: 'identifier', value: token.value});
                }
            } else if (token.type === 'number') {
                let value = token.value;
                let raw = value;
                let match: RegExpMatchArray | null;
                let suffix: IntegerLiteralSuffix | undefined;
                if (match = value.match(this.INTEGER_LITERAL_SUFFIX_REGEX)) {
                    let unsigned = match[0].includes('u') ? 'u' : '';
                    suffix = (unsigned + match[0].replaceAll('u', '').toLowerCase()) as IntegerLiteralSuffix;
                    value = value.slice(0, -match[0].length);
                }
                let parsingPrefix: string | undefined = undefined;
                if (value.match(this.INTEGER_DECIMAL_LITERAL_REGEX)) {
                    parsingPrefix = '';
                } else if (value.match(this.INTEGER_OCTAL_LITERAL_REGEX)) {
                    parsingPrefix = '0o';
                } else if (value.match(this.INTEGER_HEXADECIMAL_LITERAL_REGEX)) {
                    parsingPrefix = '0x';
                    value = value.slice(2);
                } else if (value.match(this.INTEGER_BINARY_LITERAL_REGEX)) {
                    parsingPrefix = '0b';
                    value = value.slice(2);
                } else {
                    // try parse as floating
                    value = raw;
                    let suffix: FloatingLiteralSuffix | undefined;
                    if (match = value.match(this.FLOATING_LITERAL_SUFFIX_REGEX)) {
                        suffix = match[0].toLowerCase() as FloatingLiteralSuffix;
                        value = value.slice(0, -match[0].length);
                    }
                    let number: number;
                    if (value.match(this.DECIMAL_FLOATING_LITERAL_REGEX)) {
                        number = Number(value.replaceAll('`', ''));
                    } else if (value.match(this.HEXADECIMAL_FLOATING_LITERAL_REGEX)) {
                        this.error(pos, `Hexadecimal floating point literals are not supported yet`);
                    } else {
                        this.error(pos, `Preprocessing number does not correspond to real number`);
                    }
                    out.push({pos, type: 'floating-literal', value: number, suffix, raw});
                }
                if (parsingPrefix !== undefined) {
                    let number = BigInt(parsingPrefix + value.replaceAll(`'`, ''));
                    out.push({pos, type: 'integer-literal', value: number, suffix, raw});
                }
            } else if (token.type === 'character-literal') {
                out.push({pos, type: 'character-literal', value: token.value, prefix: token.prefix, raw: token.raw});
            } else if (token.type === 'string-literal') {
                out.push({pos, type: 'string-literal', value: token.value, prefix: token.prefix, raw: token.raw});
            } else if (token.type === 'symbol') {
                let value = token.value;
                if (value in this.SYMBOL_ALIASES) {
                    value = this.SYMBOL_ALIASES[value];
                }
                out.push({pos, type: 'symbol', value, raw: token.value});
            } else if (token.type === 'universal-character-name') {
                // i don't see where the standard says what to do here
                throw new Error(`This error should not occur, please report it (universal character name token present after preprocesing)`);
            } else if (token.type === 'other') {
                throw new Error(`This error should not occur, please report it (other token present after preprocesing)`);
            } else if (token.type === 'placemarker') {
                throw new Error(`This error should not occur, please report it (placemarker token present after preprocesing)`);
            } else {
                throw new Error(`This error should not occur, please report it (invalid preprocessing token)`);
            }
        }
        return out;
    }

}


export abstract class BaseCompiler extends BaseParser<Token, Matcher> {

    constructor(from?: BaseDoer) {
        super(from);
    }

    peek<T extends Exclude<Matcher, EOF> = Exclude<Matcher, EOF>>(): MatcherReturnType<T> {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            this.error(undefined, `Unexpected end of input`);
        } else {
            return out as MatcherReturnType<T>;
        }
    }

    peekOrEOF<T extends Matcher = Matcher>(): MatcherReturnType<T> | EOF {
        return (this.tokens[this.pos] ?? EOF) as MatcherReturnType<T> | EOF;
    }

    advance<T extends Exclude<Matcher, EOF> = Exclude<Matcher, EOF>>(): MatcherReturnType<T> {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            this.error(undefined, `Unexpected end of input`);
        } else {
            this.pos++;
            return out as MatcherReturnType<T>;
        }
    }

    advanceOrEOF<T extends Matcher = Matcher>(): MatcherReturnType<T> | EOF {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            return EOF;
        } else {
            this.pos++;
            return out as MatcherReturnType<T>;
        }
    }

    _match(token: Token | EOF, matcher: Matcher): boolean {
        if (matcher === EOF) {
            return token === EOF;
        } else if (token === EOF) {
            return false;
        } else if (typeof matcher === 'string') {
            if (KEYWORDS.has(matcher as Keyword)) {
                return token.type === 'keyword' && token.value === matcher;
            } else if (SYMBOLS.has(matcher as CSymbol)) {
                return token.type === 'symbol' && token.value === matcher;
            } else if (matcher.startsWith('identifier ')) {
                return token.type === 'identifier' && token.value === matcher.slice('identifier '.length);
            } else {
                return token.type === matcher;
            }
        } else {
            return matcher.some(value => this._match(token, value));
        }
    }

    _expect(token: Token | EOF, matcher: Matcher): void {
        if (this._match(token, matcher)) {
            return;
        }
        this.error(undefined, `Expected ${matcherToString(matcher)}, got ${tokenToString(token)}`);
    }

    eat<T extends Exclude<Matcher, EOF>>(matcher: T): MatcherReturnType<T> {
        this.expect(matcher);
        return this.advance<T>();
    }

}


const INTEGER_MACRO_TYPES: {[K in Exclude<t.Scalar, t.BitInt | t.UnsignedBitInt | t.Enum>['type']]: string} = {
    'char': 'int16',
    'signed char': 'int16',
    'short int': 'int16',
    'int': 'int16',
    'long int': 'int32',
    'long long int': 'int64',
    '__builtin_int8': 'int8',
    'bool': 'uint16',
    'unsigned char': 'uint16',
    'unsigned short int': 'uint16',
    'unsigned int': 'uint16',
    'unsigned long int': 'uint32',
    'unsigned long long int': 'uint64',
    '__builtin_uint8': 'uint8',
    'float': 'float32',
    'double': 'float64',
    'long double': 'float64',
    '__builtin_float16': 'float16',
    'nullptr_t': 'int16',
    'pointer': 'int16',
};

function int(type: t.Scalar | {type: t.Scalar}): string {
    if (typeof type.type !== 'string') {
        type = type.type;
    }
    if (type.type === 'enum') {
        type = type.underlying;
    }
    let value: string;
    if (type.type === '_BitInt') {
        value = `.bigint ${type.bits}`;
    } else if (type.type === 'unsigned _BitInt') {
        value = `.biguint ${type.bits}`;
    } else {
        value = INTEGER_MACRO_TYPES[type.type];
    }
    if (value === 'int16') {
        return '';
    } else {
        return `.${value}`;
    }
}


export class Expression<T extends Type = Type> extends Code {

    type: T;
    isLvalue: boolean;

    constructor(type: T, isLvalue: boolean, ...data: (string | Iterable<string>)[]) {
        super(...data);
        this.type = type;
        this.isLvalue = isLvalue;
    }

    copy(): Expression {
        return new Expression(this.type, this.isLvalue, this);
    }

}

function expr(type: Type | {type: Type}): (strings: TemplateStringsArray, ...values: CodeTemplateParameter[]) => Expression {
    if (typeof type.type !== 'string') {
        type = type.type;
    }
    return (strings: TemplateStringsArray, ...values: CodeTemplateParameter[]) => {
        return new Expression(type, false, code(strings, ...values));
    };
}

function lvalue(type: Type | {type: Type}): (strings: TemplateStringsArray, ...values: CodeTemplateParameter[]) => Expression {
    if (typeof type.type !== 'string') {
        type = type.type;
    }
    return (strings: TemplateStringsArray, ...values: CodeTemplateParameter[]) => {
        return new Expression(type, true, code(strings, ...values));
    };
}



export class Compiler extends BaseCompiler {

    scope: Scope;

    constructor(scope: Scope, from?: BaseDoer) {
        super(from);
        this.scope = scope;
    }

    cast<T extends Type>(pos: Position | {pos: Position}, value: Expression, to: T): Expression<T> {
        let from = value.type;
        if (!t.isCastAllowed(from, to)) {
            this.error(pos, `Cannot cast value of type '${t.toString(from)}' to type '${t.toString(to)}'`);
        }
        if (t.isSame(from, to)) {
            return value as Expression<T>;
        }
    }

    applyIntegerPromotions(pos: Position | {pos: Position}, value: Expression): Expression {
        if (t.isInteger(value.type)) {
            let to = t.applyIntegerPromotions(value.type);
            return this.cast(pos, value, to);
        } else {
            return value;
        }
    }

    decayLvalues(value: Expression): Expression {
        if (value.isLvalue && value.type.type !== 'array') {
            return expr(value)`
                ${value}
                op.deref
            `;
        } else {
            return value;
        }
    }

    decayArrays(value: Expression): Expression {
        if (value.type.type === 'array') {
            value.type = t.pointer(value.type.items);
        }
        return value;
    }

    decayFunctions(value: Expression): Expression {
        if (value.type.type === 'function') {
            value.type = t.pointer(value.type);
        }
        return value;
    }

    decayLvaluesArrays(value: Expression): Expression {
        if (value.type.type === 'array') {
            value.type = t.pointer(value.type.items);
        }
        if (value.isLvalue) {
            return expr(value)`
                ${value}
                op.deref
            `;
        } else {
            return value;
        }
    }

    decayLvaluesFunctions(value: Expression): Expression {
        if (value.type.type === 'function') {
            value.type = t.pointer(value.type);
        }
        if (value.isLvalue && value.type.type !== 'array') {
            return expr(value)`
                ${value}
                op.deref
            `;
        } else {
            return value;
        }
    }

    decayArraysFunctions(value: Expression): Expression {
        if (value.type.type === 'array') {
            value.type = t.pointer(value.type.items);
        } else if (value.type.type === 'function') {
            value.type = t.pointer(value.type);
        }
        return value;
    }

    decayLvaluesArraysFunctions(value: Expression): Expression {
        if (value.type.type === 'array') {
            value.type = t.pointer(value.type.items);
        } else if (value.type.type === 'function') {
            value.type = t.pointer(value.type);
        }
        if (value.isLvalue) {
            return expr(value)`
                ${value}
                op.deref
            `;
        } else {
            return value;
        }
    }

    identifierExpression(): Expression {
        let token = this.eat('identifier');
        let data = this.scope.getVariable(token.value);
        if (!data) {
            this.error(token, `Variable '${token.value}' is not defined`);
        }
        let line: string;
        let {type, value} = data.address;
        if (type === 'static') {
            line = `push.value ${value}`;
        } else if (type === 'local') {
            line = `push.local.ptr ${value}`;
        } else {
            line = `push.argument.ptr ${value}`;
        }
        return lvalue(data.type)`${line}`;
    }

    integerLiteral(): Expression {
        let token = this.eat('integer-literal');
        let value = token.value;
        if (token.suffix === undefined) {
            return expr(t.INT)`push.value ${value}`;
        } else if (token.suffix === 'l') {
            return expr(t.LONG_INT)`push.value.int32 ${value}`;
        } else if (token.suffix === 'll') {
            return expr(t.LONG_LONG_INT)`push.value.int64 ${value}`;
        } else if (token.suffix === 'wb') {
            let length = token.value.toString(2).length + 1;
            return expr(t._BitInt(length))`push.value.bigint ${length} ${value}`;
        } else if (token.suffix === 'u') {
            return expr(t.UNSIGNED_INT)`push.value ${value}`;
        } else if (token.suffix === 'ul') {
            return expr(t.UNSIGNED_LONG_INT)`push.value.uint32 ${value}`;
        } else if (token.suffix === 'ull') {
            return expr(t.UNSIGNED_LONG_LONG_INT)`push.value.uint64 ${value}`;
        } else if (token.suffix === 'uwb') {
            let length = token.value.toString(2).length;
            return expr(t.unsigned_BitInt(length))`push.value.biguint ${length} ${value}`;
        } else {
            throw new Error(`This error should not occur, please report it (invalid integer literal suffix)`);
        }
    }

    floatingLiteral(): Expression {
        let token = this.eat('floating-literal');
        let value = token.value;
        if (token.suffix === undefined) {
            return expr(t.DOUBLE)`push.value.float64 ${value}`;
        } else if (token.suffix === 'f') {
            return expr(t.FLOAT)`push.value.float32 ${value}`;
        } else if (token.suffix === 'l') {
            return expr(t.LONG_DOUBLE)`push.value.float64 ${value}`;
        } else if (token.suffix === 'df') {
            this.error(token, `Decimal floating-point types are not supported`);
        } else if (token.suffix === 'dd') {
            this.error(token, `Decimal floating-point types are not supported`);
        } else if (token.suffix === 'dl') {
            this.error(token, `Decimal floating-point types are not supported`);
        } else {
            throw new Error(`This error should not occur, please report it (invalid floating literal suffix)`);
        }
    }

    characterLiteral(): Expression {
        let token = this.eat('character-literal');
        let value = token.value;
        if (token.prefix === undefined) {
            return expr(t.INT)`push.value ${value}`;
        } else if (token.prefix === 'u8') {
            return expr(t.BUILTIN_UINT8)`push.value.uint8 ${value}`;
        } else if (token.prefix === 'u') {
            return expr(t.UNSIGNED_INT)`push.value.uint16 ${value}`;
        } else if (token.prefix === 'U') {
            return expr(t.UNSIGNED_LONG_INT)`push.value.uint32 ${value}`;
        } else if (token.prefix === 'L') {
            return expr(t.UNSIGNED_LONG_INT)`push.value.uint32 ${value}`;
        } else {
            throw new Error(`This error should not occur, please report it (invalid character literal prefix)`);
        }
    }

    stringLiteral(): Expression {
        let token = this.eat('string-literal');
        this.error(token.pos, 'String literals are not supported yet');
    }

    genericSelection(): Expression {
        let token = this.eat('_Generic');
        this.eat('(');
        this.error(token, `_Generic is not supported yet`);
    }

    primaryExpression(): Expression {
        if (this.match('identifier')) {
            return this.identifierExpression();
        } else if (this.match('integer-literal')) {
            return this.integerLiteral();
        } else if (this.match('floating-literal')) {
            return this.floatingLiteral();
        } else if (this.match('character-literal')) {
            return this.characterLiteral();
        } else if (this.match('false')) {
            let pos = this.advance().pos;
            return expr(t.BOOL)`push.value 0`;
        } else if (this.match('true')) {
            return expr(t.BOOL)`push.value 1`;
        } else if (this.match('nullptr')) {
            return expr(t.NULLPTR)`push.value 0`;
        } else if (this.match('string-literal')) {
            return this.stringLiteral();
        } else if (this.match('(')) {
            this.advance();
            let out = this.expression();
            this.eat(')');
            return out;
        } else if (this.match('_Generic')) {
            return this.genericSelection();
        } else {
            this.error(undefined, `Expected primary expression`);
        }
    }

    indexExpression(value: Expression): Expression {
        value = this.decayLvaluesArraysFunctions(value);
        let token = this.eat('[');
        let index = this.decayLvaluesArraysFunctions(this.expression());
        this.eat(']');
        let outType: t.Type;
        if (value.type.type === 'pointer') {
            outType = value.type.value;
            if (!t.isInteger(index.type)) {
                this.error(token, `Cannot add pointer and non-integer types`);
            }
        } else if (index.type.type === 'pointer') {
            outType = index.type.value;
            if (!t.isInteger(value.type)) {
                this.error(token, `Cannot add pointer and non-integer types`);
            }
            let temp = value;
            value = index;
            index = temp;
        } else {
            this.error(token, `One of the operands to the indexing operator must be a pointer`);
        }
        if (!('size' in outType) || outType.size === undefined) {
            this.error(token, `Cannot dereference pointer to unsized type '${outType.type}'`);
        }
        return expr(outType)`
            ${value},
            ${this.cast(token, index, t.INT)},
            op.add
            op.deref ${outType.size}
        `;
    }

    functionCallExpression(funcExpr: Expression): Expression {
        funcExpr = this.decayLvaluesArraysFunctions(funcExpr);
        let token = this.eat('(');
        if (funcExpr.type.type !== 'pointer' || funcExpr.type.value.type !== 'function') {
            this.error(token, `Cannot call value of non-function-pointer type '${t.toString(funcExpr.type)}'`);
        }
        let func = funcExpr.type.value;
        let args: Expression[] = [];
        while (!this.match(')')) {
            args.push(this.decayLvaluesArraysFunctions(this.assignmentExpression()));
            if (this.match(',')) {
                this.advance();
            } else {
                break;
            }
        }
        this.eat(')');
        if (args.length < func.params.length) {
            if (func.variadic) {
                this.error(token, `Not enough arguments for function call (expected at least ${func.params.length}, got ${args.length})`);
            } else {
                this.error(token, `Not enough arguments for function call (expected ${func.params.length}, got ${args.length})`);
            }
        }
        if (args.length > func.params.length) {
            if (!func.variadic) {
                this.error(token, `Too many arguments for function call (expected ${func.params.length}, got ${args.length})`);
            }
            args = args.slice(0, func.params.length).concat(args.slice(func.params.length).map(arg => {
                if (t.isInteger(arg.type)) {
                    arg = this.applyIntegerPromotions(token, arg);
                }
                if (arg.type.type === 'float') {
                    arg = this.cast(token, arg, t.DOUBLE);
                }
                return arg;
            }));
        }
        for (let i = 0; i < func.params.length; i++) {
            args[i] = this.cast(token, args[i], func.params[i].type);
        }
        return expr(func.returnType)`
            ${args.join('\n')}
            funcExpr
            call.indirect ${args.length}
        `;
    }

    memberExpression(value: Expression): Expression {
        let op = this.match('.') ? this.eat('.') : this.eat('->');
        if (op.value === '.') {
            value = this.decayArraysFunctions(value);
        } else {
            value = this.decayLvaluesArraysFunctions(value);
        }
        let memberName = this.eat('identifier');
        let type = value.type;
        if (op.value === '->') {
            if (type.type !== 'pointer') {
                this.error(op, `Left operand of -> operator must be a pointer to a struct or union`);
            }
            type = type.value;
        }
        if (!(type.type === 'struct' || type.type === 'union')) {
            if (op.value === '.') {
                this.error(op, `Left operand of . operator must be a struct or union, is of type ${t.toString(value.type)}`);
            } else {
                this.error(op, `Left operand of -> operator must be a pointer to a struct or union, is of type ${t.toString(value.type)}`);
            }
        }
        if (type.type === 'struct') {
            let member: t.StructMember | undefined = undefined;
            for (let value of type.members) {
                if (value.name === memberName.value) {
                    member = value;
                    break;
                }
            }
            if (!member) {
                this.error(memberName, `Member '${memberName.value}' does not exist in type ${t.toString(type)}`);
            }
            if (member.bitField !== undefined) {
                this.error(op, `Bit fields are not supported yet`);
            }
            if (op.value === '.') {
                if (value.isLvalue) {
                    return lvalue(member.type)`
                        value,
                        push.value ${member.offset}
                        op.add
                    `;
                } else {
                        return expr(member.type)`
                        # calculate the stack pointer plus the member offset
                        A = ${member.offset}
                        D = A
                        A = SP
                        D = D + *A
                        # write it to address 3
                        A = 3
                        *A = D
                        ${value}
                        # load the new stack pointer from address 3
                        A = 3
                        D = *A
                        A = SP
                        *A = D
                    `;
                }
            } else {
                return expr(member.type)`
                    ${value}
                    push.value ${member.offset}
                    op.add
                    op.deref ${member.type.size}
                `;
            }
        } else {
            let member: t.UnionMember | undefined = undefined;
            for (let value of type.members) {
                if (value.name === memberName.value) {
                    member = value;
                    break;
                }
            }
            if (!member) {
                this.error(memberName, `Member '${memberName.value}' does not exist in type ${t.toString(type)}`);
            }
            if (op.value === '.') {
                return expr(member.type)`pop.discard ${type.size - member.type.size}`;
            } else {
                return expr(member.type)`op.deref ${member.type.size}`;
            }
        }
    }

    arithmeticPostfixExpression(value: Expression): Expression {
        let op = this.match('++') ? this.eat('++') : this.eat('--');
        value = this.decayArraysFunctions(value);
        let type = value.type;
        if (!value.isLvalue || type.type === 'function' || type.const || !t.isScalar(type)) {
            this.error(op, `Operand of ${op.value} operator must be a modifiable lvalue of scalar type, is of type '${t.toString(type)}`);
        }
        return expr(type)`
            ${value}
            op.dup
            op.deref
            pop.static.multi 8 ${type.size}
            push.value${int(type)} ${op.value === '++' ? '1' : '-1'}
            op.add${int(type)}
            pop.pointer ${type.size}
            push.static.multi 8 ${type.size}
        `;
    }

    compoundLiteral(): Expression {
        // todo: finish
        this.eat('(');
        // let type = this.typeName();
        this.eat(')');
        this.bracedInitializer(undefined as unknown as Type);
    }

    postfixExpression(): Expression {
        let value: Expression;
        let primary = this.try(this.primaryExpression);
        if (primary) {
            value = primary;
        } else {
            let compound = this.try(this.compoundLiteral);
            if (compound) {
                value = compound;
            } else {
                this.error(undefined, `Expected postfix expression`);
            }
        }
        while (true) {
            if (this.match('[')) {
                value = this.indexExpression(value);
            } else if (this.match('(')) {
                value = this.functionCallExpression(value);
            } else if (this.match(['.', '->'])) {
                value = this.memberExpression(value);
            } else if (this.match(['++', '--'])) {
                value = this.arithmeticPostfixExpression(value);
            } else {
                break;
            }
        }
        return value;
    }

    arithmeticUnaryExpression(): Expression {
        let op = this.match('++') ? this.eat('++') : this.eat('--');
        let value = this.decayArraysFunctions(this.unaryExpression());
        let type = value.type;
        if (!value.isLvalue || type.type === 'function' || type.const || !t.isScalar(type)) {
            this.error(op, `Operand of ${op.value} operator must be a modifiable lvalue of scalar type, is of type '${t.toString(type)}`);
        }
        return expr(type)`
            ${value}
            push.static${int(type)} ${op.value === '++' ? '1' : '-1'}
            op.add${int(type)}
        `;
    }

    basicUnaryExpression(): Expression {
        let op = this.eat(['&', '*', '+', '-', '~', '!']) as SymbolToken;
        let value = this.castExpression();
        if (op.value === '&') {
            if (!(value.exprType.type === 'function' || (a.isLvalue(value) && !a.isBitField(value)))) {
                this.error(value, `Cannot take address of object of type '${t.toString(value.exprType)}'`);
            }
            return this.create(op.pos, 'basic-unary-expression', t.pointer(value.exprType), {op: '&', value});
        } else if (op.value === '*') {
            value = this.decayLvaluesArraysFunctions(value);
            if (value.exprType.type !== 'pointer') {
                this.error(op, `Cannot use unary * operator on value of non-pointer value of type '${t.toString(value.exprType)}'`);
            }
            return this.create(op.pos, 'basic-unary-expression', value.exprType.value, {op: '*', value});
        } else if (op.value === '+') {
            value = this.decayLvaluesArraysFunctions(value);
            if (!t.isArithmetic(value.exprType)) {
                this.error(op, `Cannot use unary + operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (a.isIntegerExpression(value)) {
                // the type casts are to prevent "union type too complex to represent" errors
                return this.applyIntegerPromotions(op.pos, this.create(op.pos, 'basic-unary-expression', value.exprType as t.Type, {op: '+', value}) as a.IntegerExpression);
            } else {
                return this.create(op.pos, 'basic-unary-expression', value.exprType, {op: '+', value});
            }
        } else if (op.value === '-') {
            value = this.decayLvaluesArraysFunctions(value);
            if (!t.isArithmetic(value.exprType)) {
                this.error(op, `Cannot use unary - operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (a.isIntegerExpression(value)) {
                // the type casts are to prevent "union type too complex to represent" errors
                return this.applyIntegerPromotions(op.pos, this.create(op.pos, 'basic-unary-expression', value.exprType as t.Type, {op: '-', value}) as a.IntegerExpression);
            } else {
                return this.create(op.pos, 'basic-unary-expression', value.exprType, {op: '-', value});
            }
        } else if (op.value === '~') {
            value = this.decayLvaluesArraysFunctions(value);
            if (!a.isIntegerExpression(value)) {
                this.error(op, `Cannot use unary ~ operator on value of non-integer type '${t.toString(value.exprType)}'`);
            }
            return this.applyIntegerPromotions(op.pos, this.create(op.pos, 'basic-unary-expression', value.exprType, {op: '~', value}));
        } else if (op.value === '!') {
            value = this.decayLvaluesArraysFunctions(value);
            if (!t.isScalar(value.exprType)) {
                this.error(op, `Cannot use unary ! operator on value of non-scalar type '${t.toString(value.exprType)}'`);
            }
            return this.create(op.pos, 'basic-unary-expression', t.INT, {op: '!', value});
        } else {
            throw new Error(`This error should not occur, please report it (invalid basic unary operator)`);
        }
    }

    countofValueExpression(): Expression {
        let token = this.eat('_Countof');
        let value = this.decayLvaluesFunctions(this.unaryExpression());
        // size_t is unsigned int
        return this.create(token.pos, 'countof-value-expression', t.UNSIGNED_INT, {value});
    }

    countofTypeExpression(): Expression {
        let token = this.eat('_Countof');
        this.eat('(');
        let type = this.typeName();
        this.eat(')');
        // size_t is unsigned int
        return this.create(token.pos, 'countof-type-expression', t.UNSIGNED_INT, {value: type});
    }

    sizeofValueExpression(): Expression {
        let token = this.eat('sizeof');
        let value = this.unaryExpression();
        // size_t is unsigned int
        return this.create(token.pos, 'sizeof-value-expression', t.UNSIGNED_INT, {value});
    }

    sizeofTypeExpression(): Expression {
        let token = this.eat('sizeof');
        this.eat('(');
        let type = this.typeName();
        this.eat(')');
        // size_t is unsigned int
        return this.create(token.pos, 'sizeof-type-expression', t.UNSIGNED_INT, {value: type});
    }

    alignofExpression(): Expression {
        let token = this.eat('sizeof');
        this.eat('(');
        let type = this.typeName();
        this.eat(')');
        // size_t is unsigned int
        return this.create(token.pos, 'alignof-expression', t.UNSIGNED_INT, {value: type});
    }

    staticAssertionExpression(): Expression {
        let token = this.eat('static_assert');
        this.eat('(');
        let value = this.expression();
        let message: a.StringLiteral | undefined = undefined;
        if (this.match(',')) {
            this.advance();
            message = this.stringLiteral();
        }
        this.eat(')');
        return this.create(token.pos, 'static-assertion-expression', t.VOID, {value, message});
    }

    unaryExpression(): Expression {
        if (this.match(['++', '--'])) {
            return this.arithmeticUnaryExpression();
        } else if (this.match(['&', '*', '+', '-', '~', '!'])) {
            return this.basicUnaryExpression();
        } else if (this.match('_Countof')) {
            let out = this.try(this.countofTypeExpression);
            if (out) {
                return out;
            }
            return this.countofValueExpression();
        } else if (this.match('sizeof')) {
            let out = this.try(this.sizeofTypeExpression);
            if (out) {
                return out;
            }
            return this.sizeofValueExpression();
        } else if (this.match('alignof')) {
            return this.alignofExpression();
        } else if (this.match('static_assert')) {
            return this.staticAssertionExpression();
        } else {
            return this.postfixExpression();
        }
    }

    castExpression(): Expression {
        if (this.match('(')) {
            let paren = this.advance();
            try {
                let type = this.typeName();
                this.eat(')');
                let value = this.decayArraysFunctions(paren.pos, this.castExpression());
                if (!t.isCastAllowed(value.exprType, type.typeType)) {
                    this.error(paren, `Cannot cast value of type '${t.toString(value.exprType)}' to type '${t.toString(type.typeType)}`);
                }
                return this.create(paren.pos, 'cast-expression', type.typeType, {castTo: type, value});
            } catch (error) {
                if (!(error instanceof CError)) {
                    throw error;
                }
                return this.unaryExpression();
            }
        } else {
            return this.unaryExpression();
        }
    }

    multiplicativeExpression(): Expression {
        let value = this.castExpression();
        while (this.match(['*', '/', '%'])) {
            let op = this.advance<'*' | '/' | '%'>();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.castExpression());
            if (!t.isArithmetic(value.exprType)) {
                this.error(value, `Cannot use ${op} operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (!t.isArithmetic(arg.exprType)) {
                this.error(arg, `Cannot use ${op} operator on value of non-arithmetic type '${t.toString(arg.exprType)}'`);
            }
            let type = t.findCommonRealType(value.exprType, arg.exprType);
            value = this.create(op.pos, 'multiplicative-expression', type, {
                op: op.value,
                left: this.cast(op.pos, value, type),
                right: this.cast(op.pos, arg, type),
            });
        }
        return value;
    }

    additiveExpression(): Expression {
        let value = this.multiplicativeExpression();
        while (this.match(['+', '-'])) {
            let op = this.advance<'+' | '-'>();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.multiplicativeExpression());
            if (t.isArithmetic(value.exprType) && t.isArithmetic(arg.exprType)) {
                let type = t.findCommonRealType(value.exprType, arg.exprType);
                value = this.create(op.pos, 'additive-expression', type, {
                    op: op.value,
                    left: this.cast(op.pos, value, type),
                    right: this.cast(op.pos, value, type),
                });
            } else {
                let type: Type;
                if (t.isArithmetic(arg.exprType)) {
                    if (value.exprType.type === 'pointer') {
                        type = value.exprType.value;
                    } else {
                        this.error(op.pos, `Cannot use ${op} operator on values of type ${t.toString(value.exprType)} and ${t.toString(arg.exprType)}`);
                    }
                } else if (arg.exprType.type === 'pointer') {
                    if (t.isArithmetic(value.exprType)) {
                        type = arg.exprType.value;
                    } else if (op.value === '-' && value.exprType.type === 'pointer') {
                        if (!t.isCompatible(value.exprType.value, arg.exprType.value)) {
                            this.error(op.pos, `Cannot use ${op} operator on values of type ${t.toString(value.exprType)} and ${t.toString(arg.exprType)}`);
                        }
                        // ptrdiff_t is int
                        type = t.INT;
                    } else {
                        this.error(op.pos, `Cannot use ${op} operator on values of type ${t.toString(value.exprType)} and ${t.toString(arg.exprType)}`);
                    }
                } else {
                    this.error(op.pos, `Cannot use ${op} operator on values of type ${t.toString(value.exprType)} and ${t.toString(arg.exprType)}`);
                }
                value = this.create(op.pos, 'additive-expression', type, {
                    op: op.value,
                    left: value,
                    right: arg
                });
            }
        }
        return value;
    }

    shiftExpression(): Expression {
        let value = this.additiveExpression();
        while (this.match(['<<', '>>'])) {
            let op = this.advance<'<<' | '>>'>();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.additiveExpression());
            if (!a.isIntegerExpression(value)) {
                this.error(value, `Cannot use ${op} operator on value of non-integer type '${t.toString(value.exprType)}'`);
            }
            if (!a.isIntegerExpression(arg)) {
                this.error(arg, `Cannot use ${op} operator on value of non-integer type '${t.toString(arg.exprType)}'`);
            }
            value = this.applyIntegerPromotions(op.pos, value);
            arg = this.applyIntegerPromotions(op.pos, arg);
            value = this.create(op.pos, 'shift-expression', value.exprType, {
                op: op.value,
                left: value,
                right: arg
            });
        }
        return value;
    }

    relationalExpression(): Expression {
        let value = this.shiftExpression();
        while (this.match(['<', '>', '<=', '>='])) {
            let op = this.advance<'<' | '>' | '<=' | '>='>();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.shiftExpression());
            if (t.isReal(value.exprType) && t.isReal(arg.exprType)) {
                let type = t.findCommonRealType(value.exprType, arg.exprType);
                value = this.create(op.pos, 'relational-expression', t.INT, {
                    op: op.value,
                    left: this.cast(op.pos, value, type),
                    right: this.cast(op.pos, arg, type),
                });
            } else if (value.exprType.type === 'pointer' && arg.exprType.type === 'pointer') {
                return this.create(op.pos, 'relational-expression', t.INT, {
                    op: op.value,
                    left: value,
                    right: arg,
                });
            } else {
                this.error(value, `Cannot use ${op} operator on values of types '${t.toString(value.exprType)}' and '${t.toString(arg.exprType)}`);
            }
        }
        return value;
    }

    equalityExpression(): Expression {
        let value = this.relationalExpression();
        while (this.match(['==', '!='])) {
            let op = this.advance<'==' | '!='>();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.relationalExpression());
            if (!(
                   (t.isArithmetic(value.exprType) && t.isArithmetic(arg.exprType))
                || (value.exprType.type === 'pointer' && arg.exprType.type === 'pointer' && t.isCompatible(value.exprType.value, arg.exprType.value))
                || ((value.exprType.type === 'nullptr_t' || value.exprType.type === 'pointer') && (arg.exprType.type === 'nullptr_t' || arg.exprType.type === 'pointer'))
            )) {
                this.error(op, `Cannot use ${op} operator on values of types '${t.toString(value.exprType)}' and '${t.toString(arg.exprType)}'`);
            }
            value = this.create(op.pos, 'equality-expression', t.INT, {
                op: op.value,
                left: value,
                right: arg
            });
        }
        return value;
    }

    bitwiseANDExpression(): Expression {
        let value = this.equalityExpression();
        while (this.match('&')) {
            let op = this.advance();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.equalityExpression());
            if (!t.isArithmetic(value.exprType)) {
                this.error(value, `Cannot use & operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (!t.isArithmetic(arg.exprType)) {
                this.error(arg, `Cannot use & operator on value of non-arithmetic type '${t.toString(arg.exprType)}'`);
            }
            let type = t.findCommonRealType(value.exprType, arg.exprType);
            value = this.create(op.pos, 'bitwise-expression', type, {
                op: '&',
                left: this.cast(op.pos, value, type),
                right: this.cast(op.pos, arg, type),
            });
        }
        return value;
    }

    bitwiseXORExpression(): Expression {
        let value = this.bitwiseANDExpression();
        while (this.match('^')) {
            let op = this.advance();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.bitwiseANDExpression());
            if (!t.isArithmetic(value.exprType)) {
                this.error(value, `Cannot use ^ operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (!t.isArithmetic(arg.exprType)) {
                this.error(arg, `Cannot use ^ operator on value of non-arithmetic type '${t.toString(arg.exprType)}'`);
            }
            let type = t.findCommonRealType(value.exprType, arg.exprType);
            value = this.create(op.pos, 'bitwise-expression', type, {
                op: '^',
                left: this.cast(op.pos, value, type),
                right: this.cast(op.pos, arg, type),
            });
        }
        return value;
    }

    bitwiseORExpression(): Expression {
        let value = this.bitwiseXORExpression();
        while (this.match('|')) {
            let op = this.advance();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.bitwiseXORExpression());
            if (!t.isArithmetic(value.exprType)) {
                this.error(value, `Cannot use | operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (!t.isArithmetic(arg.exprType)) {
                this.error(arg, `Cannot use | operator on value of non-arithmetic type '${t.toString(arg.exprType)}'`);
            }
            let type = t.findCommonRealType(value.exprType, arg.exprType);
            value = this.create(op.pos, 'bitwise-expression', type, {
                op: '|',
                left: this.cast(op.pos, value, type),
                right: this.cast(op.pos, arg, type),
            });
        }
        return value;
    }

    logicalANDExpression(): Expression {
        let value = this.bitwiseORExpression();
        while (this.match('&&')) {
            let op = this.advance();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.bitwiseORExpression());
            if (!t.isScalar(value.exprType)) {
                this.error(value, `Cannot use && operator on value of non-scalar type '${t.toString(value.exprType)}'`);
            }
            if (!t.isScalar(arg.exprType)) {
                this.error(arg, `Cannot use && operator on value of non-scalar type '${t.toString(arg.exprType)}'`);
            }
            value = this.create(op.pos, 'logical-expression', t.INT, {
                op: '&&',
                left: value,
                right: arg,
            });
        }
        return value;
    }

    logicalORExpression(): Expression {
        let value = this.logicalANDExpression();
        while (this.match('||')) {
            let op = this.advance();
            value = this.decayLvaluesArraysFunctions(op.pos, value);
            let arg = this.decayLvaluesArraysFunctions(op.pos, this.logicalANDExpression());
            if (!t.isScalar(value.exprType)) {
                this.error(value, `Cannot use || operator on value of non-scalar type '${t.toString(value.exprType)}'`);
            }
            if (!t.isScalar(arg.exprType)) {
                this.error(arg, `Cannot use || operator on value of non-scalar type '${t.toString(arg.exprType)}'`);
            }
            value = this.create(op.pos, 'logical-expression', t.INT, {
                op: '&&',
                left: value,
                right: arg,
            });
        }
        return value;
    }

    conditionalExpression(): Expression {
        let condition = this.logicalORExpression();
        if (!this.match('?')) {
            return condition;
        }
        let questionMark = this.advance();
        condition = this.decayLvaluesArraysFunctions(questionMark.pos, condition);
        let ifTrue = this.decayLvaluesArraysFunctions(questionMark.pos, this.expression());
        let colon = this.eat(':');
        let ifFalse = this.decayLvaluesArraysFunctions(questionMark.pos, this.conditionalExpression());
        if (!t.isScalar(condition.exprType)) {
            this.error(condition, `The first operand of the ternary conditional operator must be of a scalar type, is of non-scalar type '${t.toString(condition.exprType)}'`);
        }
        let trueType = ifTrue.exprType;
        let falseType = ifFalse.exprType;
        let type: Type;
        if (t.isArithmetic(trueType) && t.isArithmetic(falseType)) {
            type = t.findCommonRealType(trueType, falseType);
        } else if ((trueType.type === 'struct' || trueType.type === 'union') && trueType.type === falseType.type && t.isCompatible(trueType, falseType)) {
            let value = t.createComposite(trueType, falseType);
            if (!value) {
                throw new Error(`This error should not occur, please report it (bug in isCompatible)`);
            }
            type = value;
        } else if (trueType.type === 'void' && falseType.type === 'void') {
            type = t.VOID;
        } else if (trueType.type === 'pointer' && falseType.type === 'pointer' && t.isCompatible(trueType, falseType)) {
            let value = t.createComposite(trueType, falseType);
            if (!value) {
                throw new Error(`This error should not occur, please report it (bug in isCompatible)`);
            }
            type = value;
        } else if (trueType.type === 'nullptr_t' && falseType.type === 'nullptr_t') {
            type = t.NULLPTR;
        } else if (trueType.type === 'pointer' && falseType.type === 'nullptr_t') {
            type = trueType;
        } else if (trueType.type === 'nullptr_t' && falseType.type === 'pointer') {
            type = falseType;
        } else if (trueType.type === 'pointer' && falseType.type === 'pointer' && falseType.value.type === 'void') {
            type = falseType;
        } else if (trueType.type === 'pointer' && trueType.value.type === 'void' && falseType.type === 'pointer') {
            type = trueType;
        } else {
            this.error(colon, `Invalid types for ternary conditional expression: '${t.toString(trueType)}' and '${t.toString(falseType)}'`);
        }
        ifTrue = this.cast(colon.pos, ifTrue, type);
        ifFalse = this.cast(colon.pos, ifFalse, type);
        return this.create(questionMark.pos, 'conditional-expression', type, {
            condition,
            ifTrue,
            ifFalse,
        });
    }

    assignmentExpression(): Expression {
        let left = this.try(this.unaryExpression);
        if (!left) {
            return this.conditionalExpression();
        }
        let op = this.eat(['=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|=']) as SymbolToken;
        left = this.decayArraysFunctions(left);
        if (!a.isLvalue(left) || left.exprType.type === 'function' || left.exprType.const) {
            this.error(left, `Left-hand side of ${op} operator must be a modifiable lvalue`);
        }
        let right = this.decayLvaluesArraysFunctions(this.assignmentExpression());
        if (op.value === '=') {
            if (!t.isCompatible(left.exprType, right.exprType)) {
                this.error(op, `Cannot set lvalue of type '${t.toString(left.exprType)}' to value of incompatible type '${t.toString(right.exprType)}`);
            }
        } else {
            if (!t.isArithmetic(right.exprType)) {
                this.error(op, `Right operand of ${op} operator must be of an arithmetic type, is of type '${t.toString(right.exprType)}'`);
            }
            if (!t.isArithmetic(left.exprType)) {
                if (op.value === '+=' || op.value === '-=') {
                    if (left.exprType.type !== 'pointer') {
                        this.error(op, `Left operand of ${op} operator must be of an arithmetic or pointer type, is of type '${t.toString(right.exprType)}'`);
                    }
                } else {
                    this.error(op, `Left operand of ${op} operator must be of an arithmetic type, is of type '${t.toString(right.exprType)}'`);
                }
            }
        }
        right = this.cast(op.pos, right, left.exprType);
        return this.create(op.pos, 'assignment-expression', left.exprType, {
            op: op.value as a.AssignmentExpression['op'],
            left,
            right,
        });
    }
    
    expression(): Expression {
        let out = this.decayLvaluesArraysFunctions(this.assignmentExpression());
        while (this.match(',')) {
            let op = this.advance();
            let value = this.decayLvaluesArraysFunctions(this.assignmentExpression());
            out = this.create(op.pos, 'comma-expression', value.exprType, {left: out, right: value});
        }
        return out;
    }

    range(): a.Range {
        let start = this.expression();
        let op = this.eat('...');
        let end = this.expression();
        return this.create(op.pos, 'range', {start, end});
    }

    bracedInitializer(type: Type): never {
        this.error(undefined, `Initializers are not supported yet`);
    }

    typeName(): a.TypeName {

    }

}



// export class Parser extends BaseParser<Token, Matcher> {

//     scope: Scope;

//     constructor(from?: BaseDoer) {
//         super(from);
//         this.scope = new Scope(false);
//     }

//     peek<T extends Exclude<Matcher, EOF> = Exclude<Matcher, EOF>>(): MatcherReturnType<T> {
//         let out = this.tokens[this.pos];
//         if (out === undefined) {
//             this.error(undefined, `Unexpected end of input`);
//         } else {
//             return out as MatcherReturnType<T>;
//         }
//     }

//     peekOrEOF<T extends Matcher = Matcher>(): MatcherReturnType<T> | EOF {
//         return (this.tokens[this.pos] ?? EOF) as MatcherReturnType<T> | EOF;
//     }

//     advance<T extends Exclude<Matcher, EOF> = Exclude<Matcher, EOF>>(): MatcherReturnType<T> {
//         let out = this.tokens[this.pos];
//         if (out === undefined) {
//             this.error(undefined, `Unexpected end of input`);
//         } else {
//             this.pos++;
//             return out as MatcherReturnType<T>;
//         }
//     }

//     advanceOrEOF<T extends Matcher = Matcher>(): MatcherReturnType<T> | EOF {
//         let out = this.tokens[this.pos];
//         if (out === undefined) {
//             return EOF;
//         } else {
//             this.pos++;
//             return out as MatcherReturnType<T>;
//         }
//     }

//     _match(token: Token | EOF, matcher: Matcher): boolean {
//         if (matcher === EOF) {
//             return token === EOF;
//         } else if (token === EOF) {
//             return false;
//         } else if (typeof matcher === 'string') {
//             if (KEYWORDS.has(matcher as Keyword)) {
//                 return token.type === 'keyword' && token.value === matcher;
//             } else if (SYMBOLS.has(matcher as CSymbol)) {
//                 return token.type === 'symbol' && token.value === matcher;
//             } else if (matcher.startsWith('identifier ')) {
//                 return token.type === 'identifier' && token.value === matcher.slice('identifier '.length);
//             } else {
//                 return token.type === matcher;
//             }
//         } else {
//             return matcher.some(value => this._match(token, value));
//         }
//     }

//     _expect(token: Token | EOF, matcher: Matcher): void {
//         if (this._match(token, matcher)) {
//             return;
//         }
//         this.error(undefined, `Expected ${matcherToString(matcher)}, got ${tokenToString(token)}`);
//     }

//     eat<T extends Exclude<Matcher, EOF>>(matcher: T): MatcherReturnType<T> {
//         this.expect(matcher);
//         return this.advance<T>();
//     }

//     readonly KEYWORD_ALIASES: {[key: string]: Keyword} = Object.assign(Object.create(null), {
//         '_Alignas': 'alignas',
//         '_Alignof': 'alignof',
//         '_Bool': 'bool',
//         '_Static_assert': 'static_assert',
//         '_Thread_local': 'thread_local',
//     } satisfies {[key: string]: Keyword});

//     readonly INTEGER_DECIMAL_LITERAL_REGEX = /^([1-9]('?[0-9])*)$/u;
//     readonly INTEGER_OCTAL_LITERAL_REGEX = /^(0('?[0-7]*))$/u;
//     readonly INTEGER_HEXADECIMAL_LITERAL_REGEX = /^(0[xX][0-9a-fA-F]('?[0-9a-fA-F])*)$/u;
//     readonly INTEGER_BINARY_LITERAL_REGEX = /^(0[bB][01]('?[01])*)$/u;
//     readonly INTEGER_LITERAL_SUFFIX_REGEX = /([uU](l|L|ll|LL|wb|WB|)|(l|L|ll|LL|wb|WB)[uU]?)$/u;

//     // digit-sequence: ([0-9]('?[0-9])*)
//     // exponent-part: ([eE][+-]?([0-9]('?[0-9])*))
//     readonly DECIMAL_FLOATING_LITERAL_REGEX = /^((([0-9]('?[0-9])*)?\.([0-9]('?[0-9])*)|([0-9]('?[0-9])*)\.)([eE][+-]?([0-9]('?[0-9])*))|([0-9]('?[0-9])*)([eE][+-]?([0-9]('?[0-9])*)))$/u;
//     // hexadecimal-digit-sequence: ([0-9a-fA-F]('?[0-9a-fA-F])*)
//     // hexadecimal-fractional-literal: ([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.
//     // binary-exponent-part: ([pP][+-]?([0-9]('?[0-9])*))
//     readonly HEXADECIMAL_FLOATING_LITERAL_REGEX = /^(0[xX](([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.)([pP][+-]?([0-9]('?[0-9])*)))$/u;
//     readonly FLOATING_LITERAL_SUFFIX_REGEX = /(f|l|F|L|df|dd|dl|DF|DD|DL)$/u;

//     // resolved after preprocessing, during translation phase 7
//     // because they behave differently under stringization
//     readonly SYMBOL_ALIASES: {[key: string]: CSymbol} = Object.assign(Object.create(null), {
//         '<:': '[',
//         ':>': ']',
//         '<%': '{',
//         '%>': '}',
//         '%:': '#',
//         '%:%:': '##',
//     }) satisfies {[key: string]: CSymbol};

//     convertFromPreprocessing(tokens: PreToken[]): Token[] {
//         let out: Token[] = [];
//         for (let token of tokens) {
//             let pos = token.pos;
//             if (token.type === 'whitespace') {
//                 continue;
//             } else if (token.type === 'header-name') {
//                 throw new Error(`This error should not occur, please report it (header name token present after preprocesing)`);
//             } else if (token.type === 'identifier') {
//                 if (KEYWORDS.has(token.value as Keyword)) {
//                     let value = token.value as Keyword;
//                     if (value in this.KEYWORD_ALIASES) {
//                         value = this.KEYWORD_ALIASES[value];
//                     }
//                     out.push({pos, type: 'keyword', value, raw: token.value});
//                 } else {
//                     out.push({pos, type: 'identifier', value: token.value});
//                 }
//             } else if (token.type === 'number') {
//                 let value = token.value;
//                 let raw = value;
//                 let match: RegExpMatchArray | null;
//                 let suffix: IntegerLiteralSuffix | undefined;
//                 if (match = value.match(this.INTEGER_LITERAL_SUFFIX_REGEX)) {
//                     let unsigned = match[0].includes('u') ? 'u' : '';
//                     suffix = (unsigned + match[0].replaceAll('u', '').toLowerCase()) as IntegerLiteralSuffix;
//                     value = value.slice(0, -match[0].length);
//                 }
//                 let parsingPrefix: string | undefined = undefined;
//                 if (value.match(this.INTEGER_DECIMAL_LITERAL_REGEX)) {
//                     parsingPrefix = '';
//                 } else if (value.match(this.INTEGER_OCTAL_LITERAL_REGEX)) {
//                     parsingPrefix = '0o';
//                 } else if (value.match(this.INTEGER_HEXADECIMAL_LITERAL_REGEX)) {
//                     parsingPrefix = '0x';
//                     value = value.slice(2);
//                 } else if (value.match(this.INTEGER_BINARY_LITERAL_REGEX)) {
//                     parsingPrefix = '0b';
//                     value = value.slice(2);
//                 } else {
//                     // try parse as floating
//                     value = raw;
//                     let suffix: FloatingLiteralSuffix | undefined;
//                     if (match = value.match(this.FLOATING_LITERAL_SUFFIX_REGEX)) {
//                         suffix = match[0].toLowerCase() as FloatingLiteralSuffix;
//                         value = value.slice(0, -match[0].length);
//                     }
//                     let number: number;
//                     if (value.match(this.DECIMAL_FLOATING_LITERAL_REGEX)) {
//                         number = Number(value.replaceAll('`', ''));
//                     } else if (value.match(this.HEXADECIMAL_FLOATING_LITERAL_REGEX)) {
//                         this.error(pos, `Hexadecimal floating point literals are not supported yet`);
//                     } else {
//                         this.error(pos, `Preprocessing number does not correspond to real number`);
//                     }
//                     out.push({pos, type: 'floating-literal', value: number, suffix, raw});
//                 }
//                 if (parsingPrefix !== undefined) {
//                     let number = BigInt(parsingPrefix + value.replaceAll(`'`, ''));
//                     out.push({pos, type: 'integer-literal', value: number, suffix, raw});
//                 }
//             } else if (token.type === 'character-literal') {
//                 out.push({pos, type: 'character-literal', value: token.value, prefix: token.prefix, raw: token.raw});
//             } else if (token.type === 'string-literal') {
//                 out.push({pos, type: 'string-literal', value: token.value, prefix: token.prefix, raw: token.raw});
//             } else if (token.type === 'symbol') {
//                 let value = token.value;
//                 if (value in this.SYMBOL_ALIASES) {
//                     value = this.SYMBOL_ALIASES[value];
//                 }
//                 out.push({pos, type: 'symbol', value, raw: token.value});
//             } else if (token.type === 'universal-character-name') {
//                 // i don't see where the standard says what to do here
//                 throw new Error(`This error should not occur, please report it (universal character name token present after preprocesing)`);
//             } else if (token.type === 'other') {
//                 throw new Error(`This error should not occur, please report it (other token present after preprocesing)`);
//             } else if (token.type === 'placemarker') {
//                 throw new Error(`This error should not occur, please report it (placemarker token present after preprocesing)`);
//             } else {
//                 throw new Error(`This error should not occur, please report it (invalid preprocessing token)`);
//             }
//         }
//         return out;
//     }

//     create<T extends a.Node['type']>(pos: Position, type: T, value: Omit<Extract<a.Node, {type: T}>, 'pos' | 'type'>): Extract<a.Node, {type: T}> {
//         return Object.assign(value, {pos, type}) as Extract<a.Node, {type: T}>;
//     }

//     identifier(): a.Identifier {
//         let token = this.eat('identifier');
//         return this.create(token.pos, 'identifier', {scope: this.scope, name: token.value});
//     }

//     identifierExpression(): a.IdentifierExpression {
//         let identifier = this.identifier();
//         return this.create(identifier.pos, 'identifier-expression', {identifier});
//     }

//     integerLiteral(): a.IntegerLiteral {
//         let token = this.eat('integer-literal');
//         let type: t.Integer;
//         if (token.suffix === undefined) {
//             type = t.INT;
//         } else if (token.suffix === 'l') {
//             type = t.LONG_INT;
//         } else if (token.suffix === 'll') {
//             type = t.LONG_LONG_INT;
//         } else if (token.suffix === 'wb') {
//             type = t._BitInt(token.value.toString(2).length + 1);
//         } else if (token.suffix === 'u') {
//             type = t.UNSIGNED_INT;
//         } else if (token.suffix === 'ul') {
//             type = t.UNSIGNED_LONG_INT;
//         } else if (token.suffix === 'ull') {
//             type = t.UNSIGNED_LONG_LONG_INT;
//         } else if (token.suffix === 'uwb') {
//             type = t.unsigned_BitInt(token.value.toString(2).length + 1);
//         } else {
//             throw new Error(`This error should not occur, please report it (invalid integer literal suffix)`);
//         }
//         return this.create(token.pos, 'integer-literal', {value: token.value, valueType: type});
//     }

//     floatingLiteral(): a.FloatingLiteral {
//         let token = this.eat('floating-literal');
//         let type: t.Floating;
//         if (token.suffix === undefined) {
//             type = t.DOUBLE;
//         } else if (token.suffix === 'f') {
//             type = t.FLOAT;
//         } else if (token.suffix === 'l') {
//             type = t.LONG_DOUBLE;
//         } else if (token.suffix === 'df') {
//             this.error(token, `Decimal floating-point types are not supported`);
//         } else if (token.suffix === 'dd') {
//             this.error(token, `Decimal floating-point types are not supported`);
//         } else if (token.suffix === 'dl') {
//             this.error(token, `Decimal floating-point types are not supported`);
//         } else {
//             throw new Error(`This error should not occur, please report it (invalid floating literal suffix)`);
//         }
//         return this.create(token.pos, 'floating-literal', {value: token.value, valueType: type});
//     }

//     characterLiteral(): a.IntegerLiteral {
//         let token = this.advance<'character-literal'>();
//         let type: t.Integer;
//         if (token.prefix === undefined) {
//             type = t.INT;
//         } else if (token.prefix === 'u8') {
//             // char8_t is __builtin_uint8
//             type = t.BUILTIN_UINT8;
//         } else if (token.prefix === 'u') {
//             // char16_t is unsigned int
//             type = t.UNSIGNED_INT;
//         } else if (token.prefix === 'U') {
//             // char32_t is unsigned long int
//             type = t.UNSIGNED_LONG_INT;
//         } else if (token.prefix === 'L') {
//             // wchar_t is unsigned long int
//             type = t.UNSIGNED_LONG_INT;
//         } else {
//             throw new Error(`This error should not occur, please report it (invalid character literal prefix)`);
//         }
//         return this.create(token.pos, 'integer-literal', {value: BigInt(token.value), valueType: type});
//     }

//     stringLiteral(): a.StringLiteral {
//         let token = this.eat('string-literal');
//         let type: t.Integer;
//         if (token.prefix === undefined) {
//             type = t.INT;
//         } else if (token.prefix === 'u8') {
//             // char8_t is __builtin_uint8
//             type = t.BUILTIN_UINT8;
//         } else if (token.prefix === 'u') {
//             // char16_t is unsigned int
//             type = t.UNSIGNED_INT;
//         } else if (token.prefix === 'U') {
//             // char32_t is unsigned long int
//             type = t.UNSIGNED_LONG_INT;
//         } else if (token.prefix === 'L') {
//             // wchar_t is unsigned long int
//             type = t.UNSIGNED_LONG_INT;
//         } else {
//             throw new Error(`This error should not occur, please report it (invalid string literal prefix)`);
//         }
//         let value = structuredClone(token.value);
//         value.push(0);
//         let valueType = t.array(type, value.length) as t.Array & {items: t.Integer};
//         return this.create(token.pos, 'string-literal', {value, valueType});
//     }

//     primaryExpression(): Expression {
//         if (this.match('identifier')) {
//             return this.identifierExpression();
//         } else if (this.match('integer-literal')) {
//             return this.integerLiteral();
//         } else if (this.match('floating-literal')) {
//             return this.floatingLiteral();
//         } else if (this.match('character-literal')) {
//             return this.characterLiteral();
//         } else if (this.match('false')) {
//             let pos = this.advance().pos;
//             return this.create(pos, 'boolean-literal', {value: false});
//         } else if (this.match('true')) {
//             let pos = this.advance().pos;
//             return this.create(pos, 'boolean-literal', {value: true});
//         } else if (this.match('nullptr')) {
//             let pos = this.advance().pos;
//             return this.create(pos, 'nullptr-literal', {});
//         } else if (this.match('string-literal')) {
//             return this.stringLiteral();
//         } else if (this.match('(')) {
//             this.advance();
//             let out = this.expression();
//             this.eat(')');
//             return out;
//         } else if (this.match('_Generic')) {
//             this.error(undefined, `_Generic is not supported yet`);
//         } else {
//             this.error(undefined, `Expected primary expression`);
//         }
//     }

//     indexExpression(value: Expression): Expression {
//         let pos = this.eat('[').pos;
//         let index = this.expression();
//         this.eat(']');
//         return this.create(pos, 'index-expression', {value, index});
//     }

//     functionCallExpression(func: Expression): Expression {
//         let pos = this.eat('(').pos;
//         let args: Expression[] = [];
//         while (!this.match(')')) {
//             args.push(this.assignmentExpression());
//             if (this.match(',')) {
//                 this.advance();
//             } else {
//                 break;
//             }
//         }
//         this.eat(')');
//         return this.create(pos, 'function-call-expression', {func, args});
//     }

//     memberExpression(value: Expression): Expression {
//         let op = this.match('.') ? this.eat('.') : this.eat('->');
//         let member = this.identifier();
//         return this.create(op.pos, 'member-expression', {op: op.value, value, member});
//     }

//     arithmeticPostfixExpression(value: Expression): Expression {
//         let op = this.match('++') ? this.eat('++') : this.eat('--');
//         if (!a.isLvalue(value)) {
//             this.error(op, `Operand of ${op.value} operator must be a lvalue`);
//         }
//         return this.create(op.pos, 'arithmetic-postfix-expression', {op: op.value, value});
//     }

//     compoundLiteral(): Expression {
//         // todo: finish
//         this.eat('(');
//         let type = this.typeName();
//         this.eat(')');
//         this.bracedInitializer();
//     }

//     postfixExpression(): Expression {
//         let value: Expression;
//         let primary = this.try(this.primaryExpression);
//         if (primary) {
//             value = primary;
//         } else {
//             let compound = this.try(this.compoundLiteral);
//             if (compound) {
//                 value = compound;
//             } else {
//                 this.error(undefined, `Expected postfix expression`);
//             }
//         }
//         while (true) {
//             if (this.match('[')) {
//                 value = this.indexExpression(value);
//             } else if (this.match('(')) {
//                 value = this.functionCallExpression(value);
//             } else if (this.match(['.', '->'])) {
//                 value = this.memberExpression(value);
//             } else if (this.match(['++', '--'])) {
//                 value = this.arithmeticPostfixExpression(value);
//             } else {
//                 break;
//             }
//         }
//         return value;
//     }

//     arithmeticUnaryExpression(): Expression {
//         let op = this.match('++') ? this.eat('++') : this.eat('--');
//         let value = this.unaryExpression();
//         if (!a.isLvalue(value)) {
//             this.error(op, `Operand of ${op.value} operator must be a lvalue`);
//         }
//         return this.create(op.pos, 'arithmetic-unary-expression', {op: op.value, value});
//     }

//     basicUnaryExpression(): Expression {
//         let op = this.eat(['&', '*', '+', '-', '~', '!']) as SymbolToken;
//         let value = this.castExpression();
//         if (op.value === '&') {
//             return this.create(op.pos, 'basic-unary-expression', {op: '&', value});
//         } else if (op.value === '*') {
//             return this.create(op.pos, 'basic-unary-expression', {op: '*', value});
//         } else if (op.value === '+') {
//             return this.create(op.pos, 'basic-unary-expression', {op: '+', value});
//         } else if (op.value === '-') {
//             return this.create(op.pos, 'basic-unary-expression', {op: '-', value});
//         } else if (op.value === '~') {
//             return this.create(op.pos, 'basic-unary-expression', {op: '~', value});
//         } else if (op.value === '!') {
//             return this.create(op.pos, 'basic-unary-expression', {op: '!', value});
//         } else {
//             throw new Error(`This error should not occur, please report it (invalid basic unary operator)`);
//         }
//     }

//     countofValueExpression(): a.CountofValueExpression {
//         let token = this.eat('_Countof');
//         let value = this.unaryExpression();
//         return this.create(token.pos, 'countof-value-expression', {value});
//     }

//     countofTypeExpression(): a.CountofTypeExpression {
//         let token = this.eat('_Countof');
//         this.eat('(');
//         let type = this.typeName();
//         this.eat(')');
//         return this.create(token.pos, 'countof-type-expression', {value: type});
//     }

//     sizeofValueExpression(): a.SizeofValueExpression {
//         let token = this.eat('sizeof');
//         let value = this.unaryExpression();
//         return this.create(token.pos, 'sizeof-value-expression', {value});
//     }

//     sizeofTypeExpression(): a.SizeofTypeExpression {
//         let token = this.eat('sizeof');
//         this.eat('(');
//         let type = this.typeName();
//         this.eat(')');
//         return this.create(token.pos, 'sizeof-type-expression', {value: type});
//     }

//     alignofExpression(): a.AlignofExpression {
//         let token = this.eat('sizeof');
//         this.eat('(');
//         let type = this.typeName();
//         this.eat(')');
//         return this.create(token.pos, 'alignof-expression', {value: type});
//     }

//     staticAssertionExpression(): a.StaticAssertionExpression {
//         let token = this.eat('static_assert');
//         this.eat('(');
//         let value = this.expression();
//         let message: a.StringLiteral | undefined = undefined;
//         if (this.match(',')) {
//             this.advance();
//             message = this.stringLiteral();
//         }
//         this.eat(')');
//         return this.create(token.pos, 'static-assertion-expression', {value, message});
//     }

//     unaryExpression(): Expression {
//         if (this.match(['++', '--'])) {
//             return this.arithmeticUnaryExpression();
//         } else if (this.match(['&', '*', '+', '-', '~', '!'])) {
//             return this.basicUnaryExpression();
//         } else if (this.match('_Countof')) {
//             let out = this.try(this.countofTypeExpression);
//             if (out) {
//                 return out;
//             }
//             return this.countofValueExpression();
//         } else if (this.match('sizeof')) {
//             let out = this.try(this.sizeofTypeExpression);
//             if (out) {
//                 return out;
//             }
//             return this.sizeofValueExpression();
//         } else if (this.match('alignof')) {
//             return this.alignofExpression();
//         } else if (this.match('static_assert')) {
//             return this.staticAssertionExpression();
//         } else {
//             return this.postfixExpression();
//         }
//     }

//     castExpression(): Expression {
//         if (this.match('(')) {
//             let paren = this.advance();
//             try {
//                 let type = this.typeName();
//                 this.eat(')');
//                 let value = this.castExpression();
//                 return this.create(paren.pos, 'cast-expression', {castTo: type, value});
//             } catch (error) {
//                 if (!(error instanceof CError)) {
//                     throw error;
//                 }
//                 return this.unaryExpression();
//             }
//         } else {
//             return this.unaryExpression();
//         }
//     }

//     multiplicativeExpression(): Expression {
//         let value = this.castExpression();
//         while (this.match(['*', '/', '%'])) {
//             let op = this.advance<'*' | '/' | '%'>();
//             let arg = this.castExpression();
//             value = this.create(op.pos, 'multiplicative-expression', {op: op.value, left: value, right: arg});
//         }
//         return value;
//     }

//     additiveExpression(): Expression {
//         let value = this.multiplicativeExpression();
//         while (this.match(['+', '-'])) {
//             let op = this.advance<'+' | '-'>();
//             let arg = this.multiplicativeExpression();
//             value = this.create(op.pos, 'additive-expression', {op: op.value, left: value, right: arg});
//         }
//         return value;
//     }

//     shiftExpression(): Expression {
//         let value = this.additiveExpression();
//         while (this.match(['<<', '>>'])) {
//             let op = this.advance<'<<' | '>>'>();
//             let arg = this.additiveExpression();
//             value = this.create(op.pos, 'shift-expression', {op: op.value, left: value, right: arg});
//         }
//         return value;
//     }

//     relationalExpression(): Expression {
//         let value = this.shiftExpression();
//         while (this.match(['<', '>', '<=', '>='])) {
//             let op = this.advance<'<' | '>' | '<=' | '>='>();
//             let arg = this.shiftExpression();
//             value = this.create(op.pos, 'relational-expression', {op: op.value, left: value, right: arg});
//         }
//         return value;
//     }

//     equalityExpression(): Expression {
//         let value = this.relationalExpression();
//         while (this.match(['==', '!='])) {
//             let op = this.advance<'==' | '!='>();
//             let arg = this.relationalExpression();
//             value = this.create(op.pos, 'equality-expression', {op: op.value, left: value, right: arg});
//         }
//         return value;
//     }

//     bitwiseANDExpression(): Expression {
//         let value = this.equalityExpression();
//         while (this.match('&')) {
//             let op = this.advance();
//             let arg = this.equalityExpression();
//             value = this.create(op.pos, 'bitwise-expression', type, {op: '&', left: value, right: arg});
//         }
//         return value;
//     }

//     bitwiseXORExpression(): Expression {
//         let value = this.bitwiseANDExpression();
//         while (this.match('^')) {
//             let op = this.advance();
//             let arg = this.bitwiseANDExpression();
//             value = this.create(op.pos, 'bitwise-expression', {op: '^', left: value, right: arg});
//         }
//         return value;
//     }

//     bitwiseORExpression(): Expression {
//         let value = this.bitwiseXORExpression();
//         while (this.match('|')) {
//             let op = this.advance();
//             let arg = this.bitwiseXORExpression();
//             value = this.create(op.pos, 'bitwise-expression', {op: '|', left: value, right: arg});
//         }
//         return value;
//     }

//     logicalANDExpression(): Expression {
//         let value = this.bitwiseORExpression();
//         while (this.match('&&')) {
//             let op = this.advance();
//             let arg = this.bitwiseORExpression();
//             value = this.create(op.pos, 'logical-expression', {op: '&&', left: value, right: arg});
//         }
//         return value;
//     }

//     logicalORExpression(): Expression {
//         let value = this.logicalANDExpression();
//         while (this.match('||')) {
//             let op = this.advance();
//             let arg = this.logicalANDExpression();
//             value = this.create(op.pos, 'logical-expression', {op: '||', left: value, right: arg});
//         }
//         return value;
//     }

//     conditionalExpression(): Expression {
//         let condition = this.logicalORExpression();
//         if (!this.match('?')) {
//             return condition;
//         }
//         let questionMark = this.advance();
//         let ifTrue = this.expression();
//         this.eat(':');
//         let ifFalse = this.conditionalExpression();
//         return this.create(questionMark.pos, 'conditional-expression', {condition, ifTrue, ifFalse});
//     }

//     assignmentExpression(): Expression {
//         let left = this.try(this.unaryExpression);
//         if (!left) {
//             return this.conditionalExpression();
//         }
//         let op = this.eat(['=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|=']) as SymbolToken;
//         if (!a.isLvalue(left)) {
//             this.error(left, `Left-hand side of ${op} operator must be an lvalue`);
//         }
//         return this.create(op.pos, 'assignment-expression', {op: op.value as a.AssignmentExpression['op'], left, right});
//     }
    
//     expression(): Expression {
//         let out = this.assignmentExpression();
//         while (this.match(',')) {
//             let op = this.advance();
//             let value = this.assignmentExpression();
//             out = this.create(op.pos, 'comma-expression', {left: out, right: value});
//         }
//         return out;
//     }

//     range(): a.Range {
//         let start = this.expression();
//         let op = this.eat('...');
//         let end = this.expression();
//         return this.create(op.pos, 'range', {start, end});
//     }

//     storageSpecifier(): a.StorageSpecifier {

//     }

//     declarationSpecifier(): a.DeclarationSpecifier {

//     }

//     declarator(): a.Declarator {

//     }

//     bracedInitializer(): never {
//         this.error(undefined, `Initializers are not supported yet`);
//     }

//     initializer(): a.Initializer {

//     }

//     initDeclarator(): a.InitDeclarator {
//         let declarator = this.declarator();
//         let initializer: a.Initializer | undefined = undefined;
//         if (this.match('=')) {
//             this.advance();
//             let initializer = this
//         }
//     }

//     basicDeclaration(): a.Declaration {

//     }

//     typeName(): a.TypeName {

//     }

// }
