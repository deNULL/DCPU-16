// Generic Keyboard (compatible)

var Keyboard = {
  type: 0x30cf7406,
  revision: 1,
  manufacturer: 0x904b3115,

  CLEAR_BUFFER: 0,
  GET_KEY: 1,
  SCAN_KEYBOARD: 2,
  SET_INT: 3,

  BS: 0x10,
  ENTER: 0x11,
  INSERT: 0x12,
  DELETE: 0x13,
  UP: 0x80,
  DOWN: 0x81,
  LEFT: 0x82,
  RIGHT: 0x83,
  SHIFT: 0x90,
  CONTROL: 0X91,

  JS: {
    BS: 8,
    ENTER: 13,
    SHIFT: 16,
    CONTROL: 17,
    SPACE: 32,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
//    INSERT: 45,
 //   DELETE: 46,
  },

  init: function() {
    this.buffer = [ ];
    this.shift_down = false;
    this.control_down = false;
    this.translate = { };
    this.translate[this.JS.BS] = this.BS;
    this.translate[this.JS.ENTER] = this.ENTER;
    this.translate[this.JS.INSERT] = this.INSERT;
    this.translate[this.JS.DELETE] = this.DELETE;
    this.translate[this.JS.UP] = this.UP;
    this.translate[this.JS.DOWN] = this.DOWN;
    this.translate[this.JS.LEFT] = this.LEFT;
    this.translate[this.JS.RIGHT] = this.RIGHT;
  },

  onkeydown: function(event) {
    var code = window.event ? event.keyCode : event.which;
    switch (code) {
      case this.JS.SHIFT: {
        this.shift_down = true;
        return true;
      }
      case this.JS.CONTROL: {
        this.control_down = true;
        return true;
      }
    }
    // have to intercept BS or chrome will do something weird.
    if (code == this.JS.BS || code == this.JS.UP || code == this.JS.DOWN ||
        code == this.JS.LEFT || code == this.JS.RIGHT || code == this.JS.SPACE) {
      this.onkeypress(event);
      return false;
    }
    return true;
  },

  onkeypress: function(event) {
    var code = window.event ? event.keyCode : event.which;
    if (this.translate[code]) {
      code = this.translate[code];
    } else if (code < 0x20 || code > 0x7e) {
      // ignore
      return;
    }
    this.buffer.push(code);
    // small 8-character buffer
    if (this.buffer.length > 8) this.buffer.shift();
    // keychar = String.fromCharCode(keynum);
  },

  onkeyup: function(event) {
    var code = window.event ? event.keyCode : event.which;
    switch (code) {
      case this.JS.SHIFT: {
        this.shift_down = false;
        break;
      }
      case this.JS.CONTROL: {
        this.control_down = false;
        break;
      }
    }
  },

  interrupt: function(memory, registers) {
    switch (registers.A) {
      case this.CLEAR_BUFFER: {
        this.buffer = [ ];
        break;
      }
      case this.GET_KEY: {
        var key = this.buffer.shift();
        registers.C = (key === undefined) ? 0 : key;
        break;
      }
      case this.SCAN_KEYBOARD: {
        // FIXME
        break;
      }
      case this.SET_INT: {
        // FIXME
        break;
      }
    }
    return 0;
  },
};

/*
Interrupts do different things depending on contents of the A register:

 A | BEHAVIOR
---+----------------------------------------------------------------------------
 0 | Clear keyboard buffer
 1 | Store next key typed in C register, or 0 if the buffer is empty
 2 | Set C register to 1 if the key specified by the B register is pressed, or
   | 0 if it's not pressed
 3 | If register B is non-zero, turn on interrupts with message B. If B is zero,
   | disable interrupts
---+----------------------------------------------------------------------------

When interrupts are enabled, the keyboard will trigger an interrupt when one or
more keys have been pressed, released, or typed.
*/
