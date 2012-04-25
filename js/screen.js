// Low Energy Monitor LEM1802 (NYA_ELEKTRISKA)

var Screen = {
  type: 0x7349f615,
  revision: 0x1802,
  manufacturer: 0x1c6c8b36,

  MAP_SCREEN:   0,
  MAP_FONT:     0,
  MAP_PALETTE:  0,
  BORDER_COLOR: 0,

  DISPLAY_WIDTH: 128,
  DISPLAY_HEIGHT: 96,
  PIXEL_SIZE: 3,
  blink: true,

  defaultPalette: [
    [0x00, 0x00, 0x00, 0xff],
    [0x00, 0x00, 0xaa, 0xff],
    [0x00, 0xaa, 0x00, 0xff],
    [0x00, 0xaa, 0xaa, 0xff],
    [0xaa, 0x00, 0x00, 0xff],
    [0xaa, 0x00, 0xaa, 0xff],
    [0xaa, 0x55, 0x00, 0xff],
    [0xaa, 0xaa, 0xaa, 0xff],
    [0x55, 0x55, 0x55, 0xff],
    [0x55, 0x55, 0xff, 0xff],
    [0x55, 0xff, 0x55, 0xff],
    [0x55, 0xff, 0xff, 0xff],
    [0xff, 0x55, 0x55, 0xff],
    [0xff, 0x55, 0xff, 0xff],
    [0xff, 0xff, 0x55, 0xff],
    [0xff, 0xff, 0xff, 0xff]
  ],

  // not so much of data, we can store it right here
  defaultFont: [0x000f, 0x0808, 0x080f, 0x0808, 0x08f8, 0x0808, 0x00ff, 0x0808, 0x0808, 0x0808, 0x08ff, 0x0808, 0x00ff, 0x1414, 0xff00, 0xff08, 0x1f10, 0x1714, 0xfc04, 0xf414, 0x1710, 0x1714, 0xf404, 0xf414, 0xff00, 0xf714, 0x1414, 0x1414, 0xf700, 0xf714, 0x1417, 0x1414, 0x0f08, 0x0f08, 0x14f4, 0x1414, 0xf808, 0xf808, 0x0f08, 0x0f08, 0x001f, 0x1414, 0x00fc, 0x1414, 0xf808, 0xf808, 0xff08, 0xff08, 0x14ff, 0x1414, 0x080f, 0x0000, 0x00f8, 0x0808, 0xffff, 0xffff, 0xf0f0, 0xf0f0, 0xffff, 0x0000, 0x0000, 0xffff, 0x0f0f, 0x0f0f, 0x0000, 0x0000, 0x005f, 0x0000, 0x0300, 0x0300, 0x3e14, 0x3e00, 0x266b, 0x3200, 0x611c, 0x4300, 0x3629, 0x7650, 0x0002, 0x0100, 0x1c22, 0x4100, 0x4122, 0x1c00, 0x2a1c, 0x2a00, 0x083e, 0x0800, 0x4020, 0x0000, 0x0808, 0x0800, 0x0040, 0x0000, 0x601c, 0x0300, 0x3e41, 0x3e00, 0x427f, 0x4000, 0x6259, 0x4600, 0x2249, 0x3600, 0x0f08, 0x7f00, 0x2745, 0x3900, 0x3e49, 0x3200, 0x6119, 0x0700, 0x3649, 0x3600, 0x2649, 0x3e00, 0x0024, 0x0000, 0x4024, 0x0000, 0x0814, 0x2241, 0x1414, 0x1400, 0x4122, 0x1408, 0x0259, 0x0600, 0x3e59, 0x5e00, 0x7e09, 0x7e00, 0x7f49, 0x3600, 0x3e41, 0x2200, 0x7f41, 0x3e00, 0x7f49, 0x4100, 0x7f09, 0x0100, 0x3e49, 0x3a00, 0x7f08, 0x7f00, 0x417f, 0x4100, 0x2040, 0x3f00, 0x7f0c, 0x7300, 0x7f40, 0x4000, 0x7f06, 0x7f00, 0x7f01, 0x7e00, 0x3e41, 0x3e00, 0x7f09, 0x0600, 0x3e41, 0xbe00, 0x7f09, 0x7600, 0x2649, 0x3200, 0x017f, 0x0100, 0x7f40, 0x7f00, 0x1f60, 0x1f00, 0x7f30, 0x7f00, 0x7708, 0x7700, 0x0778, 0x0700, 0x7149, 0x4700, 0x007f, 0x4100, 0x031c, 0x6000, 0x0041, 0x7f00, 0x0201, 0x0200, 0x8080, 0x8000, 0x0001, 0x0200, 0x2454, 0x7800, 0x7f44, 0x3800, 0x3844, 0x2800, 0x3844, 0x7f00, 0x3854, 0x5800, 0x087e, 0x0900, 0x4854, 0x3c00, 0x7f04, 0x7800, 0x447d, 0x4000, 0x2040, 0x3d00, 0x7f10, 0x6c00, 0x417f, 0x4000, 0x7c18, 0x7c00, 0x7c04, 0x7800, 0x3844, 0x3800, 0x7c14, 0x0800, 0x0814, 0x7c00, 0x7c04, 0x0800, 0x4854, 0x2400, 0x043e, 0x4400, 0x3c40, 0x7c00, 0x1c60, 0x1c00, 0x7c30, 0x7c00, 0x6c10, 0x6c00, 0x4c50, 0x3c00, 0x6454, 0x4c00, 0x0836, 0x4100, 0x0077, 0x0000, 0x4136, 0x0800, 0x0201, 0x0201, 0x704c, 0x7000], // default font by Notch

  init: function() {
    this.screen = ge("screen").getContext("2d");
    this.image = this.screen.createImageData(this.DISPLAY_WIDTH * this.PIXEL_SIZE, this.DISPLAY_HEIGHT * this.PIXEL_SIZE);
    for (var i = 0; i < this.DISPLAY_WIDTH * this.PIXEL_SIZE; i++) {
      for (var j = 0; j < this.DISPLAY_HEIGHT * this.PIXEL_SIZE; j++) {
        this.image.data[(j * this.DISPLAY_WIDTH * this.PIXEL_SIZE + i) * 4 + 3] = 0xff; // set alpha
      }
    }
    //this.loadFont();
  },

  // load font from image (unused for now)
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
    fontImage.src = 'font.png';
  },

  resetFont: function(memory) {
    for (var i = 0; i < 256; i++) {
      memory[0x8180 + i] = this.defaultFont[i];
    }
  },

  update: function(memory) {
    var idx = this.MAP_SCREEN;
    if (idx == 0) {
      ge('loading_overlay').style.display = 'block';
      return;
    } else {
      if ((new Date()).getTime() - startup > 2000)
        ge('loading_overlay').style.display = 'none';
    }
    var palette = this.defaultPalette;
    if (this.MAP_PALETTE > 0) {
      palette = [];
      for (var i = 0; i < 16; i++) {
        var color = memory[(this.MAP_PALETTE + i) & 0xffff];
        palette.push([
          ((color >> 8) & 0xf) << 4,
          ((color >> 4) & 0xf) << 4,
          ((color)      & 0xf) << 4,
          0xff
        ]);
      }
    }
    var line_size = (32 * 4 * this.PIXEL_SIZE * 4);
    for (var y = 0; y < 12; y++) {
      for (var x = 0; x < 32; x++) {
        var v = memory[idx & 0xffff];
        var fc = palette[(v >> 12) & 0xf];
        var bc = palette[(v >> 8) & 0xf];
        var cd = (v & 0x7f) << 1;
        var bt0 = memory[(this.MAP_FONT + cd) & 0xffff];
        var bt1 = memory[(this.MAP_FONT + cd + 1) & 0xffff];
        var b = (v >> 7) & 1;

        for (var ax = 0; ax < 4; ax++) {
          var byte = 0;
          if (!b || !this.blink) {
            switch (ax) {
              case 0: byte = bt0 >> 8; break;
              case 1: byte = bt0 & 0xff; break;
              case 2: byte = bt1 >> 8; break;
              case 3: byte = bt1 & 0xff; break;
            }
          }
          var xbase = ((x << 2) + ax) * this.PIXEL_SIZE;
          for (var ay = 0; ay < 8; ay++) {
            var color = (byte & 1) ? fc : bc;
            var ybase = ((y << 3) + ay) * this.PIXEL_SIZE;
            for (var i = 0; i < this.PIXEL_SIZE; i++) {
              for (var j = 0; j < this.PIXEL_SIZE; j++) {
                var pos = (ybase + j) * line_size + ((xbase + i) << 2);
                this.image.data[pos] = color[0];
                this.image.data[pos + 1] = color[1];
                this.image.data[pos + 2] = color[2];
              }
            }
            byte >>= 1;
          }
        }

        idx++;
      }
    }
    this.screen.putImageData(this.image, 0, 0);

    var back_color = palette[this.BORDER_COLOR];
    ge('screen').style.backgroundColor = '#' + pad(back_color[0].toString(16), 2) + pad(back_color[1].toString(16), 2) + pad(back_color[2].toString(16), 2);
  },

  interrupt: function(memory, registers) {
    switch (registers.A) {
      case 0: { // MEM_MAP_SCREEN
        this.MAP_SCREEN =   registers.B || 0;
        break;
      }
      case 1: { // MEM_MAP_FONT
        this.MAP_FONT =     registers.B || 0;
        break;
      }
      case 2: { // MEM_MAP_PALETTE
        this.MAP_PALETTE =  registers.B || 0;
        break;
      }
      case 3: { // SET_BORDER_COLOR
        this.BORDER_COLOR = registers.B & 0xf;
        break;
      }
    }
    return 0;
  },
};
