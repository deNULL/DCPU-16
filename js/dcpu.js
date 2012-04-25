/*
*  DCPU-16 Assembler & Emulator Library
*  by deNULL (me@denull.ru)
*
*/

// some common functions, shouldn't actually be here...
String.prototype.trim = function() {
  var i = 0;
  while (i < this.length && (this.charAt(i) == " " || this.charAt(i) == "\n" || this.charAt(i) == "\r" || this.charAt(i) == "\t")) i++;
  var j = this.length - 1;
  while (j >= 0 && (this.charAt(j) == " " || this.charAt(j) == "\n" || this.charAt(j) == "\r" || this.charAt(j) == "\t")) j--;
  return this.substr(i, j - i + 1);
}
Array.prototype.indexOf = function(v) {
  for (var i = 0; i < this.length; i++)
    if (this[i] == v)
      return i;
  return -1;
}
function wrapAs(s, c) {
  return "<span class='" + c + "'>" + s + "</span>";
}
function ge(e) {
  return document.getElementById(e);
}

var DCPU = {
bops: {
  0x01: "SET",
  0x02: "ADD",
  0x03: "SUB",
  0x04: "MUL",
  0x05: "MLI",
  0x06: "DIV",
  0x07: "DVI",
  0x08: "MOD",
  0x09: "AND",
  0x0a: "BOR",
  0x0b: "XOR",
  0x0c: "SHR",
  0x0d: "ASR",
  0x0e: "SHL",
  0x0f: "MVI",
  0x10: "IFB",
  0x11: "IFC",
  0x12: "IFE",
  0x13: "IFN",
  0x14: "IFG",
  0x15: "IFA",
  0x16: "IFL",
  0x17: "IFU",
  // ...
  0x1a: "ADX",
  0x1b: "SUX"
},
nbops: {
  0x01: "JSR",
  // ...
  0x08: "INT",
  0x09: "IAG",
  0x0a: "IAS",
  // ...
  0x10: "HWN",
  0x11: "HWQ",
  0x12: "HWI"
},
regs: ["A", "B", "C", "X", "Y", "Z", "I", "J"],
cycles: 0,

extendSign: function(word) {
  if (word & 0x8000) { // negative
    return (word | 0xffff0000);
  }
  return word;
},

/*
* Retrieves required value from memory or some of registers
* (no_change - don't perform any changes on SP)
*/
getValue: function(is_a, code, memory, registers, no_change) {
  if (code < 0x8) {
    return registers[DCPU.regs[code]] || 0;
  } else
  if (code < 0x10) {
    return memory[registers[DCPU.regs[code - 0x8]] || 0] || 0;
  } else
  if (code < 0x18) {
    var nw = memory[registers.PC] || 0;
    registers.PC = (registers.PC + 1) & 0xffff;
    DCPU.cycles++;
    return memory[(nw + registers[DCPU.regs[code - 0x10]] || 0) & 0xffff] || 0;
  } else
  if (code == 0x18) { // POP / PUSH
    if (is_a) {
      var v = memory[registers.SP || 0] || 0;
      if (!no_change) registers.SP = (registers.SP + 1) & 0xffff;
      return v;
    } else {
      var v = memory[(registers.SP - 1) & 0xffff] || 0;
      if (!no_change) registers.SP = (registers.SP - 1) & 0xffff;
      return v;
    }
  } else
  if (code == 0x19) { // PEEK
    return memory[registers.SP || 0] || 0;
  } else
  if (code == 0x1a) { // PICK n
    var nw = memory[registers.PC] || 0;
    registers.PC = (registers.PC + 1) & 0xffff;
    DCPU.cycles++;
    return memory[(nw + registers.SP) & 0xffff] || 0;
  } else
  if (code == 0x1b) {
    return registers.SP || 0;
  } else
  if (code == 0x1c) {
    return registers.PC || 0;
  } else
  if (code == 0x1d) {
    return registers.EX || 0;
  } else
  if (code == 0x1e) {
    var nw = memory[registers.PC] || 0;
    DCPU.cycles++;
    registers.PC = (registers.PC + 1) & 0xffff;
    return memory[nw] || 0;
  } else
  if (code == 0x1f) {
    var nw = memory[registers.PC] || 0;
    DCPU.cycles++;
    registers.PC = (registers.PC + 1) & 0xffff;
    return nw;
  } else {
    return (code - 0x21) & 0xffff;
  }
},
getSignedValue: function(is_a, code, memory, registers, no_change) {
  return DCPU.extendSign(DCPU.getValue(is_a, code, memory, registers, no_change));
},
/*
* Sets new value to specified place
* (registers - copy of registers before executing command, cur_registers - actual version of them)
*/
setValue: function(code, value, memory, registers, cur_registers) {
  if (code < 0x8) {
    cur_registers[DCPU.regs[code]] = value;
  } else
  if (code < 0x10) {
    memory[registers[DCPU.regs[code - 0x8]]] = value;
  } else
  if (code < 0x18) {
    var nw = memory[registers.PC];
    memory[(nw + registers[DCPU.regs[code - 0x10]]) & 0xffff] = value;
  } else
  if (code == 0x18) { // PUSH (POP can't be set)
    memory[cur_registers.SP] = value;
  } else
  if (code == 0x19) { // PEEK
    memory[registers.SP] = value;
  } else
  if (code == 0x1a) { // PICK n
    var nw = memory[registers.PC];
    memory[(nw + registers.SP) & 0xffff] = value;
  } else
  if (code == 0x1b) {
    cur_registers.SP = value;
  } else
  if (code == 0x1c) {
    cur_registers.PC = value;
  } else
  if (code == 0x1d) {
    cur_registers.EX = value;
  } else
  if (code == 0x1e) {
    memory[memory[registers.PC]] = value;
  }
},
/*
*  Skips one command, without performing any changes to memory and/or registers
*/
skip: function(memory, registers) {
  var cur = memory[registers.PC] || 0;
  var op = cur & 0x1f;
  var aa = (cur >> 10) & 0x3f;
  var bb = (cur >> 5) & 0x1f;
  var cycles = DCPU.cycles;
  registers.PC = (registers.PC + 1) & 0xffff;
  DCPU.getValue(true, bb, memory, registers, true);
  DCPU.getValue(true, aa, memory, registers, true);
  DCPU.cycles = cycles;
},
/*
* Steps over the next command (at [PC])
* memory - array of 65536 words, current state of memory
* registers - object with fields A, B, C... containing current registers state
* hardware - array of objects with fields "type", "version", "manufacturer" and "interrupt" (a function with two params: memory and registers, returns number of additional cycles to take)
*/
step: function(memory, registers, hardware) {
  var cur = memory[registers.PC] || 0;
  var op = cur & 0x1f;
  var aa = (cur >> 10) & 0x3f;
  var bb = (cur >> 5) & 0x1f;
  registers.PC = (registers.PC + 1) & 0xffff;
  var copy = {};
  for (var r in registers)
    copy[r] = registers[r];
  DCPU.cycles = 0;

  // check for BRK (SUB PC, 1)
  if (cur == 0x85c3) {
    return -1;
  }
  switch (op) {
    case 0x0: {
      switch (bb) {
        case 0x01: { // JSR
          var av = DCPU.getValue(true, aa, memory, registers);
          registers.SP = (registers.SP - 1) & 0xffff;
          memory[registers.SP] = registers.PC;
          registers.PC = av;
          return DCPU.cycles + 3;
        }
        // ...
        case 0x08: { // INT
          var av = DCPU.getValue(true, aa, memory, registers);
          if (registers.IA) {
            registers.SP = (registers.SP - 1) & 0xffff;
            memory[registers.SP] = registers.PC;
            registers.SP = (registers.SP - 1) & 0xffff;
            memory[registers.SP] = registers.A;
            registers.PC = registers.IA;
            registers.A = av;
          }
          return DCPU.cycles + 4;
        }
        case 0x09: { // IAG
          DCPU.getValue(true, aa, memory, registers);
          DCPU.setValue(aa, registers.IA || 0, memory, copy, registers);
          return DCPU.cycles + 1;
        }
        case 0x0a: { // IAS
          registers.IA = DCPU.getValue(true, aa, memory, registers);
          return DCPU.cycles + 1;
        }
        // ...
        case 0x10: { // HWN
          DCPU.getValue(true, aa, memory, registers);
          DCPU.setValue(aa, hardware.length, memory, copy, registers);
          return DCPU.cycles + 2;
        }
        case 0x11: { // HWQ
          var hw = hardware[DCPU.getValue(true, aa, memory, registers)];
          registers.A = (hw.type >> 16);
          registers.B = (hw.type & 0xffff);
          registers.C = hw.revision;
          registers.X = (hw.manufacturer >> 16);
          registers.Y = (hw.manufacturer & 0xffff);
          return DCPU.cycles + 4;
        }
        case 0x12: { // HWI
          var hw = hardware[DCPU.getValue(true, aa, memory, registers)];
          return DCPU.cycles + hw.interrupt(memory, registers);
        }
        default: {
          return 0;
        }
      }
      break;
    }
    case 0x01: { // SET
      var bv = DCPU.getValue(true, aa, memory, registers);
      DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, bv, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0x02: { // ADD
      var v = DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x03: { // SUB
      var v = - DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x04: { // MUL
      var v = DCPU.getValue(true, aa, memory, registers) * DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x05: { // MLI
      var v = DCPU.getSignedValue(true, aa, memory, registers) * DCPU.getSignedValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x06: { // DIV
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if (av == 0) {
        DCPU.setValue(bb, 0, memory, copy, registers);
        registers.EX = 0;
      } else {
        var res = bv / av;
        DCPU.setValue(bb, parseInt(res) & 0xffff, memory, copy, registers);
        registers.EX = parseInt(res * 0x10000) & 0xffff;
      }
      return DCPU.cycles + 3;
    }
    case 0x07: { // DVI
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      if (av == 0) {
        DCPU.setValue(bb, 0, memory, copy, registers);
        registers.EX = 0;
      } else {
        var res = bv / av;
        DCPU.setValue(bb, parseInt(res) & 0xffff, memory, copy, registers);
        registers.EX = parseInt(res * 0x10000) & 0xffff;
      }
      return DCPU.cycles + 3;
    }
    case 0x08: { // MOD
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, (av == 0) ? 0 : (bv % av), memory, copy, registers);
      return DCPU.cycles + 3;
    }
    case 0x09: { // AND
      var v = DCPU.getValue(true, aa, memory, registers) & DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0x0a: { // BOR
      var v = DCPU.getValue(true, aa, memory, registers) | DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0x0b: { // XOR
      var v = DCPU.getValue(true, aa, memory, registers) ^ DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0x0c: { // SHR
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, (bv >>> av) & 0xffff, memory, copy, registers);
      registers.EX = ((bv << 16) >>> av) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x0d: { // ASR
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      DCPU.setValue(bb, (bv >> av) & 0xffff, memory, copy, registers);
      registers.EX = ((bv << 16) >> av) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x0e: { // SHL
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, (bv << av) & 0xffff, memory, copy, registers);
      registers.EX = ((bv << av) >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x0f: { // MVI
      var av = DCPU.getValue(true, aa, memory, registers);
      DCPU.getValue(true, bb, memory, registers);
      DCPU.setValue(bb, av, memory, copy, registers);
      registers.I = (registers.I + 1) & 0xffff;
      registers.J = (registers.J + 1) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x10: { // IFB
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if ((bv & av) == 0) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x11: { // IFC
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if ((bv & av) != 0) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x12: { // IFE
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if (bv != av) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x13: { // IFN
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if (bv == av) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x14: { // IFG
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if (bv <= av) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x15: { // IFA
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      if (bv <= av) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x16: { // IFL
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(true, bb, memory, registers);
      if (bv >= av) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0x17: { // IFU
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      if (bv >= av) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }

    // ...

    case 0x1a: { // ADX
      var v = DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(true, bb, memory, registers) + registers.EX;
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 3;
    }
    case 0x1b: { // SUX
      var v = -DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(true, bb, memory, registers) + registers.EX;
      DCPU.setValue(bb, v & 0xffff, memory, copy, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 3;
    }
  }
},


// -------

disassembleValue: function(is_a, code, memory, offset, logger) {

  if (code < 0x8) {
    return {size: 0, str: wrapAs(DCPU.regs[code], "reg")};
  } else
  if (code < 0x10) {
    return {size: 0, str: "[" + wrapAs(DCPU.regs[code - 0x08], "reg") + "]"};
  } else
  if (code < 0x18) {
    if (offset >= memory.length) {
      logger(offset, "Disassembler reached end of the file", true);
      return false;
    }
    var nw = memory[offset];
    return {size: 1, str: "[" + wrapAs(DCPU.regs[code - 0x10], "reg") + "+" + wrapAs("0x" + nw.toString(16), "lit") + "]"};
  } else
  if (code == 0x18) { // POP
    return {size: 0, str: wrapAs(is_a ? "PUSH" : "POP", "kw")};
  } else
  if (code == 0x19) { // PEEK
    return {size: 0, str: wrapAs("PEEK", "kw")};
  } else
  if (code == 0x1a) { // PICK
    if (offset >= memory.length) {
      logger(offset, "Disassembler reached end of the file", true);
      return false;
    }
    var nw = memory[offset];
    return {size: 0, str: wrapAs("PICK", "kw") + " " + wrapAs(nw.toString(10), "lit")};
  } else
  if (code == 0x1b) {
    return {size: 0, str: wrapAs("SP", "kw")};
  } else
  if (code == 0x1c) {
    return {size: 0, str: wrapAs("PC", "kw")};
  } else
  if (code == 0x1d) {
    return {size: 0, str: wrapAs("EX", "kw")};
  } else
  if (code == 0x1e) {
    if (offset >= memory.length) {
      logger(offset, "Disassembler reached end of the file", true);
      return false;
    }
    var nw = memory[offset];
    return {size: 1, str: "[" + wrapAs("0x" + pad(nw.toString(16), 4), "lit") + "]"};
  } else
  if (code == 0x1f) {
    if (offset >= memory.length) {
      logger(offset, "Disassembler reached end of the file");
      return false;
    }
    var nw = memory[offset];
    return {size: 1, str: wrapAs("0x" + pad(nw.toString(16), 4), "lit"), literal: nw};
  } else {
    return {size: 0, str: wrapAs((code - 0x21).toString(10), "lit"), literal: (code == 0x20) ? 0xffff : (code - 0x21)};
  }
},
/*
* Disassembles code in memory at specified offset
*
* Returns object with fields
* - code
* - branch
* - terminal
* - size
*/
disassemble: function(memory, offset, labels, logger) {
  var res = {size: 1};
  if (offset >= memory.length) {
    logger(offset, "Disassembler reached end of the file");
    return {size: 0, terminal: true};
  }
  var cur = memory[offset];
  var op = cur & 0x1f;
  var aa = (cur >> 10) & 0x3f;
  var bb = (cur >> 5) & 0x1f;

  switch (op) {
    case 0x00: {
      switch (bb) {
        case 0x01:   // JSR
        case 0x0a: { // IAS
          var va = DCPU.disassembleValue(true, aa, memory, offset + res.size, logger);
          res.size += va.size;
          res.code = wrapAs(DCPU.nbops[op], "op") + " " + va.str;
          if (va.literal !== undefined) {
            res.branch = va.literal;
            if (!labels[res.branch]) {
              labels.last++;
              labels[res.branch] = "label" + labels.last;
            }
            res.code = wrapAs(DCPU.nbops[op], "op") + " " + wrapAs(labels[res.branch], "lbl");
          }
          return res;
        }
        default: {
          if (!DCPU.nbops[op]) {
            logger(offset, "Unknown non-basic instruction: " + aa.toString(16));
            return {size: 0, terminal: true};
          }

          var va = DCPU.disassembleValue(true, aa, memory, offset + res.size, logger);
          res.size += va.size;
          res.code = wrapAs(DCPU.nbops[op], "op") + " " + va.str;
          return res;
        }
      }
    }
    default: {
      if (!DCPU.bops[op]) {
        logger(offset, "Unknown basic instruction: " + op.toString(16));
        return {size: 0, terminal: true};
      }

      var vb = DCPU.disassembleValue(false, bb, memory, offset + res.size, logger);
      res.size += vb.size;
      var va = DCPU.disassembleValue(true, aa, memory, offset + res.size, logger);
      res.size += va.size;

      res.code = wrapAs(DCPU.bops[op], "op") + " " + vb.str + ", " + va.str;
      if (op >= 0x10 && op <= 0x17) {
        res.conditional = true;
      } else
      if (bb == 0x1c) {
        offset += res.size;
        res.terminal = true;
        if (va.literal === undefined) {
          if (aa != 0x18) // assuming SET PC, POP - RET
            logger(offset, "(Warning) Can't predict the value of PC after " + res.code + ". Some instructions may be not disassembled.");
        } else
        switch (op) {
          case 0x01:
          case 0x0f: {
            res.branch = va.literal;
            if (!labels[res.branch]) {
              labels.last++;
              labels[res.branch] = "label" + labels.last;
            }
            res.code = wrapAs(DCPU.bops[op], "op") + " " + vb.str + ", " + wrapAs(labels[res.branch], "lbl");
            break;
          }
          case 0x02: { res.branch = (offset + va.literal) & 0xffff; break; }
          case 0x03: { res.branch = (offset - va.literal) & 0xffff; break; }
          case 0x04: { res.branch = (offset * va.literal) & 0xffff; break; }
          case 0x05: { res.branch = (DCPU.extendSign(offset) * DCPU.extendSign(va.literal)) & 0xffff; break; }
          case 0x06: { res.branch = parseInt(offset / va.literal) & 0xffff; break; }
          case 0x07: { res.branch = parseInt(DCPU.extendSign(offset) / DCPU.extendSign(va.literal)) & 0xffff; break; }
          case 0x08: { res.branch = (va.literal == 0) ? 0 : (offset % va.literal); break; }
          case 0x09: { res.branch = (offset & va.literal); break; }
          case 0x0a: { res.branch = (offset | va.literal); break; }
          case 0x0b: { res.branch = (offset ^ va.literal); break; }
          case 0x0c: { res.branch = (offset >>> va.literal) & 0xffff; break; }
          case 0x0d: { res.branch = (DCPU.extendSign(offset) >> va.literal) & 0xffff; break; }
          case 0x0e: { res.branch = (offset << va.literal) & 0xffff; break; }
          case 0x1a: { res.branch = (offset + va.literal) & 0xffff; break; }
          case 0x1b: { res.branch = (offset - va.literal) & 0xffff; break; }
        }
      }

      return res;
    }
  }
}




};