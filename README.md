
# nandgame

This contains the optimal known solutions for nandgame.com, as well as a userscript that adds a scrollbar to the custom components menu (in custom-component-scrollbar.js).

It also contains an emulator for the nandgame.com multitasking computer at nce.html, which is also available at https://speedydelete.com/nce.

No records are given to people if they are too simple.


## Best solutions by number of nands/instructions

The save file containing these is save.json.

### CO.1 - Logic Gates
CO.1.1 - Nand - 2 components
CO.1.2 - Invert - 1 nand, 1 component
CO.1.3 - And - 2 nands, 2 components
CO.1.4 - Or - 3 nands, 3 components
CO.1.5 - Xor - 4 nands, 4 components

### CO.2 - Arithmetics
CO.2.1 - Half Adder - 5 nands, 5 components
CO.2.2 - Full Adder - 9 nands, 9 components
CO.2.3 - Multi-bit Adder - 18 nands, 18 components
CO.2.4 - Increment - 16 nands, 75 components (nttii)
CO.2.5 - Subtraction - 139 nands, 133 components (Sad_Courage_1564)
CO.2.6 - Equal to Zero - 10 nands, 4 components
CO.2.7 - Less than Zero - 0 nands, 0 components

### CO.3 - Switching
CO.3.1 - Selector - 4 nands, 4 components
CO.3.2 - Switch - 4 nands, 4 components (Sad_Courage_1564)

### CO.4 - Arithmetic Logic Unit
CO.4.1 - Logic Unit - 148 nands, 148 components (tctianchi)
CO.4.2 - Arithmetic Unit - 211 nands, 82 components (tctianchi)
CO.4.3 - ALU - 359 nands, 304 components (johndcochran)
CO.4.4 - Condition - 50 nands, 23 components (tctianchi)

### CO.5 - Memory
CO.5.1 - SR latch - 2 nands, 2 components
CO.5.2 - D latch - 4 nands, 1 component
CO.5.3 - Data Flip-Flop - 8 nands, 8 components (CHEpachilo)
CO.5.4 - Register - 8 nands, 8 components (CHEpachilo)
CO.5.5 - Counter - 179 nands, 3 components (CHEpachilo)
CO.5.6 - RAM - 151 nands, 150 components (CHEpachilo)

### CO.6 - Processor
CO.6.1 - Combined Memory - 100 nands, 100 components (CHEpachilo, speedydelete's 98 nand solution is cheaty)
CO.6.2 - ALU Instruction - 465 nands, 51 components (CHEPachilo)
CO.6.3 - Control Selector - 61 nands, 61 components (CHEpachilo)
CO.6.4 - Control Unit - 513 nands, 54 components (CHEpachilo, requires a 2 nand fix because it is cheaty for instructions like 0x8008)
CO.6.5 - Computer - 792 nands, 4 components
CO.6.6 - Input and Output - 6 nands, 3 components

### AS - Assembler
AS.1 - Machine code - No record
AS.2 - Assembler language - No record
AS.3 - Assembler program - 4 instructions, 4 lines (nttii)

### DI - Display
DI.1 - Display - 4 instructions, 4 lines (AcalamityDev)

### RO - Robotics
RO.1 - Escape Labyrinth - 11 instructions, 11 lines (nttii)

### NE - Network
NE.1 - Network - 22 instructions, 21 lines (nttii)

### ST.1 - Stack Operations
ST.1.1 - Init stack - 4 instructions, 4 lines
ST.1.2 - Push D - 4 instructions, 4 lines
ST.1.3 - Pop D - 3 instructions, 3 lines
ST.1.4 - Pop A - 3 instructions, 3 lines
ST.1.5 - Push Value - 6 instructions, 3 lines
ST.1.6 - Push Static - 6 instructions, 3 lines
ST.1.7 - Pop Static - 5 instructions, 3 lines

### ST.2 - Jumps
ST.2.1 - Goto - 2 instructions, 2 lines
ST.2.2 - If-goto - 5 instructions, 3 lines (nttii's 5 instruction 5 line solution is broken)

### ST.3 - Function Calls
ST.3.1 - Call - 47 instructions, 25 lines (speedydelete)
ST.3.2 - Function - 7 instructions, 7 lines (nttii)
ST.3.3 - Return - 11 instructions, 7 lines (nttii, it would be 10 instructions but you need to seperate the JMP from the last line for S.4.6-10 to work)
ST.3.4 - Push Argument - 9 instructions, 6 lines (nttii)
ST.3.5 - Pop Argument - 9 instructions, 9 lines (nttii)
ST.3.6 - add - 27 instructions, 8 lines
ST.3.7 - sub - 27 instructions, 8 lines
ST.3.8 - negate - 25 instructions, 6 lines
ST.3.9 - getChar - 30 instructions, 11 lines (speedydelete's friend)
ST.3.10 - putChar - 24 instructions, 8 lines (speedydelete's friend)

### ST.4 - Conditionals
ST.4.1 - and - 27 instructions, 8 lines
ST.4.2 - or - 27 instructions, 8 lines
ST.4.3 - negate - 24 instructions, 5 lines
ST.4.4 - equals - 33 instructions, 14 lines (speedydelete)

### HI - High-level language
HI.1 - Tokenize - 3 tokens (Sad_Courage_1564)
HI.2 - Grammar - 5 rules (nttii)
HI.3 - Code generation - 19 instructions, 5 lines

### TR - Transistor Level
TR.1 - Nand (CMOS) - 3 components (FanOfNandgame)
TR.2 - Invert (CMOS) - 1 component
TR.3 - Nor (CMOS) - 2 components (Sad_Courage_1564)

### FU - Functional Completeness
FU.1 - Nand from Nor - 4 components, 8 nands
FU.2 - Nand from And and Invert - 2 components, 3 nands

### BI - Bit-shifts
BI.1 - Left Shift - 0 nands, 0 components
BI.2 - Logical Right Shift - 0 nands, 0 components
BI.3 - Arithmetic Right Shift - 0 nands, 0 components
BI.4 - Barrel Shift Left - 181 nands, 181 components (tctianchi)

### AD.1 - Integer Arithmetics
AD.1.1 - Max - 106 nands, 106 components
AD.1.2 - Multiplication - 1158 nands, 1021 components (kariya_mitsuru)

### AD.2 - Floating Point Arithmetics
AD.2.1 - Unpack floating-point value - 12 nands, 4 components (Sad_Courage_1564)
AD.2.2 - Floating-point multiplication - 57 nands, 11 components (CHEpachilo)
AD.2.3 - Normalize overflow - 58 nands, 55 components (tctianchi)
AD.2.4 - Verify exponent - 41 nands, 21 components (speedydelete)
AD.2.5 - Align significands - 312 nands, 288 components (speedydelete)
AD.2.6 - Add signed magnitude - 198 nands, 192 components (tctianchi)
AD.2.7 - Normalize underflow - 207 nands, 207 components (tctianchi)
AD.2.8 - Pack floating-point value - 305 nands, 3 components
AD.2.9 - Floating-point multiplication - 386 nands, 4 components
AD.2.10 - Floating-point addition - 953 nands, 5 components

### MU - Multitasking
MU.1 - Timer trigger - 91 nands, 91 components (speedydelete)
MU.2 - Mode controller - 12 nands, 5 components
MU.3 - Register with backup - 311 nands, 308 components (speedydelete)
MU.4 - Program Counter - 369 nands, 328 components  (speedydelete)
MU.5 - Register Bank - 1180 nands, 1142 components (speedydelete, this version fixes a bug where user-mode processes can write to arbitrary registers, and therefore should be considered the optimal one, even though it uses more things than the "actually optimal" one.)
MU.6 - General-purpose Memory - 499 nands, 495 components (speedydelete)
MU.7 - Protected Memory - 26 nands, 25 components (speedydelete)
MU.8 - Control Unit - 969 nands, 453 components (speedydelete)
MU.9 - Processor - 1383 nands, 5 components


## Best solutions by number of components/lines

The save file containing these is components.json. Records marked in *italics* are the same as the record for the fewest number of lines/components. The nand/instruction counts assume that the optimal components from the previous section are used instead.

### CO.1 - Logic Gates
*CO.1.1 - Nand - 2 components*
*CO.1.2 - Invert - 1 component, 1 nand*
*CO.1.3 - And - 2 components, 2 nands*
*CO.1.4 - Or - 3 components, 3 nands*
CO.1.5 - Xor - 3 components, 6 nands

### CO.2 - Arithmetics
CO.2.1 - Half Adder - 2 components, 6 nands
CO.2.2 - Full Adder - 3 components, 13 nands
*CO.2.3 - Multi-bit Adder - 18 components, 18 nands*
CO.2.4 - Increment - 1 component, 144 nands
CO.2.5 - Subtraction - 2 components, 160 nands
*CO.2.6 - Equal to Zero - 4 components, 10 nands*
*CO.2.7 - Less than Zero - 0 components, 0 nands*

### CO.3 - Switching
*CO.3.1 - Selector - 4 components, 4 nands*
CO.3.2 - Switch - 2 components, 8 nands (nttii)

### CO.4 - Arithmetic Logic Unit
CO.4.1 - Logic Unit - 7 components, 352 nands
CO.4.2 - Arithmetic Unit - 4 components, 411 nands
CO.4.3 - ALU - 7 components, 584 nands
CO.4.4 - Condition - 8 components, 56 nands (mateddy)

### CO.5 - Memory
CO.5.1 - SR latch - 2 components, 2 nands
CO.5.2 - D latch - 1 component, 4 nands
CO.5.3 - Data Flip-Flop - 3 components, 9 nands (TheStormAngel)
CO.5.4 - Register - 2 components, 16 nands
CO.5.5 - Counter - 3 components, 203 nands
CO.5.6 - RAM - 4 components, 196 nands

### CO.6 - Processor
CO.6.1 - Combined Memory - 3 components, 128 nands
CO.6.2 - ALU Instruction - 3 components, 473 nands
CO.6.3 - Control Selector - 5 components, 80 nands
CO.6.4 - Control Unit - 2 components, 526 nands
*CO.6.5 - Computer - 4 components, 801 nands*
CO.6.6 - Input and Output - 2 components, 65 nands

### AS - Assembler
*AS.1 - Machine code - No record*
*AS.2 - Assembler language - No record*
*AS.3 - Assembler program - 4 lines, 4 instructions (nttii)*

### DI - Display
*DI.1 - Display - 4 lines, 4 instructions (AcalamityDev)*

### RO - Robotics
*RO.1 - Escape Labyrinth - 11 lines, 11 instructions (nttii)*

### NE - Network
*NE.1 - Network - 21 lines, 22 instructions, (nttii)*

### ST.1 - Stack Operations
*ST.1.1 - Init stack - 4 lines, 4 instructions*
*ST.1.2 - Push D - 4 lines, 4 instructions*
ST.1.3 - Pop D - 2 lines, 4 instructions (AcalamityDev, dependant on pop.A)
*ST.1.4 - Pop A - 3 lines, 3 instructions*
*ST.1.5 - Push Value - 3 lines, 6 instructions*
*ST.1.6 - Push Static - 3 lines, 6 instructions*
*ST.1.7 - Pop Static - 3 lines, 5 instructions*

### ST.2 - Jumps
*ST.2.1 - Goto - 2 lines, 2 instructions*
*ST.2.2 - If-goto - 3 lines, 5 instructions (nttii's 5 instruction 5 line solution is broken)*

### ST.3 - Function Calls
ST.3.1 - Call - 16 lines, 63 instructions (nttii)
ST.3.2 - Function - 6 lines, 15 instructions (nttii)
ST.3.3 - Return - 5 lines, 20 instructions (AcalamityDev)
*ST.3.4 - Push Argument - 9 instructions, 6 lines (nttii)*
*ST.3.5 - Pop Argument - 9 instructions, 9 lines (nttii)*
*ST.3.6 - add - 8 lines, 27 instructions*
*ST.3.7 - sub - 8 lines, 27 instructions*
*ST.3.8 - negate - 6 lines, 25 instructions*
*ST.3.9 - getChar - 11 lines, 30 instructions (speedydelete's friend)*
*ST.3.10 - putChar - 8 lines, 24 instructions (speedydelete's friend)*

### ST.4 - Conditionals
*ST.4.1 - and - 8 lines, 27 instructions*
*ST.4.2 - or - 8 lines, 27 instructions*
*ST.4.3 - negate - 5 lines, 24 instructions*
*ST.4.4 - equals - 14 lines, 33 instructions (speedydelete)*

### HI - High-level language
*HI.1 - Tokenize - 3 tokens (Sad_Courage_1564)*
*HI.2 - Grammar - 5 rules (nttii)*
*HI.3 - Code generation - 5 lines, 19 instructions*

### TR - Transistor Level
*TR.1 - Nand (CMOS) - 3 components (FanOfNandgame)*
*TR.2 - Invert (CMOS) - 1 component*
*TR.3 - Nor (CMOS) - 2 components (Sad_Courage_1564)*

### FU - Functional Completeness
*FU.1 - Nand from Nor - 4 components, 8 nands*
*FU.2 - Nand from And and Invert - 2 components, 3 nands*

### BI - Bit-shifts
*BI.1 - Left Shift - 0 components, 0 nands*
*BI.2 - Logical Right Shift - 0 components, 0 nands*
*BI.3 - Arithmetic Right Shift - 0 components, 0 nands*
*BI.4 - Barrel Shift Left - 4 components, 256 nands*

### AD.1 - Integer Arithmetics
AD.1.1 - Max - 2 components, 303 nands
AD.1.2 - Multiplication - 32 components, 2816 nands (Hafnon, trivial expansion of their cheaty solution that performs 5*16->16 multiplication to handle full multiplication)

### AD.2 - Floating Point Arithmetics
*AD.2.1 - Unpack floating-point value - 4 components, 12 nands (Sad_Courage_1564)*
AD.2.2 - Floating-point multiplication - 4 components, 287 nands
AD.2.3 - Normalize overflow - 3 components, 203 nands
AD.2.4 - Verify exponent - 2 components, 110 nands
AD.2.5 - Align significands - 7 components, 832 nands
AD.2.6 - Add signed magnitude - 8 components, 562 nands (pizzystrizzy, slightly modified for nand-count optimization)
AD.2.7 - Normalize underflow - 40 components, 2680 nands (mateddy, slightly modified for nand-count optimization)
*AD.2.8 - Pack floating-point value - 3 components, 305 nands*
*AD.2.9 - Floating-point multiplication - 4 components, 386 nands*
*AD.2.10 - Floating-point addition - 5 components, 953 nands*

### MU - Multitasking
MU.1 - Timer trigger - 1 component, 179 nands
MU.2 - Mode controller - 5 components, 12 nands
MU.3 - Register with backup - 11 components, 326 nands
MU.4 - Program Counter - 3 components, 450 nands
MU.5 - Register Bank - 8 components, 1308 nands (This version fixes a bug where user-mode processes can write to arbitrary registers, and therefore should be considered the optimal one, even though it uses more things than the "actually optimal" one.)
MU.6 - General-purpose Memory - 13 components, 652 nands
*MU.7 - Protected Memory - 25 components, 26 nands (speedydelete, not implemented in the save file because I'm lazy)*
MU.8 - Control Unit - 18 components, 1050 nands
*MU.9 - Processor - 5 components, 1383 nands*


## Cheaty solutions by number of nands/instructions

The save file containing these is cheaty.json. Some of these solutions break each other or other solutions, so some things are marked incorrect in the save file.

### S.1 - Low level
S.1.6 - Network - 4 instructions, 4 lines (AcalamityDev)

### S.4 - Function calls
S.4.3 - Return - 9 instruction, 2 lines (nttii)
S.4.4 - Push Argument - 6 instructions, 1 line (nttii)
S.4.5 - Pop Argument - 6 instructions, 1 line (AcalamityDev)

### O.3 - Arithmetics
O.3.1 - Max - 9 nands, 5 components (Sad_Courage_1564)
O.3.2 - Multiplication - 14 nands, 6 components (somedirt)

### O.5 - Multiprocessing
O.5.8 - Control Unit - 0 nands, 0 components (speedydelete's friend)


## Cheaty solutions by number of components/lines

The save file containing these is cheaty_components.json. Again, some of these solutions break each other or other solutions, so some things are marked incorrect in the save file.

### S.1 - Low level
S.1.6 - Network - 3 lines, 14 instructions (AcalamityDev)

### S.2 - Stack machine
S.2.1 - Init stack - 1 line, 6 instructions (nttii)
S.2.6 - Push Static - 1 line, 9 instructions (AcalamityDev)
S.2.7 - Pop Static - 1 line, 9 instructions (AcalamityDev)

### S.4 - Function calls
S.4.2 - Function - 4 lines, 22 instructions (AcalamityDev)
*S.4.3 - Return - 2 lines, 9 instructions (nttii, this solution does not work when combined with the cheaty init stack solution, so it is marked incorrect in the save file)*
*S.4.4 - Push Argument - 1 line, 6 instructions (nttii)*
*S.4.5 - Pop Argument - 1 line, 6 instructions (AcalamityDev)*

### O.3 - Arithmetics
*O.3.1 - Max - 5 components, 9 nands (Sad_Courage_1564)*
*O.3.2 - Multiplication - 6 components, 14 nands (somedirt)*

### O.5 - Multiprocessing
*O.5.8 - Control Unit - 0 components, 0 nands (speedydelete's friend)*


## Information for users that hold records

nttii - https://www.reddit.com/user/nttii/ - 15 records (1 nands, 8 instructions, 1 components, 2 lines, 2 cheaty instructions, 1 cheaty lines)
speedydelete - https://speedydelete.com/, https://github.com/speedydelete/ - 11 records (9 nands, 2 instructions)
CHEpachilo - https://www.reddit.com/user/CHEpachilo/ - 10 records (10 nands)
AcalamityDev - Cannot find an online profile - 9 records (1 instructions, 2 lines, 1 cheaty instructions, 5 cheaty lines)
tctianchi - https://reddit.com/user/tctianchi/, https://github.com/tctianchi/ - 7 records (7 nands)
Sad_Courage_1564 - 6 records - https://www.reddit.com/user/Sad_Courage_1564/ - 5 records (5 components, 1 tokens, 1 cheaty nands)
speedydelete's friend - No online profile - 3 records (2 instructions, 1 cheaty nands)
mateddy - https://www.reddit.com/user/mateddy/ - 2 records (2 components)
johndcochran - https://www.reddit.com/user/johndcochran/ - 1 record (1 nands)
kariya_mitsuru - https://www.reddit.com/user/kariya_mitsuru/ - 1 record (1 nands)
TheStormAngel - https://www.reddit.com/user/TheStormAngel/ - 1 record (1 components)
FanOfNandgame - https://www.reddit.com/user/FanOfNandgame/ - 1 record (1 components)
Hafnon - https://www.reddit.com/user/Hafnon/ - 1 record (1 components)
pizzystrizzy - https://www.reddit.com/user/pizzystrizzy/ - 1 record (1 components)
somedirt - https://www.reddit.com/user/somedirt/ - 1 record (1 cheaty nands)
