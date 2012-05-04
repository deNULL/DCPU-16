// Generic Clock (compatible)

var Clock = {
  type: 0x12d0b402,
  revision: 1,
  manufacturer: 0x904b3115,

  SET_FREQUENCY: 0,
  GET_TICKS: 1,
  SET_INT: 2,

  reset: function(queueInterrupt) {
    if (queueInterrupt) {
      this.queueInterrupt = queueInterrupt;
    }
    // heartbeat: # of msec between clock ticks
    this.heartbeat = 0;
    this.ticks = 0;
  },

  start: function() {
    this.stop();
    var self = this;
    this.timer = setInterval(function() { self.tick(self); }, 2);
    this.last = new Date().getTime();
  },

  stop: function() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  },

  tick: function(self) {
    if (!self.heartbeat) return;
    var now = new Date().getTime();
    while (now - self.last >= self.heartbeat) {
      self.ticks++;
      if (self.message) {
        self.queueInterrupt(function(memory, registers, state, hardware) {
          registers.A = self.message;
        });
      }
      self.last += self.heartbeat;
    }
  },

  interrupt: function(memory, registers) {
    switch (registers.A) {
      case this.SET_FREQUENCY: {
        this.reset();
        this.heartbeat = 100 * registers.B / 6;
        break;
      }
      case this.GET_TICKS: {
        registers.C = this.ticks;
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
