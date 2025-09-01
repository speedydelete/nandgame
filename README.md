
# nandgame

This contains the optimal known solutions for nandgame.com, as well as a userscript that adds a scrollbar to the custom components menu (in custom-component-scrollbar.js).

No records are given to people if they are too simple.


## Best solutions by number of nands/instructions

The save file containing these is save.json.

### H.1 - Logic Gates
H.1.1 - Nand - 2 components  
H.1.2 - Invert - 1 nand, 1 component  
H.1.3 - And - 2 nands, 2 components  
H.1.4 - Or - 3 nands, 3 components  
H.1.5 - Xor - 4 nands, 4 components  

### H.2 - Arithmetics
H.2.1 - Half Adder - 5 nands, 5 components  
H.2.2 - Full Adder - 9 nands, 9 components  
H.2.3 - Multi-bit Adder - 18 nands, 18 components  
H.2.4 - Increment - 16 nands, 75 components (nttii)  
H.2.5 - Subtraction - 139 nands, 133 components (Sad_Courage_1564)  
H.2.6 - Equal to Zero - 10 nands, 4 components  
H.2.7 - Less than Zero - 0 nands, 0 components  

### H.3 - Switching
H.3.1 - Selector - 4 nands, 4 components  
H.3.2 - Switch - 4 nands, 4 components (Sad_Courage_1564)  

### H.4 - Arithmetic Logic Unit
H.4.1 - Logic Unit - 148 nands, 148 components (tctianchi)  
H.4.2 - Arithmetic Unit - 211 nands, 82 components (tctianchi)  
H.4.3 - ALU - 359 nands, 304 components (johndcochran)  
H.4.4 - Condition - 50 nands, 23 components (tctianchi)  

### H.5 - Memory
H.5.1 - SR latch - 2 nands, 2 components  
H.5.2 - D latch - 4 nands, 1 component  
H.5.3 - Data Flip-Flop - 8 nands, 8 components (CHEpachilo)  
H.5.3 - Register - 8 nands, 8 components (CHEpachilo)  
H.5.5 - Counter - 188 nands, 4 components (CHEpachilo's 179 nand solution does not work due to a bug with edge triggers)  
H.5.6 - RAM - 151 nands, 150 components (CHEpachilo)  

### H.6 - Processor
H.6.1 - Combined Memory - 100 nands, 100 components (CHEpachilo) (speedydelete's 98 nand solution is cheaty)   
H.6.2 - ALU Instruction - 465 nands, 51 components (CHEpachilo)  
H.6.3 - Control Selector - 61 nands, 61 components (CHEpachilo)  
H.6.4 - Control Unit - 513 nands, 54 components (CHEpachilo's 524 nand solution is cheaty)  
H.6.5 - Computer - 801 nands, 5 components  
H.6.6 - Input and Output - 6 nands, 3 components  

### S.1 - Low level
S.1.1 - Machine code - No record  
S.1.2 - Assembler language - No record  
S.1.3 - Assembler program - 4 instructions, 4 lines (nttii)  
S.1.4 - Escape Labyrinth - 11 instructions, 11 lines (nttii)  
S.1.5 - Display - 4 instructions, 4 lines (AcalamityDev)  
S.1.6 - Network - 22 instructions, 21 lines (nttii)  

### S.2 - Stack machine
S.2.1 - Init Stack - 4 lines, 4 instructions, 4 lines  
S.2.2 - Push D - 4 lines, 4 instructions,  lines  
S.2.3 - Pop D - 3 lines, 3 instructions, 3 lines  
S.2.4 - Pop A - 3 lines, 3 instructions, 3 lines  
S.2.5 - Push Value - 3 lines, 6 instructions, 3 lines  
S.2.6 - Push Static - 3 lines, 6 instructions, 3 lines  
S.2.7 - Pop Static - 3 lines, 5 instructions, 3 lines  

### S.3 - Jumps
S.3.1 - Goto - 2 instructions, 2 lines  
S.3.2 - If-goto - 5 instructions, 5 lines  

### S.4 - Function calls
S.4.1 - Call - 47 instructions, 47 lines (speedydelete)  
S.4.2 - Function - 7 instructions, 7 lines (nttii)  
S.4.3 - Return - 11 instructions, 7 lines (nttii)  
S.4.4 - Push Argument - 9 instructions, 6 lines (nttii)  
S.4.5 - Pop Argument - 9 instructions, 9 lines (nttii)  
S.4.6 - add - 27 instructions, 8 lines  
S.4.7 - sub - 27 instructions, 8 lines  
S.4.8 - negate - 25 instructions, 6 lines  
S.4.9 - getChar - 30 instructions, 11 lines (speedydelete's friend)  
S.4.10 - putChar - 28 instructions, 8 lines (speedydelete's friend)  

### S.5 - High-level language
S.5.1 - Tokenize - 3 tokens (Sad_Courage_1564)  
S.5.2 - Grammar - 5 rules (nttii)  
S.5.3 - Code generation - 19 instructions, 5 lines  

### S.6 - Conditionals
S.6.1 - and - 27 instructions, 8 lines  
S.6.2 - or - 27 instructions, 8 lines  
S.6.3 - negate - 24 instructions, 5 lines  
S.6.4 - equals - 32 instructions, 14 lines (speedydelete)

### O.1 - Transistor level
O.1.1 - Nand (CMOS) - 3 components (FanOfNandgame's 2 component solution is broken)  
O.1.2 - Invert (CMOS) - 1 component  
O.1.3 - Nor (CMOS) - 2 components (Sad_Courage_1564)  

### O.2 - Logic
O.2.1 - Xnor - 5 nands, 2 components  
O.2.2 - Left Shift - 0 nands, 0 components  
O.2.3 - Logical Right Shift - 0 nands, 0 components  
O.2.4 - Arithmetic Right Shift - 0 nands, 0 components  
O.2.5 - Barrel Shift Left - 181 nands, 166 nands  

### O.3 - Arithmetics
O.3.1 - Max - 106 nands, 106 components  
O.3.2 - Multiplication - 1158 nands, 1021 components (kariya_mitsuru)  

### O.4 - Floating point
O.4.1 - Unpack floating-point value - 12 nands, 4 components (Sad_Courage_1564)  
O.4.2 - Floating-point multiplication - 57 nands, 11 componends (CHEpachilo)  
O.4.3 - Normalize overflow - 58 nands, 55 components (tctianchi)  
O.4.4 - Verify exponent - 41 nands, 21 components (speedydelete)  
O.4.5 - Align significands - 312 nands, 288 components (speedydelete)  
O.4.6 - Add signed magnitude - 198 nands, 192 components (tctianchi)  
O.4.7 - Normalize underflow - 207 nands, 207 components (tctianchi)  
O.4.8 - Pack floating-point value - 305 nands, 3 components  
O.4.9 - Floating-point multiplication - 386 nands, 4 components  
O.4.10 - Floating-point addition - 953 nands, 5 components  

### O.5 - Multitasking
O.5.1 - Timer trigger - 91 nands, 91 components (speedydelete)  
O.5.2 - Mode controller - 12 nands, 12 components  
O.5.3 - Register with backup - 307 nands, 306 components (speedydelete)  
O.5.4 - Program Counter - 431 nands, 51 components  
O.5.5 - Register Bank - 1234 nands, 8 components (This version fixes a bug where user-mode processes can write to arbitrary registers, and therefore should be considered the optimal one, even though it uses more things than the "actually optimal" one.)  
O.5.6 - General-purpose Memory - 499 nands, 495 components (speedydelete)  
O.5.7 - Virtual Memory - 20 nands, 20 components (speedydelete)  
O.5.8 - Control Unit - 969 nands, 453 components (speedydelete)  
O.5.9 - Processor - 1379 nands, 5 components  


## Best solutions by number of components/lines

The save file containing these is components.json.


## Information for users that hold records

nttii - https://www.reddit.com/user/nttii/ - 9 records (1 nands, 8 instructions)  
speedydelete - https://speedydelete.com/, https://github.com/speedydelete/ - 9 records (7 nands, 2 instructions)  
CHEpachilo - https://www.reddit.com/user/CHEpachilo/ - 8 records (8 nands)  
tctianchi - https://reddit.com/user/tctianchi/, https://github.com/tctianchi/ - 6 records (6 nands)  
Sad_Courage_1564 - 5 records - https://www.reddit.com/user/Sad_Courage_1564/ - 5 records (5 components, 1 tokens)  
speedydelete's friend - No online profile - 2 records (2 instructions)
johndcochran - https://www.reddit.com/user/johndcochran/ - 1 record (1 nands)
AcalamityDev - Cannot find an online profile - 1 record (1 instructions)
kariya_mitsuru - https://www.reddit.com/user/kariya_mitsuru/ - 1 record (1 nands)
