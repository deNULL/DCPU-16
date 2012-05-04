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
  CONTROL: 0x91,

  JS: {
    BS: 8,
    ENTER: 13,
    SHIFT: 16,
    CONTROL: 17,
    ESCAPE: 27,
    SPACE: 32,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    INSERT: 45,
    DELETE: 46,
  },

  init: function() {
    this.buffer = [ ];
    this.shift_down = false;
    this.control_down = false;
    this.message = 0;
    this.pressed = { };
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

  trigger: function(queueInterrupt) {
    var self = this;
    if (self.message) {
      queueInterrupt(function(memory, registers, state, hardware) {
        registers.A = self.message;
      });
    }
  },

  send: function(keycode, queueInterrupt) {
    this.buffer.push(keycode);
    // small 8-character buffer:
    if (this.buffer.length > 8) this.buffer.shift();
    this.trigger(queueInterrupt);
  },

  onkeydown: function(event, queueInterrupt) {
    var code = window.event ? event.keyCode : event.which;
    switch (code) {
      case this.JS.SHIFT: {
        this.pressed[this.SHIFT] = true;
        this.trigger(queueInterrupt);
        return true;
      }
      case this.JS.CONTROL: {
        this.pressed[this.CONTROL] = true;
        this.trigger(queueInterrupt);
        return true;
      }
    }
    this.pressed[this.translate[code]] = true;
    this.trigger(queueInterrupt);
    // have to intercept BS & SPACE or chrome will do something weird.
    switch (code) {
      case this.JS.BS: {
        this.send(this.BS, queueInterrupt);
        return false;
      }
      case this.JS.ENTER: {
        this.send(this.ENTER, queueInterrupt);
        return false;
      }
    }
    return true;
  },

  onkeypress: function(event, queueInterrupt) {
    var code = window.event ? event.keyCode : event.which;
    if (code < 0x20 || code > 0x7e) {
      // ignore
      return;
    }
    this.send(code, queueInterrupt);
    return;
  },

  onkeyup: function(event, queueInterrupt) {
    var code = window.event ? event.keyCode : event.which;
    switch (code) {
      case this.JS.SHIFT: {
        this.pressed[this.SHIFT] = false;
        this.trigger(queueInterrupt);
        return true;
      }
      case this.JS.CONTROL: {
        this.pressed[this.CONTROL] = false;
        this.trigger(queueInterrupt);
        return true;
      }
    }
    this.pressed[this.translate[code]] = false;
    switch (code) {
      case this.JS.UP: {
        this.send(this.UP, queueInterrupt);
        break;
      }
      case this.JS.DOWN: {
        this.send(this.DOWN, queueInterrupt);
        break;
      }
      case this.JS.LEFT: {
        this.send(this.LEFT, queueInterrupt);
        break;
      }
      case this.JS.RIGHT: {
        this.send(this.RIGHT, queueInterrupt);
        break;
      }
      case this.JS.INSERT: {
        this.send(this.INSERT, queueInterrupt);
        break;
      }
      case this.JS.DELETE: {
        this.send(this.DELETE, queueInterrupt);
        break;
      }
      // macs don't actually have an INSERT key, so let them use ESC.
      case this.JS.ESCAPE: {
        this.send(this.INSERT, queueInterrupt);
        break;
      }
    }
    this.trigger(queueInterrupt);
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
        registers.C = this.pressed[registers.B] ? 1 : 0;
        break;
      }
      case this.SET_INT: {
        this.message = registers.B;
        break;
      }
    }
    return 0;
  },
};
