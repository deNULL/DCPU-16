/*
 *  DCPU-16 Assembler & Emulator Library
 *  by deNULL (me@denull.ru)
 */

var Disassembler = {
  decodeValue: function(code, immediate, labels, wrapAs) {
    var label = labels[immediate];
    if (label === undefined && immediate !== undefined) {
      label = "0x" + pad(immedatie.toString(16), 4);
    }
    if (code < 0x08) {
      return wrapAs("reg", Assembler.REGISTERS[code].toUpperCase());
    } else if (code < 0x10) {
      return "[" + wrapAs("reg", Assembler.REGISTERS[code - 0x08].toUpperCase()) + "]";
    } else if (code < 0x18) {
      return "[" + wrapAs("reg", Assembler.REGISTERS[code - 0x10].toUpperCase()) + "+" +
        wrapAs("lit", "0x" + pad(immediate.toString(16), 4)) + "]";
    } else if (code < 0x1e) {
      return wrapAs("kw", Assembler.SPECIALS[code - 0x18].toUpperCase());
    } else if (code == 0x1e) {
      return "[" + wrapAs("lit", label) + "]";
    } else if (code == 0x1f) {
      return wrapAs("lit", label);
    } else {
      var value = code - 0x20;
      var label = labels[value];
      if (label === undefined) label = code.toString(10);
      return wrapAs("lit", label);
    }
  },

  nextOp: function(memory, offset) {
    var start = offset;
    if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
    var word = memory[offset++];
    var op = { opcode: (word & 0xf), a: (word >> 4 & 0x3f), b: (word >> 10 & 0x3f) };
    if ((op.a >= 0x10 && op.a < 0x18) || op.a == 0x1e || op.a == 0x1f) {
      if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
      op.a_immediate = memory[offset++];
    }
    if ((op.b >= 0x10 && op.b < 0x18) || op.b == 0x1e || op.b == 0x1f) {
      if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
      op.b_immediate = memory[offset++];
    }
    op.size = offset - start;
    return op;
  },

  /**
   * Build a list of memory addresses targeted by JMP/JSR instructions.
   */
  findTargets: function(memory, offset, end) {
    var targets = [ ];
    var jsr = Assembler.OP_SPECIAL.indexOf("jsr") + 1;
    var set = Assembler.OP_BINARY.indexOf("set") + 1;
    var pc = Assembler.SPECIALS.indexOf("pc") + 0x18;
    while (offset < end) {
      var op = this.nextOp(memory, offset);
      if (op.opcode == 0 && op.a == jsr && op.b_immediate !== undefined) {
        targets.push(op.b_immediate);
      } else if (op.opcode == 0 && op.a == jsr && op.b >= 0x20) {
        targets.push(op.b - 0x20);
      } else if (op.opcode == set && op.a == pc && op.b_immediate !== undefined) {
        targets.push(op.b_immediate);
      } else if (op.opcode == set && op.a == pc && op.b >= 0x20) {
        targets.push(op.b - 0x20);
      }
      offset += op.size;
    }
    return targets;
  },

  /**
   * Disassemble a single operation in memory at the specified offset.
   * Returns:
   *   - code: string for displaying
   *   - conditional: if this is a conditional op
   *   - size: # of words consumed
   */
  disassemble: function(memory, offset, labels, wrapAs) {
    var res = { };
    var op = this.nextOp(memory, offset);
    res.size = op.size;
    var va = this.decodeValue(op.a, op.a_immediate, labels, wrapAs);
    var vb = this.decodeValue(op.b, op.b_immediate, labels, wrapAs);

    if (op.opcode == 0) {
      // special
      var code = Assembler.OP_SPECIAL[op.a - 1];
      code = (code === undefined) ? "???" : code.toUpperCase();
      res.code = wrapAs("op", code) + " " + vb;
    } else {
      var code = Assembler.OP_BINARY[op.opcode - 1];
      code = (code === undefined) ? "???" : code.toUpperCase();
      res.code = wrapAs("op", code) + " " + va + ", " + vb;
      if (op.opcode >= 0x0c && op.opcode <= 0x0f) {
        res.conditional = true;
      }
    }
    return res;
  },
};
