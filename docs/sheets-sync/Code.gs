/**
 * BookNest → Google スプレッドシート 自動反映スクリプト
 *
 * 使い方は docs/sheets-sync.md を参照。
 * スプレッドシートの「拡張機能 → Apps Script」に、このファイルの内容をそのまま貼り付けます。
 * スクリプトプロパティ SECRET に、BookNest の SHEETS_WEBHOOK_SECRET と同じ文字列を設定してください。
 */

var MAX_CELL = 49000; // セルの上限（5万文字）に収める

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad_request" });
  }
  var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || body.secret !== secret) return reply({ ok: false, error: "unauthorized" });
  if (body.action === "ping") return reply({ ok: true });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet(body.sheet, body.headers);
    if (body.action === "upsert") upsert(sheet, body.headers, body.rows || []);
    else if (body.action === "delete") removeRows(sheet, body.ids || []);
    else if (body.action === "replace") replaceAll(sheet, body.headers, body.rows || []);
    else return reply({ ok: false, error: "unknown_action" });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

/** ブラウザで URL を開いたときの確認用 */
function doGet() {
  return reply({ ok: true, app: "BookNest sheets sync" });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name, headers) {
  if (!name) throw new Error("sheet name is required");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (headers && headers.length) {
    var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join("\u0001") !== headers.join("\u0001")) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function clip(row, width) {
  var out = [];
  for (var i = 0; i < width; i++) {
    var v = row[i];
    if (v === undefined || v === null) v = "";
    if (typeof v === "string" && v.length > MAX_CELL) v = v.slice(0, MAX_CELL) + "…";
    out.push(v);
  }
  return out;
}

/** 1列目の ID → 行番号 */
function idIndex(sheet) {
  var last = sheet.getLastRow();
  var map = {};
  if (last < 2) return map;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0]) map[String(ids[i][0])] = i + 2;
  return map;
}

function upsert(sheet, headers, rows) {
  var width = headers.length;
  var index = idIndex(sheet);
  var append = [];
  rows.forEach(function (row) {
    var r = clip(row, width);
    var at = index[String(r[0])];
    if (at) sheet.getRange(at, 1, 1, width).setValues([r]);
    else append.push(r);
  });
  if (append.length) sheet.getRange(sheet.getLastRow() + 1, 1, append.length, width).setValues(append);
}

function removeRows(sheet, ids) {
  var index = idIndex(sheet);
  var rows = ids
    .map(function (id) {
      return index[String(id)];
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return b - a;
    });
  rows.forEach(function (r) {
    sheet.deleteRow(r);
  });
}

function replaceAll(sheet, headers, rows) {
  var width = headers.length;
  var last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, Math.max(sheet.getLastColumn(), width)).clearContent();
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, width).setValues(
      rows.map(function (r) {
        return clip(r, width);
      }),
    );
  }
}
