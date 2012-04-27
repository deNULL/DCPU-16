var startup = (new Date()).getTime();
var cycles = 0;
var memory = [];
var registers = {A: 0, B: 0, C: 0, X: 0, Y: 0, Z: 0, I: 0, J: 0, PC: 0, SP: 0, EX: 0, IA: 0};
var memToLine = {};
var lineToMem = {};
var breaks = {};
var state = {interruptQueue: []};

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
    default: { // pass it to program
      if (!runningTimer) return true;
      return Keyboard.onkeydown(event, function(interrupt) {
        DCPU.queueInterrupt(memory, registers, state, [Screen, Keyboard], interrupt);
      });
    }
  }
};
document.onkeypress = function(event) {
  if (!runningTimer) return true;
  if (event.which == 8) { return false; }

  Keyboard.onkeypress(event, function(interrupt) {
    DCPU.queueInterrupt(memory, registers, state, [Screen, Keyboard], interrupt);
  });
};
document.onkeyup = function(event) {
  if (!runningTimer) return true;
  Keyboard.onkeyup(event, function(interrupt) {
    DCPU.queueInterrupt(memory, registers, state, [Screen, Keyboard], interrupt);
  });
};

function toggleTab(index) {
  for (var i = 0; i < 2; i++) {
    ge("tab" + i + "_wrapper").style.display = (index == i) ? "block" : "none";
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
updateRegisters();

function updateMemoryView() {
  var lns = "";
  var s = "";
  var offs = ge("memory_window").scrollTop * 8;
  ge("memory_lines").style.top = (offs / 8) + "px";
  ge("memory_view").style.top = (offs / 8) + "px";
  for (var i = 0; i < 16; i++) {
    lns += pad((offs + i * 8).toString(16), 4) + ":<br/>";
    for (var j = 0; j < 8; j++) {
      var v = memory[offs + i * 8 + j];
      if (!v) v = 0;
      v = pad(v.toString(16), 4);
      if (((offs + i * 8 + j + 1) & 0xffff) == registers.SP) {
        s += " <u class='cur_sp'>" + v + "</u>";
      } else
      if (offs + i * 8 + j == registers.PC) {
        s += " <u class='cur_pc'>" + v + "</u>";
      } else {
        s += " " + v;
      }
    }
    s += "<br/>";
  }
  ge("memory_lines").innerHTML = lns;
  ge("memory_view").innerHTML = s;
}
updateMemoryView();
function positionHighlight(line) {
  if (!ge("show_pc").checked) {
    line = -1;
  }
  for (var i = 1; i <= 4; i++) {
    var hlight = ge("hlight" + i);
    if (line >= 0) {
      hlight.style.top = line * 19 + 2;
      hlight.style.display = "block";
    } else {
      hlight.style.display = "none";
    }
  }
}
function updateHighlight() {
  positionHighlight(memToLine[registers.PC] - 1);
}
positionHighlight(-1);
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
  var rv = DCPU.step(memory, registers, state, [ Screen, Keyboard ]);
  if (rv > 0) {
    cycles += rv;
  }
  updateViews(true);
}

var runningTimer = false;
function run(button) {
  ge('loading_overlay').style.display = 'none';
  if (runningTimer) {
    clearInterval(runningTimer);
    runningTimer = false;
    button.innerHTML = "&#8595; Run (F5)";
    updateViews(true);
  } else {
    runningTimer = setInterval(function() {
      var was_cycles = cycles;
      for (var i = 0; i < 10000; i++) {
        var rv = DCPU.step(memory, registers, state, [ Screen, Keyboard ]);
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

function assemble() {
  var lines = ge("code").value.split("\n");
  var log = [];

  var linenums = [];
  for (var i = 0; i < lines.length; i++) {
    linenums.push("<u id=ln" + i + " onclick='bp(" + i + ")'>" + (i + 1) + "</u>");
  }
  ge("linenums").innerHTML = linenums.join("");

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
  }

  // update UI
  ge("offsets").innerHTML = offsets.join("<br/>");
  ge("dump").innerHTML = dump.join("<br/>");
  ge("log").innerHTML = log.join("<br/>");
  ge("code").style.height = Math.max(560, ((lines.length + 1) * 19 + 9)) + "px";

  for (var line in breaks) {
    if (breaks[line] && (lineToMem[line] === undefined)) {
      bp(line);
    } else
      ge("ln" + line).className = breaks[line] ? "breakpoint" : "";
  }
  updateViews(true);
}

function disassemble() {
  var input = ge("da_input").value;
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
  ge("da_lines").innerHTML = lines.join("<br/>");
  ge("da_code").innerHTML = output.join("<br/>");
  ge("log").innerHTML = log.join("<br/>");
  ge("da_input").style.height = Math.max(560, ((linenum + 1) * 19 + 9)) + "px";
}

function disassembleDump() {
  var dump = "";
  var end = 0x7ffe;
  while (!memory[end] && end > 0) end--;
  for (var i = 0; i <= end + 1; i++) {
    dump += pad((memory[i] || 0).toString(16), 4);
    dump += (i % 8 == 7) ? "\n" : " ";
  }
  ge("da_input").value = dump;
  disassemble();
  toggleTab(1);
}

Screen.init();
Keyboard.init();
disassemble();
reset();
var lastCode = ge("code").value;
var lastInput = ge("da_input").value;

setInterval(function() {
  Screen.blink = !Screen.blink;
  Screen.update(memory);

  var code = ge("code").value;
  if (code != lastCode) {
    lastCode = code;
    assemble();
  }
  var input = ge("code").value;
  if (input != lastInput) {
    lastInput = input;
    //disassemble();
  }
}, 600);
