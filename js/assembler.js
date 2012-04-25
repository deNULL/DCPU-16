/*
 *  DCPU-16 Assembler & Emulator Library
 *  by deNULL (me@denull.ru)
 */

var Assembler = {
  DIRECTIVES: [ "macro", "define" ],
  REGISTERS: {
    "a": 0, "b": 1, "c": 2, "x": 3, "y": 4, "z": 5, "i": 6, "j": 7 },
  SPECIALS: {
    "push": 0x18,
    "pop":  0x18,
    "peek": 0x19,
    "pick": 0x1a,
    "sp":   0x1b,
    "pc":   0x1c,
    "o":    0x1d, // deprecated
    "ex":   0x1d
  },
  BINARY: { '*': 2, '/': 2, '%': 2, '+': 1, '-': 1 },

  OP_BINARY:   {
    "set": 0x01,
    "add": 0x02,
    "sub": 0x03,
    "mul": 0x04,
    "mli": 0x05,
    "div": 0x06,
    "dvi": 0x07,
    "mod": 0x08,
    "and": 0x09,
    "bor": 0x0a,
    "xor": 0x0b,
    "shr": 0x0c,
    "asr": 0x0d,
    "shl": 0x0e,
    "mvi": 0x0f,
    "ifb": 0x10,
    "ifc": 0x11,
    "ife": 0x12,
    "ifn": 0x13,
    "ifg": 0x14,
    "ifa": 0x15,
    "ifl": 0x16,
    "ifu": 0x17,
    // ...
    "adx": 0x1a,
    "sux": 0x1b
  },
  OP_SPECIAL: {
    "jsr": 0x01,
    // ...
    "int": 0x08,
    "iag": 0x09,
    "ias": 0x0a,
    // ...
    "hwn": 0x10,
    "hwq": 0x11,
    "hwi": 0x12
  },
  OP_RESERVED: [ "set", "add", "sub", "mul", "mli", "div", "dvi", "mod",
                 "and", "bor", "xor", "shr", "asr", "shl", "mvi",
                 "ifb", "ifc", "ife", "ifn", "ifg", "ifa", "ifl", "ifu",
                 "adx", "sux",
                 "jsr", "int", "iag", "ias", "hwn", "hwq", "hwi",
                 "jmp", "brk", "ret", "bra", "dat", "org" ],

  SPACE: { ' ': true, '\n': true, '\r': true, '\t': true }, // to replace charAt(pos).match(/\s/), using regexps is very slow

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
    var subst = state.subst;
    var logger = state.logger;

    while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
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
      while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
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
      if (subst[operand]) {
        operand = subst[operand];
      }
      pos += operand.length;
      if (operand.match(/^[0-9]+$/g)) {
        atom.literal = parseInt(operand, 10);
      } else if (operand.match(/^0x[0-9a-fA-F]+$/g)) {
        atom.literal = parseInt(operand, 16);
      } else if (this.REGISTERS[operand] !== undefined) {
        atom.register = this.REGISTERS[operand];
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

    while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
    if (pos == end) {
      logger(pos, "Expression expected", true);
      return false;
    }
    var left = this.parseUnary(state);
    if (!left) return false;
    pos = left.state.pos;

    while (true) {
      while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
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
      if (this.SPECIALS[expr.label] !== undefined) {
        logger(pos, "You can't use " + expr.label.toUpperCase() + " in expressions.", true);
        return false;
      }
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
      if (value === false) return false;
      switch (expr.unary) {
        case '-': { value = -value; break; }
        default: break;
      }
    } else if (expr.binary !== undefined) {
      var left = this.evalConstant(expr.left, labels, fatal);
      if (left === false) return false;
      var right = this.evalConstant(expr.right, labels, fatal);
      if (right === false) return false;
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
    if (labels[name]) logger(0, "Duplicate label \"" + name + "\"");

    // manually find position of expression, for displaying nice error messages.
    var pos = text.indexOf('=') + 1;
    while (this.SPACE[text.charAt(pos)]) pos++;
    var state = { text: text, pos: pos, end: text.length, logger: logger };
    var expr = this.parseExpression(state, 0);
    if (expr) {
      var value = this.evalConstant(expr, labels, true);
      if (value !== false) labels[name] = value;
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
  parseLine: function(text, macros, subst, logger) {
    var pos = 0;
    var end = text.length;
    var line = { text: text, pos: pos, end: end, args: [] };

    // strip comments so we don't have to worry about them
    var in_string = false;
    for (var i = 0; i < text.length; i++) {
      if (in_string && text.charAt(i) == '\\' && i < text.length - 1) {
        i++;
      } else
      if (text.charAt(i) == '"') {
        in_string = !in_string;
      } else
      if (text.charAt(i) == ';' && !in_string) {
        end = i;
        break;
      }
    }

    while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
    if (pos >= end) return line;

    if (text.charAt(pos) == ":") {
      // label
      pos++;
      line.label = text.substr(pos, end - pos).match(/^[a-zA-Z_.][a-zA-Z_.0-9]*/);
      if (!line.label || line.label[0].length == 0) {
        logger(pos, "Label name must contain only latin characters, underscore, dot or digits.", true);
        return false;
      }
      line.label = line.label[0].toLowerCase();
      pos += line.label.length;
    }

    while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
    if (pos >= end) return line;

    if (text.charAt(pos) == "#") {
      // directive
      pos++;
      line.directive = text.substr(pos, end - pos).match(/^[a-zA-Z]*/);
      if (!line.directive || this.DIRECTIVES.indexOf(line.directive[0].toLowerCase()) < 0) {
        logger(pos, "Unknown directive: #" + line.directive[0], true);
        return false;
      }
      line.directive = line.directive[0].toLowerCase();
      pos += line.directive.length;

      while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
      if (pos >= end) return line;

      if (line.directive == "macro") {
        // #macro directive
        line.macro = text.substr(pos, end - pos).match(/^[^ (]*/);
        if (!line.macro || line.macro[0].length == 0 || this.OP_RESERVED.indexOf(line.macro[0].toLowerCase()) > -1) {
          logger(pos, "Invalid macro name: " + line.macro[0], true);
          return false;
        }
        line.macro = line.macro[0].toLowerCase();
        pos += line.macro.length;

        while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
        while (pos < end && this.SPACE[text.charAt(end - 1)]) end--;
        if (text.charAt(end - 1) == "{") {
          line.start_block = true;
          end--;
        }
        while (pos < end && this.SPACE[text.charAt(end - 1)]) end--;
        if (text.charAt(pos) == "(" && text.charAt(end - 1) == ")") {
          pos++;
          end--;
        }
        if (pos >= end) return line;

        line.macro_params = text.substr(pos, end - pos).split(",");
        for (var i = 0; i < line.macro_params.length; i++) {
          line.macro_params[i] = line.macro_params[i].trim().toLowerCase();
        }
        if (line.macro_params.length > 0 && line.macro_params[0] == "") {
          line.macro_params.pop();
        }
        return line;
      } else
      if (line.directive == "define") {
        line.define = text.substr(pos, end - pos).match(/^[a-zA-Z_.][a-zA-Z_.0-9]*/);
        if (!line.define || line.define[0].length == 0) {
          logger(pos, "#define name must contain only latin characters, underscore, dot or digits.", true);
          return false;
        }
        line.define = line.define[0].toLowerCase();
        pos += line.define.length;
        while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
        if (pos >= end) return line;
      }
    } else {
      if (text.charAt(pos) == "{") {
        line.start_block = true;
        pos++;
      }
      if (text.charAt(pos) == "}") {
        line.end_block = true;
        pos++;
      }
      while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
      if (pos >= end) return line;

      var word = text.substr(pos, end - pos).match(/^[^ (]+/);
      if (!word) {
        logger(pos, "Inscrutable opcode", true);
        return false;
      }
      line.op = word[0].toLowerCase();
      pos += line.op.length;

      while (pos < end && this.SPACE[text.charAt(pos)]) pos++;
      while (pos < end && this.SPACE[text.charAt(end - 1)]) end--;
      if (subst[line.op] !== undefined) {
        line.op = subst[line.op];
      }
      var macro_nm = macros[line.op];
      if (macro_nm && macro_nm.length) {
        if (pos < end - 1 && text.charAt(pos) == '(' && text.charAt(end - 1) == ')') {
          pos++;
          end--;
        }
      }
    }

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
      } else if (text.charAt(i) == ';' && !in_string) {
        break;
      } else if (in_string || text.charAt(i) != ' ') {
        if (arg_locs[n] == -1) arg_locs[n] = i;
        args[n] += text.charAt(i);
      }
    }
    if (args[n] == "") {
      args.pop();
      arg_locs.pop();
      arg_ends.pop();
      n--;
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

  stateFromArg: function(is_a, line, i, subst, logger) {
    return { text: line.text, is_a: is_a, pos: line.arg_locs[i], end: line.arg_ends[i], subst: subst, logger: logger };
  },

  handleData: function(info, line, labels, subst, logger) {
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
        var expr = this.parseExpression(this.stateFromArg(true, line, i, subst, logger), 0);
        if (!expr) return false;
        var value = this.evalConstant(expr, labels, true);
        if (value === false) return false;
        info.size++;
        info.dump.push(value);
      }
    }
    return info;
  },

  /**
   * Parse an operand expression into:
   *   - code: 5-bit value for the operand in an opcode
   *   - immediate: (optional) if the opcode has an immediate word attached
   *   - expr: if the operand expression can't be evaluated yet (needs to wait for the 2nd pass)
   * If 'short' is set in state, then the operand must fit into the opcode.
   */
  parseOperand: function(state, labels) {
    var text = state.text;
    var pos = state.pos;
    var end = state.end;
    var logger = state.logger;
    var is_a = state.is_a;
    var info = { };

    var pointer = false;
    if (state.text.charAt(state.pos) == '[') {
      if (state.pos + 2 >= state.end || state.text.charAt(state.end - 1) != ']') {
        logger(state.pos, "Missing ']'", true);
        return false;
      }
      pointer = true;
      state.pos++;
      state.end--;
    }

    var pick = false;
    if (end - pos >= 4 && state.text.substr(pos, 4).toLowerCase() == "pick") {
      pick = true;
      state.pos += 4;
      while (state.pos < state.end && this.SPACE[state.text.charAt(state.pos)]) state.pos++;
    }

    var expr = this.parseExpression(state);
    if (!expr) return false;

    // simple cases: register, special mode, PICK n
    if (pick) {
      var value = this.evalConstant(expr, labels, false);
      info.code = 0x1a;
      if (value !== false) {
        info.immediate = value;
      } else {
        info.immediate = 0;
        info.expr = expr;
      }
      return info;
    }
    if (expr.register !== undefined) {
      info.code = (pointer ? 0x08 : 0x00) + expr.register;
      return info;
    }
    if (expr.label !== undefined && this.SPECIALS[expr.label] !== undefined ) {
      if (pointer) {
        logger(state.pos, "You can't use a pointer to " + expr.label, true);
        return false;
      }
      if ((is_a && expr.label == "push") || (!is_a && expr.label == "pop")) {
        logger(state.pos, "You can't use " + wrapAs(expr.label.toUpperCase(), "kw") + " here", true);
        return false;
      }
      info.code = this.SPECIALS[expr.label];
      return info;
    }

    // special case: [literal + register]
    if (pointer && expr.binary !== undefined &&
        (expr.left.register !== undefined || expr.right.register !== undefined)) {
      if (expr.binary != '+') {
        logger(state.pos, "Only a sum of a value + register is allowed");
        return false;
      }
      if (expr.left.register !== undefined) {
        // switch the register to the right side
        var swap = expr.left;
        expr.left = expr.right;
        expr.right = swap;
      }
      info.code = 0x10 + expr.right.register;
      var address = this.evalConstant(expr.left, labels, false);
      if (address !== false) {
        info.immediate = address;
      } else {
        info.immediate = 0;
        info.expr = expr.left;
      }
      return info;
    }

    // try resolving the expression if we can
    var value = state.delay_eval ? false : this.evalConstant(expr, labels, false);
    if (value !== false) {
      if (!pointer && (value == 0xffff || value < 31) && is_a) {
        info.code = 0x20 + (value == 0xffff ? 0x00 : (0x01 + value));
      } else {
        info.code = (pointer ? 0x1e : 0x1f);
        info.immediate = value;
      }
    } else {
      // save it for the second pass.
      if (state.short) {
        info.code = 0;
        info.short = true;
        info.expr = expr;
      } else {
        info.code = (pointer ? 0x1e : 0x1f);
        info.immediate = 0;
        info.expr = expr;
      }
    }
    return info;
  },

  /**
   * Called during the 2nd pass: resolve any unresolved expressions, or blow up.
   */
  resolveOperand: function(info, labels, logger) {
    var value = this.evalConstant(info.expr, labels, true);
    if (value === false) return false;
    if (info.short) {
      if (value >= 32) {
        logger(0, "Operand must be < 32", true);
        return false;
      }
      info.code = 0x20 + value;
    } else {
      info.immediate = value;
    }
    info.expr = undefined;
    return info;
  },

  /*
   * Compile a line of code. If either operand can't be resolved yet, it will have an 'expr' field.
   * The size will already be computed in any case.
   *
   * Returns object with fields:
   *   op, size, dump (array of words), a, b
   */
  compileLine: function(text, org, labels, macros, subst, logger) {
    var line = this.parseLine(text, macros, subst, logger);
    if (!line) return false;
    var info = { op: line.op, size: 0, dump: [] };

    if (macros[" "]) {
      if (line.end_block) {
        macros[" "] = false;
      } else {
        macros[" "].lines.push(text);
      }
      return info;
    }

    if (line.label) labels[line.label] = org;

    if (line.macro) {
      macros[" "] = {lines: [], params: []};
      if (line.macro_params) {
        for (var i = 0; i < line.macro_params.length; i++) {
          macros[" "].params.push(line.macro_params[i]);
        }
      }

      macros[line.macro + "(" + macros[" "].params.length + ")"] = macros[" "];
      if (!macros[line.macro]) macros[line.macro] = [];
      macros[line.macro].push(macros[" "].params.length);
      return info;
    }

    if (line.define) {
      if (line.args.length != 1) {
        logger(0, "#define requires a single value", true);
        return false;
      }
      var expr = this.parseExpression(this.stateFromArg(true, line, 0, subst, logger), 0);
      if (!expr) return false;
      var value = this.evalConstant(expr, labels, true);
      if (value === false) return false;
      labels[line.define] = value;
      return info;
    }

    if (info.op === undefined) {
      return info;
    }
    if (macros[info.op]) {
      if (macros[info.op].indexOf(line.args.length) < 0) {
        logger(0, "Macro '" + info.op.toLowerCase() + "' supports " + macros[info.op].join("/") + " arguments, received " + line.args.length, true);
        return false;
      }
      var macro = macros[info.op.toLowerCase() + "(" + line.args.length + ")"];

      var macro_subst = {};
      for (var i = 0; i < macro.params.length; i++) { // build substitutes
        macro_subst[macro.params[i]] = line.args[i];
      }
      for (var i = 0; i < macro.lines.length; i++) {
        var macro_info = this.compileLine(macro.lines[i], org, labels, macros, macro_subst, logger);
        if (!macro_info) {
          return false; // error is already printed
        }
        info.size += macro_info.size;
        for (var j = 0; j < macro_info.dump.length; j++) {
          info.dump.push(macro_info.dump[j]);
        }
      }
      return info;
    }
    if (info.op == "dat") {
      return this.handleData(info, line, labels, subst, logger);
    }
    if (info.op == "org") {
      if (line.args.length != 1) {
        logger(0, "ORG requires a single value", true);
        return false;
      }
      var expr = this.parseExpression(this.stateFromArg(true, line, 0, subst, logger), 0);
      if (!expr) return false;
      var value = this.evalConstant(expr, labels, true);
      if (value === false) return false;
      info.org = value;
      if (line.label) labels[line.label] = org;
      return info;
    }

    // common aliases
    if (info.op == "jmp" && line.args.length == 1) {
      info.op = "set";
      // sneaky: overwrite the "jmp" with "pc" so it can be parsed out later.
      line.text = "pc " + line.text.substr(3);
      line.args.push("pc");
      line.arg_locs.push(0);
      line.arg_ends.push(2);
      return this.compileLine("set pc, " + line.args[0], org, labels, macros, subst, logger);
    } else if (info.op == "brk") {
      return this.compileLine("sub pc, 1", org, labels, macros, subst, logger);
    } else if (info.op == "ret") {
      return this.compileLine("set pc, pop", org, labels, macros, subst, logger);
    }

    var opcode, a, b;
    if (this.OP_BINARY[info.op]) {
      if (line.args.length != 2) {
        logger(0, "Basic instruction " + wrapAs(info.op.toUpperCase(), "op") + " requires 2 values", true);
        return false;
      }
      opcode = this.OP_BINARY[info.op];
      a = this.parseOperand(this.stateFromArg(true, line, 1, subst, logger), labels);
      b = this.parseOperand(this.stateFromArg(false, line, 0, subst, logger), labels);
    } else {
      if (this.OP_SPECIAL[info.op]) {
        if (line.args.length != 1) {
          logger(0, "Non-basic instruction " + wrapAs(info.op.toUpperCase(), "op") + " requires 1 value", true);
          return false;
        }
        opcode = 0;
        a = this.parseOperand(this.stateFromArg(true, line, 0, subst, logger), labels);
        b = { code: this.OP_SPECIAL[info.op] };
      } else {
        if (info.op == "bra") {
          var state = this.stateFromArg(true, line, 0, subst, logger);
          state.short = true;
          state.delay_eval = true;
          opcode = 0;
          a = this.parseOperand(state, labels);
          if (!a) return false;
          b = { code: this.SPECIALS["pc"] };
          // we'll compute the branch on the 2nd pass.
          info.branch_from = org + 1;
        } else {
          logger(0, "Unknown instruction: " + wrapAs(info.op.toUpperCase(), "op"), true);
          return false;
        }
      }
    }

    if (!a || !b) return false;
    info.size = 1 + (a.immediate !== undefined ? 1 : 0) + (b.immediate !== undefined ? 1 : 0);
    info.dump.push((a.code << 10) | (b.code << 5) | opcode);
    if (b.immediate !== undefined) info.dump.push(b.immediate);
    if (a.immediate !== undefined) info.dump.push(a.immediate);
    info.a = a;
    info.b = b;
    return info;
  },

  resolveLine: function(info, labels, logger) {
    var index = 1;
    if (info.branch_from) {
      // finally resolve relative branch
      info.a.short = false;
      var dest = this.resolveOperand(info.a, labels, logger);
      if (!dest) return false;
      var offset = info.branch_from - dest.immediate;
      if (offset < -30 || offset > 30) {
        logger(0, "Branch can't move this far away (limit: 30 words)", true);
        return false;
      }
      if (offset < 0) {
        opcode = this.OP_BINARY["add"];
        offset = -offset;
      } else {
        opcode = this.OP_BINARY["sub"];
      }
      info.dump[0] = ((offset + 0x21) << 10) | (info.b.code << 5) | opcode;
      return info;
    }
    if (info.b !== undefined) {
      if (info.b.expr !== undefined) {
        var b = this.resolveOperand(info.b, labels, logger);
        if (!b) return false;
        info.b = b;
        if (b.immediate !== undefined) info.dump[index] = b.immediate;
      }
      if (info.b.immediate !== undefined) index++;
    }
    if (info.a !== undefined) {
      if (info.a.expr !== undefined) {
        var a = this.resolveOperand(info.a, labels, logger);
        if (!a) return false;
        info.a = a;
        if (a.immediate !== undefined) info.dump[index] = a.immediate;
      }
      if (info.a.immediate !== undefined) index++;
    }
    return info;
  },

  /**
   * Compile a list of lines of code.
   *   - lines: array of strings, lines of DCPU assembly to compile
   *   - memory: array of DCPU memory to fill in with compiled code
   *   - logger: (line#, address, line_pos, text, fatal) function to collect warnings/errors
   * If successful, returns:
   *   - infos: opcode info per line
   */
  compile: function(lines, memory, logger) {
    var labels = { };
    var aborted = false;
    var pc = 0;
    var infos = [ ];
    var macros = { };

    for (var i = 0; i < lines.length && !aborted; i++) {
      var l_logger = function(pos, text, fatal) {
        logger(i, pc, pos, text, fatal);
        if (fatal) aborted = true;
      };
      labels["."] = pc;
      if (!this.parseConstant(lines[i], labels, l_logger)) {
        var info = this.compileLine(lines[i], pc, labels, macros, {}, l_logger);
        if (!info) break;
        if (pc + info.size > 0xffff) {
          l_logger(0, "Code is too big (exceeds 128 KB) &mdash; not enough memory", true);
          break;
        } else if (pc + info.size > 0x8000) {
          l_logger(0, "Code is too big (exceeds 64 KB) &mdash; overlaps video memory");
        }
        if (info.org !== undefined) {
          pc = info.org;
          info.pc = pc;
        } else {
          info.pc = pc;
          pc += info.size;
        }
        infos[i] = info;
      }
    }
    if (aborted) return false;

    // second pass -- resolve any leftover addresses:
    for (var i = 0; i < lines.length && !aborted; i++) {
      if (infos[i] === undefined) continue;
      var l_logger = function(pos, text, fatal) {
        logger(i, pc, pos, text, fatal);
        if (fatal) aborted = true;
      };
      infos[i] = this.resolveLine(infos[i], labels, l_logger);
      if (!infos[i]) break;
      for (var j = 0; j < infos[i].dump.length; j++) {
        memory[infos[i].pc + j] = infos[i].dump[j];
      }
    }
    if (aborted) return false;

    return { infos: infos };
  },
}
