
// implements the first part of translation phase 7
// converts preprocessing tokens to tokens and builds the AST

import {Position, CError, BaseDoer, BaseToken, EOF, BaseParser, t, Type, Scope, a} from './base.js';
import {SYMBOLS, CSymbol, CharacterConstantPrefix, PreToken} from './preprocessor.js';


export const KEYWORDS = new Set(['alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'char', 'const', 'constexpr', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'false', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'nullptr', 'register', 'restrict', 'short', 'signed', 'sizeof', 'static', 'static_assert', 'struct', 'switch', 'thread_local', 'true', 'typedef', 'typeof', 'typeof_unqual', 'union', 'unsigned', 'void', 'volatile', 'while', '_Atomic', '_BitInt', '_Complex', '_Decimal128', '_Decimal32', '_Decimal64', '_Generic', '_Imaginary', '_Noreturn', '_Alignas', '_Alignof', '_Bool', '_Static_assert', '_Thread_local'] as const);

export type Keyword = typeof KEYWORDS extends Set<infer T> ? T : never;


export type KeywordToken<T extends Keyword = Keyword> = BaseToken & {type: 'keyword', value: T, raw: string};
export type IdentifierToken = BaseToken & {type: 'identifier', value: string};
export type IntegerConstantSuffix = 'l' | 'll' | 'wb' | 'u' | 'ul' | 'ull' | 'uwb';
export type IntConstantToken = BaseToken & {type: 'integer-constant', value: bigint, suffix?: IntegerConstantSuffix, raw: string};
export type FloatingConstantSuffix = 'f' | 'l' | 'df' | 'dd' | 'dl';
export type FloatingConstantToken = BaseToken & {type: 'floating-constant', value: number, suffix?: FloatingConstantSuffix, raw: string};
export type CharConstantToken = BaseToken & {type: 'character-constant', value: number, prefix?: CharacterConstantPrefix, raw: string};
export type StringLiteralToken = BaseToken & {type: 'string-literal', value: number[], prefix?: CharacterConstantPrefix, raw: string};
export type SymbolToken<T extends CSymbol = CSymbol> = BaseToken & {type: 'symbol', value: T, raw: string};

export type Token = KeywordToken | IdentifierToken | IntConstantToken | FloatingConstantToken | CharConstantToken | StringLiteralToken | SymbolToken;

export const STRING_TOKEN_NAMES: {[K in Token['type']]: string} = {
    'keyword': 'keyword',
    'identifier': 'identifier',
    'integer-constant': 'integer constant',
    'floating-constant': 'floating-point constant',
    'character-constant': 'character constant',
    'string-literal': 'string literal',
    'symbol': 'symbol',
};

export function getTokenRaw(token: Token): string {
    if (token.type === 'keyword' || token.type === 'integer-constant' || token.type === 'floating-constant' || token.type === 'character-constant' || token.type === 'string-literal' || token.type === 'symbol') {
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


export class Parser extends BaseParser<Token, Matcher> {

    scope: Scope;

    constructor(from?: BaseDoer) {
        super(from);
        this.scope = new Scope(false);
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

    readonly KEYWORD_ALIASES: {[key: string]: Keyword} = Object.assign(Object.create(null), {
        '_Alignas': 'alignas',
        '_Alignof': 'alignof',
        '_Bool': 'bool',
        '_Static_assert': 'static_assert',
        '_Thread_local': 'thread_local',
    } satisfies {[key: string]: Keyword});

    readonly INTEGER_DECIMAL_CONSTANT_REGEX = /^([1-9]('?[0-9])*)$/u;
    readonly INTEGER_OCTAL_CONSTANT_REGEX = /^(0('?[0-7]*))$/u;
    readonly INTEGER_HEXADECIMAL_CONSTANT_REGEX = /^(0[xX][0-9a-fA-F]('?[0-9a-fA-F])*)$/u;
    readonly INTEGER_BINARY_CONSTANT_REGEX = /^(0[bB][01]('?[01])*)$/u;
    readonly INTEGER_CONSTANT_SUFFIX_REGEX = /([uU](l|L|ll|LL|wb|WB|)|(l|L|ll|LL|wb|WB)[uU]?)$/u;

    // digit-sequence: ([0-9]('?[0-9])*)
    // exponent-part: ([eE][+-]?([0-9]('?[0-9])*))
    readonly DECIMAL_FLOATING_CONSTANT_REGEX = /^((([0-9]('?[0-9])*)?\.([0-9]('?[0-9])*)|([0-9]('?[0-9])*)\.)([eE][+-]?([0-9]('?[0-9])*))|([0-9]('?[0-9])*)([eE][+-]?([0-9]('?[0-9])*)))$/u;
    // hexadecimal-digit-sequence: ([0-9a-fA-F]('?[0-9a-fA-F])*)
    // hexadecimal-fractional-constant: ([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.
    // binary-exponent-part: ([pP][+-]?([0-9]('?[0-9])*))
    readonly HEXADECIMAL_FLOATING_CONSTANT_REGEX = /^(0[xX](([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.)([pP][+-]?([0-9]('?[0-9])*)))$/u;
    readonly FLOATING_CONSTANT_SUFFIX_REGEX = /(f|l|F|L|df|dd|dl|DF|DD|DL)$/u;

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
                let suffix: IntegerConstantSuffix | undefined;
                if (match = value.match(this.INTEGER_CONSTANT_SUFFIX_REGEX)) {
                    let unsigned = match[0].includes('u') ? 'u' : '';
                    suffix = (unsigned + match[0].replaceAll('u', '').toLowerCase()) as IntegerConstantSuffix;
                    value = value.slice(0, -match[0].length);
                }
                let parsingPrefix: string | undefined = undefined;
                if (value.match(this.INTEGER_DECIMAL_CONSTANT_REGEX)) {
                    parsingPrefix = '';
                } else if (value.match(this.INTEGER_OCTAL_CONSTANT_REGEX)) {
                    parsingPrefix = '0o';
                } else if (value.match(this.INTEGER_HEXADECIMAL_CONSTANT_REGEX)) {
                    parsingPrefix = '0x';
                    value = value.slice(2);
                } else if (value.match(this.INTEGER_BINARY_CONSTANT_REGEX)) {
                    parsingPrefix = '0b';
                    value = value.slice(2);
                } else {
                    // try parse as floating
                    value = raw;
                    let suffix: FloatingConstantSuffix | undefined;
                    if (match = value.match(this.FLOATING_CONSTANT_SUFFIX_REGEX)) {
                        suffix = match[0].toLowerCase() as FloatingConstantSuffix;
                        value = value.slice(0, -match[0].length);
                    }
                    let number: number;
                    if (value.match(this.DECIMAL_FLOATING_CONSTANT_REGEX)) {
                        number = Number(value.replaceAll('`', ''));
                    } else if (value.match(this.HEXADECIMAL_FLOATING_CONSTANT_REGEX)) {
                        this.error(pos, `Hexadecimal floating point constants are not supported yet`);
                    } else {
                        this.error(pos, `Preprocessing number does not correspond to real number`);
                    }
                    out.push({pos, type: 'floating-constant', value: number, suffix, raw});
                }
                if (parsingPrefix !== undefined) {
                    let number = BigInt(parsingPrefix + value.replaceAll(`'`, ''));
                    out.push({pos, type: 'integer-constant', value: number, suffix, raw});
                }
            } else if (token.type === 'char-constant') {
                out.push({pos, type: 'character-constant', value: token.value, prefix: token.prefix, raw: token.raw});
            } else if (token.type === 'string-literal') {
                out.push({pos, type: 'string-literal', value: token.value, prefix: token.prefix, raw: token.raw});
            } else if (token.type === 'symbol') {
                let value = token.value;
                if (value in this.SYMBOL_ALIASES) {
                    value = this.SYMBOL_ALIASES[value];
                }
                out.push({pos, type: 'symbol', value, raw: token.value});
            } else if (token.type === 'universal-char') {
                // i don't see where the standard says what to do here
                throw new Error(`This error should not occur, please report it (universal character token present after preprocesing)`);
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

    create<T extends a.Node['type']>(pos: Position, type: T, value: Omit<Extract<a.Node, {type: T}>, 'pos' | 'type'>): Extract<a.Node, {type: T}> {
        return Object.assign(value, {pos, type}) as Extract<a.Node, {type: T}>;
    }

    createExpr<T extends a.Expression['type'], U extends Type>(pos: Position, type: T, exprType: U, value: Omit<Extract<a.Expression, {type: T}>, 'pos' | 'type' | 'exprType'>): Extract<a.Expression, {type: T}> & {exprType: U} {
        return Object.assign(value, {pos, type, exprType}) as Extract<a.Expression, {type: T}> & {exprType: U};
    }

    cast<T extends Type>(pos: Position, value: a.Expression, type: T): a.Expression & {exprType: T} {
        if (t.isSame(value.exprType, type)) {
            return value as a.Expression & {exprType: T};
        }
        return this.createExpr(pos, 'cast-expression', type, {value, castTo: type});
    }

    applyIntegerPromotions(pos: Position, value: a.IntegerExpression): a.IntegerExpression {
        let type = t.applyIntegerPromotions(value.exprType);
        return this.cast(pos, value, type);
    }

    decayArrays(pos: Position, value: a.Expression): a.Expression {
        if (value.exprType.type === 'array') {
            return this.cast(pos, value, t.pointer(value.exprType.items));
        } else {
            return value;
        }
    }

    identifierExpression(): a.IdentifierExpression {
        let token = this.eat('identifier');
        let data = this.scope.getVariable(token.value);
        if (!data) {
            this.error(token, `Variable '${token.value}' is not defined`);
        }
        return this.createExpr(token.pos, 'identifier-expression', data.type, {name: token.value, variable: data});
    }

    integerConstant(): a.IntegerConstant {
        let token = this.eat('integer-constant');
        let type: Type;
        if (token.suffix === undefined) {
            type = t.INT;
        } else if (token.suffix === 'l') {
            type = t.LONG_INT;
        } else if (token.suffix === 'll') {
            type = t.LONG_LONG_INT;
        } else if (token.suffix === 'wb') {
            type = t._BitInt(token.value.toString(2).length + 1);
        } else if (token.suffix === 'u') {
            type = t.UNSIGNED_INT;
        } else if (token.suffix === 'ul') {
            type = t.UNSIGNED_LONG_INT;
        } else if (token.suffix === 'ull') {
            type = t.UNSIGNED_LONG_LONG_INT;
        } else if (token.suffix === 'uwb') {
            type = t.unsigned_BitInt(token.value.toString(2).length + 1);
        } else {
            throw new Error(`This error should not occur, please report it (invalid integer constant suffix)`);
        }
        return this.createExpr(token.pos, 'integer-constant', type, {value: token.value});
    }

    floatingConstant(): a.FloatingConstant {
        let token = this.eat('floating-constant');
        let type: Type;
        if (token.suffix === undefined) {
            type = t.DOUBLE;
        } else if (token.suffix === 'f') {
            type = t.FLOAT;
        } else if (token.suffix === 'l') {
            type = t.LONG_DOUBLE;
        } else if (token.suffix === 'df') {
            this.error(token, `Decimal floating-point types are not supported`);
        } else if (token.suffix === 'dd') {
            this.error(token, `Decimal floating-point types are not supported`);
        } else if (token.suffix === 'dl') {
            this.error(token, `Decimal floating-point types are not supported`);
        } else {
            throw new Error(`This error should not occur, please report it (invalid integer constant suffix)`);
        }
        return this.createExpr(token.pos, 'floating-constant', type, {value: token.value});
    }

    stringLiteral(): a.StringLiteral {
        let token = this.eat('string-literal');
        let type: Type;
        if (token.prefix === undefined) {
            type = t.INT;
        } else if (token.prefix === 'u8') {
            type = t.BUILTIN_UINT8;
        } else if (token.prefix === 'u') {
            type = t.UNSIGNED_INT;
        } else if (token.prefix === 'U') {
            type = t.UNSIGNED_LONG_INT;
        } else if (token.prefix === 'L') {
            type = t.UNSIGNED_LONG_INT;
        } else {
            throw new Error(`This error should not occur, please report it (invalid integer constant suffix)`);
        }
        let value = structuredClone(token.value);
        value.push(0);
        type = t.array(type, value.length);
        return this.createExpr(token.pos, 'string-literal', type, {value});
    }

    characterConstant(): a.CharacterConstant {
        let token = this.advance<'character-constant'>();
        let type: Type;
        if (token.prefix === undefined) {
            type = t.INT;
        } else if (token.prefix === 'u8') {
            type = t.BUILTIN_UINT8;
        } else if (token.prefix === 'u') {
            type = t.UNSIGNED_INT;
        } else if (token.prefix === 'U') {
            type = t.UNSIGNED_LONG_INT;
        } else if (token.prefix === 'L') {
            type = t.UNSIGNED_LONG_INT;
        } else {
            throw new Error(`This error should not occur, please report it (invalid integer constant suffix)`);
        }
        return this.createExpr(token.pos, 'character-constant', type, {value: token.value});
    }

    primaryExpression(): a.Expression {
        if (this.match('identifier')) {
            return this.identifierExpression();
        } else if (this.match('integer-constant')) {
            return this.integerConstant();
        } else if (this.match('floating-constant')) {
            return this.floatingConstant();
        } else if (this.match('character-constant')) {
            return this.characterConstant();
        } else if (this.match('false')) {
            let pos = this.advance().pos;
            return this.createExpr(pos, 'boolean-constant', t.BOOL, {value: false});
        } else if (this.match('true')) {
            let pos = this.advance().pos;
            return this.createExpr(pos, 'boolean-constant', t.BOOL, {value: true});
        } else if (this.match('nullptr')) {
            let pos = this.advance().pos;
            return this.createExpr(pos, 'nullptr-constant', t.NULLPTR, {});
        } else if (this.match('string-literal')) {
            return this.stringLiteral();
        } else if (this.match('(')) {
            this.advance();
            let out = this.expression();
            this.eat(')');
            return out;
        } else if (this.match('_Generic')) {
            this.error(undefined, `_Generic is not supported yet`);
        } else {
            this.error(undefined, `Expected primary expression`);
        }
    }

    indexExpression(value: a.Expression): a.Expression {
        let pos = this.eat('[').pos;
        value = this.decayArrays(pos, value);
        let index = this.decayArrays(pos, this.expression());
        this.eat(']');
        let type: t.Pointer;
        if (value.exprType.type === 'pointer') {
            if (!t.isInteger(index.exprType)) {
                this.error(pos, `Cannot add pointer and non-integer types`);
            }
            type = value.exprType;
        } else if (index.exprType.type === 'pointer') {
                if (!t.isInteger(value.exprType)) {
                this.error(pos, `Cannot add pointer and non-integer types`);
            }
            type = index.exprType;
        } else {
            this.error(pos, `One of the arguments to the indexing operator must be a pointer`);
        }
        return this.createExpr(pos, 'index-expression', type.value, {value, index});
    }

    functionCallExpression(func: a.Expression): a.Expression {
        let pos = this.eat('(').pos;
        func = this.decayArrays(pos, func);
        if (func.exprType.type !== 'function') {
            this.error(pos, `Function being called is not a function`);
        }
        let args: a.Expression[] = [];
        while (!this.match(')')) {
            args.push(this.assignmentExpression());
            if (this.match(',')) {
                this.advance();
            } else {
                break;
            }
        }
        this.eat(')');
        return this.createExpr(pos, 'function-call-expression', func.exprType.returnType, {func, args});
    }

    memberExpression(value: a.Expression): a.Expression {
        let op = this.match('.') ? this.eat('.') : this.eat('->');
        value = this.decayArrays(op.pos, value);
        let memberName = this.identifierExpression();
        let type = value.exprType;
        if (op.value === '->') {
            if (type.type !== 'pointer') {
                this.error(op, `Argument of -> operator must be a pointer to a struct or union`);
            }
            type = type.value;
        }
        if (!(type.type === 'struct' || type.type === 'union')) {
            if (op.value === '.') {
                this.error(op, `Argument of . operator must be a struct or union, is of type ${t.toString(type)}`);
            } else {
                this.error(op, `Argument of -> operator must be a pointer to a struct or union, is of type ${t.toString(value.exprType)}`);
            }
        }
        if (type.const) {
            this.error(op, `Argument of ${op.value} operator must be modifiable`);
        }
        for (let member of type.members) {
            if (member.name === memberName.name) {
                type = member.type;
                let isBitField = Boolean(member.bitField);
                return this.createExpr(op.pos, 'member-expression', type, {
                    op: op.value,
                    value,
                    member: memberName,
                    isBitField,
                });
            }
        }
        this.error(memberName, `Member '${memberName.name}' does not exist in type ${t.toString(value.exprType)}`);
    }

    arithmeticPostfixExpression(value: a.Expression): a.Expression {
        let op = this.match('++') ? this.eat('++') : this.eat('--');
        value = this.decayArrays(op.pos, value);
        if (!a.isModifiableLvalue(value)) {
            this.error(op, `Argument to ${op.value} operator must be a modifiable lvalue`);
        }
        return this.createExpr(op.pos, 'arithmetic-postfix-expression', value.exprType, {op: op.value, value});
    }

    bracedInitializer(type: Type): never {
        this.error(undefined, `Initializers are not supported yet`);
    }

    compoundLiteral(): a.Expression {
        this.eat('(');
        let type = this.typeName();
        this.eat(')');
        this.bracedInitializer(type.typeType);
    }

    postfixExpression(): a.Expression {
        let value: a.Expression;
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

    arithmeticUnaryExpression(): a.Expression {
        let op = this.match('++') ? this.eat('++') : this.eat('--');
        let value = this.unaryExpression();
        if (!a.isModifiableLvalue(value)) {
            this.error(op, `Argument to ${op.value} operator must be a modifiable lvalue`);
        }
        return this.createExpr(op.pos, 'arithmetic-unary-expression', value.exprType, {op: op.value, value});
    }

    basicUnaryExpression(): a.Expression {
        let op = this.eat(['&', '*', '+', '-', '~', '!']) as SymbolToken;
        let value = this.castExpression();
        if (op.value === '&') {
            if (!(value.exprType.type === 'function' || (a.isLvalue(value) && !a.isBitField(value)))) {
                this.error(value, `Cannot take address of object of type '${t.toString(value.exprType)}'`);
            }
            return this.createExpr(op.pos, 'basic-unary-expression', t.pointer(value.exprType), {op: '&', value});
        } else if (op.value === '*') {
            value = this.decayArrays(op.pos, value);
            if (value.exprType.type !== 'pointer') {
                if (value.exprType.type === 'nullptr_t') {
                    this.error(op, `Cannot dereference value of type nullptr_t`);
                }
                this.error(op, `Cannot use unary * operator on value of non-pointer value of type '${t.toString(value.exprType)}'`);
            }
            return this.createExpr(op.pos, 'basic-unary-expression', value.exprType.value, {op: '*', value});
        } else if (op.value === '+') {
            value = this.decayArrays(op.pos, value);
            if (!t.isArithmetic(value.exprType)) {
                this.error(op, `Cannot use unary + operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (a.isIntegerExpression(value)) {
                return this.applyIntegerPromotions(op.pos, this.createExpr(op.pos, 'basic-unary-expression', value.exprType, {op: '+', value}));
            } else {
                return this.createExpr(op.pos, 'basic-unary-expression', value.exprType, {op: '+', value});
            }
        } else if (op.value === '-') {
            value = this.decayArrays(op.pos, value);
            if (!t.isArithmetic(value.exprType)) {
                this.error(op, `Cannot use unary - operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (a.isIntegerExpression(value)) {
                return this.applyIntegerPromotions(op.pos, this.createExpr(op.pos, 'basic-unary-expression', value.exprType, {op: '-', value}));
            } else {
                return this.createExpr(op.pos, 'basic-unary-expression', value.exprType, {op: '-', value});
            }
        } else if (op.value === '~') {
            value = this.decayArrays(op.pos, value);
            if (!a.isIntegerExpression(value)) {
                this.error(op, `Cannot use unary ~ operator on value of non-integer type '${t.toString(value.exprType)}'`);
            }
            return this.applyIntegerPromotions(op.pos, this.createExpr(op.pos, 'basic-unary-expression', value.exprType, {op: '~', value}));
        } else if (op.value === '!') {
            value = this.decayArrays(op.pos, value);
            if (!t.isScalar(value.exprType)) {
                this.error(op, `Cannot use unary ! operator on value of non-scalar type '${t.toString(value.exprType)}'`);
            }
            return this.createExpr(op.pos, 'basic-unary-expression', t.INT, {op: '!', value});
        } else {
            throw new Error(`This error should not occur, please report it (invalid basic unary operator)`);
        }
    }

    sizeofValueExpression(): a.SizeofValueExpression {
        let token = this.eat('sizeof');
        let value = this.unaryExpression();
        // size_t is unsigned int
        return this.createExpr(token.pos, 'sizeof-value-expression', t.UNSIGNED_INT, {value});
    }

    sizeofTypeExpression(): a.SizeofTypeExpression {
        let token = this.eat('sizeof');
        this.eat('(');
        let type = this.typeName();
        this.eat(')');
        // size_t is unsigned int
        return this.createExpr(token.pos, 'sizeof-type-expression', t.UNSIGNED_INT, {value: type});
    }

    alignofExpression(): a.AlignofExpression {
        let token = this.eat('sizeof');
        this.eat('(');
        let type = this.typeName();
        this.eat(')');
        // size_t is unsigned int
        return this.createExpr(token.pos, 'alignof-expression', t.UNSIGNED_INT, {value: type});
    }

    unaryExpression(): a.Expression {
        if (this.match(['++', '--'])) {
            return this.arithmeticUnaryExpression();
        } else if (this.match(['&', '*', '+', '-', '~', '!'])) {
            return this.basicUnaryExpression();
        } else if (this.match('sizeof')) {
            let out = this.try(this.sizeofTypeExpression);
            if (out) {
                return out;
            }
            return this.sizeofValueExpression();
        } else if (this.match('alignof')) {
            return this.alignofExpression();
        } else {
            return this.postfixExpression();
        }
    }

    castExpression(): a.Expression {
        if (this.match('(')) {
            let paren = this.advance();
            try {
                let type = this.typeName();
                this.eat(')');
                let value = this.castExpression();
                if (!t.isCastAllowed(value.exprType, type.typeType)) {
                    this.error(paren, `Cannot cast value of type '${t.toString(value.exprType)}' to type '${t.toString(type.typeType)}`);
                }
                return this.createExpr(paren.pos, 'cast-expression', type.typeType, {castTo: type, value});
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

    multiplicativeExpression(): a.Expression {
        let value = this.castExpression();
        while (true) {
            if (!this.match(['*', '/', '%'])) {
                break;
            }
            let op = this.advance<'*' | '/' | '%'>();
            value = this.decayArrays(op.pos, value);
            let arg = this.decayArrays(op.pos, this.castExpression());
            if (!t.isArithmetic(value.exprType)) {
                this.error(value, `Cannot use ${op} operator on value of non-arithmetic type '${t.toString(value.exprType)}'`);
            }
            if (!t.isArithmetic(arg.exprType)) {
                this.error(arg, `Cannot use ${op} operator on value of non-arithmetic type '${t.toString(arg.exprType)}'`);
            }
            let type = t.findCommonRealType(value.exprType, arg.exprType);
            value = this.createExpr(op.pos, 'multiplicative-expression', type, {
                op: op.value,
                left: this.cast(op.pos, value, type),
                right: this.cast(op.pos, arg, type),
            });
        }
        return value;
    }

    additiveExpression(): a.Expression {
        let value = this.multiplicativeExpression();
        while (true) {
            if (!this.match(['+', '-'])) {
                break;
            }
            let op = this.advance<'+' | '-'>();
            value = this.decayArrays(op.pos, value);
            let arg = this.decayArrays(op.pos, this.multiplicativeExpression());
            if (t.isArithmetic(value.exprType) && t.isArithmetic(arg.exprType)) {
                let type = t.findCommonRealType(value.exprType, arg.exprType);
                value = this.createExpr(op.pos, 'additive-expression', type, {
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
                value = this.createExpr(op.pos, 'additive-expression', type, {op: op.value, left: value, right: arg});
            }
        }
        return value;
    }

    shiftExpression(): a.Expression {
        let value = this.additiveExpression();
        while (true) {
            if (!this.match(['<<', '>>'])) {
                break;
            }
            let op = this.advance<'<<' | '>>'>();
            value = this.decayArrays(op.pos, value);
            let arg = this.decayArrays(op.pos, this.additiveExpression());
            if (!a.isIntegerExpression(value)) {
                this.error(value, `Cannot use ${op} operator on value of non-integer type '${t.toString(value.exprType)}'`);
            }
            if (!a.isIntegerExpression(arg)) {
                this.error(arg, `Cannot use ${op} operator on value of non-integer type '${t.toString(arg.exprType)}'`);
            }
            value = this.applyIntegerPromotions(op.pos, value);
            arg = this.applyIntegerPromotions(op.pos, arg);
            value = this.createExpr(op.pos, 'shift-expression', value.exprType, {op: op.value, left: value, right: arg});
        }
        return value;
    }

    relationalExpression(): a.Expression {
        let value = this.shiftExpression();
        while (true) {
            if (!this.match(['<', '>', '<=', '>='])) {
                break;
            }
            let op = this.advance<'<' | '>' | '<=' | '>='>();
            value = this.decayArrays(op.pos, value);
            let arg = this.decayArrays(op.pos, this.shiftExpression());
            if (t.isReal(value.exprType) && t.isReal(arg.exprType)) {
                let type = t.findCommonRealType(value.exprType, arg.exprType);
                value = this.createExpr(op.pos, 'relational-expression', t.INT, {
                    op: op.value,
                    left: this.cast(op.pos, value, type),
                    right: this.cast(op.pos, arg, type),
                });
            } else if (value.exprType.type === 'pointer' && arg.exprType.type === 'pointer') {
                return this.createExpr(op.pos, 'relational-expression', t.INT, {
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

    assignmentExpression(): a.Expression {

    }
    
    expression(): a.Expression {

    }

    typeName(): a.TypeName {

    }

}
