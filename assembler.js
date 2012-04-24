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
   *   - end: parsing should not continue past end
   *   - logger: function(pos, message, fatal) for reporting errors
   * index & offset are only tracked so they can be passed to logger for error reporting.
   */

  /**
   * parse a single atom and return either: literal, register, or label
   */
  parseAtom: function(state) {
    var text = state.text;
    var pos = state.pos;
    var end = state.end;
    var logger = state.logger;

    while (pos < end && text.charAt(pos).match(/\s/)) pos++;
    if (pos == end) {
      logger(pos, "Value expected (operand or expression)", true);
      return false;
    }

    var atom = { loc: pos };

    if (text.charAt(pos) == '(') {
      state.pos = pos + 1;
      atom = this.parseExpression(state, 0);
      if (!atom) return false;
      pos = atom.state.pos;
      while (pos < end && text.charAt(pos).match(/\s/)) pos++;
      if (pos == end || text.charAt(pos) != ')') {
        logger(pos, "Missing ) on expression", true);
        return false;
      }
      atom.state.pos = pos + 1;
    } else {
      var operand = text.substr(pos, end - pos).match(/^[A-Za-z_.0-9]+/);
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
        atom.register = this.REGISTERS.indexOf(operand);
      } else if (this.SPECIALS.indexOf(operand) > -1) {
        logger(pos, "You can't use " + operand.toUpperCase() + " in expressions.", true);
        return false;
      } else if (operand.match(/^[a-zA-Z_.][a-zA-Z_.0-9]*$/)) {
        atom.label = operand;
      }
      atom.state = { text: text, pos: pos, end: end, logger: logger };
    }
    return atom;
  },

  parseUnary: function(state) {
    if (state.pos < state.end &&
        (state.text.charAt(state.pos) == '-' || state.text.charAt(state.pos) == '+')) {
      var loc = state.pos;
      var op = state.text.charAt(state.pos);
      state.pos++;
      var expr = this.parseAtom(state);
      if (!expr) return false;
      return { unary: op, right: expr, state: expr.state, loc: loc };
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
    var end = state.end;
    var logger = state.logger;

    while (pos < end && text.charAt(pos).match(/\s/)) pos++;
    if (pos == end) {
      logger(pos, "Expression expected", true);
      return false;
    }
    var left = this.parseUnary(state);
    if (!left) return false;
    pos = left.state.pos;

    while (true) {
      while (pos < end && text.charAt(pos).match(/\s/)) pos++;
      if (pos == end || text.charAt(pos) == ')') return left;

      var newprec = this.BINARY[text.charAt(pos)];
      if (newprec === undefined) {
        logger(pos, "Unknown operator (try: + - * / %)", true);
        return false;
      }
      if (newprec <= precedence) return left;
      var op = text.charAt(pos);
      var loc = pos;
      state.pos = pos + 1;
      var right = this.parseExpression(state, newprec);
      if (!right) return false;
      left = { binary: op, left: left, right: right, state: right.state, loc: loc };
      pos = left.state.pos;
    }
  },

  /**
   * Convert an expression tree from 'parseExpression' into a human-friendly string form, for
   * debugging.
   */
  expressionToString: function(expr) {
    if (expr.literal !== undefined) {
      return expr.literal.toString();
    } else if (expr.label !== undefined) {
      return expr.label;
    } else if (expr.register !== undefined) {
      return this.REGISTERS[expr.register];
    } else if (expr.unary !== undefined) {
      return "(" + expr.unary + this.expressionToString(expr.right) + ")";
    } else if (expr.binary !== undefined) {
      return "(" + this.expressionToString(expr.left) + " " + expr.binary + " " +
        this.expressionToString(expr.right) + ")";
    } else {
      return "ERROR";
    }
  },

  /**
   * Given a parsed expression tree, evaluate into a literal number.
   * Label references are looked up in 'labels'. Any register reference, or reference to a label
   * that's not in 'labels' will be an error.
   */
  evalConstant: function(expr, labels, fatal) {
    var logger = expr.state.logger;
    var pos = expr.state.pos;
    var value;
    if (expr.literal !== undefined) {
      value = expr.literal;
    } else if (expr.label !== undefined) {
      value = labels[expr.label];
      if (value === undefined) {
        if (fatal) logger(expr.loc, "Unresolvable reference to '" + expr.label + "'", true);
        return false;
      }
    } else if (expr.register !== undefined) {
      logger(expr.loc, "Constant expressions may not contain register references", true);
      return false;
    } else if (expr.unary !== undefined) {
      value = this.evalConstant(expr.right, labels, fatal);
      if (!value) return false;
      switch (expr.unary) {
        case '-': { value = -value; break; }
        default: break;
      }
    } else if (expr.binary !== undefined) {
      var left = this.evalConstant(expr.left, labels, fatal);
      if (!left) return false;
      var right = this.evalConstant(expr.right, labels, fatal);
      if (!right) return false;
      switch (expr.binary) {
        case '+': { value = left + right; break; }
        case '-': { value = left - right; break; }
        case '*': { value = left * right; break; }
        case '/': { value = left / right; break; }
        case '%': { value = left % right; break; }
        default: {
          logger(expr.loc, "Internal error (undefined binary operator)", true);
          return false;
        }
      }
    } else {
      logger(expr.loc, "Internal error (undefined expression type)", true);
      return false;
    }
    if (value < 0 || value > 0xffff) {
      logger(pos, "(Warning) Literal value " + value.toString(16) + " will be truncated to " + (value & 0xffff).toString(16));
      value = value & 0xffff;
    }
    return value;
  },

  /**
   * Parse any constant in this line and place it into the labels map if we found one.
   * Returns true if this line did contain some constant definition (even if it was an error),
   * meaning you shouldn't bother compiling this line.
   */
  parseConstant: function(text, labels, logger) {
    var match = text.match(/^\s*([A-Za-z_.][A-Za-z0-9_.]*)\s*=\s*(\S+)/);
    if (!match) return false;
    var name = match[1].toLowerCase();
    if (this.REGISTERS[name] !== undefined || this.SPECIALS[name] !== undefined) {
      logger(0, name + " is a reserved word and can't be used as a constant.", true);
      return true;
    }
    // manually find position of expression, for displaying nice error messages.
    var pos = text.indexOf('=') + 1;
    while (text.charAt(pos).match(/\s/)) pos++;
    var state = { text: text, pos: pos, end: text.length, logger: logger };
    var expr = this.parseExpression(state, 0);
    if (expr) {
      var value = this.evalConstant(expr, labels, true);
      if (value) labels[name] = value;
    }
    return true;
  },

  /*
   * Parse a line of code.
   * Returns the parsed line:
   *   - label (if any)
   *   - op (if any)
   *   - args (array): any operands, in text form
   *   - arg_locs (array): positions of the operands within the text
   *   - arg_ends (array): positions of the end of operands within the text
   */
  parseLine: function(text, logger) {
    var pos = 0;
    var end = text.length;
    var line = { text: text, pos: pos, end: end };

    while (pos < end && text.charAt(pos).match(/\s/)) pos++;
    if (pos == end) return line;

    if (text.charAt(pos) == ":") {
      // label
      pos++;
      line.label = text.substr(pos, end - pos).match(/^[a-z_.][a-z_.0-9]*/);
      if (!line.label || line.label[0].length == 0) {
        logger(pos, "Label name must contain only latin characters, underscore, dot or digits.", true);
        return false;
      }
      line.label = line.label[0].toLowerCase();
      pos += line.label.length;
    }

    while (pos < end && text.charAt(pos).match(/\s/)) pos++;
    if (pos == end) return line;

    line.op = text.substr(pos, end - pos).match(/\S+/)[0].toLowerCase();
    pos += line.op.length;

    var args = [ "" ];
    var arg_locs = [ -1 ];
    var arg_ends = [ -1 ];
    var n = 0;
    in_string = false;
    for (var i = pos; i < end; i++) {
      if (text.charAt(i) == '\\' && i + 1 < end) {
        if (arg_locs[n] == -1) arg_locs[n] = i;
        args[n] += text.charAt(i);
      } else if (text.charAt(i) == '"') {
        in_string = !in_string;
        args[n] += text.charAt(i);
      } else if (text.charAt(i) == ',' && !in_string) {
        arg_ends[n] = i;
        args.push("");
        arg_locs.push(-1);
        arg_ends.push(-1);
        n += 1;
      } else if (in_string || text.charAt(i) != ' ') {
        if (arg_locs[n] == -1) arg_locs[n] = i;
        args[n] += text.charAt(i);
      }
    }
    arg_ends[n] = i;
    if (in_string) {
      logger(pos, "Expected '\"' before end of line", true);
      return false;
    }
    line.args = args;
    line.arg_locs = arg_locs;
    line.arg_ends = arg_ends;
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

  parseArgExpression: function(line, i, logger) {
    var state = { text: line.text, pos: line.arg_locs[i], end: line.arg_ends[i], logger: logger };
    return this.parseExpression(state, 0);
  },

  handleData: function(info, line, labels, logger) {
    var args = line.args;
    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
      if (arg.length == 0) continue;
      if (arg.charAt(0) == '"') {
        arg = this.unquoteString(arg.substr(1, arg.length - 2));
        for (var j = 0; j < arg.length; j++) {
          info.size++;
          info.dump.push(arg.charCodeAt(j));
        }
      } else {
        var expr = this.parseArgExpression(line, i, logger);
        if (!expr) return false;
        var value = this.evalConstant(expr, labels, true);
        if (!value) return false;
        info.size++;
        info.dump.push(value);
      }
    }
    return info;
  },

  /*
   * Compile a line of code:
   *
   * Returns object with fields:
   *   op, size, dump (array of words)
   */
  compileLine: function(text, labels, logger) {
    var line = this.parseLine(text, logger);
    if (!line) return false;
    var info = { op: line.op, size: 0, dump: [] };

    if (info.op == "dat") {
      return this.handleData(info, line, labels, logger);
    }
    if (info.op == "org") {
      if (line.args.length != 1) {
        logger(0, "ORG requires a single value", true);
         return false;
      }
      var expr = this.parseArgExpression(line, 0, logger);
      if (!expr) return false;
      var value = this.evalConstant(expr, labels, true);
      if (!value) return false;
      info.org = value;
      return info;
    }

    // common aliases
    if (info.op == "jmp") {
      info.op = "set";
      line.args.unshift("pc");
      line.arg_locs.unshift(0);
      line.arg_ends.unshift(0);
    } else if (info.op == "brk") {
      info.op = "sub";
      line.args = [ "pc", "1" ];
      line.arg_locs = [ 0, 0 ];
      line.arg_ends = [ 0, 0 ];
    } else if (info.op == "ret") {
      info.op = "set";
      line.args = [ "pc", "pop" ];
      line.arg_locs = [ 0, 0 ];
      line.arg_ends = [ 0, 0 ];
    }

  },
}