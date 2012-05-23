var startup = (new Date()).getTime();
var cycles = 0;
var memory = [];
var registers = {A: 0, B: 0, C: 0, X: 0, Y: 0, Z: 0, I: 0, J: 0, PC: 0, SP: 0, EX: 0, IA: 0};
var memToLine = {};
var lineToMem = {};
var breaks = {};
var state = { interruptQueue: [ ] };
var hardware = [ Clock, Screen, Keyboard ];

function queueInterrupt(interrupt) {
  DCPU.queueInterrupt(memory, registers, state, hardware, interrupt);
};

document.onkeydown = function(event) {
  var code = window.event ? event.keyCode : event.which;
  switch (code) {
    case 116: { // F5
      run(ge("button_run"));
      return false;
    }
    case 117: { // F6
      step();
      return false;
    }
    case 27: {
      reset();
      return false;
    }
    default: { // pass it to program
      if (!runningTimer) return true;
      return Keyboard.onkeydown(event, queueInterrupt);
    }
  }
};

document.onkeypress = function(event) {
  if (!runningTimer) return true;
  if (event.which == 8) { return false; }

  Keyboard.onkeypress(event, queueInterrupt);
};

document.onkeyup = function(event) {
  if (!runningTimer) return true;
  Keyboard.onkeyup(event, queueInterrupt);
};

function toggleTab(index) {
  for (var i = 0; i < 2; i++) {
    ge("tab" + i + "_content").style.display = (index == i) ? "block" : "none";
    ge("tab" + i).className = (index == i) ? "tab_active" : "tab_inactive";
  }
}
function updateRegisters() {
  for (var reg in registers) {
    ge("reg" + reg).innerHTML = pad(parseInt(registers[reg]).toString(16), 4);
  }
  ge("cycles").innerHTML = cycles;
}
function toggleShowPC() {
  updateHighlight();
}
//updateRegisters();

var MEMORY_ROW_SIZE = 8;
function updateMemoryView() {
  var lns = "";
  var s = "";

  var offs = ge("memory_wrapper").scrollTop * MEMORY_ROW_SIZE;
  var vis_lines = ge("memory_wrapper").offsetHeight / 19;
  ge("memory_lines").style.top = (offs / MEMORY_ROW_SIZE) + "px";
  ge("memory_view").style.top = (offs / MEMORY_ROW_SIZE) + "px";
  for (var i = 0; i < vis_lines; i++) {
    lns += pad((offs + i * MEMORY_ROW_SIZE).toString(16), 4) + ":<br/>";
    for (var j = 0; j < MEMORY_ROW_SIZE; j++) {
      var v = memory[offs + i * MEMORY_ROW_SIZE + j];
      if (!v) v = 0;
      v = pad(v.toString(16), 4);
      if (registers.SP > 0 && ((offs + i * MEMORY_ROW_SIZE + j) & 0xffff) == registers.SP) {
        s += " <u id='memSP'>" + v + "</u>";
      } else
      if (offs + i * MEMORY_ROW_SIZE + j == registers.PC) {
        s += " <u id='memPC'>" + v + "</u>";
      } else {
        s += " " + v;
      }
    }
    s += "<br/>";
  }
  ge("memory_lines").innerHTML = lns;
  ge("memory_view").innerHTML = s;
}
//updateMemoryView();
function positionHighlight(line) {
  /*if (!ge("show_pc").checked) {
    line = -1;
  }*/
  var hlight = ge("asm_hlight");
  if (line >= 0) {
    hlight.style.top = line * 19;
    hlight.style.display = "block";
  } else {
    hlight.style.display = "none";
  }
}
function updateHighlight() {
  positionHighlight(memToLine[registers.PC] - 1);
}
//positionHighlight(-1);
function reset() {
  for (var reg in registers) {
    registers[reg] = 0;
  }
  registers.SP = 0;
  cycles = 0;
  keypointer = 0;
  Screen.MAP_SCREEN = 0x8000; // for backward compatability... will be reset to 0 in future
  Screen.MAP_FONT = 0x8180;
  Screen.MAP_PALETTE = 0;
  Screen.BORDER_COLOR = 0;
  state = {interruptQueue: []};
  assemble();
}
var logger = function(offset, msg, fatal) {
  //log.push(pad(line + 1, 5) + ": " + (fatal ? "(Fatal) " : "") + msg);
  if (fatal) clearInterval(runningTimer);
};

function updateViews(show_all) {
  if (show_all) {
    updateHighlight();
    updateMemoryView();
  }
  updateRegisters();
  Screen.update(memory);
  document.getElementById("cycles").innerHTML = cycles;
}

function step() {
  ge('loading_overlay').style.display = 'none';
  var rv = DCPU.step(memory, registers, state, hardware);
  if (rv > 0) {
    cycles += rv;
  }
  updateViews(true);
}

var runningTimer = false;
function run(button) {
  ge('loading_overlay').style.display = 'none';
  if (runningTimer) {
    Clock.stop();
    clearInterval(runningTimer);
    runningTimer = false;
    button.innerHTML = "&#8595; Run (F5)";
    updateViews(true);
  } else {
    Clock.start();
    runningTimer = setInterval(function() {
      var was_cycles = cycles;
      for (var i = 0; i < 10000; i++) {
        var rv = DCPU.step(memory, registers, state, hardware);
        if (rv < 0) { // break
          if (runningTimer) run(button);
          return;
        }
        cycles += rv;
        if (!runningTimer) return;
        if (breaks[memToLine[registers.PC] - 1]) {
          run(button);
          return;
        }
        if (cycles > was_cycles + 5213) break;
      }
      updateViews(true);
    }, 50);
    button.innerHTML = "&#215; Stop (F5)";
  }
}
function bp(line) {
  breaks[line] = !breaks[line] && (lineToMem[line] !== undefined);
  ge("ln" + line).className = breaks[line] ? "breakpoint" : "";
}
function pad(v, w) {
  var s = "" + v;
  var len = s.length;
  for (var i = 0; i < w - len; i++)
    s = "0" + s;
  return s;
}

function getText(e) {
  return ge(e).innerHTML.replace(/\n/g, "").replace(/<(?:br|\/div|\/p)>/g, "\n").replace(/<.*?>/g, "").replace(/&nbsp;/g, " ");
}
function htmlEscape(s) {
  return s.split(" ").join("&nbsp;").split("<").join("&lt;");
}
function assemble() {
  var asm_code = ge("asm_code");
  /*var selStart = -1;
  var selEnd = -1;
  if (window.getSelection().rangeCount > 0) {
    var range = window.getSelection().getRangeAt(0);
    selStart = range.startOffset;
    var startContainer = range.startContainer;
    var startAtLineStart = selStart == 0;
    while (startContainer != asm_code && startContainer != null) {
      while (startContainer.previousSibling != null) {
        startContainer = startContainer.previousSibling;
        selStart += startContainer.textContent.length;
      }
      startContainer = startContainer.parentNode;
    }
    selEnd = range.endOffset;
    var endContainer = range.endContainer;
    var endAtLineStart = selEnd == 0;
    while (endContainer != asm_code && endContainer != null) {
      while (endContainer.previousSibling != null) {
        endContainer = endContainer.previousSibling;
        selEnd += endContainer.textContent.length;
      }
      endContainer = endContainer.parentNode;
    }
    if (startContainer == null || endContainer == null) {
      selStart = -1;
      selEnd = -1;
    }
  }*/
  var lines = getText("asm_code").split("\n");
  var emptyLine = false;
  if (lines.length > 0 && lines[lines.length - 1].length == 0) {
    emptyLine = true;
    lines.pop();
  }

  var log = [];

  var linenums = [];
  for (var i = 0; i < lines.length; i++) {
    linenums.push("<u id=ln" + i + " onclick='bp(" + i + ")'>" + (i + 1) + "</u>");
  }
  ge("asm_lines").innerHTML = linenums.join("");

  var logger = function(line, address, pos, message, fatal) {
    log.push("<span class='line'>" + pad(line + 1, 5) + ":</span> " +
      (fatal ? "(<span class='fatal'>Fatal</span>) " : "") +
      message);
    ge("ln" + line).style.backgroundColor = '#f88';
  };
  for (var i = 0; i < 0xffff; i++) {
    if (memory[i]) memory[i] = 0;
  }
  Screen.resetFont(memory);
  var rv = Assembler.compile(lines, memory, logger);

  // map line # to address, and build up offsets/dump
  memToLine = {};
  lineToMem = {};
  var offsets = [];
  var dump = [];
  if (rv) {
    for (var i = 0; i < lines.length; i++) {
      if (rv.infos[i] === undefined || rv.infos[i].size == 0) {
        offsets.push("");
        dump.push("");
      } else {
        var info = rv.infos[i];
        offsets.push(pad(info.pc.toString(16), 4) + ":");
        lineToMem[i] = info.pc;
        var s = "";
        for (var j = 0; j < info.dump.length; j++) {
          s += pad(info.dump[j].toString(16), 4) + " ";
          memToLine[info.pc + j] = i + 1;
        }
        dump.push(s);
      }
    }

    /*asm_code.innerHTML = rv.syntax.join("<br/>") + (emptyLine ? "<br/><span></span>" : "");
    if (selStart > -1 && selEnd > -1) {
      var sel = window.getSelection();
      sel.removeAllRanges();
      range = document.createRange();
      startContainer = asm_code;
      while (true) {
        if (startContainer.childNodes.length > 0) {
          startContainer = startContainer.childNodes[0];
        } else
        if (selStart < startContainer.textContent.length || (selStart == startContainer.textContent.length && !startAtLineStart) || (selStart == 0 && (startContainer == asm_code || (startContainer.parentNode == asm_code && startContainer.nextSibling == null)))) {
          range.setStart(startContainer, selStart);
          break;
        } else
        if (startContainer.nextSibling != null) {
          selStart -= startContainer.textContent.length;
          startContainer = startContainer.nextSibling;
        } else {
          selStart -= startContainer.textContent.length;
          while (startContainer.parentNode.nextSibling == null) {
            startContainer = startContainer.parentNode;
          }
          startContainer = startContainer.parentNode.nextSibling;
        }
      }
      endContainer = asm_code;
      while (true) {
        if (endContainer.childNodes.length > 0) {
          endContainer = endContainer.childNodes[0];
        } else
        if (selEnd < endContainer.textContent.length || (selEnd == endContainer.textContent.length && !endAtLineStart) || (selEnd == 0 && (endContainer == asm_code || (endContainer.parentNode == asm_code && endContainer.nextSibling == null)))) {
          range.setEnd(endContainer, selEnd);
          break;
        } else
        if (endContainer.nextSibling != null) {
          selEnd -= endContainer.textContent.length;
          endContainer = endContainer.nextSibling;
        } else {
          selEnd -= endContainer.textContent.length;
          while (endContainer.parentNode.nextSibling == null) {
            endContainer = endContainer.parentNode;
          }
          endContainer = endContainer.parentNode.nextSibling;
        }
      }
      sel.addRange(range);
    }*/
  }

  // update UI
  ge("asm_offsets").innerHTML = offsets.join("<br/>");
  ge("asm_dump").innerHTML = dump.join("<br/>");
  ge("log").innerHTML = log.join("<br/>");
  //ge("asm_code").style.height = Math.max(560, (lines.length * 19 + 3)) + "px";
  var asm_code = ge("asm_code");
  asm_code.style.height = Math.max(560, (lines.length * 19 + 3)) + (asm_code.scrollWidth > asm_code.offsetWidth ? SCROLLER_SIZE : 0) + "px";

  for (var line in breaks) {
    if (breaks[line] && (lineToMem[line] === undefined)) {
      bp(line);
    } else
      ge("ln" + line).className = breaks[line] ? "breakpoint" : "";
  }
  updateViews(true);
}

function disassemble() {
  var input = getText("dasm_dump");
  var linenum = input.split("\n").length;
  var data = [];
  var s = "";
  for (var i = 0; i < input.length; i++) {
    if ("0123456789abcdefABCDEF".indexOf(input.charAt(i)) > -1) {
      s += input.charAt(i);
      if (s.length == 4) {
        data.push(parseInt(s, 16));
        s = "";
      }
    }
  }

  var log = [];
  var logger = function(offset, msg, fatal) {
    log.push("<span class='line'>" + pad(offset, 4) + ":</span> " + (fatal ? "(<span class='fatal'>Fatal</span>) " : "") + msg);
    if (fatal) aborted = true;
  };

  var used = {};
  var code = {};
  var stack = [];
  var conditional = false;
  if (data.length > 0) {
    stack.push(0);
  }
  var labels = {last: 0};
  while (stack.length > 0) {
    var pc = stack.pop();
    if (used[pc]) {
      continue;
    }
    do {
      var info = Disassembler.disassemble(data, pc, labels, function(type, str) {
        return "<span class='" + type + "'>" + str + "</span>";
      }, logger);

      if (info.branch !== undefined) {
        stack.push(info.branch);
      }
      for (var i = pc; i < pc + info.size; i++) {
        used[i] = true;
      }
      if (info.code !== undefined) {
        code[pc] = (conditional ? "&nbsp;&nbsp;" : "") + info.code;
      }
      pc += info.size;
      if (conditional) {
        info.terminal = false;
      }
      conditional = info.conditional;
    } while (pc < data.length && !info.terminal);
  }

  var lines = [];
  var output = [];
  for (var i = 0; i < data.length; i++) {
    if (labels[i]) {
      lines.push("");
      output.push("");
      lines.push("");
      output.push(":" + wrapAs(labels[i], "lbl"));
    }
    if (code[i] !== undefined) {
      lines.push(pad(i.toString(16), 4) + ":");
      output.push("&nbsp;&nbsp;" + code[i]);
    } else if (!used[i]) {
      var words = [];
      var all_zeros = true;
      var old_i = i;
      while (i < data.length && !used[i]) {
        words.push(wrapAs("0x" + pad(data[i].toString(16), 4), "lit"));
        if (data[i]) all_zeros = false;
        i++;
      }
      if (all_zeros) {
        if (i < data.length) {
          lines.push("");
          lines.push("");
          output.push("");
          output.push(wrapAs("ORG", "op") + " " + wrapAs("0x" + pad(i.toString(16), 4), "lit"));
        }
      } else {
        lines.push(pad(old_i.toString(16), 4) + ":");
        output.push("&nbsp;&nbsp;" + wrapAs("DAT", "op") + " " + words.join(", "));
      }
      i--;
    }
  }

  // update UI
  ge("dasm_lines").innerHTML = lines.join("<br/>");
  ge("dasm_code").innerHTML = output.join("<br/>");
  ge("log").innerHTML = log.join("<br/>");
  ge("dasm_dump").style.height = Math.max(560, ((linenum + 1) * 19 + 9)) + "px";
}

function disassembleDump() {
  var dump = "";
  var end = 0x7ffe;
  while (!memory[end] && end > 0) end--;
  for (var i = 0; i <= end + 1; i++) {
    dump += pad((memory[i] || 0).toString(16), 4);
    dump += (i % 8 == 7) ? "<br/>" : " ";
  }
  ge("dasm_dump").innerHTML = dump;
  disassemble();
  toggleTab(1);
}

function updateSizes() {
  var height = window.innerHeight;
  if (height === undefined) {
    if (document.documentElement) {
      height = document.documentElement.clientHeight;
    }
    if (height === undefined && document.body) {
      height = document.body.clientHeight;
    }
  }

  ge("tab0_content").style.height = (height - 48*2 - 10) + "px";
  ge("tab1_content").style.height = (height - 48*2 - 10) + "px";

  var vis_lines = parseInt((height - ge("memory_wrapper").offsetTop - 4) / 19);
  ge("memory_wrapper").style.height = vis_lines * 19 + "px";
  ge("memory_content").style.height = ((65536 / MEMORY_ROW_SIZE) + vis_lines * 19 - vis_lines) + "px";
  updateMemoryView();
}

var SCROLLER_SIZE = getScrollerWidth();

Clock.reset(queueInterrupt);
Screen.init();
Keyboard.init();

disassemble();
reset();
updateSizes();
var lastCode = getText("asm_code");
var lastInput = getText("dasm_dump");

setInterval(function() {
  Screen.blink = !Screen.blink;
  Screen.update(memory);


  var code = getText("asm_code");
  if (code != lastCode) {
    lastCode = code;
    assemble();
  }
  var input = getText("dasm_dump");
  if (input != lastInput) {
    lastInput = input;
    disassemble();
  }
}, 600);