
import * as path from 'node:path';
import * as fs from 'node:fs/promises';


type Token = 
;

function tokenize(code: string): Token[] {

}

export async function preprocess(codePath: string, code: string): Promise<string> {
    // no need to remap characters ($5.1.1.2)
    // resolve backslashes ($5.1.1.2)
    let newCode = '';
    let lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        while (line.endsWith('\\') && i < lines.length) {
            i++;
            line += lines[i];
        }
        newCode += line + '\n';
    }
}
