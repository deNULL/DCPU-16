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
bops: ["SET", "ADD", "SUB", "MUL", "DIV", "MOD", "SHL", "SHR", "AND", "BOR", "XOR", "IFE", "IFN", "IFG", "IFB"],
cond: ["IFE", "IFN", "IFG", "IFB"],
nbops: ["JSR"],
regs: ["A", "B", "C", "X", "Y", "Z", "I", "J"],
add_vals: ["POP", "PEEK", "PUSH", "SP", "PC", "O"],
reserved: ["A", "B", "C", "X", "Y", "Z", "I", "J", "POP", "PEEK", "PUSH", "SP", "PC", "O"],
cycles: 0,

/*
* Retrieves required value from memory or some of registers
* (no_change - don't perform any changes on SP or PC)
*/
getValue: function(code, memory, registers, no_change) {
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
  if (code == 0x18) { // POP
    var v = memory[registers.SP || 0] || 0;
    if (!no_change) registers.SP = (registers.SP + 1) & 0xffff;
    return v;
  } else
  if (code == 0x19) { // PEEK
    return memory[registers.SP || 0] || 0;
  } else
  if (code == 0x1a) { // PUSH
    var v = memory[(registers.SP - 1) & 0xffff] || 0;
    if (!no_change) registers.SP = (registers.SP - 1) & 0xffff;
    return v;
  } else
  if (code == 0x1b) {
    return registers.SP || 0;
  } else
  if (code == 0x1c) {
    return registers.PC || 0;
  } else
  if (code == 0x1d) {
    return registers.O || 0;
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
    return code - 0x20;
  }
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
  if (code == 0x18) { // POP
    memory[registers.SP] = value;
  } else
  if (code == 0x19) { // PEEK
    memory[registers.SP] = value;
  } else
  if (code == 0x1a) { // PUSH
    memory[cur_registers.SP] = value;
  } else
  if (code == 0x1b) {
    cur_registers.SP = value;
  } else
  if (code == 0x1c) {
    cur_registers.PC = value;
  } else
  if (code == 0x1d) {
    cur_registers.O = value;
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
  var op = cur & 0xf;
  var aa = (cur >> 4) & 0x3f;
  var bb = (cur >> 10) & 0x3f;
  var cycles = DCPU.cycles;
  registers.PC = (registers.PC + 1) & 0xffff;
  DCPU.getValue(aa, memory, registers, true);
  DCPU.getValue(bb, memory, registers, true);
  DCPU.cycles = cycles;
},
/*
* Steps over the next command (at [PC])
*/
step: function(memory, registers) {
  var cur = memory[registers.PC] || 0;
  var op = cur & 0xf;
  var aa = (cur >> 4) & 0x3f;
  var bb = (cur >> 10) & 0x3f;
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
      switch (aa) {
        case 0x1: { // JSR
          var av = DCPU.getValue(bb, memory, registers);
          registers.SP = (registers.SP - 1) & 0xffff;
          memory[registers.SP] = registers.PC;
          registers.PC = av;
          return DCPU.cycles + 2;
        }
        default: {
          return 0;
        }
      }
      break;
    }
    case 0x1: {
      DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, bv, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0x2: {
      var v = DCPU.getValue(aa, memory, registers) + DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      registers.O = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x3: {
      var v = DCPU.getValue(aa, memory, registers) - DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      registers.O = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x4: {
      var v = DCPU.getValue(aa, memory, registers) * DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      registers.O = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x5: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      if (bv == 0) {
        DCPU.setValue(aa, 0, memory, copy, registers);
        registers.O = 0;
      } else {
        var res = av / bv;
        DCPU.setValue(aa, parseInt(res) & 0xffff, memory, copy, registers);
        registers.O = parseInt(res * 0x10000) & 0xffff;
      }
      return DCPU.cycles + 3;
    }
    case 0x6: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, (bv == 0) ? 0 : (av % bv), memory, copy, registers);
      return DCPU.cycles + 3;
    }
    case 0x7: {
      var v = DCPU.getValue(aa, memory, registers) << DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      registers.O = (v >> 16) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x8: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, (av >> bv) & 0xffff, memory, copy, registers);
      registers.O = ((av << 16) >> bv) & 0xffff;
      return DCPU.cycles + 2;
    }
    case 0x9: {
      var v = DCPU.getValue(aa, memory, registers) & DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0xa: {
      var v = DCPU.getValue(aa, memory, registers) | DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0xb: {
      var v = DCPU.getValue(aa, memory, registers) ^ DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      return DCPU.cycles + 1;
    }
    case 0xc: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      if (av != bv) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0xd: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      if (av == bv) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0xe: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      if (av <= bv) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
    case 0xf: {
      var av = DCPU.getValue(aa, memory, registers);
      var bv = DCPU.getValue(bb, memory, registers);
      if ((av & bv) == 0) {
        DCPU.skip(memory, registers);
        return DCPU.cycles + 3;
      }
      return DCPU.cycles + 2;
    }
  }
},


// -------


disassembleValue: function(code, memory, offset, logger) {

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
    return {size: 0, str: wrapAs("POP", "kw")};
  } else
  if (code == 0x19) { // PEEK
    return {size: 0, str: wrapAs("PEEK", "kw")};
  } else
  if (code == 0x1a) { // PUSH
    return {size: 0, str: wrapAs("PUSH", "kw")};
  } else
  if (code == 0x1b) {
    return {size: 0, str: wrapAs("SP", "kw")};
  } else
  if (code == 0x1c) {
    return {size: 0, str: wrapAs("PC", "kw")};
  } else
  if (code == 0x1d) {
    return {size: 0, str: wrapAs("O", "kw")};
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
    return {size: 0, str: wrapAs((code - 0x20).toString(10), "lit"), literal: (code - 0x20)};
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
  var op = cur & 0xf;
  var aa = (cur >> 4) & 0x3f;
  var bb = (cur >> 10) & 0x3f;

  switch (op) {
    case 0x0: {
      switch (aa) {
        case 0x1: { // JSR
          var vb = DCPU.disassembleValue(bb, memory, offset + res.size, logger);
          res.size += vb.size;
          res.code = wrapAs("JSR", "op") + " " + vb.str;
          if (vb.literal !== undefined) {
            res.branch = vb.literal;
            if (!labels[res.branch]) {
              labels.last++;
              labels[res.branch] = "label" + labels.last;
            }
            res.code = wrapAs("JSR", "op") + " " + wrapAs(labels[res.branch], "lbl");
          }
          return res;
        }
        default: {
          logger(offset, "Unknown instruction: " + aa.toString(16));
          return {size: 0, terminal: true};
        }
      }
    }
    default: {
      var va = DCPU.disassembleValue(aa, memory, offset + res.size, logger);
      res.size += va.size;
      var vb = DCPU.disassembleValue(bb, memory, offset + res.size, logger);
      res.size += vb.size;

      res.code = wrapAs(DCPU.bops[op - 1], "op") + " " + va.str + ", " + vb.str;
      if (op >= 0x0c && op <= 0x0f) {
        res.conditional = true;
      } else
      if (aa == 0x1c) {
        offset += res.size;
        res.terminal = true;
        if (vb.literal === undefined) {
          if (bb != 0x18) // assuming SET PC, POP - RET
            logger(offset, "(Warning) Can't predict the value of PC after " + res.code + ". Some instructions may be not disassembled.");
        } else
        switch (op) {
          case 0x1: {
            res.branch = vb.literal;
            if (!labels[res.branch]) {
              labels.last++;
              labels[res.branch] = "label" + labels.last;
            }
            res.code = wrapAs(DCPU.bops[op - 1], "op") + " " + va.str + ", " + wrapAs(labels[res.branch], "lbl");
            break;
          }
          case 0x2: { res.branch = (offset + vb.literal) & 0xffff; break; }
          case 0x3: { res.branch = (offset - vb.literal) & 0xffff; break; }
          case 0x4: { res.branch = (offset * vb.literal) & 0xffff; break; }
          case 0x5: { res.branch = parseInt(offset / vb.literal) & 0xffff; break; }
          case 0x6: { res.branch = (vb.literal == 0) ? 0 : (offset % vb.literal); break; }
          case 0x7: { res.branch = (offset << vb.literal) & 0xffff; break; }
          case 0x8: { res.branch = (offset >> vb.literal) & 0xffff; break; }
          case 0x9: { res.branch = (offset & vb.literal); break; }
          case 0xa: { res.branch = (offset | vb.literal); break; }
          case 0xb: { res.branch = (offset ^ vb.literal); break; }
        }
      }

      return res;
    }
  }
}




};