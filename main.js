const defaultSpreadsheetId = '';

const defaultTimeZone = 'JST';
const defaultBreakTime = 1;

const dateCol = 1;
const attendanceCol = 2;
const startCol = 3;
const endCol = 4;
const breakCol = 5;

function main() {
}

function test() {
}

function doPost(e) {
  const params = JSON.parse(e.postData.getDataAsString());

  const output = processRequest(params);

  return output;
}

function doGet(e) {
  const params = e.parameter;

  const output = processRequest(params);

  return output;
}

function processRequest(params) {
  if (params.mode === 'get') {
    return getRecords(params);
  }

  let result = 'Failed';
  try {
    if (recordWork(params)) {
      result = 'Succeeded';
    }
  } catch (e) {
    Logger.log(e);
    result = `Error: ${e.message}`;
  }

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.TEXT);
  output.setContent(result);

  return output;
}

function getRecords(params) {
  const result = {};
  try {
    const { spreadsheetId = defaultSpreadsheetId, year, month, timeZone = defaultTimeZone } = params;
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = formatDate(year, month);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet !== null) {
      const range = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn());
      result.values = range.getValues().map((row) => {
        return row.map((cell) => {
          if (cell instanceof Date) {
            const { time } = parseDate(cell, timeZone);
            return time;
          }
          return cell.toString();
        });
      });
    } else {
      result.values = [];
    }
  } catch (e) {
    Logger.log(e);
    result.error = e.message;
  }

  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  output.setContent(JSON.stringify(result));

  return output;
}

function recordWork(params) {
  const { spreadsheetId = defaultSpreadsheetId, mode, timeZone = defaultTimeZone, breakTime = defaultBreakTime } = params;
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  const now = new Date();
  const { year, month } = parseDate(now, timeZone);

  const sheetName = formatDate(year, month);
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (mode === 'start') {
    if (sheet === null) {
      sheet = spreadsheet.insertSheet(sheetName, 0);
    }
    recordStartTime(sheet, now, timeZone);
    return true;
  } else if (mode === 'end') {
    if (sheet !== null) {
      recordEndTime(sheet, now, timeZone, breakTime);
      return true;
    }
  }

  return false;
}

function formatDate(year, month) {
  return `${year}/${(month < 10 ? '0' : '')}${month}`;
}

function formatTime(hour, minute) {
  return `${hour}:${(minute < 10 ? '0' : '')}${minute}`;
}

function parseDate(date, timeZone) {
  const components = Utilities.formatDate(date, timeZone, 'yyyy MM dd HH mm').split(' ');

  const year = parseInt(components[0]);
  const month = parseInt(components[1]);
  const day = parseInt(components[2]);
  let hour = parseInt(components[3]);
  let minute = Math.round(parseInt(components[4]) / 15) * 15;
  hour += Math.floor(minute / 60);
  minute = minute % 60;
  const time = formatTime(hour, minute);

  return { year, month, day, hour, minute, time };
}

function recordStartTime(sheet, date, timeZone) {
  const { day, time } = parseDate(date, timeZone)

  let row = 0;
  while (row < day) {
    row += 1;
    const range = sheet.getRange(row, dateCol);
    if (range.isBlank()) {
      sheet.appendRow([row]);
    }
  }
  const range = sheet.getRange(row, attendanceCol, 1, 2);
  range.setValues([['出勤', time]]);
}

function recordEndTime(sheet, date, timeZone, breakTime = defaultBreakTime) {
  const { day, time } = parseDate(date, timeZone)
  
  const hours = Math.floor(breakTime);
  const minutes = Math.round((breakTime - hours) * 60);

  const range = sheet.getRange(day, endCol, 1, 2);
  range.setValues([[time, formatTime(hours, minutes)]]);
}
