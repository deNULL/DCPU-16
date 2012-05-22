var Fonts = {
  fontMemory: [ ],
  fontSource: [ ],

  // load font from image
  loadFont: function(filename) {
    var canvas = document.createElement('canvas');
    canvas.style.display = "none";
    document.body.appendChild(canvas);

    var charWidth = 4, charHeight = 8;
    var fontContext = canvas.getContext('2d');
    var fontImage = new Image();
    var self = this;

    fontImage.onload = function() {
      fontContext.drawImage(fontImage, 0, 0);

      for (var i = 0; i < 4; i++) {
        for (var j = 0; j < 32; j++) {
          var fontData = fontContext.getImageData(j * charWidth, i * charHeight, charWidth, charHeight);
          var charId = (i * 32) + j;
          var glyph = 0;
          for (var x = 0; x < charWidth; x++) {
            for (var y = charHeight - 1; y >= 0; y--) {
              var pixelId = y * charWidth + x;
              glyph = (glyph << 1) | ((fontData.data[pixelId * charWidth + 1] > 128) * 1);
            }
          }
          self.fontMemory[(i * 32 + j) * 2] = (glyph >> 16) & 0xffff;
          self.fontMemory[(i * 32 + j) * 2 + 1] = (glyph & 0xffff);
        }
      }

      for (var i = 0; i < 256; i += 8) {
        var line = "  dat";
        for (var j = 0; j < 8; j++) {
          line += " 0x" + pad((self.fontMemory[i + j] & 0xffff).toString(16), 4);
          if (j < 7) line += ",";
        }
        self.fontSource.push(line);
      }
    };
    fontImage.src = filename;
  },
};
