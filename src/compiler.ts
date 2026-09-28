
import {preprocess} from './preprocessor.js';


export async function compile(codePath: string, code: string): Promise<string> {
    code = await preprocess(codePath, code);
}
