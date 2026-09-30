
// implements translation phases 1, 2, 3, 4, 5, 6, and 7

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


export type Token = BaseToken & (
    | {type: 'keyword', value: Keyword}
    | {type: 'identifier', value: string}
    | {type: 'int-constant', value: bigint, suffix?: string, raw: string}
    | {type: 'float-constant', value: number, raw: string}
    | {type: 'char-constant', value: string}
    | {type: 'string-literal', value: string}
    | {type: 'symbol', value: CSymbol}
);


type Whitespace = ' ' | '\n' | '\t' | '\v' | '\f';

type PreToken = BaseToken & (
    | {type: 'whitespace', value: Whitespace}
    | {type: 'header-name', value: string}
    | {type: 'identifier', value: string}
    | {type: 'number', value: string}
    | {type: 'char-constant', value: string}
    | {type: 'string-literal', value: string[], raw: string}
    | {type: 'symbol', value: CSymbol}
    | {type: 'universal-char', value: string}
    | {type: 'other', value: string}
);

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
    T extends Whitespace ? Extract<PreToken, {type: 'whitespace'}> :
    T extends CSymbol ? Extract<PreToken, {type: 'symbol', value: T}> :
    T extends `identifier ${string}` ? Extract<PreToken, {type: 'identifier'}> :
    T extends (infer U)[] ? PreMatcherReturnType<U>[] :
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

function getPreTokenRaw(token: PreToken): string {
    if (token.type === 'string-literal') {
        return token.raw;
    } else {
        return token.value;
    }
}

function preTokenToString(token: PreToken | EOF): string {
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


type Macro = {function: false, value: PreToken[]} | {function: true, args: string[], variadic: boolean, body: PreToken[]}


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
                        currentLine.push({pos: multiLineComment, type: 'whitespace', value: ' '});
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
                    singleLineComment = pos;
                    line.shift();
                    line.shift();
                    col += 2;
                    continue;
                } else if (char === '/' && line[1] === '*') {
                    multiLineComment = pos;
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
                    currentLine.push({pos, type: 'other', value: char});
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

    pragma(): void {
    }
    
    replaceMacros(tokens: PreToken[]): PreToken[] {

    }

    directive(): PreToken[] {
        while (this.match('whitespace') && !this.match('\n')) {
            this.advance();
        }
        // handle empty directive
        if (this.match('\n')) {
            this.advance();
            return [];
        }
        let directive = this.eat('identifier').value;
        if (directive === 'if') {

        }
    }

    line(): PreToken[] {
        while (this.match('whitespace') && !this.match('\n')) {
            this.advance();
        }
        if (!this.match('#')) {
            let out: PreToken[] = [];
            while (!this.match('\n')) {
                out.push(this.advance());
            }
            out.push(this.eat('\n'));
            return out;
        }
        this.advance();
        return this.directive();
    }

    preprocess(filePath: string, code: string): Token[] {
        this.currentFilePath = filePath;
        this.tokens = this.tokenize(code);
        console.log(this.tokens);
        let newTokens: PreToken[] = [];
        while (!this.isAtEnd()) {
            for (let token of this.line()) {
                newTokens.push(token);
            }
        }
        this.tokens = newTokens;
    }

}


export function preprocess(filePath: string, code: string): Token[] {
    let preprocessor = new Preprocessor();
    return preprocessor.preprocess(filePath, code);
}

preprocess('test.c', (await fs.readFile('test.c')).toString());
