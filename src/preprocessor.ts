
// implements translation phases 1, 2, 3, 4, and 5

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import {PLACEHOLDER_POSITION, Position, BaseToken, BaseParser, EOF} from './base.js';


export const KEYWORDS = new Set(['alignas', 'alignof', 'auto', 'bool', 'break', 'case', 'char', 'const', 'constexpr', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extern', 'false', 'float', 'for', 'goto', 'if', 'inline', 'int', 'long', 'nullptr', 'register', 'restrict', 'short', 'signed', 'sizeof', 'static', 'static_assert', 'struct', 'switch', 'thread_local', 'true', 'typedef', 'typeof', 'typeof_unqual', 'union', 'unsigned', 'void', 'volatile', 'while', '_Atomic', '_BitInt', '_Complex', '_Decimal128', '_Decimal32', '_Decimal64', '_Generic', '_Imaginary', '_Noreturn', '_Alignas', '_Alignof', '_Bool', '_Static_assert', '_Thread_local'] as const);

export type Keyword = typeof KEYWORDS extends Set<infer T> ? T : never;

export const KEYWORD_ALIASES: {[key: string]: string} = Object.assign(Object.create(null), {
    '_Alignas': 'alignas',
    '_Alignof': 'alignof',
    '_Bool': 'bool',
    '_Static_assert': 'static_assert',
    '_Thread_local': 'thread_local',
});

export const IDENTIFIER_REGEX = /^\p{XID_Start}\p{XID_Continue}*$/u;

export const UNIVERSAL_CHARACTER_REGEX = /^(\\u[0-9A-Fa-f]{4}([0-9a-fA-F]{4})?)$/u;

export const INTEGER_DECIMAL_CONSTANT_REGEX = /^([1-9]('?[0-9])*)/u;
export const INTEGER_OCTAL_CONSTANT_REGEX = /^(0('?[0-7]*))/u;
export const INTEGER_HEXADECIMAL_CONSTANT_REGEX = /^(0[xX][0-9a-fA-F]('?[0-9a-fA-F])*)/u;
export const INTEGER_BINARY_CONSTANT_REGEX = /^(0[bB][01]('?[01])*)/u;
export const INTEGER_CONSTANT_SUFFIX_REGEX = /^([uU](l|L|ll|LL|wb|WB|)|(l|L|ll|LL|wb|WB)[uU]?)/u;

// digit-sequence: ([0-9]('?[0-9])*)
// exponent-part: ([eE][+-]?([0-9]('?[0-9])*))
export const DECIMAL_FLOATING_CONSTANT_REGEX = /^((([0-9]('?[0-9])*)?\.([0-9]('?[0-9])*)|([0-9]('?[0-9])*)\.)([eE][+-]?([0-9]('?[0-9])*))|([0-9]('?[0-9])*)([eE][+-]?([0-9]('?[0-9])*)))/u;
// hexadecimal-digit-sequence: ([0-9a-fA-F]('?[0-9a-fA-F])*)
// hexadecimal-fractional-constant: ([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.
// binary-exponent-part: ([pP][+-]?([0-9]('?[0-9])*))
export const HEXADECIMAL_FLOATING_CONSTANT_REGEX = /^(0[xX](([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)?\.([0-9a-fA-F]('?[0-9a-fA-F])*)|([0-9a-fA-F]('?[0-9a-fA-F])*)\.)([pP][+-]?([0-9]('?[0-9])*)))/u;
export const FLOATING_CONSTANT_SUFFIX_REGEX = /^(f|l|F|L|df|dd|dl|DF|DD|DL)/u;

export const ESCAPE_SEQUENCE_REGEX = /^((\\)(['"?\\abfnrtv]|[0-7]{1,3}|x[0-9a-fA-F]+))/u;
export const CHARACTER_CONSTANT_REGEX = /^((u8|u|U|L)'([^'\\]|((\\)(['"?\\abfnrtv]|[0-7]{1,3}|x[0-9a-fA-F]+)))+')/u;

export function parseEscapeSequence(value: string): string {
    value = value.slice(1);
    if (value === `'` || value === '"' || value === '?' || value === '\\') {
        return value;
    } else if (value === 'a') {
        return '\x07';
    } else if (value === 'b') {
        return '\b';
    } else if (value === 'f') {
        return '\f';
    } else if (value === 'n') {
        return '\n';
    } else if (value === 'r') {
        return '\r';
    } else if (value === 't') {
        return '\t';
    } else if (value === 'v') {
        return '\v';
    } else if (value.startsWith('x')) {
        return String.fromCodePoint(parseInt(value.slice(1), 16));
    } else {
        return String.fromCodePoint(parseInt(value, 8));
    }
}

export function parseStringLiteral(value: string): string[] | false {
    let match = value.match(/^(u8|u|U|L)/);
    if (match) {
        value = value.slice(match[0].length);
    }
    if (!(value.startsWith('"') && value.endsWith('"'))) {
        return false;
    }
    let out: string[] = [];
    // call Array.from here to use real Unicode characters
    let chars = Array.from(value.slice(1, -1));
    for (let i = 0; i < chars.length; i++) {
        let char = chars[i];
        if (char === '"') {
            return false;
        } else if (char === '\\') {
            let match = chars.slice(i).join('').match(ESCAPE_SEQUENCE_REGEX);
            if (!match) {
                return false;
            }
            i += Array.from(match[0]).length - 1;
            out.push(parseEscapeSequence(match[0]));
        } else {
            out.push(char);
        }
    }
    return out;
}

export const SYMBOLS = new Set([
    '[', ']', '(', ')', '{', '}', '.', '->',
    '++', '--', '&', '*', '+', '-', '~', '!',
    '/', '%', '<<', '>>', '<', '>', '<=', '>=', '==', '!=', '^', '|', '&&', '||',
    '?', ':', '::', ';', '...',
    '=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|=',
    ',', '#', '##',
    '<:', ':>', '<%', '%>', '%:', '%:%:',
] as const);

export type CSymbol = typeof SYMBOLS extends Set<infer T> ? T : never;

// resolved after preprocessing, during translation phase 7
// because they behave differently under stringization
export const SYMBOL_ALIASES: {[key: string]: string} = Object.assign(Object.create(null), {
    '<:': '[',
    ':>': ']',
    '<%': '{',
    '%>': '}',
    '%:': '#',
    '%:%:': '##',
});

export const HEADER_NAME_REGEX = /^(<[^\n>]*>|"[^\n>]*")$/u;

export const PREPROCESSING_NUMBER_REGEX = /^(\.?[0-9](\p{XID_Continue}|'[0-9]|'[_a-zA-Z]|[eEpP][+-]|\.)*)$/u;




export type Whitespace = ' ' | '\n' | '\t' | '\v' | '\f';

export type PreWhitespaceToken = BaseToken & {type: 'whitespace', value: Whitespace};
export type PreHeaderNameToken = BaseToken & {type: 'header-name', value: string};
export type PreIdentifierToken = BaseToken & {type: 'identifier', value: string};
export type PreNumberToken = BaseToken & {type: 'number', value: string};
export type PreCharConstantToken = BaseToken & {type: 'char-constant', value: string};
export type PreStringLiteralToken = BaseToken & {type: 'string-literal', value: string[], raw: string};
export type PreSymbolToken = BaseToken & {type: 'symbol', value: CSymbol};
export type PreUniversalCharToken = BaseToken & {type: 'universal-char', value: string};
export type PreOtherToken = BaseToken & {type: 'other', value: string};

export type PreToken = PreWhitespaceToken | PreHeaderNameToken | PreIdentifierToken | PreNumberToken | PreCharConstantToken | PreStringLiteralToken | PreSymbolToken | PreUniversalCharToken | PreOtherToken;

type PreMatcher =
    | EOF
    | PreToken['type']
    | Whitespace
    | CSymbol
    | `identifier ${string}`
    | PreMatcher[]
;

type PreMatcherReturnType<T> =
    T extends EOF ? EOF :
    T extends PreToken['type'] ? Extract<PreToken, {type: T}> :
    T extends Whitespace ? PreWhitespaceToken :
    T extends CSymbol ? PreSymbolToken :
    T extends `identifier ${string}` ? PreIdentifierToken :
    // T extends (infer U)[] ? PreMatcherReturnType<U> :
    never
;

const STRING_PRE_NAMES: {[K in Whitespace | PreToken['type']]: string} = {
    ' ': 'space',
    '\n': 'newline',
    '\t': 'tab',
    '\v': 'vertical tab',
    '\f': 'form feed',
    'whitespace': 'whitespace',
    'header-name': 'header name',
    'identifier': 'identifier',
    'number': 'number',
    'char-constant': 'character constant',
    'string-literal': 'string literal',
    'symbol': 'symbol',
    'universal-char': 'universal character name',
    'other': 'other',
};

export function getPreTokenRaw(token: PreToken): string {
    if (token.type === 'string-literal') {
        return token.raw;
    } else {
        return token.value;
    }
}

export function rawStringifyPreTokens(tokens: PreToken[]): string {
    return tokens.map(getPreTokenRaw).toString();
}

export function preTokenToString(token: PreToken | EOF): string {
    if (token === EOF) {
        return `end of file`;
    } else if (token.type === 'whitespace') {
        return STRING_PRE_NAMES[token.value];
    } else if (token.type === 'other') {
        return `'${token.value}'`;
    } else {
        let out = `${STRING_PRE_NAMES[token.type]} `;
        if (token.type === 'string-literal') {
            out += token.raw;
        } else {
            out += `'${token.value}'`;
        }
        return out;
    }
}

function preMatcherToString(matcher: PreMatcher): string {
    if (matcher === EOF) {
        return `end of file`;
    } else if (typeof matcher === 'string') {
        if (SYMBOLS.has(matcher as CSymbol)) {
            return `symbol '${matcher}'`;
        } else if (matcher.startsWith('identifier ')) {
            return `identifier '${matcher.slice('identifier '.length)}'`;
        } else {
            return STRING_PRE_NAMES[matcher as Whitespace | PreToken['type']];
        }
    } else {
        let out = matcher.map(preMatcherToString);
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


type Macro = 
    | {function: false, value: PreToken[]}
    | {function: true, args: string[], variadic: boolean, value: PreToken[]}
;

const GLOBAL_CODE_PATH = '__global__';
const GLOBAL_CODE = `

`;

class Preprocessor extends BaseParser<PreToken, PreMatcher> {

    canHaveHeaderTokens: boolean = false;

    currentFilePath: string = '/this_file_does_not_exist.txt';

    macros: Map<string, Macro> = new Map();

    pragmaOnced: Set<string> = new Set();

    _match(token: PreToken | EOF, matcher: PreMatcher): boolean {
        if (matcher === EOF) {
            return token === EOF;
        } else if (token === EOF) {
            return false;
        } else if (typeof matcher === 'string') {
            if (matcher === ' ' || matcher === '\n' || matcher === '\t' || matcher === '\v' || matcher === '\f') {
                return token.type === 'whitespace' && token.value === matcher;
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

    _expect(token: PreToken | EOF, matcher: PreMatcher): void {
        if (this._match(token, matcher)) {
            return;
        }
        this.error(`Expected ${preMatcherToString(matcher)}, got ${preTokenToString(token)}`);
    }

    eat<T extends PreMatcher>(matcher: T): PreMatcherReturnType<T> {
        this.expect(matcher);
        return this.advance() as PreMatcherReturnType<T>;
    }

    tryToConvertToSingleToken(pos: Position, value: string): PreToken | false {
        pos = structuredClone(pos);
        if (this.canHaveHeaderTokens && value.match(HEADER_NAME_REGEX)) {
            return {pos, type: 'header-name', value};
        }
        let string = parseStringLiteral(value);
        if (Array.isArray(string)) {
            return {pos, type: 'string-literal', value: string, raw: value};
        }
        if (value === ' ' || value === '\n' || value === '\t' || value === '\v' || value === '\f') {
            return {pos, type: 'whitespace', value};
        } else if (value.match(IDENTIFIER_REGEX)) {
            return {pos, type: 'identifier', value};
        } else if (value.match(PREPROCESSING_NUMBER_REGEX)) {
            return {pos, type: 'number', value};
        } else if (value.match(CHARACTER_CONSTANT_REGEX)) {
            return {pos, type: 'char-constant', value};
        } else if (SYMBOLS.has(value as CSymbol)) {
            return {pos, type: 'symbol', value: value as CSymbol};
        } else if (value.match(UNIVERSAL_CHARACTER_REGEX)) {
            return {pos, type: 'universal-char', value};
        } else {
            return false;
        }
    }

    updateCanHaveHeaderTokens(currentLine: PreToken[]): void {
        this.canHaveHeaderTokens = false;
        let i = 0;
        while (i < currentLine.length && currentLine[i].type === 'whitespace') {
            i++;
        }
        if (i === currentLine.length) {
            return;
        }
        let token = currentLine[i];
        if (token.type === 'symbol' && token.value === '#') {
            i++;
            while (i < currentLine.length && currentLine[i].type === 'whitespace') {
                i++;
            }
            if (i === currentLine.length) {
                return;
            }
            let token = currentLine[i];
            if (token.type === 'identifier' && token.value === 'include') {
                this.canHaveHeaderTokens = true;
            } else if (token.type === 'identifier' && (token.value === 'if' || token.value === 'elif')) {
                i++;
                let parenLevel = 0;
                let goalParenLevel = Infinity;
                for (; i < currentLine.length; i++) {
                    let token = currentLine[i];
                    if (token.type === 'symbol' && token.value === '(') {
                        parenLevel++;
                    } else if (token.type === 'symbol' && token.value === ')') {
                        parenLevel--;
                    } else if (token.type === 'identifier' && (token.value === '__has_include' || token.value === '__has_embed')) {
                        goalParenLevel = parenLevel + 1;
                    }
                }
                if (parenLevel >= goalParenLevel) {
                    this.canHaveHeaderTokens = true;
                } else {
                    this.canHaveHeaderTokens = false;
                }
            }
        }
    }

    tokenize(code: string): PreToken[] {
        let lines = code.split('\n');
        let out: PreToken[] = [];
        let multiLineComment: false | Position = false;
        for (let lineNumber = 1; lineNumber < lines.length + 1; lineNumber++) {
            this.canHaveHeaderTokens = false;
            let line: string[] = [];
            let startLineNumber = lineNumber;
            while (true) {
                // translation phase 1
                // call Array.from here to use real Unicode characters
                for (let char of Array.from(lines[lineNumber - 1])) {
                    line.push(char);
                }
                if (line[line.length - 1] === '\\') {
                    lineNumber++;
                } else {
                    break;
                }
            }
            lineNumber = startLineNumber;
            // translation phase 3
            let currentLine: PreToken[] = [];
            let singleLineComment: false | Position = false;
            let col = 0;
            while (line.length > 0) {
                if (col >= lines[lineNumber - 1].length) {
                    col -= lines[lineNumber - 1].length;
                    lineNumber++;
                }
                let pos = {file: this.currentFilePath, line: lineNumber, col};
                let char = line[0];
                // do comments
                if (singleLineComment) {
                    line.shift();
                    col += 1;
                    continue;
                }
                if (multiLineComment) {
                    if (char === '*' && line[1] === '/') {
                        currentLine.push({pos: structuredClone(multiLineComment), type: 'whitespace', value: ' '});
                        multiLineComment = false;
                        line.shift();
                        line.shift();
                        col += 2;
                        continue;
                    } else {
                        line.shift();
                        col += 1;
                        continue;
                    }
                }
                if (char === '/' && line[1] === '/') {
                    singleLineComment = structuredClone(pos);
                    line.shift();
                    line.shift();
                    col += 2;
                    continue;
                } else if (char === '/' && line[1] === '*') {
                    multiLineComment = structuredClone(pos);
                    line.shift();
                    line.shift();
                    col += 2;
                    continue;
                }
                // get the largest possible preprocessing token
                let found = false;
                this.updateCanHaveHeaderTokens(currentLine);
                for (let i = line.length; i > 0; i--) {
                    let value = line.slice(0, i).join('');
                    let token = this.tryToConvertToSingleToken(pos, value);
                    if (token) {
                        currentLine.push(token);
                        found = true;
                        for (let j = 0; j < i; j++) {
                            line.shift();
                        }
                        col += i;
                        break;
                    }
                }
                if (!found) {
                    currentLine.push({pos: structuredClone(pos), type: 'other', value: char});
                    line.shift();
                    col += 1;
                }
            }
            for (let token of currentLine) {
                out.push(token);
            }
            out.push({pos: {file: this.currentFilePath, line: lineNumber, col}, type: 'whitespace', value: '\n'});
        }
        if (multiLineComment) {
            this.error(`Unterminated multi-line comment`, multiLineComment);
        }
        return out;
    }

    eatNonNewlineWhitespace(): void {
        while (this.match('whitespace') && !this.match('\n')) {
            this.advance();
        }
    }

    expandMacros(tokens: PreToken[]): PreToken[] {
        let out: PreToken[] = [];
        for (let token of tokens) {
            if (token.type === 'identifier' && this.macros.has(token.value)) {
                let macro = this.macros.get(token.value) as Macro;
                if (macro.function) {
                    
                } else {
                    for (let token of macro.value) {
                        out.push(token);
                    }
                }
            } else {
                out.push(token);
            }
        }
        return out;
    }

    balancedTokenSequence(): PreToken[] {
        let out: PreToken[] = [];
        let stack: PreSymbolToken[] = [];
        while (!this.match('\n')) {
            let token = this.advance();
            if (token.type !== 'symbol') {
                out.push(token);
                continue;
            }
            let value = token.value;
            if (value === '(' || value === '[' || value === '{') {
                stack.push(token);
            } else if (value === ')' || value === ']' || value === '}') {
                let last = stack.pop();
                if (last === undefined) {
                    return out;
                } else if (value !== last.value) {
                    this.error(`Unmatched ${preTokenToString(token)}`, token.pos);
                }
            }
            out.push(token);
        }
        let last = stack.pop();
        if (last !== undefined) {
            this.error(`Unmatched ${preTokenToString(last)}`, last.pos);
        }
        return out;
    }

    getLineAndExpandMacros(): PreToken[] {
        let out: PreToken[] = [];
        while (!this.match('\n')) {
            out.push(this.advance());
        }
        return this.expandMacros(out);
    }

    expandMacrosInCurrentLine(): void {
        let startPos = this.pos;
        let data = this.getLineAndExpandMacros();
        // splice the token list, replacing the line
        let after = this.tokens.slice(this.pos);
        this.tokens = this.tokens.slice(0, startPos);
        for (let token of data) {
            this.tokens.push(token);
        }
        for (let token of after) {
            this.tokens.push(token);
        }
        this.pos = startPos;
    }

    getFilePath(): string {
        this.eatNonNewlineWhitespace();
        let nameToken = this.peek();
        let name = '';
        while (!this.match('\n')) {
            name += getPreTokenRaw(this.advance());
            if (name.startsWith('<') && name.endsWith('>')) {
                break;
            } else if (name.startsWith('"') && name.endsWith('"')) {
                break;
            }
        }
        name = name.trimEnd();
        let system: boolean;
        if (name.startsWith('<')) {
            if (!name.endsWith('>')) {
                this.error(`No closing bracket for opening one`, nameToken.pos);
            }
            name = name.slice(1, -1);
            system = true;
        } else if (name.startsWith('"')) {
            if (!name.endsWith('"')) {
                this.error(`No closing quote for opening one`, nameToken.pos);
            }
            name = name.slice(1, -1);
            system = false;
        } else {
            this.error(`Expected header name`, nameToken.pos);
        }
        if (system) {
            name = path.resolve(name, path.join(import.meta.dirname, '..', 'include'));
        } else {
            name = path.join(this.currentFilePath, name);
        }
        return name;
    }

    async evalConstantExpression(data: PreToken[], allowSpecialOperators: boolean): Promise<bigint> {

    }

    async pragma(): Promise<void> {

    }

    eatIfSection(): void {
        let level = 1;
        let prevPos = this.pos;
        while (level > 0) {
            prevPos = this.pos;
            this.eatNonNewlineWhitespace();
            if (this.match('#')) {
                this.advance();
                this.eatNonNewlineWhitespace();
                if (this.match('identifier')) {
                    let directive = this.advance().value;
                    if (directive === 'if' || directive === 'ifdef' || directive === 'ifndef') {
                        level++;
                    } else if (directive === 'endif') {
                        level--;
                    } else if (level === 1 && (directive === 'elif' || directive === 'elifdef' || directive === 'elifndef' || directive === 'else')) {
                        level--;
                    }
                }
            }
            while (!this.match('\n')) {
                this.advance();
            }
            this.eat('\n');
        }
        this.pos = prevPos;
    }

    async conditionalCompilationDirective(directive: string): Promise<PreToken[]> {
        let value: boolean;
        if (directive === 'if') {
            value = await this.evalConstantExpression(this.getLineAndExpandMacros(), true) !== 0n;
        } else {
            this.eatNonNewlineWhitespace();
            let id = this.eat('identifier').value;
            this.eatNonNewlineWhitespace();
            if (!this.match('\n')) {
                this.error(`More than 1 token provided for #${directive} directive`);
            }
            value = this.macros.has(id);
            if (directive === 'ifndef') {
                value = !value;
            }
        }
        this.eat('\n');
        let out: PreToken[] = [];
        let found = false;
        while (true) {
            let startPos = this.pos;
            this.eatIfSection();
            if (value) {
                found = true;
                // run the line
                let endPos = this.pos;
                this.pos = startPos;
                while (this.pos < endPos) {
                    for (let token of await this.line()) {
                        out.push(token);
                    }
                }
            }
            this.eatNonNewlineWhitespace();
            this.eat('#');
            this.eatNonNewlineWhitespace();
            let directive2Token = this.eat('identifier');
            let directive2 = directive2Token.value as 'endif' | 'elif' | 'elifdef' | 'elifndef' | 'else';
            if (directive2 === 'endif') {
                this.eatNonNewlineWhitespace();
                this.eat('\n');
                break;
            } else {
                if (found) {
                    // skip over the sections if we already found a true one
                    value = false;
                    this.eatNonNewlineWhitespace();
                } else if (directive2 === 'else') {
                    // else is not conditional
                    value = true;
                    this.eatNonNewlineWhitespace();
                } else if (directive2 === 'elif') {
                    value = await this.evalConstantExpression(this.getLineAndExpandMacros(), true) !== 0n;
                } else {
                    this.eatNonNewlineWhitespace();
                    let id = this.eat('identifier').value;
                    this.eatNonNewlineWhitespace();
                    if (!this.match('\n')) {
                        this.error(`More than 1 token provided for '#${directive2}' directive`);
                    }
                    value = this.macros.has(id);
                    if (directive2 === 'elifndef') {
                        value = !value;
                    }
                }
                this.eat('\n');
            }
        }
        return out;
    }

    async includeDirective(startPos: number): Promise<void> {
        this.expandMacrosInCurrentLine();
        this.eatNonNewlineWhitespace();
        if (this.match('\n')) {
            this.error(`No argument provided for #include directive`);
        }
        let name = this.getFilePath();
        this.eatNonNewlineWhitespace();
        this.eat('\n');
        // get and parse the file
        let oldPath = this.currentFilePath;
        let oldPos = this.pos;
        this.currentFilePath = name;
        this.pos = 0;
        let newTokens = this.tokenize((await fs.readFile(name)).toString());
        this.currentFilePath = oldPath;
        this.pos = oldPos;
        // splice the token list, deleting the directive in the process
        let after = this.tokens.slice(this.pos);
        this.tokens = this.tokens.slice(0, startPos);
        for (let token of newTokens) {
            this.tokens.push(token);
        }
        for (let token of after) {
            this.tokens.push(token);
        }
        this.pos = startPos;
    }

    async embedDirective(): Promise<PreToken[]> {
        this.expandMacrosInCurrentLine();
        this.eatNonNewlineWhitespace();
        if (this.match('\n')) {
            this.error(`No argument provided for #include directive`);
        }
        let name = this.getFilePath();
        this.eatNonNewlineWhitespace();
        let limit: number | undefined = undefined;
        let suffix: PreToken[] | undefined = undefined;
        let prefix: PreToken[] | undefined = undefined;
        let ifEmpty: PreToken[] | undefined = undefined;
        while (!this.match('\n')) {
            let paramToken = this.eat('identifier');
            let param = paramToken.value;
            if (param === 'limit') {
                this.eat('(');
                let expr = this.balancedTokenSequence();
                this.eat(')');
                limit = Number(await this.evalConstantExpression(expr, false));
            } else if (param === 'suffix') {
                this.eat('(');
                suffix = this.balancedTokenSequence();
                this.eat(')');
            } else if (param === 'prefix') {
                this.eat('(');
                prefix = this.balancedTokenSequence();
                this.eat(')');
            } else if (param === 'if_empty') {
                this.eat('(');
                ifEmpty = this.balancedTokenSequence();
                this.eat(')');
            }
            this.eatNonNewlineWhitespace();
        }
        this.eat('\n');
        let data = new Uint8Array(await fs.readFile(name));
        if (data.length === 0) {
            if (ifEmpty) {
                return ifEmpty;
            } else {
                return [];
            }
        } else {
            let out: PreToken[] = [];
            if (prefix) {
                for (let token of prefix) {
                    out.push(token);
                }
            }
            let length: number;
            if (limit !== undefined) {
                length = Math.min(data.length, limit);
            } else {
                length = data.length;
            }
            for (let i = 0; i < length; i++) {
                let pos = {file: name, line: 1, col: i};
                out.push({pos: structuredClone(pos), type: 'number', value: String(data[i])});
                if (i !== data.length - 1) {
                    out.push({pos: structuredClone(pos), type: 'symbol', value: ','});
                }
            }
            if (suffix) {
                for (let token of suffix) {
                    out.push(token);
                }
            }
            return out;
        }
    }

    replacementListsAreEqual(x: PreToken[], y: PreToken[]): boolean {
        let xi = 0;
        let yi = 0;
        while (xi < x.length && yi < y.length) {
            if (x[xi].type !== y[yi].type) {
                return false;
            }
            if (x[xi].type === 'whitespace') {
                while (x[xi].type === 'whitespace') {
                    xi++;
                }
                while (y[yi].type === 'whitespace') {
                    xi++;
                }
                continue;
            }
            if (getPreTokenRaw(x[xi]) !== getPreTokenRaw(y[yi])) {
                return false;
            }
            xi++;
            yi++;
        }
        return xi === x.length && yi === y.length;
    }

    defineDirective(): void {
        this.eatNonNewlineWhitespace();
        let nameToken = this.eat('identifier');
        let name = nameToken.value;
        let macro: Macro;
        if (this.match('(') && !this.match('(', 'whitespace')) {
            this.advance();
            let args: string[] = [];
            let variadic = false;
            while (true) {
                this.eatNonNewlineWhitespace();
                if (this.match('...')) {
                    variadic = true;
                    break;
                }
                args.push(this.eat('identifier').value);
                if (this.match(',')) {
                    this.advance();
                } else {
                    break;
                }
            }
            this.eatNonNewlineWhitespace();
            this.eat(')');
            this.eatNonNewlineWhitespace();
            let tokens: PreToken[] = [];
            while (!this.match('\n')) {
                tokens.push(this.advance());
            }
            this.eat('\n');
            while (tokens[tokens.length - 1].type === 'whitespace') {
                tokens.pop();
            }
            macro = {function: true, args, variadic, value: tokens};
        } else {
            this.eatNonNewlineWhitespace();
            let tokens: PreToken[] = [];
            while (!this.match('\n')) {
                tokens.push(this.advance());
            }
            this.eat('\n');
            while (tokens[tokens.length - 1].type === 'whitespace') {
                tokens.pop();
            }
            macro = {function: false, value: tokens};
        }
        let old = this.macros.get(name);
        if (old !== undefined) {
            let fine = false;
            if (macro.function && old.function) {
                if (
                       macro.args.length === old.args.length
                    && macro.args.every((x, i) => x === old.args[i])
                    && macro.variadic === old.variadic
                    && this.replacementListsAreEqual(macro.value, old.value)
                ) {
                    fine = true;
                }
            } else if (!macro.function && !old.function) {
                if (this.replacementListsAreEqual(macro.value, old.value)) {
                    fine = true;
                }
            }
            if (!fine) {
                this.error(`Non-identical redefinition of macro '${name}'`, nameToken.pos);
            }
        }
        this.macros.set(name, macro);
    }

    undefDirective(): void {
        this.eatNonNewlineWhitespace();
        let name = this.eat('identifier').value;
        this.macros.delete(name);
        this.eatNonNewlineWhitespace();
        this.eat('\n');
    }

    async directive(): Promise<PreToken[]> {
        let startPos = this.pos;
        this.eatNonNewlineWhitespace();
        this.eat('#');
        this.eatNonNewlineWhitespace();
        // handle empty directive
        if (this.match('\n')) {
            this.advance();
            return [];
        }
        let directiveToken = this.eat('identifier');
        let directive = directiveToken.value;
        if (directive === 'if' || directive === 'ifdef' || directive === 'ifndef') {
            return this.conditionalCompilationDirective(directive);
        } else if (directive === 'elif' || directive === 'elifdef' || directive === 'elifndef' || directive === 'else' || directive === 'endif') {
            this.error(`Invalid location for #${directive} directive`, directiveToken.pos);
        } else if (directive === 'include') {
            await this.includeDirective(startPos);
        } else if (directive === 'embed') {
            return await this.embedDirective();
        } else if (directive === 'define') {
            this.defineDirective();
        } else if (directive === 'undef') {
            this.undefDirective();
        } else {
            this.error(`Invalid directive: '#${directive}'`, directiveToken.pos);
        }
        return [];
    }

    async line(): Promise<PreToken[]> {
        let startPos = this.pos;
        this.eatNonNewlineWhitespace();
        if (this.match('#')) {
            this.pos = startPos;
            return await this.directive();
        } else {
            let out = this.getLineAndExpandMacros();
            out.push(this.eat('\n'));
            return out;
        }
    }

    async resolvePragmaOperator(): Promise<PreToken[]> {

    }

    async preprocess(filePath: string, code: string): Promise<PreToken[]> {
        let oldPath = this.currentFilePath;
        this.currentFilePath = filePath;
        this.tokens = this.tokenize(code);
        this.pos = 0;
        let newTokens: PreToken[] = [];
        while (!this.isAtEnd()) {
            for (let token of await this.line()) {
                newTokens.push(token);
            }
        }
        this.currentFilePath = oldPath;
        this.tokens = newTokens;
        this.pos = 0;
        newTokens = await this.resolvePragmaOperator();
        return newTokens;
    }

}


export async function preprocess(filePath: string, code: string): Promise<PreToken[]> {
    let preprocessor = new Preprocessor();
    preprocessor.preprocess(GLOBAL_CODE_PATH, GLOBAL_CODE);
    let out = preprocessor.preprocess(filePath, code);
    return out;
}
