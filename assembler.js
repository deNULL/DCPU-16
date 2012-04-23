/*
 *  DCPU-16 Assembler & Emulator Library
 *  by deNULL (me@denull.ru)
 */

var Assembler = {
  REGISTERS: [ "a", "b", "c", "x", "y", "z", "i", "j" ],
  SPECIALS: [ "pop", "peek", "push", "sp", "pc", "o" ],
  BINARY: { '*': 2, '/': 2, '%': 2, '+': 1, '-': 1 },

  /*
   * parser state is passed around in a "state" object:
   *   - text: line of text
   *   - pos: current index into text
   *   - logger: function(pos, message, fatal) for reporting errors
   * index & offset are only tracked so they can be passed to logger for error reporting.
   */

  /**
   * parse a single atom and return either: literal, register, or label
   */
  parseAtom: function(state) {
    var text = state.text;
    var pos = state.pos;
    var logger = state.logger;

    while (pos < text.length && text.charAt(pos).match(/\s/)) pos++;
    if (pos >= text.length) {
      logger(pos, "Value expected (operand or expression)", true);
      return false;
    }

    var atom = {};

    if (text.charAt(pos) == '(') {
      state.pos = pos;
      atom = this.parseExpression(state, 0);
      if (!atom) return false;
      pos = atom.state.pos;
      while (pos < text.length && text.charAt(pos).match(/\s/)) pos++;
      if (pos >= text.length || text.charAt(pos) != ')') {
        logger(pos, "Missing ) on expression", true);
        return false;
      }
      atom.state.pos = pos + 1;
    } else {
      var operand = text.substr(pos).match(/^[A-Za-z_.0-9]/);
      if (!operand) {
        logger(pos, "Operand value expected", true);
        return false;
      }
      operand = operand[0].toLowerCase();
      pos += operand.length;
      if (operand.match(/^[0-9]+$/g)) {
        atom.literal = parseInt(operand, 10);
      } else if (operand.match(/^0x[0-9a-fA-F]+$/g)) {
        atom.literal = parseInt(operand, 16);
      } else if (this.REGISTERS.indexOf(operand) > -1) {
        atom.register = thes.REGISTERS.indexOf(operand);
      } else if (this.SPECIALS.indexOf(operand) > -1) {
        logger(pos, "You can't use " + operand.toUpperCase() + " in expressions.", true);
        return false;
      } else if (operand.match(/^[a-zA-Z_.][a-zA-Z_.0-9]*$/)) {
        atom.label = operand;
      }
      atom.state = { text: text, pos: pos, logger: logger };
    }
    return atom;
  },

  parseUnary: function(state) {
    if (state.text.charAt(state.pos) == '-' || state.text.charAt(state.pos) == '+') {
      var op = state.text.charAt(state.pos);
      state.pos++;
      var expr = this.parseAtom(state);
      if (!expr) return false;
      return { unary: op, right: expr, state: expr.state };
    } else {
      return this.parseAtom(state);
    }
  },

  /**
   * Parse an expression and return a parse tree. The parse tree nodes will contain one of:
   *   - binary (left, right)
   *   - unary (right)
   *   - literal
   *   - register
   *   - label
   */
  parseExpression: function(state, precedence) {
    var text = state.text;
    var pos = state.pos;
    var logger = state.logger;

    while (pos < text.length && text.charAt(pos).match(/\s/)) pos++;
    if (pos >= text.length) {
      logger(pos, "Expression expected", true);
      return false;
    }
    var left = this.parseUnary(state);
    if (!left) return false;
    pos = left.state.pos;

    while (true) {
      while (pos < text.length && text.charAt(pos).match(/\s/)) pos++;
      if (pos == text.length) return left;

      var newprec = this.BINARY[text.charAt(pos)];
      if (newprec === undefined) {
        logger(pos, "Unknown operator (try: + - * / %)", true);
        return false;
      }
      if (newprec <= precedence) return left;
      var op = text.charAt(pos);
      state.pos = pos + 1;
      var right = this.parseExpression(state, newprec);
      if (!right) return false;
      left = { binary: op, left: left, right: right, state: right.state };
      pos = left.state.pos;
    }
  },

  /**
   * Given a parsed expression tree, evaluate into a literal number.
   * Label references are looked up in 'labels'. Any register reference, or reference to a label
   * that's not in 'labels' will be an error.
   */
  evalConstant: function(expr, labels) {
    var logger = expr.state.logger;
    var pos = expr.state.pos;
    if (expr.literal !== undefined) {
      return expr.literal;
    } else if (expr.label !== undefined) {
      var value = labels[expr.label];
      if (value === undefined) {
        logger(pos, "Unresolvable reference to '" + expr.label + "'", true);
        return false;
      }
    } else if (expr.register !== undefined) {
      logger(pos, "Constant expressions may not contain register references", true);
      return true;
    } else if (expr.unary !== undefined) {
      var value = this.evalConstant(expr.right, labels);
      if (!value) return false;
      switch (expr.unary) {
        case '-': return -value;
        default: return value;
      }
    } else if (expr.binary !== undefined) {
      var left = this.evalConstant(expr.left, labels);
      if (!left) return false;
      var right = this.evalConstant(expr.right, labels);
      if (!right) return false;
      switch (expr.binary) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        default: {
          logger(pos, "Internal error (undefined binary operator)", true);
          return false
        }
      }
    } else {
      logger(pos, "Internal error (undefined expression type)", true);
      return false;
    }
  },

  /*
   * Parse given expression containing GP registers, literals, labels, operations +, -, * and parentheses
   *
   * Returns object with fields:
   *   literal: int word (or)
   *     register: int index (or)
   *     operation: string (+/-/*) + operands: array (or)
   *     label: string
   *   end: int
   */
  parseExpression: function(index, offset, expr, pos, labels, logger) {
    var res = false;
    while (pos < expr.length) {
      var operation = false;

      // read binary operation
      if (res) {
        while (pos < expr.length && expr.charAt(pos) == ' ') pos++;
        if (pos >= expr.length) break;

        if (expr.charAt(pos) == ')') {
          res.end = pos + 1;
          return res;
        } else if (expr.charAt(pos) == '+' || expr.charAt(pos) == '-' || expr.charAt(pos) == '*') {
          operation = expr.charAt(pos);
        } else {
          logger(index, offset, "Only three operations are accepted in expressions: +, - and *", true);
          return false;
        }
        pos++;
      }

      // read unary operation
      while (pos < expr.length && expr.charAt(pos) == ' ') pos++;
      if (pos >= expr.length) {
        logger(index, offset, "Value expected before end of line", true);
        return false;
      }
      var unary = false;
      if (expr.charAt(pos) == '-' || expr.charAt(pos) == '+') {
        unary = expr.charAt(pos);
        pos++;
      }

      // read next operand
      while (pos < expr.length && expr.charAt(pos) == ' ') pos++;
      if (pos >= expr.length) {
        logger(index, offset, "Value expected before end of line", true);
        return false;
      }
      var value = {};
      if (expr.charAt(pos) == '(') {
        value = this.parseExpression(index, offset, expr, pos + 1, labels, logger);
        if (value) {
          pos = value.end;
        } else {
          return false;
        }
      } else {
        var operand = "";
        while (pos < expr.length && " +-*/()[],".indexOf(expr.charAt(pos)) == -1) { // TODO: inverse condition
          operand += expr.charAt(pos);
          pos++;
        }
        if (operand == "$") {
          value.literal = offset;
        } else if (operand.match(/^[0-9]+$/g)) {
          value.literal = parseInt(operand, 10);
        } else if (operand.match(/^0x[0-9a-fA-F]+$/g)) {
          value.literal = parseInt(operand, 16);
        } else if (DCPU.regs.indexOf(operand.toUpperCase()) > -1) {
          value.register = DCPU.regs.indexOf(operand.toUpperCase());
        } else if (DCPU.add_vals.indexOf(operand.toUpperCase()) > -1) {
          logger(index, offset, "You can not use " + operand + " in expressions", true);
          return false;
        } else if (operand.match(/^[a-zA-Z_.][a-zA-Z_.0-9]*$/)) {
          value.label = operand.toLowerCase();
          if (labels) {
            logger(index, offset, "Labels[" + value.label + ": " + labels[value.label]);
            if (labels[value.label] !== undefined) {
              value.literal = labels[value.label];
            } else {
              logger(index, offset, "Invalid value: " + operand, true);
              return false;
            }
          } else {
            // first pass -- we'll fill in labels on the 2nd pass.
            value.incomplete = true;
          }
        } else {
          logger(index, offset, "Invalid value: " + operand, true);
          return false;
        }
      }

      // first, apply optional `unary` to `value` (it has highest priority)
      if (unary == '-') {
        if (value.literal !== false) {
          value.literal = -value.literal;
        } else {
          value = {operation: 'U-', operands: [value]};
        }
      }

      if (res) { // okay, now we have left part in res, operation, and right part as value
        if (operation == '*' && (res.operation == '+' || res.operation == '-')) {
          res.operands[1] = {operation: operation, operands: [res.operands[1], value]};
        } else
        if (operation == '-') {
          res = {operation: '+', operands: [res, {operation: 'U-', operands: [value]}]};
        } else {
          res = {operation: operation, operands: [res, value]};
        }
      } else { // first value
        res = value;
      }
    }

    if (!res) {
      logger(index, offset, "Value expected", true);
      return false;
    }
    res.end = pos;
    return res;
  },

  /*
   * Evaluates expression (if it's possible)
   */
  simplifyExpression: function(expr) {
    if (!expr) return expr;

    var incomplete = false;
    for (var i in expr.operands) {
      expr.operands[i] = this.simplifyExpression(expr.operands[i]);
      if (expr.operands[i].incomplete) incomplete = true;
    }
    switch (expr.operation) {
      case 'U-': { // unary minus
        if (expr.operands[0].literal !== undefined) {
          return { literal: -expr.operands[0].literal, incomplete: incomplete };
        }
        return expr;
      }
      case '-': {
        if ((expr.operands[0].literal !== undefined || expr.operands[0].incomplete) &&
            (expr.operands[1].literal !== undefined || expr.operands[1].incomplete)) {
          return { literal: expr.operands[0].literal - expr.operands[1].literal, incomplete: incomplete };
        }
        return expr;
      }
      case '+': {
        if ((expr.operands[0].literal !== undefined || expr.operands[0].incomplete) &&
            (expr.operands[1].literal !== undefined || expr.operands[1].incomplete)) {
          return { literal: expr.operands[0].literal + expr.operands[1].literal, incomplete: incomplete };
        }
        return expr;
      }
      case '*': {
        if ((expr.operands[0].literal !== undefined || expr.operands[0].incomplete) &&
            (expr.operands[1].literal !== undefined || expr.operands[1].incomplete)) {
          return { literal: expr.operands[0].literal * expr.operands[1].literal, incomplete: incomplete };
        }
        return expr;
      }
    }
    return expr;
  },

  resolveExpression: function(index, offset, expr, pos, labels, logger) {
    var value = this.parseExpression(index, offset, expr, 0, labels, logger);
    if (!value) return false;
    return this.simplifyExpression(value);
  },

  /**
   * Parse any constant in this line and place it into the labels map if we found one.
   * Returns true if this line did contain some constant definition (even if it was an error),
   * meaning you shouldn't bother compiling this line.
   */
  parseConstant: function(index, offset, text, labels, logger) {
    text = text.trim();
    if (!text.match(/^[a-z_.][a-z_.0-9]*\s*=/)) return false;
    var equal = text.indexOf("=");
    var name = text.substr(0, equal).trim().toLowerCase();
    var value = this.resolveExpression(index, offset, text.substr(equal + 1).trim(), 0, labels, logger);
    if (value.literal === undefined) {
      logger(index, offset, "Can't resolve constant expression.", true);
    } else {
      labels[name] = value.literal;
    }
    return true;
  },

  /*
   * Parse a line of code:
   *   - index = line number
   *   - offset = current address
   * Returns the parsed line:
   *   - label (if any)
   *   - op (if any)
   *   - args (array)
   */
  parseLine: function(index, offset, text, logger) {
    var line = { };
    text = text.trim();
    if (text.length == 0) return line;

    if (text.charAt(0) == ":") {
      // label
      var label_end = text.indexOf(" ");
      if (label_end < 0) label_end = text.length;
      line.label = text.substr(1, label_end - 1).toLowerCase();
      text = text.substr(label_end).trim();
      if (line.label.length == 0) {
        logger(index, offset, "Missing label");
        line.label = false;
      } else if (!line.label.match(/^[a-z_.][a-z_.0-9]*$/)) {
        logger(index, offset, "Label name must contain only latin characters, underscore, dot or digits. Ignoring \"" + line.label + "\"");
        line.label = false;
      }
    }

    if (text.length == 0 || text.charAt(0) == ".") return line;
    var op_end = text.indexOf(" ");
    if (op_end < 0) op_end = text.length;
    line.op = text.substr(0, op_end).toUpperCase();
    text = text.substr(op_end).trim();

    var args = [ "" ];
    var n = 0;
    in_string = false;
    for (var i = 0; i < text.length; i++) {
      if (text.charAt(i) == '\\' && i < text.length - 1) {
        args[n] += text.charAt(i);
      } else if (text.charAt(i) == '"') {
        in_string = !in_string;
        args[n] += text.charAt(i);
      } else if (text.charAt(i) == ',' && !in_string) {
        args.push("");
        n += 1;
      } else if (in_string || text.charAt(i) != ' ') {
        args[n] += text.charAt(i);
      }
    }
    if (in_string) {
      logger(index, offset, "Expected '\"' before end of line", true);
      return false;
    }
    line.args = args;
    return line;
  },

  unquoteString: function(s) {
    var rv = "";
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) == '\\' && i < s.length - 1) {
        i += 1;
        switch (s.charAt(i)) {
          case 'n': { rv += "\n"; break; }
          case 'r': { rv += "\r"; break; }
          case 't': { rv += "\t"; break; }
          case 'x': {
            if (i < s.length - 2) {
              rv += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16));
              i += 2;
            } else {
              rv += "\\x";
            }
            break;
          }
          default: { rv += "\\" + s.charAt(i); break; }
        }
      } else {
        rv += s.charAt(i);
      }
    }
    return rv;
  },

  /*
   * Parse line of code:
   *   - index = line number
   *   - offset = current address
   * These two params will be passed to logger in case of some error, along with error message.
   * Labels can be either label-to-address array or just false if addresses are not yet known
   *
   * Returns object with fields:
   *   op, size, dump (array of words)
   */
  compileLine: function(index, offset, text, labels, logger) {
    var line = this.parseLine(index, offset, text, logger);
    if (!line) return false;
    var info = { op: line.op, size: 0, dump: [] };
  },
}