/*
 *  DCPU-16 Assembler & Emulator Library
 *  by deNULL (me@denull.ru)
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
setValue: function(code, value, memory, registers) {
  if (code < 0x8) {
    registers[DCPU.regs[code]] = value;
  } else
  if (code < 0x10) {
    memory[registers[DCPU.regs[code - 0x8]]] = value;
  } else
  if (code < 0x18) {
    var nw = memory[(registers.PC - 1) & 0xffff];
    memory[(nw + registers[DCPU.regs[code - 0x10]]) & 0xffff] = value;
  } else
  if (code == 0x18) { // PUSH (POP can't be set)
    memory[registers.SP] = value;
  } else
  if (code == 0x19) { // PEEK
    memory[registers.SP] = value;
  } else
  if (code == 0x1a) { // PICK n
    var nw = memory[(registers.PC - 1) & 0xffff];
    memory[(nw + registers.SP) & 0xffff] = value;
  } else
  if (code == 0x1b) {
    registers.SP = value;
  } else
  if (code == 0x1c) {
    registers.PC = value;
  } else
  if (code == 0x1d) {
    registers.EX = value;
  } else
  if (code == 0x1e) {
    memory[memory[(registers.PC - 1) & 0xffff]] = value;
  }
},
/*
*  Skips one command, without performing any changes to memory and/or registers
*/
skip: function(memory, registers) {
  var op;
  var cycles = DCPU.cycles;
  var skipped = 0;
  do {
    var cur = memory[registers.PC] || 0;
    op = cur & 0x1f;
    var aa = (cur >> 10) & 0x3f;
    var bb = (cur >> 5) & 0x1f;

    registers.PC = (registers.PC + 1) & 0xffff;
    DCPU.getValue(false, bb, memory, registers, true);
    DCPU.getValue(true, aa, memory, registers, true);
    skipped++;
  } while (op >= 0x10 && op <= 0x17);
  DCPU.cycles = cycles;
  return skipped;
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
  DCPU.cycles = 0;

  // check for BRK (SUB PC, 1)
  if (cur == 0x8b83) {
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
        case 0x07: { // HCF
          // for now, assume = BRK
          return -1;
        }
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
          DCPU.setValue(aa, registers.IA || 0, memory, registers);
          return DCPU.cycles + 1;
        }
        case 0x0a: { // IAS
          registers.IA = DCPU.getValue(true, aa, memory, registers);
          return DCPU.cycles + 1;
        }
        // ...
        case 0x10: { // HWN
          DCPU.getValue(true, aa, memory, registers);
          DCPU.setValue(aa, hardware.length, memory, registers);
          return DCPU.cycles + 2;
        }
        case 0x11: { // HWQ
          var hw = hardware[DCPU.getValue(true, aa, memory, registers)];
          registers.A = (hw.type >> 16) & 0xffff;
          registers.B = (hw.type & 0xffff);
          registers.C = hw.revision;
          registers.X = (hw.manufacturer >> 16) & 0xffff;
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
      DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, bv, memory, registers);
      return DCPU.cycles + 1;
    }
    case 0x02: { // ADD
      var v = DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x03: { // SUB
      var v = - DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x04: { // MUL
      var v = DCPU.getValue(true, aa, memory, registers) * DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x05: { // MLI
      var v = DCPU.getSignedValue(true, aa, memory, registers) * DCPU.getSignedValue(true, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x06: { // DIV
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if (av == 0) {
        DCPU.setValue(bb, 0, memory, registers);
        registers.EX = 0;
      } else {
        var res = bv / av;
        DCPU.setValue(bb, parseInt(res) & 0xffff, memory, registers);
        registers.EX = parseInt(res * 0x10000) & 0xffff;
      }
      return DCPU.cycles + 3;
    }
    case 0x07: { // DVI
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      if (av == 0) {
        DCPU.setValue(bb, 0, memory, registers);
        registers.EX = 0;
      } else {
        var res = bv / av;
        DCPU.setValue(bb, parseInt(res) & 0xffff, memory, registers);
        registers.EX = parseInt(res * 0x10000) & 0xffff;
      }
      return DCPU.cycles + 3;
    }
    case 0x08: { // MOD
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, (av == 0) ? 0 : (bv % av), memory, registers);
      return DCPU.cycles + 3;
    }
    case 0x09: { // MDI
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(false, bb, memory, registers);
      DCPU.setValue(bb, (av == 0) ? 0 : (bv % av), memory, registers);
      return DCPU.cycles + 3;
    }
    case 0x0a: { // AND
      var v = DCPU.getValue(true, aa, memory, registers) & DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      return DCPU.cycles + 1;
    }
    case 0x0b: { // BOR
      var v = DCPU.getValue(true, aa, memory, registers) | DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      return DCPU.cycles + 1;
    }
    case 0x0c: { // XOR
      var v = DCPU.getValue(true, aa, memory, registers) ^ DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      return DCPU.cycles + 1;
    }
    case 0x0d: { // SHR
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, (bv >>> av) & 0xffff, memory, registers);
      registers.EX = ((bv << 16) >>> av) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x0e: { // ASR
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      DCPU.setValue(bb, (bv >> av) & 0xffff, memory, registers);
      registers.EX = ((bv << 16) >> av) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x0f: { // SHL
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, (bv << av) & 0xffff, memory, registers);
      registers.EX = ((bv << av) >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x10: { // IFB
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if ((bv & av) == 0) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x11: { // IFC
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if ((bv & av) != 0) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x12: { // IFE
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if (bv != av) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x13: { // IFN
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if (bv == av) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x14: { // IFG
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if (bv <= av) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x15: { // IFA
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      if (bv <= av) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x16: { // IFL
      var av = DCPU.getValue(true, aa, memory, registers);
      var bv = DCPU.getValue(false, bb, memory, registers);
      if (bv >= av) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }
    case 0x17: { // IFU
      var av = DCPU.getSignedValue(true, aa, memory, registers);
      var bv = DCPU.getSignedValue(true, bb, memory, registers);
      if (bv >= av) {
        return DCPU.cycles + 2 + DCPU.skip(memory, registers);
      }
      return DCPU.cycles + 2;
    }

    // ...

    case 0x1a: { // ADX
      var v = DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(false, bb, memory, registers) + registers.EX;
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 3;
    }
    case 0x1b: { // SBX
      var v = -DCPU.getValue(true, aa, memory, registers) + DCPU.getValue(false, bb, memory, registers) + registers.EX;
      DCPU.setValue(bb, v & 0xffff, memory, registers);
      registers.EX = (v >> 16) & 0xffff;
      return DCPU.cycles + 3;
    }
    case 0x1e: { // STI
      var av = DCPU.getValue(true, aa, memory, registers);
      DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, av, memory, registers);
      registers.I = (registers.I + 1) & 0xffff;
      registers.J = (registers.J + 1) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x1f: { // STD
      var av = DCPU.getValue(true, aa, memory, registers);
      DCPU.getValue(false, bb, memory, registers);
      DCPU.setValue(bb, av, memory, registers);
      registers.I = (registers.I - 1) & 0xffff;
      registers.J = (registers.J - 1) & 0xffff;
      return DCPU.cycles + 2;
    }
  }
},

};