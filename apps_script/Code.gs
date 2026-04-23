/**
 * ========================================
 * EDU The Final Chapter - Contact Display Backend
 * ========================================
 * Google Apps Script สำหรับจัดการคิวการแสดง Contact บนจอ
 * 
 * วิธีใช้:
 * 1. สร้าง Google Form เชื่อมกับ Spreadsheet
 * 2. เปิด Apps Script Editor จาก Spreadsheet
 * 3. วาง Code นี้ทับ Code.gs
 * 4. รัน initializeSheet() ครั้งแรก
 * 5. ตั้ง Trigger: onFormSubmit สำหรับ Form submissions
 * 6. Deploy เป็น Web App (Anyone can access)
 */

// ==================== CONFIG ====================
const CONFIG = {
  DISPLAY_DURATION_SEC: 15,   // ระยะเวลาแสดงแต่ละคน (วินาที)
  SHEET_NAME: 'Form Responses 1', // ชื่อ Sheet (ปรับตาม Google Form)
  STATUS_COL: 'G',           // คอลัมน์ Status
  DISPLAY_TIME_COL: 'H',     // คอลัมน์ Display Time
  DATA_START_ROW: 2,         // แถวเริ่มต้นข้อมูล (แถว 1 = header)
};

// Column indices (1-based) - ปรับตามลำดับฟิลด์ใน Google Form
const COLS = {
  TIMESTAMP: 1,    // A: Timestamp
  NAME: 2,         // B: ชื่อ-นามสกุล  
  MAJOR: 3,        // C: วิชาเอก
  INSTAGRAM: 4,    // D: Instagram Contact
  QUOTE: 5,        // E: คำคม
  IMAGE: 6,        // F: รูปภาพ (File URL)
  STATUS: 7,       // G: Status
  DISPLAY_TIME: 8, // H: Display Time
};

// ==================== WEB APP ENDPOINT ====================

/**
 * Web App endpoint - Display page จะเรียก URL นี้เพื่อรับข้อมูล
 * @param {Object} e - Event object
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'getNext';
    
    let result;
    
    switch (action) {
      case 'getNext':
        result = getNextInQueue();
        break;
      case 'markShown':
        const row = parseInt(e.parameter.row);
        if (row) {
          markAsShown(row);
          result = { success: true, message: 'Marked as shown' };
        } else {
          result = { success: false, message: 'Invalid row parameter' };
        }
        break;
      case 'status':
        result = getQueueStatus();
        break;
      default:
        result = { success: false, message: 'Unknown action' };
    }
    
    // Return JSON with CORS headers
    const output = ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    return output;
    
  } catch (error) {
    const errorResult = { success: false, error: error.toString() };
    return ContentService.createTextOutput(JSON.stringify(errorResult))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== QUEUE MANAGEMENT ====================

/**
 * ดึงข้อมูลถัดไปในคิว
 * Logic:
 * 1. หาข้อมูลที่กำลังแสดงอยู่ (status = "displaying")
 * 2. ถ้ามี → ตรวจว่าผ่าน 15 วินาทีหรือยัง
 *    - ถ้ายัง → return ข้อมูลเดิม (ยังแสดงอยู่)
 *    - ถ้าผ่านแล้ว → mark as "shown" แล้วดึงตัวถัดไป
 * 3. ถ้าไม่มีตัวที่กำลังแสดง → ดึง pending ตัวแรก
 */
function getNextInQueue() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    return { success: false, hasData: false, pending: 0, message: 'Sheet not found: ' + CONFIG.SHEET_NAME };
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    return { success: true, hasData: false, pending: 0, message: 'No submissions yet' };
  }
  
  const now = new Date();
  
  // หาข้อมูลที่กำลังแสดงอยู่
  const statusRange = sheet.getRange(CONFIG.DATA_START_ROW, COLS.STATUS, lastRow - 1, 1).getValues();
  const displayTimeRange = sheet.getRange(CONFIG.DATA_START_ROW, COLS.DISPLAY_TIME, lastRow - 1, 1).getValues();
  
  let currentlyDisplaying = -1;
  let firstPending = -1;
  let pendingCount = 0;
  
  for (let i = 0; i < statusRange.length; i++) {
    const status = statusRange[i][0].toString().toLowerCase().trim();
    
    if (status === 'displaying') {
      currentlyDisplaying = i + CONFIG.DATA_START_ROW;
    }
    
    if (status === 'pending') {
      pendingCount++;
      if (firstPending === -1) {
        firstPending = i + CONFIG.DATA_START_ROW;
      }
    }
  }
  
  // ถ้ามีข้อมูลกำลังแสดงอยู่
  if (currentlyDisplaying > 0) {
    const displayTime = displayTimeRange[currentlyDisplaying - CONFIG.DATA_START_ROW][0];
    
    if (displayTime) {
      const displayDate = new Date(displayTime);
      const elapsedSec = (now.getTime() - displayDate.getTime()) / 1000;
      
      // ยังไม่ครบ 15 วินาที → return ข้อมูลเดิม
      if (elapsedSec < CONFIG.DISPLAY_DURATION_SEC) {
        const data = getRowData(sheet, currentlyDisplaying);
        return {
          success: true,
          hasData: true,
          isNew: false,
          pending: pendingCount,
          remainingSec: Math.ceil(CONFIG.DISPLAY_DURATION_SEC - elapsedSec),
          data: data,
          row: currentlyDisplaying
        };
      }
      
      // ครบ 15 วินาทีแล้ว → mark as shown
      markAsShown(currentlyDisplaying);
    }
  }
  
  // ดึง pending ตัวถัดไป
  if (firstPending === -1) {
    const freshStatusRange = sheet.getRange(CONFIG.DATA_START_ROW, COLS.STATUS, lastRow - 1, 1).getValues();
    pendingCount = 0;
    for (let i = 0; i < freshStatusRange.length; i++) {
      if (freshStatusRange[i][0].toString().toLowerCase().trim() === 'pending') {
        pendingCount++;
        if (firstPending === -1) {
          firstPending = i + CONFIG.DATA_START_ROW;
        }
      }
    }
  }
  
  if (firstPending > 0) {
    sheet.getRange(firstPending, COLS.STATUS).setValue('displaying');
    sheet.getRange(firstPending, COLS.DISPLAY_TIME).setValue(now.toISOString());
    pendingCount = Math.max(0, pendingCount - 1);
    
    const data = getRowData(sheet, firstPending);
    return {
      success: true,
      hasData: true,
      isNew: true,
      pending: pendingCount,
      remainingSec: CONFIG.DISPLAY_DURATION_SEC,
      data: data,
      row: firstPending
    };
  }
  
  // ไม่มีข้อมูลรอแสดง
  return { success: true, hasData: false, pending: 0, message: 'Queue is empty' };
}

/**
 * ดึงข้อมูลจากแถวที่ระบุ
 */
function getRowData(sheet, rowNumber) {
  const rowData = sheet.getRange(rowNumber, 1, 1, COLS.IMAGE).getValues()[0];
  
  let imageUrl = rowData[COLS.IMAGE - 1] ? rowData[COLS.IMAGE - 1].toString() : '';
  
  // แปลง Google Drive URL เป็น direct image URL
  if (imageUrl) {
    imageUrl = convertDriveUrl(imageUrl);
  }
  
  return {
    timestamp: rowData[COLS.TIMESTAMP - 1],
    name: rowData[COLS.NAME - 1] || '',
    major: rowData[COLS.MAJOR - 1] || '',
    instagram: rowData[COLS.INSTAGRAM - 1] || '',
    quote: rowData[COLS.QUOTE - 1] || '',
    imageUrl: imageUrl,
    row: rowNumber
  };
}

/**
 * Mark ข้อมูลว่าแสดงเสร็จแล้ว
 */
function markAsShown(rowNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (sheet && rowNumber >= CONFIG.DATA_START_ROW) {
    sheet.getRange(rowNumber, COLS.STATUS).setValue('shown');
  }
}

/**
 * ดึงสถานะคิวทั้งหมด
 */
function getQueueStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { success: false, message: 'Sheet not found' };
  
  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    return { success: true, total: 0, pending: 0, displaying: 0, shown: 0 };
  }
  
  const statusRange = sheet.getRange(CONFIG.DATA_START_ROW, COLS.STATUS, lastRow - 1, 1).getValues();
  
  let pending = 0, displaying = 0, shown = 0;
  
  statusRange.forEach(row => {
    const status = row[0].toString().toLowerCase().trim();
    if (status === 'pending') pending++;
    else if (status === 'displaying') displaying++;
    else if (status === 'shown') shown++;
  });
  
  return {
    success: true,
    total: statusRange.length,
    pending: pending,
    displaying: displaying,
    shown: shown
  };
}

// ==================== IMAGE HANDLING ====================

/**
 * แปลง Google Drive URL เป็น direct access URL
 * รูปแบบ URL ที่รองรับ:
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/uc?id=FILE_ID
 */
function convertDriveUrl(url) {
  if (!url) return '';
  
  let fileId = '';
  
  // Pattern: /file/d/FILE_ID/
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    fileId = match[1];
  }
  
  // Pattern: ?id=FILE_ID
  if (!fileId) {
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) {
      fileId = match[1];
    }
  }
  
  if (fileId) {
    // ใช้ Google Drive direct download URL
    return 'https://lh3.googleusercontent.com/d/' + fileId;
  }
  
  // ถ้าไม่ใช่ Google Drive URL ให้ return ตามเดิม
  return url;
}

// ==================== FORM TRIGGER ====================

/**
 * Trigger เมื่อมี Form submission ใหม่
 * ตั้งค่า: Edit > Current project's triggers > Add Trigger
 * - Function: onFormSubmit
 * - Event source: From spreadsheet
 * - Event type: On form submit
 */
function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  
  // Set status = "pending" สำหรับ submission ใหม่
  sheet.getRange(lastRow, COLS.STATUS).setValue('pending');
  sheet.getRange(lastRow, COLS.DISPLAY_TIME).setValue('');
  
  Logger.log('New form submission at row ' + lastRow + ' - Status set to pending');
}

// ==================== INITIALIZATION ====================

/**
 * รันครั้งแรกเพื่อเพิ่ม header คอลัมน์ Status และ Display Time
 */
function initializeSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    Logger.log('ERROR: Sheet "' + CONFIG.SHEET_NAME + '" not found!');
    Logger.log('กรุณาเปลี่ยน CONFIG.SHEET_NAME ให้ตรงกับชื่อ Sheet');
    return;
  }
  
  // เพิ่ม headers
  sheet.getRange(1, COLS.STATUS).setValue('Status');
  sheet.getRange(1, COLS.DISPLAY_TIME).setValue('Display Time');
  
  // Set existing rows to "pending"
  const lastRow = sheet.getLastRow();
  if (lastRow >= CONFIG.DATA_START_ROW) {
    for (let i = CONFIG.DATA_START_ROW; i <= lastRow; i++) {
      const currentStatus = sheet.getRange(i, COLS.STATUS).getValue();
      if (!currentStatus) {
        sheet.getRange(i, COLS.STATUS).setValue('pending');
      }
    }
  }
  
  Logger.log('Sheet initialized successfully!');
  Logger.log('Headers added at columns G and H');
  Logger.log('Existing rows set to "pending"');
}

/**
 * รีเซ็ตสถานะทั้งหมดกลับเป็น pending (สำหรับเริ่มใหม่)
 */
function resetAllStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow >= CONFIG.DATA_START_ROW) {
    for (let i = CONFIG.DATA_START_ROW; i <= lastRow; i++) {
      sheet.getRange(i, COLS.STATUS).setValue('pending');
      sheet.getRange(i, COLS.DISPLAY_TIME).setValue('');
    }
  }
  
  Logger.log('All statuses reset to pending');
}
