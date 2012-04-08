/*
*  DCPU-16 Assembler & Emulator Library
*  by deNULL (me@denull.ru)
*
*/

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
    return registers[DCPU.regs[code]];
  } else
  if (code < 0x10) {
    return memory[registers[DCPU.regs[code - 0x8]]] || 0;
  } else
  if (code < 0x18) {
    var nw = memory[registers.PC];
    registers.PC = (registers.PC + 1) & 0xffff;
    DCPU.cycles++;
    return memory[(nw + registers[DCPU.regs[code - 0x10]]) & 0xffff] || 0;
  } else
  if (code == 0x18) { // POP
    var v = memory[registers.SP];
    if (!no_change) registers.SP = (registers.SP + 1) & 0xffff;
    return v;
  } else
  if (code == 0x19) { // PEEK
    return memory[registers.SP];
  } else
  if (code == 0x1a) { // PUSH
    var v = memory[(registers.SP - 1) & 0xffff];
    if (!no_change) registers.SP = (registers.SP - 1) & 0xffff;
    return v;
  } else
  if (code == 0x1b) {
    return registers.SP;
  } else
  if (code == 0x1c) {
    return registers.PC;
  } else
  if (code == 0x1d) {
    return registers.O;
  } else
  if (code == 0x1e) {
    var nw = memory[registers.PC];
    DCPU.cycles++;
    registers.PC = (registers.PC + 1) & 0xffff;
    return memory[nw];
  } else
  if (code == 0x1f) {
    var nw = memory[registers.PC];
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
  registers.PC = (registers.PC + 1) & 0xffff;
  DCPU.getValue(aa, memory, registers, true);
  DCPU.getValue(bb, memory, registers, true);
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
        DCPU.setValue(aa, parseInt(av / bv) & 0xffff, memory, copy, registers);
        registers.O = parseInt((av << 16) / bv) & 0xffff;
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
      var v = DCPU.getValue(aa, memory, registers) >> DCPU.getValue(bb, memory, registers);
      DCPU.setValue(aa, v & 0xffff, memory, copy, registers);
      registers.O = (v << 16) & 0xffff;
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
/*
* Parse given string (val) as a value
* (index - line number, offset - current address, this two params will be passed to function logger in case of some error, along with error message)
* labels can be either label-to-address array or just false if addresses are not yet known
*
* Returns object with fields:
* code, size, max_size (at the moment same as size), complete
*/
decodeValue: function(index, offset, val, labels, logger) {
  var info = {};
  if (val.length == 0) {
    logger(index, offset, "Value must not be empty", true);
    return false;
  }
  var pointer = false;
  if (val.charAt(0) == "[") {
    pointer = true;
    if (val.length < 2 || val.charAt(val.length - 1) != "]") {
      logger(index, offset, "Expected ] before end of value", true);
      return false;
    }
    val = val.substr(1, val.length - 2).trim();
  }
  info.pointer = pointer;

  // defaults
  info.size = 0;
  info.max_size = 0;
  info.complete = true;

  // register / [register]
  var reg = DCPU.regs.indexOf(val.toUpperCase());
  if (reg >= 0) {
    info.code = (pointer ? 0x08 : 0x00) + reg;
    return info;
  }
  // POP, PEEK, PUSH, SP, PC, O
  var add = DCPU.add_vals.indexOf(val.toUpperCase());
  if (add >= 0) {
    info.code = 0x18 + add;
    if (pointer) {
      logger(index, offset, "You can not use pointer to " + val, true);
      return false;
    }
    return info;
  }
  reg = -1;
  if (pointer && val.indexOf("+") >= 0) { // literal + register
    var vals = val.split("+");
    if (!vals || vals.length != 2) {
      logger(index, offset, "Sum can not contain more than 2 values", true);
      return false;
    }
    reg = DCPU.regs.indexOf(vals[0].trim().toUpperCase());
    if (reg >= 0) {
      val = vals[1].trim();
    } else {
      reg = DCPU.regs.indexOf(vals[1].trim().toUpperCase());
      if (reg >= 0) {
        val = vals[0].trim();
      } else {
        logger(index, offset, "Only sum of register and literal as value is allowed", true);
        return false;
      }
    }
  }
  var intval = -1;
  var can_be_label = !labels && val.match(/^[a-zA-Z_.][a-zA-Z_.0-9]+$/);
  var is_label = false;
  if (val.match(/^[0-9]{1,5}$/g)) {
    intval = parseInt(val, 10);
  } else
  if (val.match(/^0x[0-9a-fA-F]{1,4}$/g)) {
    intval = parseInt(val, 16);
  } else
  if (labels && labels[val.toLowerCase()] !== undefined) {
    intval = labels[val.toLowerCase()];
    is_label = true;
  }
  if ((intval >= 0 && intval < 0x10000) || can_be_label) { // literal or label [+register]
    if ((intval < 32) && !pointer && (reg == -1) && !can_be_label && !is_label) { // short form unsupported yet
      info.code = 0x20 + intval;
    } else {
      info.code = (reg > -1 ? (0x10 + reg) : (pointer ? 0x1e : 0x1f));
      info.nextword = intval;
      info.size = 1;
      info.max_size = 1;
      if (can_be_label) {
        info.min_size = 0;
        info.complete = false;
      }
    }
    info.literal = true;
    return info;
  } else
  if (reg > -1) {
    logger(index, offset, "Only sum of register and literal as value is allowed", true);
    return false;
  }

  logger(index, offset, "Unrecognized value: " + val, true);
  return false;
},

/*
* Parse line of code
* (index - line number, offset - current address, this two params will be passed to function logger in case of some error, along with error message)
* labels can be either label-to-address array or just false if addresses are not yet known
*
* Returns object with fields:
* op, size, max_size (at the moment equal to size), dump (array of words)
*/
compileLine: function(index, offset, line, labels, logger) {
  var info = {max_size: 0, size: 0, dump: []};
  var in_string = false;
  for (var i = 0; i < line.length; i++) {
    if (in_string && line.charAt(i) == '\\' && i < line.length - 1) {
      i++;
    } else
    if (line.charAt(i) == '"') {
      in_string = !in_string;
    } else
    if (line.charAt(i) == ';' && !in_string) {
      line = line.substr(0, i);
      break;
    }
  }
  line = line.replace(/\s/g, " ").trim();
  if (line.length == 0) return info;
  if (line.charAt(0) == ":") {
    line = line.substr(1).trim();
    var label_end = line.indexOf(" ");
    if (label_end < 0) label_end = line.length;
    info.label = line.substr(0, label_end).toLowerCase();
    line = line.substr(label_end).trim();
    if (info.label.length == 0) {
      if (labels)
        logger(index, offset, "Label name must not be empty");
      info.label = false;
    } else
    if (!info.label.match(/^[a-z_.][a-z_.0-9]+$/)) {
      if (labels)
        logger(index, offset, "Label name must contain only latin characters, underscore, dot or digits. Ignoring \"" + info.label + "\"");
      info.label = false;
    }
  }
  if (line.length == 0) return info;
  var op_end = line.indexOf(" ");
  if (op_end < 0) op_end = line.length;
  info.op = line.substr(0, op_end).toUpperCase();
  line = line.substr(op_end).trim();
  //var vals = line.split(/\s*,\s*/g);
  var vals = [""];
  in_string = false;
  for (var i = 0; i < line.length; i++) {
    if (line.charAt(i) == '\\' && i < line.length - 1) {
      i++;
      vals[vals.length - 1] += line.charAt(i);
    } else
    if (line.charAt(i) == '"') {
      in_string = !in_string;
      vals[vals.length - 1] += line.charAt(i);
    } else
    if (line.charAt(i) == ',' && !in_string) {
      vals.push("");
    } else
    if (in_string || line.charAt(i) != ' ') {
      vals[vals.length - 1] += line.charAt(i);
    }
  }
  if (in_string) {
    logger(index, offset, "Expected '\"' before end of line", true);
    return false;
  }

  if (info.op == "DAT") {
    for (var j = 0; j < vals.length; j++) {
      if (vals[j].length > 0) {
        if (vals[j].charAt(0) == '"') {
          if (vals[j].length < 2 || vals[j].charAt(vals[j].length - 1) != '"') {
            logger(index, offset, "Expected '\"'", true);
            return false;
          }
          vals[j] = vals[j].substr(1, vals[j].length - 2);
          for (var k = 0; k < vals[j].length; k++) {
            info.max_size++;
            info.size++;
            info.dump.push(vals[j].charCodeAt(k));
          }
        } else {
          var intval = -1;
          if (vals[j].match(/^[0-9]{1,5}$/g)) {
            intval = parseInt(vals[j], 10);
          } else
          if (vals[j].match(/^0x[0-9a-fA-F]{1,4}$/g)) {
            intval = parseInt(vals[j], 16);
          }
          if (intval < 0 || intval > 0xFFFF) {
            logger(index, offset, "Unknown literal " + vals[j], true);
            return false;
          }
          info.max_size++;
          info.size++;
          info.dump.push(intval);
        }
      }
    }
    return info;
  }

  var i = DCPU.bops.indexOf(info.op);
  var vala = {code: 0, max_size: 0, complete: true};
  var valb = {code: 0, max_size: 0, complete: true};
  var opcode = i + 1;
  if (i >= 0) {
    if (vals.length != 2) {
      logger(index, offset, "Basic instruction " + info.op + " requires 2 values, received " + vals.length, true);
      return false;
    }
    vala = DCPU.decodeValue(index, offset, vals[0], labels, logger);
    valb = DCPU.decodeValue(index, offset, vals[1], labels, logger);
    if (vala && valb && vala.literal && !vala.pointer && i < 11 && labels) {
      logger(index, offset, "(Warning) Assignment to literal " + vals[0] + " will be ignored");
    }
  } else {
    i = DCPU.nbops.indexOf(info.op);
    if (i == -1) {
      logger(index, offset, "Unknown instruction: " + info.op, true);
      return false;
    }
    if (vals.length != 1) {
      logger(index, offset, "Non-basic instruction " + info.op + " requires 1 value, received " + vals.length, true);
      return false;
    }
    opcode = 0;
    vala = {code: i + 1, max_size: 0, complete: true};
    valb = DCPU.decodeValue(index, offset, vals[0], labels, logger);
  }
  if (!vala || !valb) return false;

  info.max_size = 1 + vala.max_size + valb.max_size;
  if (vala.complete && valb.complete) {
    info.dump.push(opcode | (vala.code << 4) | (valb.code << 10));
    if (vala.nextword) {
      info.dump.push(vala.nextword);
    }
    if (valb.nextword) {
      info.dump.push(valb.nextword);
    }
  }

  return info;
}




};