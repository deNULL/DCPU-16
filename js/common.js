String.prototype.trim = function() {
  var i = 0;
  while (i < this.length && (this.charAt(i) == " " || this.charAt(i) == "\n" || this.charAt(i) == "\r" || this.charAt(i) == "\t")) i++;
  var j = this.length - 1;
  while (j >= 0 && (this.charAt(j) == " " || this.charAt(j) == "\n" || this.charAt(j) == "\r" || this.charAt(j) == "\t")) j--;
  return this.substr(i, j - i + 1);
}
Array.prototype.indexOf = function(v) {
  for (var i = 0; i < this.length; i++)
    if (this[i] == v)
      return i;
  return -1;
}
function wrapAs(s, c) {
  return "<span class='" + c + "'>" + s + "</span>";
}
function ge(e) {
  return document.getElementById(e);
}

function computedHeight(e) {
  return parseInt(getComputedStyle(e, "").getPropertyValue("height"));
}

function bodyMargin() {
  var style = getComputedStyle(document.body, "")
  return parseInt(style.getPropertyValue("margin-top")) +
    parseInt(style.getPropertyValue("margin-bottom"));
}

// make "dest" element be the same height as "source"
function matchHeight(dest, source) {
  dest.style.height = computedHeight(source) + "px";
}
