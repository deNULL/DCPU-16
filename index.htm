<html>
<head>
  <title>DCPU-16 emulator</title>
  <meta name="viewport" content="width = 1300">
  <link rel="stylesheet" href="css/dcpu.css">
  <script type="text/javascript" src="js/common.js?v=1"></script>
  <script type="text/javascript" src="js/assembler.js?v=5"></script>
  <script type="text/javascript" src="js/disassembler.js?v=3"></script>
  <script type="text/javascript" src="js/emulator.js?v=2"></script>
  <script type="text/javascript" src="js/clock.js?v=1"></script>
  <script type="text/javascript" src="js/screen.js?v=1"></script>
  <script type="text/javascript" src="js/keyboard.js?v=1"></script>
  <script type="text/javascript">
    var _gaq = _gaq || [];
    _gaq.push(['_setAccount', 'UA-31249994-1']);
    _gaq.push(['_setDomainName', 'dcpu.ru']);
    _gaq.push(['_setAllowLinker', true]);
    _gaq.push(['_trackPageview']);

    (function() {
      var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
      ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
    })();
  </script>
</head>
<body spellcheck="false" onresize="updateSizes()" onload="updateSizes()">
  <div id="controls" class="fl_r">
    <button onclick="run(this)" id="button_run" class="big green"/>&#8595; Run (F5)</button>
    <button onclick="step()"  class="big"/>&#8618; Step (F6)</button>
    <button onclick="reset()" class="big">&#8634; Reset (Esc)</button>
  </div>
  <div id="cycles_wrap" class="editor fl_r"><div class="reg_name fl_l">Cycles:</div><div id="cycles" class="reg_value fl_l">0</div></div>
  <div id="header">
    <h3>DCPU-16 Assembler, Emulator &amp; Disassembler<span class="notice">by deNULL. In case of problems, write at <a href="mailto:me@denull.ru">me@denull.ru</a> or use <a href="/old/">the old version</a>.</span></h3>
    <div class="tabs">
      <a href="javascript:" onclick="toggleTab(0)" class="tab_active" id="tab0">Assembler</a>
      <a href="javascript:" onclick="toggleTab(1)" class="tab_inactive" id="tab1">Disassembler</a>
    </div>
  </div>
  <div id="info_panel" class="fl_r">
    <div id="screen_wrapper">
      <canvas id="screen" width="384" height="288"></canvas>
      <img id="loading_overlay" src="http://i.imgur.com/DcNzS.png" width="384" height="288"/>
    </div>
    <h4>Registers:</h4>
    <div id="registers" class="editor">
      <div class="reg_name fl_l">PC:</div><div id="regPC" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">SP:</div><div id="regSP" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">IA:</div><div id="regIA" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">EX:</div><div id="regEX" class="reg_value fl_l">0</div>

      <div class="reg_name fl_l clear">A:</div><div id="regA" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">B:</div><div id="regB" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">C:</div><div id="regC" class="reg_value fl_l">0</div>

      <div class="reg_name fl_l clear">X:</div><div id="regX" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">Y:</div><div id="regY" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">Z:</div><div id="regZ" class="reg_value fl_l">0</div>

      <div class="reg_name fl_l clear">I:</div><div id="regI" class="reg_value fl_l">0</div>
      <div class="reg_name fl_l">J:</div><div id="regJ" class="reg_value fl_l">0</div>
    </div>
    <div style="clear: both"></div>
    <button onclick="disassembleDump()" id="disassemble_dump">Disassemble</button>
    <h4>Memory dump:</h4>
    <div id="memory_wrapper" onscroll="updateMemoryView()">
      <div id="memory_content">
        <div id="memory_lines" class="editor fl_l"></div>
        <div id="memory_view" class="editor fl_l"></div>
      </div>
    </div>
  </div>
  <div id="tab0_content">
    <div id="asm_lines_wrap" class="column fl_l">
      <div class="editor" id="asm_lines"></div>
    </div>
    <div id="asm_dump_wrap" class="column fl_r">
      <div class="editor" id="asm_dump"></div>
    </div>
    <div class="column fl_r">
      <div class="editor" id="asm_offsets"></div>
    </div>
    <div class="column">
      <div class="line_highlight" id="asm_hlight"></div>
      <div class="editor" id="asm_code" wrap="off" spellcheck="false" onkeyup="assemble()" onkeydown="assemble()" onselect="assemble()" onkeypress="assemble()" onmouseup="assemble()" onchange="assemble()" contentEditable="true" autocomplete="off"><?php
$default_code = <<<EOF
    ; Try some basic stuff
                  SET A, 0x30              ; 7c01 0030
                  SET [0x1000], 0x20       ; 7de1 1000 0020
                  SUB A, [0x1000]          ; 7803 1000
                  IFN A, 0x10              ; c00d
                     SET PC, crash         ; 7dc1 001a [*]

    ; Do a loopy thing
                  SET I, 10                ; a861
                  SET A, 0x2000            ; 7c01 2000
    :loop         SET [0x2000+I], [A]      ; 2161 2000
                  SUB I, 1                 ; 8463
                  IFN I, 0                 ; 806d
                     SET PC, loop          ; 7dc1 000d [*]

    ; Call a subroutine
                  SET X, 0x4               ; 9031
                  JSR testsub              ; 7c10 0018 [*]
                  SET PC, crash            ; 7dc1 001a [*]

    :testsub      SHL X, 4                 ; 9037
                  SET PC, POP              ; 61c1

    ; Hang forever. X should now be 0x40 if everything went right.
    :crash        SET PC, crash            ; 7dc1 001a [*]

    ; [*]: Note that these can be one word shorter and one cycle faster by using the short form (0x00-0x1f) of literals,
    ;      but my assembler doesn't support short form labels yet.
EOF;
$code = $default_code;
if (isset($_REQUEST['code'])) {
  $code = $_REQUEST['code'];
}
$code = htmlspecialchars($code);
$code = "<div>".str_replace(array(" ", "\n"), array("&nbsp;", "</div><div>"), $code)."</div>";
$code = str_replace("<div></div>", "<div><br/></div>", $code);
echo $code;?></div>
    </div>
  </div>
  <div id="tab1_content">
    <div id="dasm_lines_wrap" class="column fl_l">
      <div class="editor" id="dasm_lines"></div>
    </div>
    <div class="column fl_r">
      <div class="editor" id="dasm_offsets"></div>
    </div>
    <div id="dasm_code_wrap" class="column fl_r">
      <div class="editor" id="dasm_code"></div>
    </div>
    <div class="editor" id="dasm_dump" wrap="off" spellcheck="false" onkeyup="disassemble()" onkeydown="disassemble()" onselect="disassemble()" onkeypress="disassemble()" onmouseup="disassemble()" onchange="disassemble()" contentEditable="true" autocomplete="off"></div>
  </div>
  <div id="log" class="editor">

  </div>
  <script language="javascript" src="js/ui.js?v=1"></script>
</body>
</html>