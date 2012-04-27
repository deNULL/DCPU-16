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
      return wrapAs("kw", is_a ? "POP" : "PUSH");
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
    if (offset >= memory.length) return false;
    var word = memory[offset++];
    var op = { opcode: (word & 0x1f), a: (word >> 10 & 0x3f), b: (word >> 5 & 0x1f) };
    if (this.hasArg(op.b)) {
      if (offset >= memory.length) return false;
      op.b_immediate = memory[offset++];
    }
    if (this.hasArg(op.a)) {
      if (offset >= memory.length) return false;
      op.a_immediate = memory[offset++];
    }
    // go ahead and decode embedded immediates.
    if (op.a >= 0x20) op.a_immediate = (op.a == 0x20 ? 0xffff : (op.a - 0x21));
    if (op.b >= 0x20) op.b_immediate = (op.b == 0x20 ? 0xffff : (op.b - 0x21));
    op.size = offset - start;
    return op;
  },

  /**
   * Disassemble a single operation in memory at the specified offset.
   * Returns:
   *   - code: string for displaying
   *   - conditional: if this is a conditional op
   *   - terminal: if this is a terminal op (any instuctions after it are unreachable and should be treated as data)
   *   - branch: new possible target
   *   - size: # of words consumed
   */
  disassemble: function(memory, offset, labels, wrapAs, logger) {
    var res = { };
    var op = this.nextOp(memory, offset);
    if (!op) {
      logger(offset, "Disassembler reached end of the file");
      return {size: 0, terminal: true};
    }

    res.size = op.size;

    var va = this.decodeValue(true, op.a, op.a_immediate, labels, wrapAs);
    var vb = this.decodeValue(false, op.b, op.b_immediate, labels, wrapAs);

    // BRA pseudo-opcode is very convinient, but we want disassembled code to as compatible as possible

    if (op.opcode == 0) {
      // special
      var code = this.OP_SPECIAL[op.b];
      if (code === undefined) {
        logger(offset, "Unknown non-basic instruction: " + op.opcode.toString(16));

        // again, for compatability purposes, decode unknown instructions as DATs (and add a comment)
        res.code = wrapAs("op", "DAT") + " ";
        for (var i = 0; i < op.size; i++) {
          res.code += "0x" + pad(memory[offset + i].toString(16), 4) + (i < op.size - 1 ? ", " : "");
        }
        res.code += "  ; " + wrapAs("op", "???") + " " + va;
      } else {
        res.code = wrapAs("op", code) + " " + va;
      }
      switch (op.b) {
        case 0x01:   // JSR
        case 0x0a: { // IAS
          if (op.a_immediate !== undefined) {
            res.branch = op.a_immediate;
            if (!labels[res.branch]) {
              labels.last++;
              labels[res.branch] = (op.b == 0x0a ? "int_handler" : "subroutine") + labels.last;
            }
            res.code = wrapAs("op", code) + " " + wrapAs("lbl", labels[res.branch]);
          }
          return res;
        }
      }
    } else {
      var code = this.OP_BINARY[op.opcode];
      if (code === undefined) {
        logger(offset, "Unknown basic instruction: " + op.opcode.toString(16));

        // again, for compatability purposes, decode unknown instructions as DATs (and add a comment)
        res.code = wrapAs("op", "DAT") + " ";
        for (var i = 0; i < op.size; i++) {
          res.code += "0x" + pad(memory[offset + i].toString(16), 4) + (i < op.size - 1 ? ", " : "");
        }
        res.code += "  ; " + wrapAs("op", "???") + " " + vb + ", " + va;
      } else {
        res.code = wrapAs("op", code) + " " + vb + ", " + va;
      }
      if (op.opcode >= 0x10 && op.opcode <= 0x17) {
        res.conditional = true;
      } else
      if (op.b == 0x1c) { // PC
        offset += res.size;
        res.terminal = true;
        if (op.a_immediate === undefined) {
          if (op.a != 0x18) // assuming SET PC, POP - RET
            logger(offset, "(Warning) Can't predict the value of PC after " + res.code + ". Some instructions may be not disassembled.");
        } else
        switch (op.opcode) {
          case 0x01:
          case 0x0f: {
            res.branch = op.a_immediate;
            if (!labels[res.branch]) {
              labels.last++;
              labels[res.branch] = "label" + labels.last;
            }
            res.code = wrapAs("op", code) + " " + vb + ", " + wrapAs("lbl", labels[res.branch]);
            break;
          }
          case 0x02: { res.branch = (offset + op.a_immediate) & 0xffff; break; }
          case 0x03: { res.branch = (offset - op.a_immediate) & 0xffff; break; }
          case 0x04: { res.branch = (offset * op.a_immediate) & 0xffff; break; }
          case 0x05: { res.branch = (DCPU.extendSign(offset) * DCPU.extendSign(op.a_immediate)) & 0xffff; break; }
          case 0x06: { res.branch = parseInt(offset / op.a_immediate) & 0xffff; break; }
          case 0x07: { res.branch = parseInt(DCPU.extendSign(offset) / DCPU.extendSign(op.a_immediate)) & 0xffff; break; }
          case 0x08: { res.branch = (op.a_immediate == 0) ? 0 : (offset % va.literal); break; }
          case 0x09: { res.branch = (offset & op.a_immediate); break; }
          case 0x0a: { res.branch = (offset | op.a_immediate); break; }
          case 0x0b: { res.branch = (offset ^ op.a_immediate); break; }
          case 0x0c: { res.branch = (offset >>> op.a_immediate) & 0xffff; break; }
          case 0x0d: { res.branch = (DCPU.extendSign(offset) >> op.a_immediate) & 0xffff; break; }
          case 0x0e: { res.branch = (offset << op.a_immediate) & 0xffff; break; }
          case 0x1a: { res.branch = (offset + op.a_immediate) & 0xffff; break; }
          case 0x1b: { res.branch = (offset - op.a_immediate) & 0xffff; break; }
        }
      }
    }
    return res;
  },
};
