
// implements translation phases 1, 2, 3, 4, 5, and 6

import * as path from 'node:path';

import {simplePositionToString, MacroPositionData, Position, BaseDoer, BaseToken, EOF, BaseParser, a} from './base.js';


export const IDENTIFIER_REGEX = /^\p{XID_Start}\p{XID_Continue}*$/u;

export const UNIVERSAL_CHARACTER_REGEX = /^(\\u[0-9A-Fa-f]{4}([0-9a-fA-F]{4})?)$/u;

export type CharacterConstantPrefix = 'u8' | 'u' | 'U' | 'L';

export const ESCAPE_SEQUENCE_REGEX = /^((\\)(['"?\\abfnrtv]|[0-7]{1,3}|x[0-9a-fA-F]+))/u;
export const CHARACTER_CONSTANT_REGEX = /^((u8|u|U|L)'([^'\\]|((\\)(['"?\\abfnrtv0]|[0-7]{1,3}|x[0-9a-fA-F]+)))+')/u;

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
    } else if (value === '0') {
        return '\0';
    } else if (value.startsWith('x')) {
        return String.fromCodePoint(parseInt(value.slice(1), 16));
    } else {
        return String.fromCodePoint(parseInt(value, 8));
    }
}

export function parseStringLiteral(value: string): [number[], CharacterConstantPrefix | undefined] | false {
    let prefix: CharacterConstantPrefix | undefined;
    let match = value.match(/^(u8|u|U|L)/);
    if (match) {
        value = value.slice(match[0].length);
        prefix = match[0] as CharacterConstantPrefix;
    }
    if (!(value.startsWith('"') && value.endsWith('"'))) {
        return false;
    }
    let out: number[] = [];
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
            out.push(parseEscapeSequence(match[0]).codePointAt(0) as number);
        } else {
            out.push(char.codePointAt(0) as number);
        }
    }
    return [out, prefix];
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

export const HEADER_NAME_REGEX = /^(<[^\n>]*>|"[^\n>]*")$/u;

export const PREPROCESSING_NUMBER_REGEX = /^(\.?[0-9](\p{XID_Continue}|'[0-9]|'[_a-zA-Z]|[eEpP][+-]|\.)*)$/u;


export type Whitespace = ' ' | '\n' | '\t' | '\v' | '\f';

export type PreWhitespaceToken = BaseToken & {type: 'whitespace', value: Whitespace};
export type PreHeaderNameToken = BaseToken & {type: 'header-name', value: string};
export type PreIdentifierToken = BaseToken & {type: 'identifier', value: string};
export type PreNumberToken = BaseToken & {type: 'number', value: string};
export type PreCharacterConstantToken = BaseToken & {type: 'char-constant', value: number, prefix?: CharacterConstantPrefix, raw: string};
export type PreStringLiteralToken = BaseToken & {type: 'string-literal', value: number[], prefix?: CharacterConstantPrefix, raw: string};
export type PreSymbolToken<T extends CSymbol = CSymbol> = BaseToken & {type: 'symbol', value: T};
export type PreUniversalCharacterToken = BaseToken & {type: 'universal-char', value: string};
export type PreOtherToken = BaseToken & {type: 'other', value: string};
export type PrePlacemarkerToken = BaseToken & {type: 'placemarker'};

export type PreToken = PreWhitespaceToken | PreHeaderNameToken | PreIdentifierToken | PreNumberToken | PreCharacterConstantToken | PreStringLiteralToken | PreSymbolToken | PreUniversalCharacterToken | PreOtherToken | PrePlacemarkerToken;

export const STRING_PRE_TOKEN_NAMES: {[K in Whitespace | PreToken['type']]: string} = {
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
    'placemarker': 'placemarker',
};

export function getPreTokenRaw(token: PreToken): string {
    if (token.type === 'char-constant' || token.type === 'string-literal') {
        return token.raw;
    } else if (token.type === 'placemarker') {
        return '';
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
        return STRING_PRE_TOKEN_NAMES[token.value];
    } else if (token.type === 'other') {
        return `'${token.value}'`;
    } else if (token.type === 'placemarker') {
        return `<placemarker>`;
    } else {
        return `${STRING_PRE_TOKEN_NAMES[token.type]} ${getPreTokenRaw(token)}`;
    }
}


type PreMatcher =
    | EOF
    | PreToken['type']
    | Whitespace
    | CSymbol
    | `identifier ${string}`
    | PreMatcher[]
;

type PreMatcherReturnType<T extends PreMatcher> =
    T extends EOF ? EOF :
    T extends PreToken['type'] ? Extract<PreToken, {type: T}> :
    T extends Whitespace ? PreWhitespaceToken :
    T extends CSymbol ? PreSymbolToken<T> :
    T extends `identifier ${string}` ? PreIdentifierToken :
    // T extends (infer U)[] ? PreMatcherReturnType<U> :
    T extends any[] ? PreToken :
    never
;

function preMatcherToString(matcher: PreMatcher): string {
    if (matcher === EOF) {
        return `end of file`;
    } else if (typeof matcher === 'string') {
        if (SYMBOLS.has(matcher as CSymbol)) {
            return `symbol '${matcher}'`;
        } else if (matcher.startsWith('identifier ')) {
            return `identifier '${matcher.slice('identifier '.length)}'`;
        } else {
            return STRING_PRE_TOKEN_NAMES[matcher as Whitespace | PreToken['type']];
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
    | {name: string, function: false, value: PreToken[]}
    | {name: string, function: true, args: string[], variadic: boolean, value: PreToken[]}
;


export class Preprocessor extends BaseParser<PreToken, PreMatcher> {

    canHaveHeaderTokens: boolean = false;

    currentFilePath: string = '/this_file_does_not_exist.txt';

    macros: Map<string, Macro> = new Map();

    constructor(from: BaseDoer | undefined, compileDate: Date) {
        super(from);
        let data = new Map<string, PreToken[]>();
        let pos = {file: '__builtin__', line: 1, col: 0};
        let dateValue = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][compileDate.getUTCMonth()]} ${String(compileDate.getUTCDay()).padStart(2, '0')} ${String(compileDate.getUTCFullYear()).padStart(4, '0')}`;
        data.set('__DATE__', [{pos, type: 'string-literal', value: Array.from(dateValue).map(x => x.codePointAt(0) as number), raw: dateValue}]);
        let timeValue = `${String(compileDate.getUTCHours()).padStart(2, '0')}:${String(compileDate.getUTCMinutes()).padStart(2, '0')}:${String(compileDate.getUTCSeconds()).padStart(2, '0')}`;
        data.set('__TIME__', [{pos, type: 'string-literal', value: Array.from(timeValue).map(x => x.codePointAt(0) as number), raw: timeValue}]);
        data.set('__STDC__', [{pos, type: 'number', value: '0'}]);
        data.set('__STDC_EMBED_NOT_FOUND__', [{pos, type: 'number', value: '0'}]);
        data.set('__STDC_EMBED_FOUND__', [{pos, type: 'number', value: '1'}]);
        data.set('__STDC_EMBED_EMPTY__', [{pos, type: 'number', value: '2'}]);
        data.set('__STDC_HOSTED__', [{pos, type: 'number', value: '0'}]);
        data.set('__STDC_UTF_16__', [{pos, type: 'number', value: '1'}]);
        data.set('__STDC_UTF_32__', [{pos, type: 'number', value: '1'}]);
        data.set('__STDC_VERSION__', [{pos, type: 'number', value: '202311L'}]);
        data.set('__STDC_ISO_10646__', [{pos, type: 'number', value: '202012L'}]);
        data.set('__STDC_NO_ATOMICS__', [{pos, type: 'number', value: '1'}]);
        data.set('__STDC_NO_COMPLEX__', [{pos, type: 'number', value: '1'}]);
        data.set('__STDC_NO_THREADS__', [{pos, type: 'number', value: '1'}]);
        data.set('__STDC_NO_VLA__', [{pos, type: 'number', value: '1'}]);
        for (let [key, value] of data) {
            this.macros.set(key, {name: key, function: false, value});
        }
    }

    peek<T extends Exclude<PreMatcher, EOF> = Exclude<PreMatcher, EOF>>(): PreMatcherReturnType<T> {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            this.error(`Unexpected end of input`);
        } else {
            return out as PreMatcherReturnType<T>;
        }
    }

    peekOrEOF<T extends PreMatcher = PreMatcher>(): PreMatcherReturnType<T> | EOF {
        return (this.tokens[this.pos] ?? EOF) as PreMatcherReturnType<T> | EOF;
    }

    advance<T extends Exclude<PreMatcher, EOF> = Exclude<PreMatcher, EOF>>(): PreMatcherReturnType<T> {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            this.error(`Unexpected end of input`);
        } else {
            this.pos++;
            return out as PreMatcherReturnType<T>;
        }
    }

    advanceOrEOF<T extends PreMatcher = PreMatcher>(): PreMatcherReturnType<T> | EOF {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            return EOF;
        } else {
            this.pos++;
            return out as PreMatcherReturnType<T>;
        }
    }

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

    eat<T extends Exclude<PreMatcher, EOF>>(matcher: T): PreMatcherReturnType<T> {
        this.expect(matcher);
        return this.advance<T>();
    }

    tryToConvertToSingleToken(pos: Position, value: string): PreToken | false {
        pos = structuredClone(pos);
        if (this.canHaveHeaderTokens && value.match(HEADER_NAME_REGEX)) {
            return {pos, type: 'header-name', value};
        }
        let string = parseStringLiteral(value);
        if (string !== false) {
            return {pos, type: 'string-literal', value: string[0], prefix: string[1], raw: value};
        }
        if (value === ' ' || value === '\n' || value === '\t' || value === '\v' || value === '\f') {
            return {pos, type: 'whitespace', value};
        } else if (value.match(IDENTIFIER_REGEX)) {
            return {pos, type: 'identifier', value};
        } else if (value.match(PREPROCESSING_NUMBER_REGEX)) {
            return {pos, type: 'number', value};
        } else if (value.match(CHARACTER_CONSTANT_REGEX)) {
            let prefix = value.slice(0, value.indexOf(`'`)) as CharacterConstantPrefix;
            let array = Array.from(value);
            let number = array[array.indexOf(`'`) + 1].codePointAt(0) as number;
            return {pos, type: 'char-constant', value: number, prefix, raw: value};
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
            this.error(multiLineComment, `Unterminated multi-line comment`);
        }
        return out;
    }

    eatNonNewlineWhitespace(): void {
        while (this.match('whitespace') && !this.match('\n')) {
            this.advance();
        }
    }

    balancedParenthesesCall(): PreToken[][] {
        this.eat('(');
        let parenCount = 1;
        let out: PreToken[][] = [];
        let current: PreToken[] = [];
        while (parenCount > 0) {
            let token = this.advance();
            if (token.type === 'symbol') {
                if (token.value === '(') {
                    parenCount++;
                    current.push(token);
                } else if (token.value === ')') {
                    parenCount--;
                    if (parenCount !== 0) {
                        current.push(token);
                    }
                } else if (token.value === ',' && parenCount === 1) {
                    current.push(token);
                    out.push(current);
                    current = [];
                } else {
                    current.push(token);
                }
            } else {
                current.push(token);
            }
        }
        out.push(current);
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
                    this.error(token, `Unmatched ${preTokenToString(token)}`);
                }
            }
            out.push(token);
        }
        let last = stack.pop();
        if (last !== undefined) {
            this.error(last, `Unmatched ${preTokenToString(last)}`);
        }
        return out;
    }

    expandFunctionMacro(macro: Macro & {function: true}): PreToken[] {
        let startPos = this.getCurrentPosition();
        let argData = this.balancedParenthesesCall();
        let variadicArgs: PreToken[] = [];
        if (argData.length !== macro.args.length) {
            if (macro.variadic && argData.length > macro.args.length) {
                variadicArgs = argData.slice(macro.args.length).flat();
                argData = argData.slice(0, macro.args.length);
            } else {
                this.error(startPos, `Invalid number of arguments for call of macro '${macro.name}' (expected ${macro.variadic ? 'at least ' : ''}${macro.args.length}, got ${argData.length})`);
            }
        }
        let args = new Map<string, PreToken[]>();
        for (let i = 0; i < macro.args.length; i++) {
            args.set(macro.args[i], argData[i]);
        }
        let data = macro.value;
        let out: PreToken[] = [];
        // we don't need to call structuredClone in here because it is called later on
        for (let i = 0; i < data.length; i++) {
            let token = data[i];
            if (token.type === 'identifier') {
                let argValue = args.get(token.value);
                if (argValue !== undefined) {
                    // deal with ## operator
                    if (argValue.length === 0) {
                        let prev = data[i - 1];
                        let next = data[i + 1];
                        if ((prev?.type === 'symbol' && prev?.value === '##') || (next?.type === 'symbol' && next?.value === '##')) {
                            out.push({pos: token.pos, type: 'placemarker'});
                        }
                    } else {
                        for (let token of argValue) {
                            out.push(token);
                        }
                    }
                } else if (token.value === '__VA_ARGS__') {
                    if (!macro.variadic) {
                        this.error(token, `__VA_ARGS__ outside of variadic macro`);
                    }
                    if (variadicArgs.length === 0) {
                        out.push({pos: token.pos, type: 'placemarker'});
                    } else {
                        for (let token of variadicArgs) {
                            out.push(token);
                        }
                    }
                } else if (token.value === '__VA_OPT__') {
                    if (!macro.variadic) {
                        this.error(token, `__VA_OPT__ outside of variadic macro`);
                    }
                    i++;
                    let next = data[i];
                    if (!(next.type === 'symbol' && next.value === '(')) {
                        this.error(next, `Expected '(' after __VA_OPT__`);
                    }
                    let value: PreToken[] = [];
                    let parenCount = 1;
                    while (parenCount > 0 && i < data.length) {
                        let token = data[i];
                        if (token.type === 'symbol') {
                            if (token.value === '(') {
                                parenCount++;
                                value.push(token);
                            } else if (token.value === ')') {
                                parenCount--;
                                if (parenCount !== 0) {
                                    value.push(token);
                                }
                            } else {
                                value.push(token);
                            }
                        } else {
                            value.push(token);
                        }
                        i++;
                    }
                    if (i === data.length && parenCount > 0) {
                        this.error(next, `No closing parenthesis found for __VA_OPT__ invocation`);
                    }
                    if (variadicArgs.length > 0) {
                        for (let token of value) {
                            out.push(token);
                        }
                    }
                } else {
                    out.push(token);
                }
            } else if (token.type === 'symbol' && token.value === '#') {
                i++;
                let arg = data[i];
                if (!(arg && arg.type === 'identifier')) {
                    this.error(token, `Expected identifier argument for # operator`);
                }
                let tokens = args.get(arg.value);
                if (!tokens) {
                    this.error(arg, `Argument to # operator is not an argument of the macro`);
                }
                let string: PreStringLiteralToken = {pos: token.pos, type: 'string-literal', value: [], raw: ''};
                tokens = tokens.filter(token => token.type !== 'placemarker');
                while (tokens[0]?.type === 'whitespace') {
                    tokens.shift();
                }
                while (tokens[tokens.length - 1]?.type === 'whitespace') {
                    tokens.pop();
                }
                let wasWhitespace = false;
                for (let token of tokens) {
                    if (token.type === 'whitespace') {
                        if (!wasWhitespace) {
                            wasWhitespace = true;
                            
                        }
                        string.value.push(' '.codePointAt(0) as number);
                        string.raw += ' ';
                    } else {
                        wasWhitespace = false;
                        let tokenRaw = getPreTokenRaw(token);
                        // use for/of to iterate over real Unicode characters
                        for (let char of tokenRaw) {
                            string.value.push(char.codePointAt(0) as number);
                        }
                        string.raw += tokenRaw.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
                    }
                }
                out.push(string);
            } else {
                out.push(token);
            }
        }
        return out;
    }

    expandMacros(tokens: PreToken[], forbidden: Set<string> = new Set()): PreToken[] {
        let out: PreToken[] = [];
        for (let token of tokens) {
            if (token.type === 'identifier' && token.value === '__FILE__') {
                out.push({pos: token.pos, type: 'string-literal', value: Array.from(token.pos.file).map(x => x.codePointAt(0) as number), raw: token.pos.file.replaceAll('\\', '\\\\').replaceAll('"', '\\"')});
            } else if (token.type === 'identifier' && token.value === '__LINE__') {
                out.push({pos: token.pos, type: 'number', value: String(token.pos.line)});
            } else if (token.type === 'identifier' && this.macros.has(token.value)) {
                let macro = this.macros.get(token.value) as Macro;
                let expanded: PreToken[] = [];
                if (macro.function) {
                    for (let token of this.expandFunctionMacro(macro)) {
                        expanded.push(token);
                    }
                } else {
                    for (let token of macro.value) {
                        expanded.push(token);
                    }
                }
                // add error messages before ## operator resolution for better ## operator error messages 
                let toInsert: MacroPositionData[];
                if (token.pos.macro) {
                    toInsert = token.pos.macro;
                } else {
                    toInsert = [];
                }
                toInsert.splice(0, 0, {name: macro.name, pos: token.pos});
                expanded = expanded.map(token => {
                    token = structuredClone(token);
                    if (!token.pos.macro) {
                        token.pos.macro = [];
                    }
                    token.pos.macro = toInsert.concat(token.pos.macro);
                    return token;
                });
                // deal with ## operator
                for (let i = 0; i < expanded.length; i++) {
                    let token = expanded[i];
                    if (token.type === 'symbol' && token.value === '##') {
                        if (i === 0) {
                            this.error(token, `## operator at start of replacement list`);
                        } else if (i === expanded.length - 1) {
                            this.error(token, `## operator at end of replacement list`);
                        }
                        let prev = expanded[i - 1];
                        let next = expanded[i + 1];
                        let value: PreToken;
                        if (prev.type === 'placemarker') {
                            if (next.type === 'placemarker') {
                                value = {pos: token.pos, type: 'placemarker'};
                            } else {
                                value = next;
                            }
                        } else if (next.type === 'placemarker') {
                            value = prev;
                        } else {
                            let possible = this.tryToConvertToSingleToken(token.pos, getPreTokenRaw(prev) + ' ' + getPreTokenRaw(next));
                            if (!possible) {
                                this.error(token, `Cannot convert ## operator result to single preprocessing token`);
                            }
                            value = possible;
                        }
                        expanded = expanded.splice(i - 1, 3, value);
                        i -= 1;
                    }
                }
                expanded = expanded.filter(token => token.type !== 'placemarker');
                forbidden.add(macro.name);
                expanded = this.expandMacros(expanded, forbidden);
                forbidden.delete(macro.name);
                for (let token of expanded) {
                    out.push(token);
                }
            } else {
                out.push(token);
            }
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
                this.error(nameToken, `No closing bracket for opening one`);
            }
            name = name.slice(1, -1);
            system = true;
        } else if (name.startsWith('"')) {
            if (!name.endsWith('"')) {
                this.error(nameToken, `No closing quote for opening one`);
            }
            name = name.slice(1, -1);
            system = false;
        } else {
            this.error(nameToken, `Expected header name`);
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

    pragmaOncedFiles: Set<string> = new Set();

    async pragma(): Promise<PreToken[]> {
        if (this.match('identifier STDC')) {
            this.error(`Standard pragmas are not supported yet`);
        } else if (this.match('identifier once')) {
            this.pragmaOncedFiles.add(this.currentFilePath);
        } else {
            this.error(`Unknown pragma`);
        }
        return [];
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
                    let directive = (this.advance<'identifier'>()).value;
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
        if (this.pragmaOncedFiles.has(name)) {
            return;
        }
        let oldPath = this.currentFilePath;
        this.currentFilePath = name;
        let newTokens = this.tokenize((await this.getFile(name)).toString());
        this.currentFilePath = oldPath;
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
        let data = await this.getFile(name);
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
            macro = {name, function: true, args, variadic, value: tokens};
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
            macro = {name, function: false, value: tokens};
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
                this.error(nameToken, `Non-identical redefinition of macro '${name}'`);
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

    lineDirective(): void {
        this.expandMacrosInCurrentLine();
        this.eatNonNewlineWhitespace();
        let newLineNumberToken = this.eat('number');
        if (!newLineNumberToken.value.match(/^([0-9]('?[0-9])*)$/)) {
            this.error(newLineNumberToken, `Invalid line number for #line`);
        }
        let newLineNumber = Number(newLineNumberToken.value.replaceAll(`'`, ''));
        this.eatNonNewlineWhitespace();
        let newFile: string | undefined = undefined;
        if (this.match('string-literal')) {
            newFile = this.eat('string-literal').value.join('');
        }
        this.eatNonNewlineWhitespace();
        this.eat('\n');
        if (this.isAtEnd()) {
            return;
        }
        let startOldLineNumber = this.peek().pos.line;
        for (let token of this.tokens.slice(this.pos)) {
            token.pos.line = token.pos.line - startOldLineNumber + newLineNumber;
            if (newFile) {
                token.pos.file = newFile;
            }
        }
    }

    errorDirective(): void {
        let pos = this.peek().pos;
        let out = '';
        while (!this.match('\n')) {
            out += getPreTokenRaw(this.advance());
        }
        this.eat('\n');
        this.error(pos, `Error directive: ${out}`);
    }

    warningDirective(): void {
        let pos = this.peek().pos;
        let out = '';
        while (!this.match('\n')) {
            out += getPreTokenRaw(this.advance());
        }
        this.eat('\n');
        console.warn(`Warning directive: ${out}\n    at ${simplePositionToString(pos)}`);
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
            this.error(directiveToken, `Invalid location for #${directive} directive`);
        } else if (directive === 'include') {
            await this.includeDirective(startPos);
        } else if (directive === 'embed') {
            return await this.embedDirective();
        } else if (directive === 'define') {
            this.defineDirective();
        } else if (directive === 'undef') {
            this.undefDirective();
        } else if (directive === 'line') {
            this.lineDirective();
        } else if (directive === 'error') {
            this.errorDirective();
        } else if (directive === 'warning') {
            this.warningDirective();
        } else if (directive === 'pragma') {
            return await this.pragma();
        } else {
            this.error(directiveToken, `Invalid directive: '#${directive}'`);
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
        let out: PreToken[] = [];
        while (!this.isAtEnd()) {
            if (this.match('identifier _Pragma')) {
                this.advance();
                this.eat('(');
                let pragmaToken = this.eat('string-literal');
                this.eat(')');
                let newTokens = this.tokenize(pragmaToken.value.join('')).map(token => {
                    token.pos = structuredClone(pragmaToken.pos);
                    return token;
                });
                let after = this.tokens.slice(this.pos);
                this.tokens = this.tokens.slice(0, this.pos);
                for (let token of newTokens) {
                    this.tokens.push(token);
                }
                this.tokens.push({pos: structuredClone(pragmaToken.pos), type: 'whitespace', value: '\n'});
                for (let token of after) {
                    this.tokens.push(token);
                }
                for (let token of await this.pragma()) {
                    out.push(token);
                }
            } else {
                out.push(this.advance());
            }
        }
        return out;
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
        // translation phase 6
        let out: PreToken[] = [];
        for (let token of newTokens) {
            let prev = out[out.length - 1];
            if (token.type === 'string-literal' && prev?.type === 'string-literal') {
                for (let char of token.value) {
                    prev.value.push(char);
                }
                prev.raw += token.raw;
            } else {
                out.push(token);
            }
        }
        return out;
    }

}
