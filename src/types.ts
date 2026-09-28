
// $6.2.5

// there are never any padding bits

export namespace t {

    export type BaseType = {const?: boolean, volatile?: boolean};

    export const BOOL = {type: 'bool', size: 1} as const;
    export type Bool = BaseType & typeof BOOL;

    export const CHAR = {type: 'char', size: 1} as const;
    export type Char = BaseType & typeof CHAR;

    export const SIGNED_CHAR = {type: 'signed char', size: 1} as const;
    export type SignedChar = BaseType & typeof SIGNED_CHAR;

    export const SHORT_INT = {type: 'short int', size: 1} as const;
    export type ShortInt = BaseType & typeof SHORT_INT;

    export const INT = {type: 'int', size: 1} as const;
    export type Int = BaseType & typeof INT;

    export const LONG_INT = {type: 'long int', size: 2} as const;
    export type LongInt = BaseType & typeof LONG_INT;

    export const LONG_LONG_INT = {type: 'long long int', size: 4} as const;
    export type LongLongInt = BaseType & typeof LONG_LONG_INT;

    export type BitInt = BaseType & {type: '_BitInt', size: number, bits: number};
    export function createBitInt(bits: number): BitInt {
        return {type: '_BitInt', size: Math.ceil(bits / 16), bits};
    }

    export const BUILTIN_INT8 = {type: '__builtin_int8', size: 1} as const;
    export type BuiltinInt8 = BaseType & typeof BUILTIN_INT8;

    export type SignedInteger = SignedChar | ShortInt | Int | LongInt | LongLongInt | BitInt | BuiltinInt8;
    export function isSignedInteger(type: Type): type is SignedInteger {
        return type.type === 'signed char' || type.type === 'short int' || type.type === 'int' || type.type === 'long int' || type.type === 'long long int' || type.type === '_BitInt' || type.type === '__builtin_int8';
    }

    export const UNSIGNED_CHAR = {type: 'unsigned char', size: 1} as const;
    export type UnsignedChar = BaseType & typeof UNSIGNED_CHAR;

    export const UNSIGNED_SHORT_INT = {type: 'unsigned short int', size: 1} as const;
    export type UnsignedShortInt = BaseType & typeof UNSIGNED_SHORT_INT;

    export const UNSIGNED_INT = {type: 'unsigned int', size: 1} as const;
    export type UnsignedInt = BaseType & typeof UNSIGNED_INT;

    export const UNSIGNED_LONG_INT = {type: 'unsigned long int', size: 2} as const;
    export type UnsignedLongInt = BaseType & typeof UNSIGNED_LONG_INT;

    export const UNSIGNED_LONG_LONG_INT = {type: 'unsigned long long int', size: 4} as const;
    export type UnsignedLongLongInt = BaseType & typeof UNSIGNED_LONG_LONG_INT;

    export type UnsignedBitInt = BaseType & {type: 'unsigned _BitInt', size: number, bits: number};
    export function createUnsignedBitInt(bits: number): UnsignedBitInt {
        return {type: 'unsigned _BitInt', size: Math.ceil(bits / 16), bits};
    }

    export const BUILTIN_UINT8 = {type: '__builtin_uint8', size: 1} as const;
    export type BuiltinUint8 = BaseType & typeof BUILTIN_UINT8;

    export type UnsignedInteger = Bool | UnsignedChar | UnsignedShortInt | UnsignedInt | UnsignedLongInt | UnsignedLongLongInt | UnsignedBitInt | BuiltinUint8;
    export function isUnsignedInteger(type: Type): type is SignedInteger {
        return type.type === 'unsigned char' || type.type === 'unsigned short int' || type.type === 'unsigned int' || type.type === 'unsigned long int' || type.type === 'unsigned long long int' || type.type === 'unsigned _BitInt' || type.type === '__builtin_uint8';
    }

    export const FLOAT = {type: 'float', size: 2} as const;
    export type Float = BaseType & typeof FLOAT;

    export const DOUBLE = {type: 'double', size: 4} as const;
    export type Double = BaseType & typeof DOUBLE;

    export const LONG_DOUBLE = {type: 'long double', size: 8} as const;
    export type LongDouble = BaseType & typeof LONG_DOUBLE;

    export const BUILTIN_FLOAT16 = {type: '__builtin_float16', size: 1} as const;
    export type BuiltinFloat16 = BaseType & typeof BUILTIN_FLOAT16;

    export type Floating = Float | Double | LongDouble | BuiltinFloat16;
    export function isFloating(type: Type): type is Floating {
        return type.type === 'float' || type.type === 'double' || type.type === 'long double' || type.type === '__builtin_float16';
    }

    export type Basic = Char | SignedInteger | UnsignedInteger | Floating;
    export function isBasic(type: Type): type is Basic {
        return type.type === 'char' || isSignedInteger(type) || isUnsignedInteger(type) || isFloating(type);
    }

    export type Character = Char | SignedChar | UnsignedChar;
    export function isCharacter(type: Type): type is Floating {
        return type.type === 'char' || type.type === 'signed char' || type.type === 'unsigned char';
    }

    export type Enumerated = BaseType & {type: 'enum', size: number, backing: CompleteType};
    export function createEnumerated(backing: CompleteType): Enumerated {
        return {type: 'enum', size: backing.size, backing};
    }

    export type Integer = Char | SignedInteger | UnsignedInteger;
    export function isInteger(type: Type): type is Integer {
        return type.type === 'char' || isSignedInteger(type) || isUnsignedInteger(type);
    }

    export type Real = Integer | Floating;
    export function isReal(type: Type): type is Real {
        return isInteger(type) || isFloating(type);
    }

    export type Arithmetic = Integer | Floating;
    export function isArithmetic(type: Type): type is Arithmetic {
        return isInteger(type) || isFloating(type);
    }

    export const VOID = {type: 'void'} as const;
    export type Void = BaseType & typeof VOID;

    export type Array = BaseType & {type: '[]', size: number, items: CompleteType, length: number};
    export function createArray(items: CompleteType, length: number): Array {
        return {type: '[]', size: items.size * length, items, length};
    }

    export type StructMember = {name: string | undefined, type: CompleteType, offset: number};
    export type Struct = BaseType & {type: 'struct', size: number, members: StructMember[]};

    export type UnionMember = {name: string | undefined, type: CompleteType};
    export type Union = BaseType & {type: 'union', size: number, members: UnionMember[]};
    export function createUnion(members: UnionMember[]): Union {
        let size = 0;
        for (let member of members) {
            if (member.type.size > size) {
                size = member.type.size;
            }
        }
        return {type: 'union', size, members};
    }

    export type Parameter = {name?: string, type: Type};
    export type Function = BaseType & {type: '()', params: Parameter[], returnType: Type};
    export function createFunction(params: Parameter[], returnType: Type): Function {
        return {type: '()', params, returnType};
    }

    export type Pointer = BaseType & {type: '*', size: 1, value: Type, restricted?: boolean};
    export function createPointer(value: Type): Pointer {
        return {type: '*', size: 1, value};
    }

    export const NULLPTR = {type: 'nullptr_t', size: 1} as const;
    export type Nullptr = typeof NULLPTR;

    export type Scalar = Arithmetic | Pointer | Nullptr;
    export function isScalar(type: Type): type is Scalar {
        return isArithmetic(type) || type.type === '*' || type.type === 'nullptr_t';
    }

    export type IncompleteArray = BaseType & {type: 'incomplete []', items: Type};

    export type IncompleteStruct = BaseType & {type: 'incomplete struct', tag: string};

    export type IncompleteUnion = BaseType & {type: 'incomplete union', tag: string};

    export type IncompleteType = IncompleteArray | IncompleteStruct | IncompleteUnion;
    export function isIncomplete(type: Type): type is IncompleteType {
        return type.type.startsWith('incomplete ');
    }

    export type DerivedDeclarator = Array | Function | Pointer;
    export function isDerivedDeclarator(type: Type): type is DerivedDeclarator {
        return type.type === '[]' || type.type === '()' || type.type === '*';
    }

    export type CompleteType = Scalar | Array | Struct | Union;
    export function isComplete(type: Type): type is CompleteType {
        return !type.type.startsWith('incomplete ') && type.type !== '()';
    }

    export type Object = IncompleteType | CompleteType;

    export type Type = Object | Function;

}
