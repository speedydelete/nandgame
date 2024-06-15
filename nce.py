
import traceback
import html
import re
import time
import base64

from typing import Callable

# pylint: disable=import-error

import js as window # type: ignore
import pyodide # type: ignore

from pyodide.ffi.wrappers import add_event_listener, set_interval, clear_interval # type: ignore

# pylint: enable=import-error

document = window.document


ZWSPL = '&#x200B'
ZWSP = '\u200B'

RE_NUM = re.compile('\\*?-?(0b[01]+|0o[0-7]+|0x[0-9A-Fa-f]+|[0-9]+)')
RE_NAME = re.compile('\\*?-?[A-Za-z_][A-Za-z_0-9.]*')
RE_DOLLAR_SUB = re.compile('\\$([0-9]+|n|N)')
RE_FOLDED = re.compile('<-- ([A-Za-z0-9_]*) -->\n')

ASM_SYM_1 = ('>', '<', '{', '}', '+', '-', '&', '|', '^', '~', '=')
ASM_SYM_2 = ('==', '!=', '>=', '<=')
ASM_KEYWORDS = ('macro', 'goto', 'label', 'def', 'if', 'else', 'while', 'func', 'return')
ASM_NAND_CODE = re.compile('<nand( ?)([A-Za-z][A-Za-z0-9_]*)?>(.*?)</nand>', re.S)
ASM_INV_CONDS = {'==': '!=', '!=': '==', '>': '<=', '>=': '<', '<': '>=', '<=': '>'}
ASM_RETURN_NOTHING = 'A = 2\nD = *A\nA = 0\nA, *A = D - 1\nA = *A ; JMP'

E_DESTS = ('A', 'D', '*A', 'A,D', 'A,*A', 'D,A', 'D,*A', '*A,A', '*A,D', \
            'A,D,*A', 'A,*A,D', 'D,A,*A', 'D,*A,A', '*A,A,D', '*A,D,A')
E_NUMBER = re.compile('[1-9][0-9]*|0b[1][01]*|0o[1-7][0-7]*|0x[1-9A-Fa-f][0-9A-Fa-f]*')
E_CALCULATIONS = {'D+A': 'd + a', 'D-A': 'd - a', 'A-D': 'a - d', 'D&A': 'd & a', 'D|A': 'd | a', 'A+1': 'a + 1', \
                  'A-1': 'a - 1', 'D+*A': 'd + s', 'D-*A': 'd - s', '*A-D': 's - d', 'D&*A': 'd & s', 'D|*A': 'd | s', \
                  '*A+1': 's + 1', '*A-1': 's - 1', 'D+1': 'd + 1', 'D-1': 'd - 1', '-D': '-d', '~D': '~d', '1': '1', \
                  '0': '0', '-1': '-1', 'A': 'a', 'D': 'd', '*A': 's', '-A': '-a', '-*A': '-s', '~A': '~a', '~*A': '~s'}
E_JUMPS = {'JMP': 'True', 'JEQ': 'value == 0', 'JNE': 'value != 0', 'JGT': 'value > 0', 'JGE': 'value >= 0', \
           'JLT': 'value < 0', 'JLE': 'value <= 0'}
E_METHODS = {0: 'GET', 1: 'HEAD', 2: 'POST', 3: 'PUT', 4: 'DELETE', 5: 'CONNECT', 6: 'OPTIONS', 7: 'TRACE', 8: 'PATCH'}

E_DEFAULT_MACROS = {
    'INIT_STACK': 'A=256\nD=A\nA=SP\n*A=D',
    'PUSH_D': 'A=SP\n*A=*A+1\nA=*A-1\n*A=D',
    'POP_D': 'A=SP\nA,*A=*A-1\nD=*A',
    'POP_A': 'A=SP\nA,*A=*A-1\nA=*A',
    'PUSH_VALUE': 'A=$0\nD=A\nA=SP\n*A=*A+1\nA=*A-1\n*A=D',
    'ADD': 'A=SP\nA,*A=*A-1\nD=*A\nA=A-1\n*A=D+*A',
    'SUB': 'A=SP\nA,*A=*A-1\nD=*A\nA=A-1\n*A=*A-D',
    'NEG': 'A=SP\nA=*A-1\n*A=-*A',
    'AND': 'A=SP\nA,*A = *A-1\nD=*A\nA=A-1\n*A=D&*A',
    'OR': 'A=SP\nA,*A = *A-1\nD=*A\nA=A-1\n*A=D|*A',
    'EQ': 'A=SP\n*A=*A-1\nA=*A\nD=*A\nA=A-1\nD=*A-D\nA=$R0\nD;JEQ\nA=$R1\nD=0;JMP\n$R0:\nD=-1\n$R1:\nA=SP\nA=*A-1\n*A=D',
    'GT': 'A=SP\n*A=*A-1\nA=*A\nD=*A\nA=A-1\nD=*A-D\nA=$R0\nD;JGT\nA=$R1\nD=0;JMP\n$R0:\nD=-1\n$R1:\nA=SP\nA=*A-1\n*A=D',
    'LT': 'A=SP\n*A=*A-1\nA=*A\nD=*A\nA=A-1\nD=*A-D\nA=$R0\nD;JLT\nA=$R1\nD=0;JMP\n$R0:\nD=-1\n$R1:\nA=SP\nA=*A-1\n*A=D',
    'GOTO': 'A=$0\nA;JMP',
    'IF_GOTO': 'A=SP\nA,*A=*A-1\nD=*A\nA=$0\n*A;JNE',
    'PUSH_MEMORY': 'A=SP\nD,A=*A-1\nA=*A\nD=D+*A\nA=D-*A\n*A=D-A',
    'POP_MEMORY': 'A=SP\nA,*A=*A-1\nD=*A\nA=SP\nA,*A=*A-1\nA=*A\n*A=D',
    'PUSH_STATIC': 'A=$0\nD=*A\nA=SP\n*A=*A+1\nA=*A-1\n*A=D',
    'POP_STATIC': '\nA=SP\nA,*A=*A-1\nD=*A\nA=$0\n*A=D',
    'CALL': 'A=1\nD=*A\nA=SP\n*A=*A+1\nA=*A-1\n*A=D\nA=2\nD=*A\nA=SP\n*A=*A+1\nA=*A-1\n*A=D\nA=$R0\nD=A\nA=SP\n*A=*A+1\n' + \
            'A=*A-1\n*A=D\nD=A-1\nA=$1\nD=D-A\nA=1\n*A=D-1\nA=$0\nA;JMP\n$R0:\nA=SP\nA,*A=*A-1\nD=*A\nA=2\n*A=D\n' + \
            'A= SP\nA,*A=*A-1\nD=*A\nA=4\n*A=D\nA=6\nD=*A\nA=1\nA=*A\n*A=D\nD=A+1\nA=SP\n*A=D\nA=4\nD=*A\nA=1\n*A=D',
    'FUNCTION': '$0:\nA=$1\nD=A\nA=0\n*A=D+*A\nD=*A-D\nA=2\n*A=D',
    'RETURN': 'A=SP\nA,*A=*A-1\nD=*A\nA=6\n*A=D\nA=2\nD=*A\nA=SP\nA,*A=D-1\nA=*A;JMP',
    'PUSH_ARG': 'A=1\nD=*A\nA=$0\nA=D+A\nD=*A\nA=SP\n*A=*A+1\nA=*A-1\n*A=D',
    'POP_ARG': 'A=$0\nD=A\nA=1\nD=D+*A\nA=SP\nA,*A=*A-1\nD=D+*A\nA=D-*A\n*A=D-A',
    'PUSH_LOCAL': '\nA=2\nD=*A\nA=$0\nA=D+A\nD=*A\nA=SP\n*A=*A+1\nA=*A-1\n*A=D',
    'POP_LOCAL': 'A=$0\nD=A\nA=2\nD=D+*A\nA=SP\nA,*A=*A-1\nD=D+*A\nA=D-*A\n*A=D-A'
}
E_KEYWORDS = ('DEFINE', 'LABEL') + tuple(E_DEFAULT_MACROS)
E_FIRST_PARTS = tuple(E_CALCULATIONS.keys()) + E_KEYWORDS + ('#',)

SPECIAL_KEYMAP = {0x0000: 'Unidentified', 0x0008: 'Backspace', 0x0009: 'Tab', 0x000A: 'Enter', 0xF100: 'Alt', \
                  0xF101: 'AltGraph', 0xF102: 'CapsLock', 0xF103: 'Control', 0xF104: 'Fn', 0xF105: 'FnLock', \
                  0xF106: 'Hyper', 0xF107: 'Meta', 0xF108: 'NumLock', 0xF109: 'ScrollLock', 0xF10A: 'Shift', \
                  0xF10B: 'Super', 0xF10C: 'Symbol', 0xF10D: 'SymbolLock', 0xF110: 'ArrowDown', 0xF111: 'ArrowLeft', \
                  0xF112: 'ArrowRight', 0xF113: 'ArrowUp', 0xF114: 'End', 0xF115: 'Home', 0xF116: 'PageDown', \
                  0xF117: 'PageUp', 0xF120: 'Clear', 0xF121: 'Copy', 0xF122: 'CrSel', 0xF123: 'Cut', 0xF124: 'Delete', \
                  0xF125: 'EraseEof', 0xF126: 'ExSel', 0xF127: 'Insert', 0xF128: 'Paste', 0xF129: 'Redo', 0xF12A: 'Undo', \
                  0xF130: 'Accept', 0xF131: 'Again', 0xF132: 'Attn', 0xF133: 'Cancel', 0xF134: 'ContextMenu', 0xF135: 'Escape', \
                  0xF136: 'Execute', 0xF137: 'Find', 0xF138: 'Finish', 0xF139: 'Help', 0xF13A: 'Pause',0xF13B: 'Play', \
                  0xF13C: 'Props' ,0xF13D: 'Select', 0xF13E: 'ZoomIn', 0xF13F: 'ZoomOut', 0xF140: 'BrightnessDown', \
                  0xF141: 'BrightnessUp', 0xF142: 'Eject', 0xF143: 'LogOff', 0xF144: 'Power', 0xF145: 'PowerOff', \
                  0xF146: 'PrintScreen', 0xF147: 'Hibernate', 0xF148: 'Standby', 0xF149: 'WakeUp', 0xF150: 'AllCandidates', \
                  0xF151: 'Alphanumeric', 0xF152: 'CodeInput', 0xF153: 'Compose', 0xF154: 'Convert', 0xF155: 'Dead', \
                  0xF156: 'FinalMode',  0xF157: 'GroupFirst', 0xF158: 'GroupLast', 0xF159: 'GroupNext', 0xF15A: 'GroupPrevious', \
                  0xF15B: 'ModeChange', 0xF15C: 'NextCandidate', 0xF15D: 'NonConvert', 0xF15E: 'Process', \
                  0xF15F: 'SingleCandidate', 0xF160: 'HangulMode', 0xF161: 'HanjaMode', 0xF162: 'JunjaMode', 0xF163: 'Eisu', \
                  0xF164: 'Hankaku', 0xF165: 'Hiragana', 0xF166: 'HiraganaKatakana', 0xF167: 'KanaMode', 0xF168: 'KanjiMode', \
                  0xF169: 'Katakana',  0xF170: 'Romanji',  0xF171: 'Zenkaku',  0xF172: 'ZenkakuHankaku',  0xF180: 'F1', \
                  0xF181: 'F2', 0xF182: 'F3', 0xF183: 'F4', 0xF184: 'F5', 0xF185: 'F6', 0xF186: 'F7', 0xF187: 'F8', \
                  0xF188: 'F9', 0xF189: 'F10', 0xF18A: 'F11', 0xF18B: 'F12', 0xF18C: 'F13', 0xF18D: 'F14', 0xF18E: 'F15', \
                  0xF18F: 'F16', 0xF190: 'F17', 0xF191: 'F18', 0xF192: 'F19', 0xF193: 'F20', 0xF19D: 'Soft1', 0xF19E: 'Soft2', \
                  0xF19F: 'Soft3', 0xF1A0: 'BrowserBack', 0xF1A1: 'BrowserFavorites', 0xF1A2: 'BrowserForward', \
                  0xF1A3: 'BrowserHome', 0xF1A4: 'BrowserRefresh', 0xF1A5: 'BrowserSearch', 0xF1A6: 'BrowserStop', \
                  0xF1B0: 'Decimal', 0xF1B1: 'Key11', 0xF1B2: 'Key12', 0xF1B3: 'Multiply', 0xF1B4: 'Add', 0xF1B5: 'Clear', \
                  0xF1B6: 'Divide', 0xF1B7: 'Subtract', 0xF1B8: 'Seperator'}

class AssemblyError(Exception):
    '''Exception for assembly errors'''

class ExecutionError(Exception):
    '''Exception for errors encountered during execution'''


def is_selection() -> bool | None:
    '''Checks if the user is selecting something'''
    try:
        return bool(window.getSelection().toString())
    except pyodide.ffi.JsException:
        return None

def get_caret_position(elt, attr: str='innerText') -> int | bool:
    '''Gets the position of the caret'''
    t = document.createTextNode('\u0001')
    try:
        document.getSelection().getRangeAt(0).insertNode(t)
    except pyodide.ffi.JsException:
        return False
    try:
        pos = getattr(elt, attr).replace('\r', '').replace(ZWSP, '').index('\u0001')
    except (ValueError, pyodide.ffi.JsException):
        pos = False
    finally:
        t.parentNode.removeChild(t)
    return pos

def set_caret_position(elt, pos: int) -> None:
    '''Sets the position of the caret'''
    try:
        if pos == False:
            return
        window.setCaretPosition(elt, pos)
    except pyodide.ffi.JsException:
        pass
def get_code() -> str:
    '''Get the code div's value'''
    return document.getElementById('pre-code').innerText.replace(ZWSP, '').replace('\xA0', ' ')

def set_code(code: str, pos: int=0, h: bool=False) -> None:
    '''Set the code div's value'''
    elt = document.getElementById('pre-code')
    code = escape(code.replace('\n', '\n' + ZWSP))
    if code.startswith('<br>' + ZWSPL):
        code = code[4:]
    elt.innerHTML = code
    if h:
        highlight()
    set_caret_position(elt, pos)

def alert(*args, sep=' ', end='\n') -> None:
    '''Wrapper around alert for print-like behavior'''
    window.alert(str(sep).join([str(x) for x in args]) + str(end))

def escape(text: str) -> str:
    '''Escapes HTML'''
    return html.escape(str(text)).replace(' ', '&nbsp;').replace('\n', '<br>')

folds = {}


def tokenize(code: str) -> tuple[list[str], list[str]]:
    '''Tokenizes NCE assembly'''
    code = code.replace(ZWSP, '').replace('\xA0', ' ')
    if len(code) == 0:
        return ([], [])
    if code[-1] != '\n':
        code += '\n'
    out = []
    errmsgs = []
    line = []
    funcs = []
    ln = 0
    lines = code.split('\n')
    wfunc = False
    while len(code) > 0:
        rwfunc = True
        if code[0] == ' ':
            line.append(' ')
            code = code[1:]
            rwfunc = False
        elif code[0] == '\t':
            line.append('\t')
            code = code[1:]
        elif code[0] == '\n':
            out.append(line)
            line = []
            code = code[1:]
            ln += 1
            if len(code) == 0:
                break
            if m := RE_FOLDED.match(code):
                code = code[m.end():]
                out.append(['F', m.group(1)])
        elif code[0] == '#':
            pos = code.index('\n')
            out.append([code[:pos]])
            code = code[pos + 1:]
            ln += 1
        elif code.startswith('macro'):
            line.append('macro')
            code = code[5:]
            wfunc = True
            rwfunc = False
        elif code.startswith('func'):
            line.append('func')
            code = code[4:]
            wfunc = True
            rwfunc = False
        elif len(kw := [x for x in ASM_KEYWORDS if code.startswith(x)]) > 0:
            kw = kw[0]
            line.append(kw)
            code = code[len(kw):]
        elif code.startswith('true'):
            line.append('true')
            code = code[4:]
        elif m := ASM_NAND_CODE.match(code):
            code = code[m.end():]
            sp = m.group(1)
            name = m.group(2)
            text = m.group(3)
            sp = sp if sp is not None else ''
            name = name if name is not None else ''
            text = text if text is not None else ''
            line.append(['N', sp, name, text.replace('\xA0', ' ').replace(ZWSP, '')])
        elif code[:2] in ASM_SYM_2:
            line.append(code[:2])
            code = code[2:]
        elif code[0] in ASM_SYM_1:
            line.append(code[0])
            code = code[1:]
        elif m := RE_NUM.match(code):
            code = code[m.end():]
            line.append('n' + str(m.group(0)))
        elif m := RE_NAME.match(code):
            code, name = code[m.end():], str(m.group())
            if wfunc:
                funcs.append(name)
            line.append(('c' if wfunc or name in funcs else 'm') + name)
        elif m := RE_DOLLAR_SUB.match(code):
            code = code[m.end():]
            line.append(str(m.group()))
        else:
            line.append('e' + code[0])
            code = code[1:]
            errmsgs.append(f'Invalid code "{lines[ln]}" on line {ln}')
        if rwfunc:
            wfunc = False
    return out, errmsgs


def get_block(code: list, ln: int) -> tuple[list, int]:
    '''Gets a block of code in NCE assembly'''
    out = []
    found = False
    sln = int(ln)
    cnt = 1
    ln += 1
    while ln < len(code):
        line = code[ln]
        cnt -= line.count('}')
        if cnt == 0:
            found = True
            break
        cnt += line.count('{')
        if cnt == 0:
            found = True
            break
        out.append(line)
        ln += 1
    if not found:
        raise AssemblyError(f'Nonterminating block starting on line {sln}')
    elif '}' in line:
        line = list(line)
        line.reverse()
        line.remove('}')
        line.reverse()
        line = ''.join(line)
    out.append(line)
    return out, ln


def asm_replace_num(code: str) -> str:
    '''Replaces numeric literals in NCE assembly'''
    for ln, line in enumerate(code):
        for i, t in enumerate(line):
            if len(t) == 0 or isinstance(t, list):
                continue
            if t.startswith('n'):
                t = t[1:]
                _t = str(t)
                if t.startswith('*'):
                    s, t = True, t[1:]
                else:
                    s = False
                if t.startswith('-'):
                    n, t = True, t[1:]
                else:
                    n = False
                if t.startswith('0b'):
                    b, t = 2, t[2:]
                elif t.startswith('0o'):
                    b, t = 8, t[2:]
                elif t.startswith('0x'):
                    b, t = 16, t[2:]
                else:
                    b = 10
                try:
                    t = int(t, b) % 65536
                except Exception as e:
                    raise AssemblyError(f'Invalid literal on line {ln}: {_t}')
                if n:
                    t = -t
                t = str(t)
                if s:
                    t = '*' + t
                code = code[:ln] + code[ln][:i] + 'n' + t + code[ln][i + 1:] + code[ln + 1:]
    return code

def asm_nand_sub(code) -> list:
    '''NCE assembly nand section substitution'''
    out = []
    macros = {}
    for ln, line in enumerate(code):
        nl = []
        for t in line:
            if t[0] == 'N':
                name = t[2]
                nc = t[3]
                nc = nc.split('\n')
                for i, line in enumerate(nc):
                    if any([line.startswith(x) for x in E_FIRST_PARTS]):
                        continue
                    line = line.split(' ')
                    if line[0] in macros:
                        c = macros[line[0]]
                        if len(line) != 0:
                            args = line[1:]
                            n = len(args)
                            c = c.replace('$n', str(n))
                            c = c.replace('$N', str(n))
                            c = c.replace('$R0', f'm_{i}')
                            c = c.replace('$R1', f'm_{i}')
                            while True:
                                sub = RE_DOLLAR_SUB.search(c)
                                if sub is None:
                                    break
                                sub = sub.group()
                                sl = int(sub[1:])
                                if sl >= n:
                                    raise AssemblyError(f'Argument {sl} not provided to macro {line[0]} on line {ln}')
                                c = c.replace(sub, args[sl])
                        nc[i] = c
                nc = '\n'.join(nc)
                if name != '':
                    macros[name] = nc
                else:
                    nl.append(['U', nc])
            else:
                nl.append(t)
        out.append(nl)
    return out

def asm_control_sub(code) -> str:
    '''Substitute control flow keywords in NCE assembly'''
    n = 0
    ln = 0
    while ln < len(code):
        line = code[ln]
        if len(line) == 0:
            continue
        elif line[0] == 'if':
            sln = int(ln)
            _, ln = get_block(code, ln)
            if len(line[:-1]) != 4 or line[2] not in ASM_INV_CONDS:
                raise AssemblyError(f'Invalid if condition: {line[1:-1]}')
            line[2] = ASM_INV_CONDS[line[2]]
            nc = code[:sln] + [['goto', f'ml_{n}', *line[:-1]]] + code[sln + 1:ln]
            if 'else' in code[ln] or 'else' in code[ln - 1]:
                # Handle else's
                sln2 = int(ln)
                _, ln = get_block(code, ln)
                nc += [['goto', f'ml_{n + 1}'], ['label', f'ml_{n}']]
                n += 1
                nc += code[sln2 + 1:ln] + [['label', f'ml_{n}']] + code[ln + 1:]
            else:
                nc += [['label', f'ml_{n}']] + code[ln + 1:]
            n += 1
            code = nc
        elif line[0] == 'while':
            sln = int(ln)
            _, ln = get_block(code, ln)
            if line[1] == 'true':
                code = code[:sln] + [['label', f'ml_{n}']] + code[sln + 1:ln] + \
                       [['goto', f'ml_{n}']] + code[ln:]
            else:
                code = code[:sln] + [['label', f'ml_{n}']] + code[sln + 1:ln] + \
                       [['goto', f'ml_{n}', 'if', *line[1:-1]]] + code[ln:]
            n += 1
            ln += 1
        ln += 1
    return code

def asm_macro_sub(code: list) -> list:
    '''NCE assembly macro substitution'''
    macros = {}
    nc = []
    wuln = None
    for ln, line in enumerate(code):
        line = code[ln]
        if wuln is not None:
            if ln >= wuln:
                wuln = None
            continue
        elif len(line) == 0:
            nc.append([])
        elif isinstance(line[0], list):
            nc.append(line)
        elif line[0] == 'macro':
            name = line[1][1:]
            mc, wuln = get_block(code, ln)
            macros[name] = mc
        elif line[0].startswith('c'):
            name = line[0][1:]
            if name not in macros:
                nc.append(line) # Functions could also exist
                continue
            mc = macros[name]
            if len(line) > 1:
                args = line[1:]
                n = str(len(args))
                for ln, line in enumerate(mc):
                    for i, t in enumerate(line):
                        if t[0] == 'U':
                            c = t[1]
                            for j, arg in enumerate(args):
                                if arg[0] in ('m', 'n'):
                                    arg = arg[1:]
                                c = c.replace('$' + str(j), arg)
                            mc[ln][i][1] = c
                        elif t in ('$n', '$N'):
                            mc[ln][i] = 'n' + n
                        elif t.startswith('$'):
                            j = int(t[1:])
                            if len(args) <= j:
                                continue
                            mc[ln][i] = args[j]
            nc += mc
        else:
            nc.append(line)
    return nc

def asm_func_sub(code):
    '''NCE assembly function substitution'''
    funcs = []
    nc = []
    wuln = None
    for ln, line in enumerate(code):
        if wuln is not None:
            if ln >= wuln:
                wuln = None
            continue
        elif len(line) == 0:
            nc.append([])
        elif isinstance(line[0], list):
            nc.append(line)
        elif line[0] == 'func':
            name = line[1][1:]
            fc, wuln = get_block(code, ln)
            if len(line) > 3:
                lc = line[2][1:]
                if not RE_NUM.match(lc):
                    raise AssemblyError(f'Invalid locals count on line {ln}')
                lc = eval(lc)
            else:
                lc = 0
            fc = [[y.replace('$', '%') for y in x] for x in fc]
            nc.append([['U', f'GOTO w_{ln}\nFUNCTION {name} {lc}\n']])
            returned = False
            for line in fc:
                if len(line) == 0:
                    nc.append([])
                elif line[0] == 'return':
                    if len(line) == 1:
                        nc.append([['U', ASM_RETURN_NOTHING]])
                    elif len(line) == 2:
                        return
                        if line[1].startswith('n'):
                            c = f'PUSH_VALUE {line[1:]}'
                        elif line[1].startswith('m'):
                            c = f'PUSH_STATIC {line[1:]}' 
                        else:
                            raise AssemblyError(f'Invalid argument to return on line {ln}')
                        nc.append([['U', c + '\nRETURN']])
                    else:
                        raise AssemblyError(f'Invalid number of arguments to return on line {ln}')
                else:
                    nc.append(line)
            if not returned:
                nc.append([['U', ASM_RETURN_NOTHING]])
            nc.append([['U', f'\nw_{ln}:']])
            funcs.append(name)
        elif line[0].startswith('c'):
            name = line[0][1:]
            if name not in funcs:
                raise AssemblyError(f'Invalid macro/function name: {name}')
            c = ''
            if len(line) > 1:
                for arg in line[1:]:
                    c += f'PUSH_VALUE {arg[1:]}\n'
            c += f'CALL {name} {len(line) - 1}'
            nc.append([['U', c]])
        else:
            nc.append(line)
    return nc

def asm_value(x: str, loc: str, stars: list[str], names: dict[str, int], ln: int, dos: bool=True) -> tuple[list, int] | list:
    '''Assembles values (numbers/addresses) in NCE'''
    # % (invokes args)
    if x.startswith('%'):
        out = [f'PUSH_ARG {x[1:]}\nPOP_D']
        return (out, 0) if not dos else out
    out = []
    s = x.count('*')
    x = x.replace('*', '')
    if x.startswith('m'):
        # Names
        name = x[1:]
        try:
            y = int(names[name])
        except (KeyError, ValueError):
            raise AssemblyError(f'Invalid name on line {ln}: {name}')
        if name in stars:
            s += 1
    else:
        try:
            y = int(x[1:])
        except ValueError:
            raise AssemblyError(f'Syntax error on line {ln}')
    if y > 32767:
        y = -y + 65535
        n = True
    else:
        n = False
    nloc = 'A' if s > 0 or (not dos) else loc
    # Direct assignment
    if y == -1:
        out.append(f'{nloc} = -1')
    elif y == 0:
        out.append(f'{nloc} = 0')
    elif y == 1:
        out.append(f'{nloc} = 1')
    else:
        out.append(f'A = {abs(y)}')
        if nloc == 'D' and n:
            out.append('D = ~A')
        elif nloc == 'A' and n:
            out.append('A = ~A')
        elif nloc == 'D':
            out.append('D = A')
    # Indirect
    if s > 0 and dos:
        while s > 1:
            out.append(f'A = *A')
            s -= 1
        out.append(f'{loc} = A')
    return (out, s) if not dos else out

def asm_value_dbl(d: str, a: str, stars: list[str], names: dict[str, int], ln: int) -> str:
    '''Assembles 2 values, puts them into D and A (because arguments require D to work)'''
    if a.startswith('%'):
        a, d = d, a
    return asm_value(d, 'D', stars, names, ln) + asm_value(a, 'A', stars, names, ln) # type: ignore

def asm_gen(code: str) -> str:
    '''NCE assembly code generation'''
    stars = []
    out = []
    names = {}
    for ln, line in enumerate(code):
        if len(line) == 0 or len(line[0]) == 0:
            continue
        # Nand segments
        elif type(line[0]) == list:
            if line[0][0] == 'U':
                out.append(line[0][1])
                line = line[1:]
        elif line[0].startswith('#'):
            continue
        while len(line) > 0 and line[-1] in ('{', '}'):
            line = line[:-1]
        if len(line) == 0:
            continue
        # Label and goto
        if line[0] == 'label':
            if len(line) != 2:
                raise AssemblyError(f'Invalid number of arguments to label keyword on line {ln}, must be 1')
            out.append(f'LABEL {line[1][1:]}')
        elif line[0] == 'goto':
            if len(line) not in (2, 6):
                raise AssemblyError(f'Invalid number of arguments to goto keyword on line {ln}, must be 2 or 6')
            j = 'JMP'
            if len(line) == 6:
                if line[2] != 'if':
                    raise AssemblyError(f'Invalid goto statement on line {ln}')
                out += asm_value(line[3], 'D', stars, names, ln)
                out += asm_value(line[5], 'A', stars, names, ln)
                out.append('D = D - A')
                op = line[4]
                if op == '==':
                    j = 'JEQ'
                elif op == '!=':
                    j = 'JNE'
                elif op == '>':
                    j = 'JGT'
                elif op == '>=':
                    j = 'JGE'
                elif op == '<':
                    j = 'JLT'
                elif op == '<=':
                    j = 'JLE'
                else:
                    raise AssemblyError(f'Invalid goto if condition on line {ln}')
            loc = line[1]
            if loc.startswith('m') and loc[1:] not in names:
                out.append(f'A = {loc[1:]}')
            else:
                out += asm_value(loc, 'A', stars, names, ln)
            out.append(f'D ; {j}')
        # Definitions
        elif line[0] == 'def':
            s = False
            if len(line) != 3:
                raise AssemblyError(f'Invalid number of arguments to def keyword on line {ln}, must be 3')
            elif line[1][0] != 'm':
                raise AssemblyError(f'Name required as first argument to def on line {ln}')
            elif line[2][0] != 'n':
                raise AssemblyError(f'Number required as second argument to def on line {ln}')
            name = line[1][1:]
            value = line[2][1:]
            if value[0] == '*':
                stars.append(name)
                value = value[1:]
            names[name] = int(value)
        # Assignments
        elif len(line) > 1 and line[1] == '=':
            if len(line) == 3:
                out += asm_value(line[2], 'D', stars, names, ln)
            elif len(line) == 4:
                out += asm_value(line[3], 'D', stars, names, ln)
                op = line[2]
                if op == '-':
                    out.append('D = -D')
                elif op == '~':
                    out.append('D = ~D')
                else:
                    raise AssemblyError(f'Invalid operator on line {ln}: {op}')
            elif len(line) == 5:
                out += asm_value_dbl(line[2], line[4], stars, names, ln)
                op = line[3]
                if op == '+':
                    out.append('D = D + A')
                elif op == '-':
                    out.append('D = D - A')
                elif op == '&':
                    out.append('D = D & A')
                elif op == '|':
                    out.append('D = D | A')
                elif op == '^':
                    out.append('D = D ^ A')
                else:
                    raise AssemblyError(f'Invalid operator on line {ln}: {op}')
            else:
                raise AssemblyError(f'Cannot parse instruction on line {ln} (Invalid number of tokens) ({repr(line)})')
            loc = line[0]
            loc, s = asm_value(loc, 'A', stars, names, ln, dos=False)
            out += loc
            if not s:
                raise AssemblyError(f'Cannot redefine literal on line {ln}: {repr(line)}')
            while s > 1:
                s -= 1
                out.append('A = *A')
            out.append('*A = D')
        else:
            raise AssemblyError(f'Unrecognized token sequence on line {ln}: {repr(line)}')
    return '\n'.join(out)

def assemble(code: str, html: bool=False) -> str:
    '''Assembles NCE assembly'''
    tokens, errmsgs = tokenize(code)
    if len(errmsgs) > 0:
        if html:
            return '<div class="h-err">' + escape('\n'.join(errmsgs)) + '</div>'
        else:
            raise AssemblyError(errmsgs[0])
    code = [] # type: ignore
    for line in tokens:
        if len(line) == 0:
            continue
        elif line[0] == 'F':
            code += tokenize(folds[line[1]])[0] # type: ignore
        else:
            code.append(line) # type: ignore
    code = [[('mu_' + y[1:] if y.startswith('m') else ('cc_' + y[1:] if y.startswith('c') else y)) for y in x] for x in code] # type: ignore
    code = [[y for y in x if y not in (' ', '\t')] for x in code] # type: ignore
    try:
        code = asm_nand_sub(code) # type: ignore
        code = asm_replace_num(code)
        while any([x[0] in ('if', 'while') or 'else' in x for x in code if len(x) > 0]):
            code = asm_control_sub(code)
        code = asm_macro_sub(code) # type: ignore
        code = asm_func_sub(code) # type: ignore
        code = 'INIT_STACK\n' + asm_gen(code)
        while '\n\n' in code:
            code = code.replace('\n\n', '\n')
        return escape(code) if html else code
    except AssemblyError as e:
        if html:
            return '<div class="h-err">' + escape(str(e)) + '</div>'
        else:
            raise e


current_keys = {}
def key_intercept_add(event) -> None:
    '''Key intercepts for the IOAPI'''
    current_keys[event.key] = True
def key_intercept_del(event) -> None:
    '''Key intercepts for the IOAPI'''
    current_keys[event.key] = False

e_a = 0
e_d = 0
e_ram = {}
e_code = []
e_defs = {}
e_ln = 0
e_int = None
e_isinit = False
e_uri = '\0' * 256
e_response = None
e_win = None
e_ctx = None
e_canvas_data = None

def e_when_done_playing(_event):
    e_rset(0x7840, 1)

def e_get_xhr_loaded(xhr):
    def wrapper(_event):
        global e_response
        e_rset(0x7860, xhr.status)
        e_response = xhr.responseText
    return wrapper

def e_rget(addr: int, nested: bool=False) -> int:
    '''Gets a value from the emulator's RAM and implements parts of the IOAPI'''
    out = -1
    if addr == 0x7802:
        a = e_rget(0x7800, True) * 65536 + e_rget(0x7801, True)
        if a > 2**22:
            raise ExecutionError(f'Invalid address in storage: {a}')
        x = window.localStorage.getItem('ne.' + str(a))
        if x:
            out = int(x)
    elif addr == 0x7811:
        k = e_rget(0x7810)
        if k in SPECIAL_KEYMAP:
            k = SPECIAL_KEYMAP[k]
        else:
            k = chr(k)
        if k in current_keys:
            out = 1 if current_keys[k] else 0
    elif addr == 0x7862:
        i = e_rget(0x78)
    else:
        out = e_ram[addr]
    if out > 32767 and nested:
        out = out - 65536
    return out

def e_rset(addr: int, value: int) -> None:
    '''Sets a value in the emulator's RAM and implements parts of the IOAPI'''
    global e_ram, e_uri
    if addr == 0x7802:
        a = e_rget(0x7800) * 65536 + e_rget(0x7801)
        if a > 2**22:
            raise ExecutionError(f'Invalid address in storage: {a}')
        window.localStorage.setItem('ne.' + str(a), value)
    elif addr == 0x7832:
        x = e_rget(0x7830, True) * 2
        y = e_rget(0x7831, True) * 2
        r = str(value // 4096 * 16)
        g = str(value % 4096 // 256 * 16)
        b = str(value % 256 // 16 * 16)
        a = str(1 - (value % 16 / 16))
        try:
            window.setPixel(e_ctx, x, y, r, g, b, a)
        except pyodide.ffi.JsException:
            raise ExecutionError('You need to press "Open screen" to use graphics')
    elif addr == 0x7840 and value != 0:
        uri = e_uri.rstrip()
        audio = window.getURLAudio(uri)
        if audio == -1:
            raise ExecutionError(f'Invalid URI: {uri}')
        add_event_listener(audio, 'ended', e_when_done_playing)
        audio.play()
    elif addr == 0x7850 and value != 0:
        xhr = window.XMLHttpRequest()
        add_event_listener(xhr, 'load', e_get_xhr_loaded(xhr))
        method = e_rget(0x7851, True)
        if method not in E_METHODS:
            raise ExecutionError(f'Invalid method ID: {method}')
        method = E_METHODS[method]
        uri = e_uri
        if not window.isValidURL(uri):
            raise ExecutionError(f'Invalid URI: {uri}')
        xhr.open(method, uri)
        xhr.send()
    elif addr in range(0x7C00, 0x7C7F):
        addr -= 0x7C00
        e_uri = e_uri[:addr] + chr(value) + e_uri[addr + 1:]
    e_ram[addr] = value

def e_exc_single(defs: dict[str, int], line: str, a: int, d: int, ln: int) -> tuple[int, int, int]:
    '''Executes a single line of nand game assembly'''
    line = line.replace(' ', '')
    line = line.split('=') # type: ignore
    if len(line) > 2:
        raise ExecutionError(f'Invalid code on line {ln}')
    if len(line) > 1:
        dest, value = line
        if dest not in E_DESTS:
            raise ExecutionError(f'Invalid destination on line {ln}: {dest}')
    else:
        dest = None
        value = line[0]
    if ';' in value:
        if value.count(';') > 1:
            raise ExecutionError(f'Invalid code on line {ln}')
        value, jump = value.split(';')
        if jump not in E_JUMPS:
            raise ExecutionError(f'Invalid jump on line {ln}')
        jump = E_JUMPS[jump]
    else:
        jump = None
    new_ln = ln + 1
    if value.startswith('LABEL') or value.startswith('DEFINE') or value.endswith(':'):
        pass
    elif dest == 'A' and E_NUMBER.match(value):
        a = eval(value) % 65536
        if a < 0 or a > 32767:
            raise ExecutionError(f'Invalid value on line {ln}: {a}')
        if jump:
            raise ExecutionError(f'Invalid code on line {ln}')
    elif dest == 'A' and value in defs:
        a = defs[value]
        if jump:
            raise ExecutionError(f'Invalid code on line {ln}')
    else:
        s = e_rget(a)
        if value not in E_CALCULATIONS:
            raise ExecutionError(f'Invalid calculation on line {ln}')
        value = eval(E_CALCULATIONS[value]) % 65536
        if dest is not None:
            dest = dest.split(',')
            if '*A' in dest:
                e_rset(a, value)
            if 'A' in dest:
                a = value
            if 'D' in dest:
                d = value
        if jump is not None and eval(jump):
            new_ln = a
    return a, d, new_ln

def e_exc_single_weh() -> None:
    '''Executes a single line of nand game assembly, with error handling'''
    global e_a, e_d, e_ln, e_int, e_defs
    try:
        e_a, e_d, e_ln = e_exc_single(e_defs, e_code[e_ln], e_a, e_d, e_ln)
    except ExecutionError as e:
        alert(f'Error: {str(e)} ({e_code[e_ln]} on line {e_ln})')
        if e_int is not None:
            clear_interval(e_int)
            e_int = None
            document.getElementById('e-run').textContent = 'Start'
            e_btn_update_f(None)
    except IndexError:
        if e_int is None:
            alert('No more code to run')
        else:
            clear_interval(e_int)
            e_int = None
            document.getElementById('e-run').textContent = 'Start'
            e_btn_update_f(None)

def e_get_defs(defs: dict[str, int], code: str) -> tuple[dict[str, int], str]:
    for ln, line in enumerate(code):
        line = line.strip()
        code[ln] = line # type: ignore
        if line.endswith(':'):
            defs[line[:-1]] = ln
        elif line.startswith('LABEL'):
            defs[line[5:].replace(' ', '')] = ln
        elif line.startswith('DEFINE'):
            line = line.split(' ')
            defs[line[1]] = line[2] % 65536 # type: ignore
    return defs, code

def e_btn_init(_event) -> None:
    '''Button for initalizing the nand game emulator'''
    global e_code, e_a, e_d, e_ram, e_defs, e_ln, e_isinit
    code = get_code()
    try:
        code = assemble(code)
    except AssemblyError as e:
        alert(f'Error during assembling: {str(e)}')
    code = code.split('\n')
    # Macro substitution
    i = 0
    e_code = []
    for ln, line in enumerate(code):
        line = line.split(' ')
        if line[0] in E_DEFAULT_MACROS:
            macro = line[0]
            args = line[1:]
            line = E_DEFAULT_MACROS[macro]
            line = line.replace('$R0', f'i_n_{i}')
            line = line.replace('$R1', f'i_n_{i}')
            if '$0' in line:
                if len(args) < 1:
                    alert(f'Invalid number of arguments to {line} on line {ln}')
                    return
                line = line.replace('$0', args[0])
            if '$1' in line:
                if len(args) < 2:
                    alert(f'Invalid number of arguments to {line} on line {ln}')
                    return
                line = line.replace('$1', args[1])
            e_code += line.split('\n')
            i += 2
        else:
            e_code.append(' '.join(line))
    e_code = [x.strip() for x in e_code]
    e_code = [x for x in e_code if x != '' and not x.startswith('#')]
    e_defs, e_code = e_get_defs({'SP': 0}, e_code) # type: ignore
    # Reset state
    e_a = 0
    e_d = 0
    e_ram = {}
    for i in range(65536):
        e_ram[i] = 0
    e_ln = 0
    e_isinit = True
    e_btn_update_f(None)

def e_btn_run(_event) -> None:
    '''Button for starting/stopping the nand game emulator'''
    global e_int
    if not e_isinit:
        alert('Emulator is not initalized')
        return
    elt = document.getElementById('e-run')
    if e_int is not None:
        clear_interval(e_int)
        e_int = None
        elt.textContent = 'Start'
        e_btn_update_f(None)
    else:
        e_int = set_interval(e_exc_single_weh, 1)
        elt.textContent = 'Stop'

def e_btn_tick(_event) -> None:
    '''Button for ticking the nand game emulator'''
    if not e_isinit:
        alert('Emulator is not initalized')
        return
    e_exc_single_weh()
    e_btn_update_f(None)

def e_btn_open(_event) -> None:
    '''Button for opening a new window for the nand game emulator'''
    global e_win, e_ctx, e_canvas_data
    e_win = window.open('about:blank')
    e_win.document.title = 'Nandgame Computer Emulator'
    add_event_listener(e_win.document, 'keydown', key_intercept_add)
    add_event_listener(e_win.document, 'keyup', key_intercept_del)
    canvas = e_win.document.createElement('canvas')
    canvas.setAttribute('width', '1024')
    canvas.setAttribute('height', '512')
    canvas.style.border = '5px solid black'
    canvas.style.height = '512px'
    canvas.style.width = '1024px'
    canvas.style.padding = '5'
    canvas.style.margin = 'auto'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.bottom = '0'
    canvas.style.left = '0'
    canvas.style.right = '0'
    e_win.document.body.appendChild(canvas)
    e_ctx = canvas.getContext('2d')
    e_canvas_data = {}

def e_btn_update_f(_event) -> None:
    '''Button for updating the display variables of the nand game emulator'''
    document.getElementById('e-pc').textContent = e_ln
    document.getElementById('e-a').textContent = e_a
    document.getElementById('e-d').textContent = e_d
    document.getElementById('e-s').textContent = e_ram[e_a]
    document.getElementById('e-sp').textContent = e_ram[0]
    document.getElementById('e-args').textContent = e_ram[1]
    document.getElementById('e-locals').textContent = e_ram[2]
    document.getElementById('e-retval').textContent = e_ram[3]
    document.getElementById('e-stack').innerHTML = escape('\n'.join([str(e_ram[x]) for x in range(256, e_ram[0])]))

def e_btn_update(_event) -> None:
    '''Button that updates the internal state based on the display variables'''
    try:
        e_a = int(document.getElementById('e-a').textContent)
        e_d = int(document.getElementById('e-d').textContent)
        s = int(document.getElementById('e-s').textContent)
        e_ram[e_a] = s
        e_ram[0] = int(document.getElementById('e-sp').textContent)
        e_ram[1] = int(document.getElementById('e-args').textContent)
        e_ram[2] = int(document.getElementById('e-locals').textContent)
        e_ram[6] = int(document.getElementById('e-retval').textContent)
    except ValueError:
        alert('Invalid value for a variable')

def e_btn_update_s(_event) -> None:
    '''Button that updates *A'''
    try:
        document.getElementById('e-s').textContent = e_ram[int(document.getElementById('e-a').textContent)]
    except ValueError:
        alert('Invalid value for a variable')

def e_btn_push_d(_event) -> None:
    '''Pushes D in the nand game stack'''
    global e_ram
    sp = e_ram[0]
    e_ram[sp] = e_d
    e_ram[0] = sp + 1

def e_btn_pop_d(_event) -> None:
    '''Pops D in the nand game stack'''
    global e_ram, e_d
    sp = e_ram[0] - 1
    e_ram[0] = sp
    e_d = e_ram[sp]

def e_btn_pop_a(_event) -> None:
    '''Pops A in the nand game stack'''
    global e_ram, e_a
    sp = e_ram[0] - 1
    e_ram[0] = sp
    e_a = e_ram[sp]

def e_btn_toggle_prgm_info(_event) -> None:
    '''Button for toggling the visibility of the program info'''
    txt = document.getElementById('e-prgmi-t-s')
    ddv = document.getElementById('e-prgmi')
    if ddv.style.display == 'block':
        txt.textContent = 'Show'
        ddv.style.display = 'none'
    else:
        txt.textContent = 'Hide'
        ddv.style.display = 'block'


def update_linenos() -> None:
    '''Updates line numbering'''
    lines = str(document.getElementById('pre-code').innerText).count('\n') + 1
    out = ''
    for l in range(lines):
        out += str(l) + '\n'
    document.getElementById('linenos').innerHTML = escape(out)

def highlight_nand(code: str, macros: dict[str, str]) -> str:
    '''Highlights nandgame assembly'''
    out = ''
    while len(code) > 0:
        if code.startswith(' '):
            out += '&nbsp;'
            code = code[1:]
        elif code.startswith('\n'):
            out += '<br>' + ZWSPL
            code = code[1:]
        elif code[0] in ('=', '+', '-', '&', '|', '^'):
            out += f'<span class="h-opr">{code[0]}</span>'
            code = code[1:]
        elif code[:3] in ('JMP', 'JEQ', 'JNE', 'JGT', 'JGE', 'JLT', 'JLE'):
            out += f'<span class="h-key">{code[:3]}</span>'
            code = code[3:]
        elif code[0] in (':', ';'):
            out += f'<span class="h-key">{code[0]}</span>'
            code = code[1:]
        elif code[0] == ',':
            out += '<span class="h-reg">,</span>'
            code = code[1:]
        elif code.startswith('LABEL'):
            out += '<span class="h-key">LABEL</span>'
            code = code[5:]
        elif code.startswith('DEFINE'):
            out += '<span class="h-key">DEFINE</span>'
        elif m := RE_NUM.match(code):
            out += f'<span class="h-num">{m.group()}</span>'
            code = code[m.end():]
        elif m := RE_NAME.match(code):
            t = m.group()
            if t in ('A', 'D', '*A'):
                out += '<span class="h-reg">'
            elif t in macros:
                out += '<span class="h-fnc">'
            else:
                out += '<span class="h-var">'
            out += t
            out += '</span>'
            code = code[m.end():]
        elif m := RE_DOLLAR_SUB.match(code):
            out += '<span class="h-var">'
            out += m.group()
            out += '</span>'
            code = code[m.end():]
        elif code.startswith('$R0') or code.startswith('$R1'):
            out += f'<span class="h-var">{code[:3]}</span>'
            code = code[3:]
        else:
            out += f'<span class="h-err">{code[0]}</span>'
            code = code[1:]
    return out

def highlight() -> None:
    '''Performs syntax highlighting'''
    code_elt = document.getElementById('pre-code')
    issel = is_selection()
    if issel is True: # So you can copy/paste
        return
    out = ZWSPL
    nmacros = list(E_DEFAULT_MACROS)
    tokens = tokenize(code_elt.innerText)[0]
    for ln, line in enumerate(tokens):
        if len(line) == 0:
            pass
        elif line[0] == 'F':
            out += '<span class="h-fld">&lt;--&nbsp;' + line[1] + '&nbsp;--&gt;</span>'
        else:
            for t in line:
                if t[0] == ' ':
                    out += '&nbsp;'
                elif t[0] == '\t':
                    out += '&#9;'
                elif t[0] == '#':
                    out += '<span class="h-cmt">' + t + '</span>'
                elif t in ASM_KEYWORDS:
                    out += '<span class="h-key">' + t + '</span>'
                elif t[0] == 'N':
                    out += f'<span class="h-key">&lt;nand{t[1]}</span><span class="h-fnc">{t[2]}' + \
                            '</span><span class="h-key">&gt;</span>'
                    out += highlight_nand(t[3], nmacros) # type: ignore
                    out += '<span class="h-key">&lt;/nand&gt;</span>'
                    if t[2] != '':
                        nmacros.append(t[2])
                elif t in '}{':
                    out += '<span class="h-bre">' + t + '</span>'
                elif t in ASM_SYM_1 or t in ASM_SYM_2:
                    out += '<span class="h-opr">' + t + '</span>'
                elif t[0] == 'n':
                    out += '<span class="h-num">' + t[1:] + '</span>'
                elif t[0] == 'm':
                    out += '<span class="h-var">' + t[1:] + '</span>'
                elif t[0] == 'c':
                    out += '<span class="h-fnc">' + t[1:] + '</span>'
                elif t[0] == '$':
                    out += '<span class="h-var">' + t + '</span>'
                elif t == 'true':
                    out += '<span class="h-num">' + t + '</span>'
                elif t[0] == 'e':
                    if len(t) == 1:
                        continue
                    out += '<span class="h-err">' + escape(t[1:]) + '</span>'
                else:
                    out += '<span class="h-err">' + escape(t) + '</span>'
        out += '<br />' + ZWSPL
    pos = get_caret_position(code_elt)
    code_elt.innerHTML = out
    if issel is False and pos is not False:
        set_caret_position(code_elt, pos + 1)


########## BUTTON HANDLERS AND OTHER MISC STUFF ##########


def special_keys(event) -> None:
    '''Handles special keys and autoinsertion'''
    global folds
    elt = document.getElementById('pre-code')
    pos = get_caret_position(elt)
    text = str(elt.textContent)
    code = get_code()
    print(pos, repr(text), text[pos])
    if event.key == 'ArrowLeft' and text[pos] == ZWSP:
        event.preventDefault()
        set_caret_position(elt, pos)
    elif event.key == 'ArrowRight' and pos != len(text) - 1 and text[pos + 1] == ZWSP:
        event.preventDefault()
        set_caret_position(elt, pos + 2)
    elif event.key == 'Backspace' and pos + 1 < len(text) and text[pos + 1] == ZWSP and pos > 0 and not is_selection():
        event.preventDefault()
        code = code[:pos - 1] + code[pos:]
        set_code(code, pos, True)
    elif event.key == '{':
        event.preventDefault()
        code = code[:pos] + '{}' + code[pos:]
        set_code(code, pos + 2, True)
    elif event.key == 'Enter':
        event.preventDefault()
        cnt = code[:pos].count('{') - code[:pos].count('}')
        pst = ('\n' + '\t' * (cnt - 1) if (text[pos] == '{' and pos != len(text) and text[pos + 1] == '}') else '')
        set_code(code[:pos] + '\n' + '\t' * cnt + pst + code[pos:], pos + cnt + 2, True)
    elif event.key == 'f' and event.altKey:
        event.preventDefault()
        lines = code.split('\n')
        start = code[:pos].count('\n')
        if '<--' in lines[start] and '-->' in lines[start]:
            try:
                name = lines[start][4:-4]
                text = folds[name]
            except (IndexError, KeyError):
                alert(f'Invalid fold on line {ln}') # type: ignore
                return
            code = '\n'.join(lines[:start]) + '\n' + text + '\n' + '\n'.join(lines[start + 1:])
        else:
            name = window.prompt('What is this fold\'s name?')
            end = start + str(window.getSelection().toString()).count('\n') + 1
            code = '\n'.join(lines[:start])
            pos = len(code) + 1
            code += '\n<-- ' + name + ' -->\n'
            code += '\n'.join(lines[end:])
            folds[name] = '\n'.join(lines[start:end])
        set_code(code, pos)

def save_code() -> None:
    '''Save the code to storage and to the download link'''
    code = get_code()
    pos = get_caret_position(document.getElementById('pre-code'))
    fold = repr(folds)
    window.localStorage.setItem('ne.code', code)
    window.localStorage.setItem('ne.folds', fold)
    window.localStorage.setItem('ne.pos', pos)
    ts = int(time.strftime('%Y%U%w%H%M%S'))
    ts = base64.b32hexencode(ts.to_bytes(6, 'big'))
    ts = ts.decode('utf-8').replace('=', '')
    name = f'{ts}.nce'
    link = document.getElementById('save-link')
    link.download = name
    link.href = 'data:text/plain;base64,' + window.btoa(code + '%' + fold)

def load_from_future(file) -> None:
    '''Internally loads files'''
    global folds
    file = str(file).split('%')
    if len(file) == 1:
        folds = {}
        set_code(file[0], 0)
    elif len(file) == 2:
        try:
            folds = eval(file[1])
        except Exception as e:
            alert(f'Invalid folds section of file ({e})')
        set_code(file[0], 0)
    else:
        alert('Invalid file')

def btn_load_from_file(_event) -> None:
    '''Load from file button'''
    try:
        window.askForFile().then(load_from_future)
    except Exception:
        alert('Error reading file: ' + traceback.format_exc())

def btn_assemble(_event) -> None:
    '''Assemble button'''
    elt = document.getElementById('asm-code')
    document.getElementById('emulator').style.display = 'none'
    document.getElementById('help').style.display = 'none'
    elt.style.display = 'block'
    code = get_code()
    code = assemble(code, True)
    elt.innerHTML = code

def btn_execute(_event) -> None:
    '''Execute button'''
    document.getElementById('asm-code').style.display = 'none'
    document.getElementById('emulator').style.display = 'block'
    document.getElementById('help').style.display = 'none'

def btn_help(_event) -> None:
    '''Help button'''
    document.getElementById('asm-code').style.display = 'none'
    document.getElementById('emulator').style.display = 'none'
    document.getElementById('help').style.display = 'block'


########## MAIN ##########

# Top buttons
def msgni(_event):
    alert('This button is not implemented yet')
add_event_listener(document.getElementById('btn-load'), 'click', btn_load_from_file)
add_event_listener(document.getElementById('btn-asm'), 'click', btn_assemble)
add_event_listener(document.getElementById('btn-help'), 'click', btn_help)
add_event_listener(document.getElementById('btn-sgts'), 'click', msgni)
add_event_listener(document.getElementById('btn-run'), 'click', btn_execute)
# Code editing
add_event_listener(document.getElementById('pre-code'), 'keydown', special_keys)
set_interval(highlight, 1000)
set_interval(save_code, 1000)
set_interval(update_linenos, 250)
# Nand game emulator
add_event_listener(document.getElementById('e-prgmi-t'), 'click', e_btn_toggle_prgm_info)
add_event_listener(document.getElementById('e-init'), 'click', e_btn_init)
add_event_listener(document.getElementById('e-run'), 'click', e_btn_run)
add_event_listener(document.getElementById('e-tick'), 'click', e_btn_tick)
add_event_listener(document.getElementById('e-open'), 'click', e_btn_open)
add_event_listener(document.getElementById('e-update-f'), 'click', e_btn_update_f)
add_event_listener(document.getElementById('e-update'), 'click', e_btn_update)
add_event_listener(document.getElementById('e-update-s'), 'click', e_btn_update_s)
add_event_listener(document.getElementById('e-push-d'), 'click', e_btn_push_d)
add_event_listener(document.getElementById('e-pop-d'), 'click', e_btn_pop_d)
add_event_listener(document.getElementById('e-pop-a'), 'click', e_btn_pop_a)
add_event_listener(document, 'keydown', key_intercept_add)
add_event_listener(document, 'keyup', key_intercept_del)
# Disable spellcheck
scf = document.getElementById('pre-code')
scf.spellcheck = False
scf.focus()
scf.blur()
# Load presaved code
try:
    code = window.localStorage.getItem('ne.code')
    pos = int(window.localStorage.getItem('ne.pos'))
    folds = eval(window.localStorage.getItem('ne.folds'))
except (KeyError, ValueError): 
    code = ''
    pos = 0
set_code(code, pos)
