/*
 *  DCPU-16 Assembler & Emulator Library
 *  by deNULL (me@denull.ru)
 */

var Disassembler = {
  REGISTERS: [ "A", "B", "C", "X", "Y", "Z", "I", "J" ],
  SPECIALS: {
    0x18: "PUSH",
    0x19: "PEEK",
    0x1a: "PICK",
    0x1b: "SP",
    0x1c: "PC",
    0x1d: "EX"
  },
  OP_BINARY: {
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
    0x1A: "ADX",
    0x1B: "SUX"
  },
  OP_SPECIAL: {
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

  decodeValue: function(is_a, code, immediate, labels, wrapAs) {
    var label = labels[immediate];
    if (label === undefined && immediate !== undefined) {
      label = "0x" + pad(immediate.toString(16), 4);
    }
    if (code < 0x08) {
      return wrapAs("reg", this.REGISTERS[code]);
    } else if (code < 0x10) {
      return "[" + wrapAs("reg", this.REGISTERS[code - 0x08]) + "]";
    } else if (code < 0x18) {
      return "[" + wrapAs("reg", this.REGISTERS[code - 0x10]) + "+" +
        wrapAs("lit", "0x" + pad(immediate.toString(16), 4)) + "]";
    } else if (code == 0x18) {
      return wrapAs("kw", is_a ? "PUSH" : "POP");
    } else if (code == 0x1a) {
      return wrapAs("kw", "PICK") + " " + wrapAs("lit", immediate.toString(10));
    } else if (code < 0x1e) {
      return wrapAs("kw", this.SPECIALS[code]);
    } else if (code == 0x1e) {
      return "[" + wrapAs("lit", label) + "]";
    } else if (code == 0x1f) {
      return wrapAs("lit", label);
    } else {
      var value = (code == 0x20) ? 0xffff : (code - 0x21);
      var label = labels[value];
      if (label === undefined) label = (code == 0x20) ? "-1" : value.toString(10);
      return wrapAs("lit", label);
    }
  },

  hasImmediate: function(code) {
    return ((code >= 0x10 && code < 0x18) || code == 0x1a || code == 0x1e || code == 0x1f);
  },

  nextOp: function(memory, offset) {
    var start = offset;
    if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
    var word = memory[offset++];
    var op = { opcode: (word & 0x1f), a: (word >> 10 & 0x3f), b: (word >> 5 & 0x1f) };
    if (this.hasImmediate(op.b)) {
      if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
      op.b_immediate = memory[offset++];
    }
    if (this.hasImmediate(op.a)) {
      if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
      op.a_immediate = memory[offset++];
    }
    op.size = offset - start;
    return op;
  },

  /**
   * Build a list of memory addresses targeted by JMP/JSR instructions.
   */
  findTargets: function(memory, offset, end) {
    var targets = [ ];
    var jsr = Assembler.OP_SPECIAL["jsr"];
    var set = Assembler.OP_BINARY["set"];
    var pc = Assembler.SPECIALS["pc"];
    while (offset < end) {
      var op = this.nextOp(memory, offset);
      if (op.opcode == 0 && op.b == jsr && op.a_immediate !== undefined) {
        targets.push(op.a_immediate);
      } else if (op.opcode == 0 && op.b == jsr && op.a >= 0x20) {
        targets.push(op.a == 0x20 ? 0xffff : (op.a - 0x21));
      } else if (op.opcode == set && op.b == pc && op.a_immediate !== undefined) {
        targets.push(op.a_immediate);
      } else if (op.opcode == set && op.b == pc && op.a >= 0x20) {
        targets.push(op.a == 0x20 ? 0xffff : (op.a - 0x21));
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
    var va = this.decodeValue(true, op.a, op.a_immediate, labels, wrapAs);
    var vb = this.decodeValue(false, op.b, op.b_immediate, labels, wrapAs);

    if (op.opcode == 0) {
      // special
      var code = this.OP_SPECIAL[op.b];
      if (code === undefined) code = "???";
      res.code = wrapAs("op", code) + " " + va;
    } else {
      var code = this.OP_BINARY[op.opcode];
      if (code === undefined) code = "???";
      res.code = wrapAs("op", code) + " " + vb + ", " + va;
      if (op.opcode >= 0x10 && op.opcode <= 0x17) {
        res.conditional = true;
      }
    }
    return res;
  },
};
