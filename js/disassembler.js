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
    0x09: "MDI",
    0x0a: "AND",
    0x0b: "BOR",
    0x0c: "XOR",
    0x0d: "SHR",
    0x0e: "ASR",
    0x0f: "SHL",
    0x10: "IFB",
    0x11: "IFC",
    0x12: "IFE",
    0x13: "IFN",
    0x14: "IFG",
    0x15: "IFA",
    0x16: "IFL",
    0x17: "IFU",
    0x1A: "ADX",
    0x1B: "SBX",
    // ...
    0x1E: "STI",
    0x1F: "STD",
  },
  OP_SPECIAL: {
    0x01: "JSR",
    // ...
    0x07: "HCF",
    0x08: "INT",
    0x09: "IAG",
    0x0a: "IAS",
    0x0b: "IAP",
    0x0c: "IAQ",
    // ...
    0x10: "HWN",
    0x11: "HWQ",
    0x12: "HWI",
  },

  address: function(n, labels) {
    if (labels[n]) return labels[n];
    return (n > 15) ? ("0x" + pad(n.toString(16), 4)) : n.toString(10);
  },

  decodeValue: function(is_a, code, immediate, labels, wrapAs) {
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
      return "[" + wrapAs("lit", this.address(immediate, labels)) + "]";
    } else if (code == 0x1f) {
      return wrapAs("lit", this.address(immediate, labels));
    } else { // embedded immediate
      return wrapAs("lit", this.address(immediate, labels));
    }
  },

  hasArg: function(code) {
    return ((code >= 0x10 && code < 0x18) || code == 0x1a || code == 0x1e || code == 0x1f);
  },

  nextOp: function(memory, offset) {
    var start = offset;
    if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
    var word = memory[offset++];
    var op = { opcode: (word & 0x1f), a: (word >> 10 & 0x3f), b: (word >> 5 & 0x1f) };
    if (this.hasArg(op.b)) {
      if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
      op.b_immediate = memory[offset++];
    }
    if (this.hasArg(op.a)) {
      if (offset >= memory.length) return { op: 0, a: 0, b: 0 };
      op.a_immediate = memory[offset++];
    }
    // go ahead and decode embedded immediates.
    if (op.a >= 0x20) op.a_immediate = (op.a == 0x20 ? 0xffff : (op.a - 0x21));
    if (op.b >= 0x20) op.b_immediate = (op.b == 0x20 ? 0xffff : (op.b - 0x21));
    op.size = offset - start;
    return op;
  },

  /**
   * Build a list of memory addresses targeted by JMP/JSR instructions.
   */
  findTargets: function(memory, offset, end) {
    var targets = [ ];
    var jsr = Assembler.OP_SPECIAL["jsr"];
    var add = Assembler.OP_BINARY["add"];
    var sub = Assembler.OP_BINARY["sub"];
    var set = Assembler.OP_BINARY["set"];
    var pc = Assembler.SPECIALS["pc"];
    while (offset < end) {
      var op = this.nextOp(memory, offset);
      var a = op.a_immediate;
      var b = op.a_immediate;

      if (op.opcode == 0 && op.b == jsr && a !== undefined) {
        targets.push(a);
      } else if (op.opcode == set && op.b == pc && a !== undefined) {
        targets.push(a);
      } else if (op.opcode == add && op.b == pc && a !== undefined) {
        targets.push(offset + op.size + a);
      } else if (op.opcode == sub && op.b == pc && a !== undefined) {
        targets.push(offset + op.size - a);
      }

      if (op.size > 1 && targets.indexOf(offset + 1) >= 0) {
        offset++;
      } else if (op.size > 2 && targets.indexOf(offset + 2) >= 0) {
        offset += 2;
      } else {
        offset += op.size;
      }
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

    // if this op would stretch into a labeled target, scrap it. it's just data.
    if ((op.size == 2 && labels[offset + 1]) ||
        (op.size == 3 && (labels[offset + 1] || labels[offset + 2]))) {
      res.size = 1;
      res.code = wrapAs("op", "DAT") + " " + wrapAs("lit", "0x" + pad(memory[offset].toString(16), 4));
      return res;
    }

    res.size = op.size;

    // for convenience, decode BRA.
    var add = Assembler.OP_BINARY["add"];
    var sub = Assembler.OP_BINARY["sub"];
    var pc = Assembler.SPECIALS["pc"];

    if (op.opcode == add && op.b == pc && op.a_immediate !== undefined) {
      res.code = wrapAs("op", "BRA") + " " + this.address(offset + op.size + op.a_immediate, labels);
      return res;
    }
    if (op.opcode == sub && op.b == pc && op.a_immediate !== undefined) {
      res.code = wrapAs("op", "BRA") + " " + this.address(offset + op.size - op.a_immediate, labels);
      return res;
    }

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
