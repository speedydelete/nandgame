
import {Position, BaseToken, BaseParser} from './base.js';
import {Keyword, CSymbol, PreToken} from './preprocessor.js';


export type Token = BaseToken & (
    | {type: 'keyword', value: Keyword}
    | {type: 'identifier', value: string}
    | {type: 'int-constant', value: bigint, suffix?: string, raw: string}
    | {type: 'float-constant', value: number, raw: string}
    | {type: 'char-constant', value: string}
    | {type: 'string-literal', value: string}
    | {type: 'symbol', value: CSymbol}
);


export class Parser extends BaseParser<Token> {

}
