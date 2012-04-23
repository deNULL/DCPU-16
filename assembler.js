/*
 *  DCPU-16 Assembler & Emulator Library
 *  by deNULL (me@denull.ru)
 */

var Assembler = {
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

}