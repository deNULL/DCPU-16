var Screen = {
  DISPLAY_WIDTH: 128,
  DISPLAY_HEIGHT: 96,

  palette: [
    0x000000, 0x0000a8, 0x00a800, 0x00a8a8,
    0xa80000, 0xa800a8, 0xa8a800, 0xa8a8a8,
    0x545454, 0x5454Fc, 0x54Fc54, 0x54Fcfc,
    0xFc5454, 0xFc54Fc, 0xFcFc54, 0xFfFfFf
  ],

  init: function() {
    this.frameBuffer = new Uint32Array(128 * 96);
    this.font = [];
    this.screen = document.getElementById("screen").getContext("2d");
    this.screenImageData = this.screen.createImageData(128, 96);
    this.loadFont();
  },

  // load font from image
  loadFont: function() {
    var charWidth = 4, charHeight = 8;
    var fontCanvas = document.getElementById('fontCanvas');
    var fontCtx = fontCanvas.getContext('2d');
    var fontImage = new Image();
    var self = this;
    fontImage.onload = function() {
      fontCtx.drawImage(fontImage, 0, 0);
      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 32; j++) {
          var fontData = fontCtx.getImageData(j * charWidth, i * charHeight, charWidth, charHeight), charId = (i * 32) + j;
          var glyph = 0;
          for (var y = charHeight - 1; y >= 0; y--) {
            var row = 0;
            for (var x = 0; x < charWidth; x++) {
              var pixelId = y * charWidth + x;
              row = (row << 1) | ((fontData.data[pixelId * charWidth + 1] > 128) * 1);
            }
            glyph = (glyph << 4) | row;
          }
          self.font[i * 32 + j] = glyph;
        }
      }
    };
    fontImage.src = '/font.png';
  },

  clear: function() {
    for (var i = 0; i < this.frameBuffer.length; i++) {
      this.frameBuffer[i] = 0;
    }
  },

  copyFramebufferToScreen: function() {
    var idx = 0;
    var src = 0;
    for (var i = 0; i < 96; i++) {
      for (var j = 0; j < 128; j++) {
        var pixel = this.frameBuffer[src++] & 0x0f;
        var color = this.palette[pixel];
        this.screenImageData.data[idx++] = (color >> 16) & 0xff;
        this.screenImageData.data[idx++] = (color >> 8) & 0xff;
        this.screenImageData.data[idx++] = (color) & 0xff;
        this.screenImageData.data[idx++] = 0xff;
      }
    }
    this.screen.putImageData(this.screenImageData, 0, 0);
  },

  writeChar: function(y, x, c, fg, bg) {
    var bits = this.font[c];
    var topLeft = y * 8 * 128 + x * 4 + 4;
    for (var ty = 0; ty < 8; ty++) {
      var walk = topLeft + ty * 128;
      for (var tx = 0; tx < 4; tx++) {
        this.frameBuffer[--walk] = ((bits & 1) != 1) ? bg : fg;
        bits = bits >> 1;
      }
    }
  },

  updateText: function(memory) {
    var idx = 0x8000;
    for (var y = 0; y < 12; y++) {
      for (var x = 0; x < 32; x++) {
        var v = memory[idx];
        var fc = (v >> 12) & 0xf;
        var bc = (v >> 8) & 0xf;
        var cd = (v & 0x7f);
        var b = (v >> 7) & 1;
        if (!v) v = 0x0;
        if (fc == 0 && bc == 0) fc = 0xf;
        this.writeChar(y, x, cd, fc, bc);
        idx++;
      }
    }
  },

  update: function(memory) {
    this.clear();
    this.updateText(memory);
    this.copyFramebufferToScreen();
  },  
};
