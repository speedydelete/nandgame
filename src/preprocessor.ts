
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
        return '\a';
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
    | {type: 'int-constant', value: bigint, suffix?: string}
    | {type: 'float-constant', value: number}
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
    | {type: 'string-literal', value: string[]}
    | {type: 'symbol', value: CSymbol}
    | {type: 'universal-char', value: string}
    | {type: 'other', value: string}
);

type PreMatcher =
    | EOF
    | PreToken['type']
    | Whitespace
    | ['symbol', CSymbol | CSymbol[]]
    | ['identifier', string | string[]]
;

const STRING_PRE_NAMES: {[K in Extract<PreMatcher, string>]: string} = {
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


interface Macro {

}

class Preprocessor extends BaseParser<PreToken, PreMatcher> {

    canHaveHeaderTokens: boolean = false;

    currentFilePath: string = '/this_file_does_not_exist.txt';

    macros: Map<string, Macro> = new Map();

    pragmaOnced: Set<string> = new Set();

    _match(token: PreToken | EOF, matcher: PreMatcher): boolean {
        
    }

    _expect(token: PreToken | EOF, matcher: PreMatcher): void {
        if (this._match(token, matcher)) {
            return;
        }
        let expected: string;
        if (matcher === EOF) {
            expected = `end of file`;
        } else if (typeof matcher === 'string') {
            expected = STRING_PRE_NAMES[matcher];
        } else {
            expected = `${STRING_PRE_NAMES[matcher[0]]} `;
            if (typeof matcher[1] === 'string') {
                expected += `'${matcher[1]}'`;
            } else {
                expected += matcher[1].map(x => `'${x}'`).join(', ');
            }
        }
        let got: string;
        if (token === EOF) {
            got = `end of file`;
        } else if (token.type === 'whitespace') {
            got = STRING_PRE_NAMES[token.value];
        } else {
            got = `${STRING_PRE_NAMES[token.type]} `;
            if (token.type === 'string-literal') {
                got += token.raw;
            } else {
                got += `'${token.raw}'`;
            }
        }
        this.error(`Expected ${expected}, got ${got}`);
    }

    tryToConvertToSingleToken(pos: Position, value: string): PreToken | false {
        let raw = value;
        if (value === ' ' || value === '\n' || value === '\t' || value === '\v' || value === '\f') {
            return {pos, raw, type: 'whitespace', value};
        } else if (this.canHaveHeaderTokens && value.match(HEADER_NAME_REGEX)) {
            return {pos, raw, type: 'header-name', value};
        } else if (value.match(IDENTIFIER_REGEX)) {
            return {pos, raw, type: 'identifier', value};
        } else if (value.match(PREPROCESSING_NUMBER_REGEX)) {
            return {pos, raw, type: 'number', value};
        } else if (value.match(CHARACTER_CONSTANT_REGEX)) {
            return {pos, raw, type: 'char-constant', value};
        } else if (SYMBOLS.has(value as CSymbol)) {
            return {pos, raw, type: 'symbol', value: value as CSymbol};
        } else if (value.match(UNIVERSAL_CHARACTER_REGEX)) {
            return {pos, raw, type: 'universal-char', value};
        } else {
            let out = parseStringLiteral(value);
            if (Array.isArray(out)) {
                return {pos, raw, type: 'string-literal', value: out};
            }
            return false;
        }
    }

    convertToSingleToken(pos: Position, value: string): PreToken {
        let out = this.tryToConvertToSingleToken(pos, value);
        if (out === false) {
            throw new Error(`This error should not occur (cannot convert text to single token)`);
        }
        return out;
    }

    isSingleToken(value: string): boolean {
        return this.tryToConvertToSingleToken(PLACEHOLDER_POSITION, value) !== false;
    }

    tokenize(code: string): PreToken[] {
        let lines = code.split('\n');
        let out: PreToken[] = [];
        let multiLineComment: false | Position = false;
        for (let lineNumber = 1; lineNumber < lines.length + 1; lineNumber++) {
            this.canHaveHeaderTokens = false;
            let currentLine: PreToken[] = [];
            let currentTokenStart: Position = {file: this.currentFilePath, line: lineNumber, col: 0};
            let currentToken = '';
            let currentTokenIsSingleToken = false;
            let singleLineComment: false | Position = false;
            while (true) {
                // translation phase 1
                // call Array.from here to use real Unicode characters
                let line = Array.from(lines[lineNumber - 1]);
                let continueToNext = false;
                for (let i = 0; i < line.length; i++) {
                    let char = line[i];
                    // continuation, translation phase 2
                    if (char === '\\' && i === line.length - 1) {
                        continueToNext = true;
                        break;
                    }
                    // translation phase 3
                    // do comments
                    if (singleLineComment) {
                        continue;
                    }
                    if (multiLineComment) {
                        if (char === '*' && line[i + 1] === '/') {
                            out.push(this.convertToSingleToken(multiLineComment, ' '));
                            multiLineComment = false;
                            i += 1;
                            currentTokenStart = {file: this.currentFilePath, line: lineNumber, col: i + 1};
                            currentToken = '';
                            continue;
                        } else {
                            continue;
                        }
                    }
                    if (char === '/' && line[i + 1] === '/') {
                        if (currentToken !== '') {
                            out.push(this.convertToSingleToken(currentTokenStart, currentToken));
                        }
                        singleLineComment = {file: this.currentFilePath, line: lineNumber, col: i};
                        continue;
                    } else if (char === '/' && line[i + 1] === '*') {
                        if (currentToken !== '') {
                            out.push(this.convertToSingleToken(currentTokenStart, currentToken));
                        }
                        multiLineComment = {file: this.currentFilePath, line: lineNumber, col: i};
                        i += 1;
                        continue;
                    }
                    // split it into preprocessing tokens
                    let newToken = currentToken + char;
                    if (!this.isSingleToken(newToken) && currentTokenIsSingleToken) {
                        out.push(this.convertToSingleToken(currentTokenStart, currentToken));
                        currentTokenStart = {file: this.currentFilePath, line: lineNumber, col: i};
                        currentToken = char;
                        currentTokenIsSingleToken = this.isSingleToken(currentToken);
                        // update `canHaveHeaderTokens`
                        if (!this.canHaveHeaderTokens) {
                            // TODO WRITE THIS THING
                        }
                    } else {
                        currentTokenIsSingleToken = true;
                    }
                }
                // continuation, translation phase 2
                if (continueToNext) {
                    lineNumber++;
                } else {
                    break;
                }
            }
            if (singleLineComment) {
                currentLine.push(this.convertToSingleToken(singleLineComment, ' '));
            }
            if (currentToken !== '') {
                currentLine.push(this.convertToSingleToken(currentTokenStart, currentToken));
            }
            currentLine.push(this.convertToSingleToken({file: this.currentFilePath, line: lineNumber, col: lines[lineNumber].length}, '\n'));
            for (let token of currentLine) {
                out.push(token);
            }
        }
        if (multiLineComment) {
            this.error(`Unterminated multi-line comment`, multiLineComment);
        }
        return out;
    }

    line(): PreToken[] {

    }

    preprocess(filePath: string, code: string): Token[] {
        this.currentFilePath = filePath;
        this.tokens = this.tokenize(code);
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
