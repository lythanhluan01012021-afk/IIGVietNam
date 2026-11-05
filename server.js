const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Phục vụ trực tiếp 5 ảnh banner (1.png -> 5.png) từ thư mục gốc dự án để luôn hiển thị bản mới nhất không bị cache
app.get(/^\/assets\/([1-5]\.png)$/, (req, res) => {
  const fileName = req.params[0];
  const rootBannerPath = path.join(__dirname, fileName);
  const assetBannerPath = path.join(__dirname, 'public', 'assets', fileName);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (fs.existsSync(rootBannerPath)) {
    return res.sendFile(rootBannerPath);
  }
  return res.sendFile(assetBannerPath);
});

app.use(express.static(path.join(__dirname, 'public')));

const IS_VERCEL = Boolean(process.env.VERCEL);
const WORK_DIR = IS_VERCEL ? '/tmp' : __dirname;
const EXCEL_PATH = path.join(WORK_DIR, 'BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx');
const STUDENTS_EXCEL_PATH = path.join(WORK_DIR, 'CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx');
const TEMPLATE_PATH = path.join(__dirname, 'data', 'BM01-template.xlsx');
const DB_JSON_PATH = IS_VERCEL ? path.join('/tmp', 'db-state.json') : path.join(__dirname, 'data', 'db-state.json');
const INITIAL_DB_JSON_PATH = path.join(__dirname, 'data', 'db-state.json');
const DRIVE_FOLDER_ID = '1a_hJhS5wetmMRktY6qfSVCqNN3pQUuCb';
const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}?usp=sharing`;
const MOUNTED_DRIVE_DIR = 'G:\\My Drive\\IIGVN';
const GDRIVE_CMD = 'C:\\Users\\HOANG ANH\\.gemini\\antigravity\\bin\\gdrive.cmd';

let isWritingExcel = false;
let lastWriteTimestamp = 0;
let sseClients = [];
let hasHydratedFromCloud = false;

// Cấu trúc dữ liệu mặc định cho Trường THPT Nguyễn Sinh Sắc (Phương án B)
const defaultState = {
  meta: {
    soGddt: 'tỉnh An Giang',
    nguoiPhuTrach: 'Thầy/Cô Phụ trách CNTT & Đoàn Trường',
    chucVuPhuTrach: 'Cán bộ phụ trách cuộc thi',
    dienThoaiPhuTrach: '02963 822 xxx',
    emailPhuTrach: 'c3nguyensinhsac@angiang.edu.vn',
    autoCountFromStudents: true,
    driveFolderId: DRIVE_FOLDER_ID,
    driveFolderUrl: DRIVE_FOLDER_URL,
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbykh0lOPK04OGlbq-FgocezIIGs1YdJhOypzmB9gZc6Dm9PSYzhOTx8d3WuxxggLHmBAA/exec',
    driveFileId: '',
    driveFileUrl: '',
    lastLocalSync: null,
    lastDriveSync: null,
    driveSyncStatus: 'ready', // 'synced' | 'syncing' | 'needs_auth' | 'error' | 'ready'
    driveSyncMessage: 'Đã sẵn sàng đồng bộ với thư mục Google Drive (1a_hJhS5wetmMRktY6qfSVCqNN3pQUuCb)'
  },
  bm01Rows: [
    {
      stt: 1,
      schoolName: 'Trường THPT Nguyễn Sinh Sắc',
      ward: 'Phường Long Thạnh, TX. Tân Châu, An Giang',
      studentCount: 0,
      contactName: 'Ban Tổ chức Cấp Trường - THPT Nguyễn Sinh Sắc',
      contactRole: 'Giáo viên phụ trách Tin học / Đoàn Thanh niên',
      contactEmail: 'c3nguyensinhsac@angiang.edu.vn',
      contactPhone: '0918000000'
    }
  ],
  students: []
};

// Thời gian thực theo múi giờ Việt Nam (UTC+7), định dạng dd/MM/yyyy HH:mm:ss — đúng cả khi chạy trên Vercel (máy chủ UTC)
function nowVN() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(new Date()).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.day}/${parts.month}/${parts.year} ${hh}:${parts.minute}:${parts.second}`;
}
let appState = loadInitialState();

function loadInitialState() {
  if (!IS_VERCEL && !fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  }
  const sourceJson = fs.existsSync(DB_JSON_PATH)
    ? DB_JSON_PATH
    : fs.existsSync(INITIAL_DB_JSON_PATH)
    ? INITIAL_DB_JSON_PATH
    : null;
  if (sourceJson) {
    try {
      const saved = JSON.parse(fs.readFileSync(sourceJson, 'utf8'));
      return {
        meta: { ...defaultState.meta, ...(saved.meta || {}) },
        bm01Rows: Array.isArray(saved.bm01Rows) && saved.bm01Rows.length > 0 ? saved.bm01Rows : defaultState.bm01Rows,
        students: Array.isArray(saved.students) ? saved.students : []
      };
    } catch (e) {
      console.error('Lỗi đọc db-state.json:', e.message);
    }
  }
  return JSON.parse(JSON.stringify(defaultState));
}

function saveJsonState() {
  try {
    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(appState, null, 2), 'utf8');
  } catch (e) {
    console.error('Lỗi lưu db-state.json:', e.message);
  }
}

function extractPlainText(cellValue) {
  if (cellValue === null || cellValue === undefined) return '';
  if (typeof cellValue === 'string' || typeof cellValue === 'number') return String(cellValue).trim();
  if (typeof cellValue === 'object') {
    if (cellValue.richText && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map(rt => rt.text || '').join('').trim();
    }
    if (cellValue.text) {
      return typeof cellValue.text === 'string' ? cellValue.text.trim() : extractPlainText(cellValue.text);
    }
    if (cellValue.result !== undefined) return String(cellValue.result).trim();
  }
  return '';
}

function parseHeaderField(rawText, prefix) {
  if (!rawText) return '';
  const idx = rawText.indexOf(':');
  if (idx !== -1) {
    return rawText.slice(idx + 1).trim();
  }
  return rawText.replace(prefix, '').trim();
}

/**
 * Đọc dữ liệu từ file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx (Đồng bộ chiều Excel Local -> Web)
 */
async function readFromLocalExcel() {
  if (!fs.existsSync(EXCEL_PATH)) return false;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);

    // 1. Đọc Sheet 1: Mẫu 1 (Bảng BM01 chuẩn)
    const ws1 = wb.getWorksheet('Mẫu 1') || wb.worksheets[0];
    if (ws1) {
      const a3 = extractPlainText(ws1.getCell('A3').value);
      const a4 = extractPlainText(ws1.getCell('A4').value);
      const g4 = extractPlainText(ws1.getCell('G4').value);
      const a5 = extractPlainText(ws1.getCell('A5').value);
      const g5 = extractPlainText(ws1.getCell('G5').value);

      const soGddtVal = parseHeaderField(a3, 'Sở Giáo dục và Đào tạo:');
      const nguoiPtVal = parseHeaderField(a4, 'Người phụ trách đăng ký:');
      const chucVuVal = parseHeaderField(g4, 'Chức vụ:');
      const sdtVal = parseHeaderField(a5, 'Điện thoại liên hệ:');
      const emailVal = parseHeaderField(g5, 'Email:');

      if (soGddtVal) appState.meta.soGddt = soGddtVal;
      if (nguoiPtVal) appState.meta.nguoiPhuTrach = nguoiPtVal;
      if (chucVuVal) appState.meta.chucVuPhuTrach = chucVuVal;
      if (sdtVal) appState.meta.dienThoaiPhuTrach = sdtVal;
      if (emailVal) appState.meta.emailPhuTrach = emailVal;

      const parsedRows = [];
      for (let r = 9; r <= ws1.rowCount; r++) {
        const aVal = extractPlainText(ws1.getCell(r, 1).value);
        const bVal = extractPlainText(ws1.getCell(r, 2).value);
        const cVal = extractPlainText(ws1.getCell(r, 3).value);
        const dVal = extractPlainText(ws1.getCell(r, 4).value);
        const eVal = extractPlainText(ws1.getCell(r, 5).value);
        const fVal = extractPlainText(ws1.getCell(r, 6).value);
        const gVal = extractPlainText(ws1.getCell(r, 7).value);
        const hVal = extractPlainText(ws1.getCell(r, 8).value);

        // Dừng khi gặp dòng "..." hoặc dòng ghi chú cuối bảng
        if (
          aVal === '...' ||
          aVal.startsWith('Vui lòng thêm dòng') ||
          aVal.startsWith('(*):') ||
          aVal.startsWith('Đơn vị đăng ký') ||
          aVal.startsWith('- ')
        ) {
          break;
        }

        const hasContent = bVal || cVal || dVal || eVal || fVal || gVal || hVal;
        if (hasContent) {
          parsedRows.push({
            stt: parsedRows.length + 1,
            schoolName: bVal || 'Trường THPT Nguyễn Sinh Sắc',
            ward: cVal || 'Tân Châu - An Giang',
            studentCount: parseInt(dVal, 10) || 0,
            contactName: eVal || '',
            contactRole: fVal || '',
            contactEmail: gVal || '',
            contactPhone: hVal || ''
          });
        }
      }

      if (parsedRows.length > 0) {
        appState.bm01Rows = parsedRows;
      }
    }

    // 2. Đọc file CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx (hoặc Sheet 2 nếu có)
    let ws2 = wb.getWorksheet('DS Thí Sinh Đăng Ký');
    if (!ws2 && fs.existsSync(STUDENTS_EXCEL_PATH)) {
      try {
        const wbSt = new ExcelJS.Workbook();
        await wbSt.xlsx.readFile(STUDENTS_EXCEL_PATH);
        ws2 = wbSt.getWorksheet('DS Thí Sinh Đăng Ký') || wbSt.worksheets[0];
      } catch (_) {}
    }
    if (ws2 && ws2.rowCount >= 5) {
      const parsedStudents = [];
      for (let r = 5; r <= ws2.rowCount; r++) {
        const code = extractPlainText(ws2.getCell(r, 2).value);
        const fullName = extractPlainText(ws2.getCell(r, 3).value);
        if (!fullName) continue;
        parsedStudents.push({
          id: code || `NSS-AI-${String(parsedStudents.length + 1).padStart(3, '0')}`,
          fullName: fullName,
          dob: extractPlainText(ws2.getCell(r, 4).value),
          gender: extractPlainText(ws2.getCell(r, 5).value) || 'Nam',
          className: extractPlainText(ws2.getCell(r, 6).value),
          cccd: extractPlainText(ws2.getCell(r, 7).value),
          phone: extractPlainText(ws2.getCell(r, 8).value),
          email: extractPlainText(ws2.getCell(r, 9).value),
          examLang: extractPlainText(ws2.getCell(r, 10).value) || 'Tiếng Việt',
          parentName: extractPlainText(ws2.getCell(r, 11).value),
          parentPhone: extractPlainText(ws2.getCell(r, 12).value),
          consent: true,
          createdAt: extractPlainText(ws2.getCell(r, 14).value) || nowVN()
        });
      }
      if (parsedStudents.length > 0 || appState.students.length === 0) {
        appState.students = parsedStudents;
      }
    }

    if (appState.meta.autoCountFromStudents && appState.bm01Rows.length > 0 && appState.students.length > 0) {
      appState.bm01Rows[0].studentCount = appState.students.length;
    }

    appState.meta.lastLocalSync = new Date().toISOString();
    saveJsonState();
    return true;
  } catch (err) {
    console.error('Lỗi đọc file Excel BM01:', err.message);
    return false;
  }
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildBm01TemplateXmls(meta, bm01Rows) {
  const cleanSoGddt = String(meta.soGddt || 'Tỉnh An Giang')
    .replace(/^Sở Giáo dục và Đào tạo\s*:?\s*/i, '')
    .trim();

  const baseSiXmls = [
    `<si><t>DANH SÁCH CÁC TRƯỜNG ĐĂNG KÝ THAM DỰ VÒNG THI CẤP CƠ SỞ \nCUỘC THI AI OR BEHIND NĂM HỌC 2026 - 2027</t></si>`,
    `<si><t>${escapeXml(cleanSoGddt ? `Sở Giáo dục và Đào tạo: ${cleanSoGddt}` : 'Sở Giáo dục và Đào tạo:')}</t></si>`,
    `<si><t>${escapeXml(meta.nguoiPhuTrach ? `Người phụ trách đăng ký: ${meta.nguoiPhuTrach}` : 'Người phụ trách đăng ký:')}</t></si>`,
    `<si><t>${escapeXml(meta.chucVuPhuTrach ? `Chức vụ: ${meta.chucVuPhuTrach}` : 'Chức vụ:')}</t></si>`,
    `<si><t>${escapeXml(meta.dienThoaiPhuTrach ? `Điện thoại liên hệ: ${meta.dienThoaiPhuTrach}` : 'Điện thoại liên hệ:')}</t></si>`,
    `<si><t>${escapeXml(meta.emailPhuTrach ? `Email: ${meta.emailPhuTrach}` : 'Email:')}</t></si>`,
    `<si><t>STT</t></si>`,
    `<si><t>Tên trường THPT\n(*)</t></si>`,
    `<si><t>Phường/Xã trực thuộc\n(*)</t></si>`,
    `<si><t>Số lượng thí sinh đăng ký tham dự\n(*)</t></si>`,
    `<si><t>Thông tin đầu mối nhận code bài thi Gmetrix\n(*)</t></si>`,
    `<si><t>Họ và tên\n(*)</t></si>`,
    `<si><t>Chức vụ\n(*)</t></si>`,
    `<si><t>Email\n(*)</t></si>`,
    `<si><t>Số điện thoại\n(*)</t></si>`,
    `<si><t>...</t></si>`,
    `<si><t>Vui lòng thêm dòng để điền thêm thông tin đăng ký</t></si>`,
    `<si><t>(*): là các thông tin bắt buộc để BTC căn cứ thông tin cấp mã code bài thi Gmetrix, đơn vị đăng ký vui lòng điền đầy đủ nội dung vào các trường thông tin này.</t></si>`,
    `<si><t>Đơn vị đăng ký danh sách tham gia cuộc thi phải chịu trách nhiệm:</t></si>`,
    `<si><t xml:space="preserve">- Đảm bảo các thông tin đã cung cấp là chính xác. Trường hợp thông tin kê khai không đúng thực tế, Ban Tổ chức có quyền không ghi nhận kết quả. </t></si>`,
    `<si><r><rPr><b/><i/><sz val="12"/><color rgb="FF1F1F1F"/><rFont val="Times New Roman"/><family val="1"/></rPr><t xml:space="preserve">- Ghi nhận sự đồng ý của thí sinh về việc cho Ban Tổ chức thu thập xử lý và sử dụng dữ liệu cá nhân phục vụ mục đích tổ chức, vận hành và truyền thông của chương trình, theo Chính sách bảo vệ dữ liệu cá nhân của IIG Việt Nam công bố tại: </t></r><r><rPr><b/><i/><u/><sz val="12"/><color rgb="FF1155CC"/><rFont val="Times New Roman"/><family val="1"/></rPr><t>https://iigvietnam.com/chinh-sach-bao-mat-thong-tin-khach-hang/</t></r><r><rPr><b/><i/><sz val="12"/><color rgb="FF1F1F1F"/><rFont val="Times New Roman"/><family val="1"/></rPr><t xml:space="preserve">  </t></r></si>`,
    `<si><t>- Người đại diện theo pháp luật/giám hộ (Trường hợp Thí sinh dưới 18 tuổi) cam kết chịu trách nhiệm giám sát, hướng dẫn Thí sinh tham gia Cuộc thi và chịu trách nhiệm pháp lý đối với sự đồng ý nêu trên.</t></si>`
  ];

  const addSharedString = (val) => {
    const idx = baseSiXmls.length;
    baseSiXmls.push(`<si><t>${escapeXml(val)}</t></si>`);
    return idx;
  };

  const rowsToWrite = Array.isArray(bm01Rows) && bm01Rows.length > 0 ? bm01Rows : defaultState.bm01Rows;
  const totalSlots = Math.max(5, rowsToWrite.length);
  const extra = totalSlots - 5;

  const dataRowsXml = [];
  for (let i = 0; i < totalSlots; i++) {
    const rNum = 9 + i;
    const rowData = rowsToWrite[i];
    const styles =
      i === 0
        ? [26, 26, 32, 32, 31, 33, 27, 27]
        : i === 1
        ? [26, 26, 26, 26, 28, 28, 29, 29]
        : [26, 26, 26, 26, 26, 26, 30, 30];

    const colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cells = [`<c r="A${rNum}" s="${styles[0]}"><v>${i + 1}</v></c>`];

    const hasContent =
      rowData &&
      (rowData.schoolName ||
        rowData.ward ||
        rowData.studentCount ||
        rowData.contactName ||
        rowData.contactRole ||
        rowData.contactEmail ||
        rowData.contactPhone);

    if (hasContent) {
      const strFields = [
        { colIdx: 1, val: rowData.schoolName },
        { colIdx: 2, val: rowData.ward },
        { colIdx: 3, isNum: true, val: Number(rowData.studentCount) || 0 },
        { colIdx: 4, val: rowData.contactName },
        { colIdx: 5, val: rowData.contactRole },
        { colIdx: 6, val: rowData.contactEmail },
        { colIdx: 7, val: rowData.contactPhone }
      ];
      for (const f of strFields) {
        const ref = `${colLetters[f.colIdx]}${rNum}`;
        const st = styles[f.colIdx];
        if (f.isNum) {
          cells.push(`<c r="${ref}" s="${st}"><v>${f.val}</v></c>`);
        } else if (f.val && String(f.val).trim()) {
          const ssIdx = addSharedString(String(f.val).trim());
          cells.push(`<c r="${ref}" s="${st}" t="s"><v>${ssIdx}</v></c>`);
        } else {
          cells.push(`<c r="${ref}" s="${st}"/>`);
        }
      }
    } else {
      for (let c = 1; c < 8; c++) {
        cells.push(`<c r="${colLetters[c]}${rNum}" s="${styles[c]}"/>`);
      }
    }

    dataRowsXml.push(`<row r="${rNum}" spans="1:15" ht="25.15" customHeight="1">${cells.join('')}</row>`);
  }

  const r14 = 14 + extra;
  const r15 = 15 + extra;
  const r16 = 16 + extra;
  const r17 = 17 + extra;
  const r18 = 18 + extra;
  const r19 = 19 + extra;
  const r20 = 20 + extra;
  const r21 = 21 + extra;
  const r22 = 22 + extra;

  const sheet1Xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0000-000000000000}">` +
    `<sheetPr><outlinePr summaryBelow="0" summaryRight="0"/><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<dimension ref="A1:O${r22}"/>` +
    `<sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"><selection activeCell="A7" sqref="A7:A8"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultColWidth="12.7109375" defaultRowHeight="15.75" customHeight="1"/>` +
    `<cols><col min="1" max="1" width="8.28515625" customWidth="1"/><col min="2" max="3" width="25.7109375" customWidth="1"/><col min="4" max="4" width="22.140625" customWidth="1"/><col min="5" max="6" width="25.7109375" customWidth="1"/><col min="7" max="7" width="21.85546875" customWidth="1"/><col min="8" max="8" width="21.5703125" customWidth="1"/></cols>` +
    `<sheetData>` +
    `<row r="1" spans="1:15" ht="58.5" customHeight="1"><c r="A1" s="38"/><c r="B1" s="38"/><c r="C1" s="38"/><c r="D1" s="38"/><c r="E1" s="38"/><c r="F1" s="22"/></row>` +
    `<row r="2" spans="1:15" ht="45" customHeight="1"><c r="A2" s="39" t="s"><v>0</v></c><c r="B2" s="39"/><c r="C2" s="39"/><c r="D2" s="39"/><c r="E2" s="39"/><c r="F2" s="39"/><c r="G2" s="39"/><c r="H2" s="39"/></row>` +
    `<row r="3" spans="1:15" s="9" customFormat="1" ht="25.9" customHeight="1"><c r="A3" s="7" t="s"><v>1</v></c><c r="B3" s="7"/><c r="C3" s="7"/><c r="D3" s="7"/><c r="E3" s="7"/><c r="F3" s="7"/><c r="G3" s="10"/><c r="H3" s="10"/><c r="I3" s="10"/><c r="J3" s="10"/><c r="K3" s="11"/><c r="L3" s="10"/><c r="M3" s="10"/><c r="N3" s="10"/><c r="O3" s="8"/></row>` +
    `<row r="4" spans="1:15" s="9" customFormat="1" ht="25.9" customHeight="1"><c r="A4" s="7" t="s"><v>2</v></c><c r="B4" s="18"/><c r="C4" s="18"/><c r="D4" s="18"/><c r="E4" s="18"/><c r="F4" s="18"/><c r="G4" s="23" t="s"><v>3</v></c><c r="H4" s="12"/><c r="I4" s="11"/><c r="J4" s="11"/><c r="K4" s="11"/><c r="L4" s="10"/><c r="M4" s="10"/><c r="N4" s="10"/><c r="O4" s="8"/></row>` +
    `<row r="5" spans="1:15" s="9" customFormat="1" ht="25.9" customHeight="1"><c r="A5" s="7" t="s"><v>4</v></c><c r="B5" s="7"/><c r="C5" s="7"/><c r="D5" s="7"/><c r="E5" s="7"/><c r="F5" s="7"/><c r="G5" s="23" t="s"><v>5</v></c><c r="H5" s="12"/><c r="I5" s="11"/><c r="J5" s="11"/><c r="K5" s="11"/><c r="L5" s="10"/><c r="M5" s="10"/><c r="N5" s="10"/><c r="O5" s="8"/></row>` +
    `<row r="6" spans="1:15"><c r="A6" s="13"/><c r="B6" s="6"/><c r="C6" s="6"/><c r="D6" s="6"/><c r="E6" s="6"/><c r="F6" s="6"/><c r="G6" s="2"/><c r="H6" s="2"/><c r="I6" s="3"/><c r="J6" s="3"/><c r="K6" s="2"/><c r="L6" s="2"/><c r="M6" s="2"/></row>` +
    `<row r="7" spans="1:15" ht="40.15" customHeight="1"><c r="A7" s="42" t="s"><v>6</v></c><c r="B7" s="42" t="s"><v>7</v></c><c r="C7" s="34" t="s"><v>8</v></c><c r="D7" s="34" t="s"><v>9</v></c><c r="E7" s="44" t="s"><v>10</v></c><c r="F7" s="44"/><c r="G7" s="44"/><c r="H7" s="44"/><c r="I7" s="4"/><c r="J7" s="4"/><c r="K7" s="4"/><c r="L7" s="4"/><c r="M7" s="4"/><c r="N7" s="4"/><c r="O7" s="4"/></row>` +
    `<row r="8" spans="1:15" ht="42.75" customHeight="1"><c r="A8" s="43"/><c r="B8" s="43"/><c r="C8" s="35"/><c r="D8" s="35"/><c r="E8" s="24" t="s"><v>11</v></c><c r="F8" s="25" t="s"><v>12</v></c><c r="G8" s="25" t="s"><v>13</v></c><c r="H8" s="25" t="s"><v>14</v></c><c r="I8" s="4"/><c r="J8" s="4"/><c r="K8" s="4"/><c r="L8" s="4"/><c r="M8" s="4"/><c r="N8" s="4"/><c r="O8" s="4"/></row>` +
    dataRowsXml.join('') +
    `<row r="${r14}" spans="1:15" ht="25.15" customHeight="1"><c r="A${r14}" s="5" t="s"><v>15</v></c><c r="B${r14}" s="5"/><c r="C${r14}" s="5"/><c r="D${r14}" s="5"/><c r="E${r14}" s="5"/><c r="F${r14}" s="5"/><c r="G${r14}" s="21"/><c r="H${r14}" s="21"/></row>` +
    `<row r="${r15}" spans="1:15" ht="26.45" customHeight="1"><c r="A${r15}" s="16" t="s"><v>16</v></c><c r="B${r15}" s="6"/><c r="C${r15}" s="6"/><c r="D${r15}" s="6"/><c r="E${r15}" s="6"/><c r="F${r15}" s="6"/></row>` +
    `<row r="${r16}" spans="1:15" ht="36" customHeight="1"><c r="A${r16}" s="36" t="s"><v>17</v></c><c r="B${r16}" s="36"/><c r="C${r16}" s="36"/><c r="D${r16}" s="36"/><c r="E${r16}" s="36"/><c r="F${r16}" s="36"/><c r="G${r16}" s="36"/><c r="H${r16}" s="36"/></row>` +
    `<row r="${r17}" spans="1:10" ht="37.5" customHeight="1"><c r="A${r17}" s="19" t="s"><v>18</v></c><c r="B${r17}" s="20"/><c r="C${r17}" s="20"/><c r="D${r17}" s="20"/><c r="E${r17}" s="20"/><c r="F${r17}" s="20"/><c r="G${r17}" s="20"/><c r="H${r17}" s="20"/></row>` +
    `<row r="${r18}" spans="1:10" ht="37.5" customHeight="1"><c r="A${r18}" s="41" t="s"><v>19</v></c><c r="B${r18}" s="41"/><c r="C${r18}" s="41"/><c r="D${r18}" s="41"/><c r="E${r18}" s="41"/><c r="F${r18}" s="41"/><c r="G${r18}" s="41"/><c r="H${r18}" s="41"/><c r="I${r18}" s="14"/><c r="J${r18}" s="14"/></row>` +
    `<row r="${r19}" spans="1:10" ht="46.5" customHeight="1"><c r="A${r19}" s="40" t="s"><v>20</v></c><c r="B${r19}" s="40"/><c r="C${r19}" s="40"/><c r="D${r19}" s="40"/><c r="E${r19}" s="40"/><c r="F${r19}" s="40"/><c r="G${r19}" s="40"/><c r="H${r19}" s="40"/><c r="I${r19}" s="15"/><c r="J${r19}" s="15"/></row>` +
    `<row r="${r20}" spans="1:10" ht="47.25" customHeight="1"><c r="A${r20}" s="37" t="s"><v>21</v></c><c r="B${r20}" s="37"/><c r="C${r20}" s="37"/><c r="D${r20}" s="37"/><c r="E${r20}" s="37"/><c r="F${r20}" s="37"/><c r="G${r20}" s="37"/><c r="H${r20}" s="37"/><c r="I${r20}" s="17"/><c r="J${r20}" s="17"/></row>` +
    `<row r="${r21}" spans="1:10" ht="15.75" customHeight="1"><c r="A${r21}" s="1"/><c r="B${r21}" s="1"/><c r="C${r21}" s="1"/><c r="D${r21}" s="1"/><c r="E${r21}" s="1"/><c r="F${r21}" s="1"/></row>` +
    `<row r="${r22}" spans="1:10" ht="15.75" customHeight="1"><c r="A${r22}" s="1"/><c r="B${r22}" s="1"/><c r="C${r22}" s="1"/><c r="D${r22}" s="1"/><c r="E${r22}" s="1"/><c r="F${r22}" s="1"/></row>` +
    `</sheetData>` +
    `<mergeCells count="11"><mergeCell ref="C7:C8"/><mergeCell ref="A${r16}:H${r16}"/><mergeCell ref="A${r20}:H${r20}"/><mergeCell ref="A1:E1"/><mergeCell ref="A2:H2"/><mergeCell ref="A${r19}:H${r19}"/><mergeCell ref="A${r18}:H${r18}"/><mergeCell ref="A7:A8"/><mergeCell ref="B7:B8"/><mergeCell ref="D7:D8"/><mergeCell ref="E7:H7"/></mergeCells>` +
    `<hyperlinks><hyperlink ref="A${r19}" r:id="rId1" display="Việc đăng ký tham gia chương trình đồng nghĩa với việc thí sinh đồng ý cho Ban Tổ chức thu thập, xử lý và sử dụng dữ liệu cá nhân phục vụ mục đích tổ chức, vận hành và truyền thông của chương trình, theo Chính sách bảo vệ dữ liệu cá nhân của IIG Việt Nam " xr:uid="{00000000-0004-0000-0000-000000000000}"/></hyperlinks>` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" scale="80" fitToHeight="0" orientation="landscape" r:id="rId2"/>` +
    `<drawing r:id="rId3"/></worksheet>`;

  const sharedStringsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${baseSiXmls.length}" uniqueCount="${baseSiXmls.length}">` +
    baseSiXmls.join('') +
    `</sst>`;

  return { sheet1Xml, sharedStringsXml };
}

function writeTemplateZipWithReplacements(templateZipPath, outputZipPath, replacementsMap) {
  const buf = fs.readFileSync(templateZipPath);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid XLSX template ZIP archive');

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const localParts = [];
  const cdParts = [];
  let currentLocalOffset = 0;
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    const versionMadeBy = buf.readUInt16LE(ptr + 4);
    const versionNeeded = buf.readUInt16LE(ptr + 6);
    let flags = buf.readUInt16LE(ptr + 8);
    let method = buf.readUInt16LE(ptr + 10);
    const modTime = buf.readUInt16LE(ptr + 12);
    const modDate = buf.readUInt16LE(ptr + 14);
    let crc = buf.readUInt32LE(ptr + 16);
    let compSize = buf.readUInt32LE(ptr + 20);
    let uncompSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const diskNum = buf.readUInt16LE(ptr + 34);
    const internalAttr = buf.readUInt16LE(ptr + 36);
    const externalAttr = buf.readUInt32LE(ptr + 38);
    const oldLocalOffset = buf.readUInt32LE(ptr + 42);

    const nameBuf = buf.slice(ptr + 46, ptr + 46 + nameLen);
    const nameStr = nameBuf.toString('utf8');
    const cdExtraBuf = buf.slice(ptr + 46 + nameLen, ptr + 46 + nameLen + extraLen);
    const cdCommentBuf = buf.slice(ptr + 46 + nameLen + extraLen, ptr + 46 + nameLen + extraLen + commentLen);

    const localNameLen = buf.readUInt16LE(oldLocalOffset + 26);
    const localExtraLen = buf.readUInt16LE(oldLocalOffset + 28);
    const localExtraBuf = buf.slice(oldLocalOffset + 30 + localNameLen, oldLocalOffset + 30 + localNameLen + localExtraLen);
    const oldDataStart = oldLocalOffset + 30 + localNameLen + localExtraLen;
    let compDataBuf = buf.slice(oldDataStart, oldDataStart + compSize);

    if (Object.prototype.hasOwnProperty.call(replacementsMap, nameStr)) {
      const rawBuf = Buffer.isBuffer(replacementsMap[nameStr])
        ? replacementsMap[nameStr]
        : Buffer.from(String(replacementsMap[nameStr]), 'utf8');
      crc = zlib.crc32(rawBuf) >>> 0;
      compDataBuf = zlib.deflateRawSync(rawBuf);
      compSize = compDataBuf.length;
      uncompSize = rawBuf.length;
      method = 8;
    }

    // Build Local File Header
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(versionNeeded, 4);
    lfh.writeUInt16LE(flags, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(modTime, 10);
    lfh.writeUInt16LE(modDate, 12);
    lfh.writeUInt32LE(crc >>> 0, 14);
    lfh.writeUInt32LE(compSize >>> 0, 18);
    lfh.writeUInt32LE(uncompSize >>> 0, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(localExtraBuf.length, 28);

    const newLocalOffset = currentLocalOffset;
    localParts.push(lfh, nameBuf, localExtraBuf, compDataBuf);
    currentLocalOffset += lfh.length + nameBuf.length + localExtraBuf.length + compDataBuf.length;

    // Build Central Directory Header
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(versionMadeBy, 4);
    cdh.writeUInt16LE(versionNeeded, 6);
    cdh.writeUInt16LE(flags, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(modTime, 12);
    cdh.writeUInt16LE(modDate, 14);
    cdh.writeUInt32LE(crc >>> 0, 16);
    cdh.writeUInt32LE(compSize >>> 0, 20);
    cdh.writeUInt32LE(uncompSize >>> 0, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(cdExtraBuf.length, 30);
    cdh.writeUInt16LE(cdCommentBuf.length, 32);
    cdh.writeUInt16LE(diskNum, 34);
    cdh.writeUInt16LE(internalAttr, 36);
    cdh.writeUInt32LE(externalAttr >>> 0, 38);
    cdh.writeUInt32LE(newLocalOffset >>> 0, 42);

    cdParts.push(cdh, nameBuf, cdExtraBuf, cdCommentBuf);
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  const cdBuffer = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(totalEntries, 8);
  eocd.writeUInt16LE(totalEntries, 10);
  eocd.writeUInt32LE(cdBuffer.length >>> 0, 12);
  eocd.writeUInt32LE(currentLocalOffset >>> 0, 16);
  eocd.writeUInt16LE(0, 20);

  const finalZip = Buffer.concat([...localParts, cdBuffer, eocd]);
  fs.writeFileSync(outputZipPath, finalZip);
}

async function writeStudentsDatabaseExcel() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DS Thí Sinh Đăng Ký');

  ws.mergeCells('A1:N1');
  ws.getCell('A1').value = 'CSDL HỌC SINH ĐĂNG KÝ DỰ THI AI OR BEHIND NĂM HỌC 2026 - 2027';
  ws.getCell('A1').font = { name: 'Times New Roman', size: 14, bold: true, color: { argb: 'FF1B3189' } };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:N2');
  ws.getCell('A2').value = `Đơn vị: TRƯỜNG THPT NGUYỄN SINH SẮC (Tân Châu - An Giang) | Tổng số đã đăng ký: ${appState.students.length} / 500 suất`;
  ws.getCell('A2').font = { name: 'Times New Roman', size: 12, bold: true, italic: true, color: { argb: 'FFE11D48' } };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 22;

  const headers = [
    'STT',
    'Mã ĐK',
    'Họ và tên học sinh (*)',
    'Ngày sinh (*)',
    'Giới tính',
    'Lớp (*)',
    'Số CCCD / Định danh (*)',
    'SĐT Học sinh (*)',
    'Email nhận code Gmetrix (*)',
    'Ngôn ngữ bài thi (*)',
    'Họ tên Phụ huynh / Giám hộ (*)',
    'SĐT Phụ huynh (*)',
    'Cam kết dữ liệu (*)',
    'Thời gian đăng ký'
  ];

  const headerRow = ws.getRow(4);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3189' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  headerRow.height = 28;

  appState.students.forEach((st, idx) => {
    const r = ws.getRow(5 + idx);
    const vals = [
      idx + 1,
      st.id || `NSS-AI-${String(idx + 1).padStart(3, '0')}`,
      st.fullName || '',
      st.dob || '',
      st.gender || '',
      st.className || '',
      st.cccd || '',
      st.phone || '',
      st.email || '',
      st.examLang || 'Tiếng Việt',
      st.parentName || '',
      st.parentPhone || '',
      st.consent ? 'Đã đồng ý (IIG & Phụ huynh)' : 'Chưa đồng ý',
      st.createdAt || ''
    ];
    vals.forEach((v, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.value = v;
      cell.font = { name: 'Times New Roman', size: 11 };
      cell.alignment = {
        horizontal: [0, 1, 3, 4, 5, 9].includes(cIdx) ? 'center' : 'left',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    r.height = 22;
  });

  const colWidths = [6, 14, 26, 14, 10, 10, 18, 15, 26, 18, 24, 15, 24, 20];
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  await wb.xlsx.writeFile(STUDENTS_EXCEL_PATH);
}

/**
 * Ghi dữ liệu chuẩn xác vào file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx
 * GIỮ NGUYÊN 100% ĐỊNH DẠNG GỐC CỦA MẪU BAN ĐẦU (Logo Viettel & IIG, Fonts, Styles, Merged Cells, PageSetup, Sheet "Mẫu 1")
 * và đồng thời ghi file CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx
 */
async function writeToLocalExcel() {
  isWritingExcel = true;
  try {
    if (appState.meta.autoCountFromStudents && appState.bm01Rows.length > 0) {
      appState.bm01Rows[0].studentCount = appState.students.length;
    }

    const { sheet1Xml, sharedStringsXml } = buildBm01TemplateXmls(appState.meta, appState.bm01Rows);
    writeTemplateZipWithReplacements(TEMPLATE_PATH, EXCEL_PATH, {
      'xl/worksheets/sheet1.xml': sheet1Xml,
      'xl/sharedStrings.xml': sharedStringsXml
    });

    await writeStudentsDatabaseExcel();

    // Nếu thư mục Google Drive Desktop (G:\My Drive\IIGVN) đang mở trên máy -> Đồng bộ trực tiếp cả 2 file ngay lập tức
    if (fs.existsSync(MOUNTED_DRIVE_DIR)) {
      try {
        fs.copyFileSync(EXCEL_PATH, path.join(MOUNTED_DRIVE_DIR, 'BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx'));
        fs.copyFileSync(STUDENTS_EXCEL_PATH, path.join(MOUNTED_DRIVE_DIR, 'CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx'));
        fs.writeFileSync(
          path.join(MOUNTED_DRIVE_DIR, 'BM01-sync-state.json'),
          JSON.stringify({ meta: appState.meta, bm01Rows: appState.bm01Rows, students: appState.students }, null, 2),
          'utf8'
        );
        appState.meta.lastDriveSync = new Date().toISOString();
        appState.meta.driveSyncStatus = 'synced';
        appState.meta.driveSyncMessage = 'Đã đồng bộ trực tiếp BM01 & CSDL Học sinh đăng ký lên Google Drive (IIGVN)!';
      } catch (copyErr) {
        console.error('Lỗi ghi trực tiếp vào G:\\My Drive\\IIGVN:', copyErr.message);
      }
    }

    lastWriteTimestamp = Date.now();
    appState.meta.lastLocalSync = new Date().toISOString();
    saveJsonState();
    return true;
  } catch (err) {
    console.error('Lỗi ghi file Excel BM01:', err.message);
    return false;
  } finally {
    setTimeout(() => {
      isWritingExcel = false;
    }, 800);
  }
}

function uploadOrUpdateDriveFile(localFilePath, searchKeyword) {
  return new Promise((resolve) => {
    execFile(
      'cmd.exe',
      ['/c', GDRIVE_CMD, 'readonly', 'search', '--parent-id', DRIVE_FOLDER_ID, '--name-contains', searchKeyword, '--json'],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        const outStr = `${stdout || ''} ${stderr || ''}`;
        if (err && (outStr.includes('no credentials found') || outStr.includes('auth login') || outStr.includes('Not logged in'))) {
          return resolve({ ok: false, reason: 'needs_auth', message: outStr });
        }

        let existingFileId = '';
        try {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : (parsed.files || []);
          if (list.length > 0 && list[0].id) {
            existingFileId = list[0].id;
          }
        } catch (_) {}

        const args = existingFileId
          ? ['/c', GDRIVE_CMD, 'mutate', 'update', existingFileId, localFilePath]
          : ['/c', GDRIVE_CMD, 'mutate', 'upload', localFilePath, '--parent', DRIVE_FOLDER_ID];

        execFile('cmd.exe', args, { timeout: 25000 }, (upErr, upOut, upStderr) => {
          if (upErr) {
            return resolve({ ok: false, error: upStderr || upErr.message });
          }
          resolve({ ok: true, output: upOut });
        });
      }
    );
  });
}

/**
 * Đồng bộ lên Google Drive (Hỗ trợ cả Google Apps Script Bridge & gdrive CLI)
 * Tự động tải cả 2 file:
 * 1) BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx (Mẫu chuẩn IIG)
 * 2) CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx (CSDL chi tiết thông tin học sinh đăng ký)
 */
async function syncToGoogleDrive() {
  appState.meta.driveSyncStatus = 'syncing';
  broadcastSSE({ type: 'sync_status', meta: appState.meta });

  // 1. Nếu người dùng đã cấu hình Google Apps Script Web App URL -> Đồng bộ 2 chiều qua HTTPS
  if (appState.meta.appsScriptUrl && appState.meta.appsScriptUrl.startsWith('https://script.google.com/')) {
    try {
      const xlsxBase64 = fs.existsSync(EXCEL_PATH) ? fs.readFileSync(EXCEL_PATH).toString('base64') : null;
      const studentsXlsxBase64 = fs.existsSync(STUDENTS_EXCEL_PATH) ? fs.readFileSync(STUDENTS_EXCEL_PATH).toString('base64') : null;
      const res = await fetch(appState.meta.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: DRIVE_FOLDER_ID,
          data: {
            meta: appState.meta,
            bm01Rows: appState.bm01Rows,
            students: appState.students
          },
          xlsxBase64,
          studentsXlsxBase64
        })
      });
      const result = await res.json();
      if (result && result.ok) {
        appState.meta.lastDriveSync = new Date().toISOString();
        appState.meta.driveSyncStatus = 'synced';
        appState.meta.driveFileUrl = result.xlsxUrl || DRIVE_FOLDER_URL;
        appState.meta.driveSyncMessage = 'Đã đồng bộ 2 chiều CSDL Học sinh & BM01 lên Google Drive!';
        saveJsonState();
        broadcastSSE({ type: 'state_updated', state: appState });
        return { ok: true, mode: 'apps_script', result };
      }
    } catch (err) {
      console.error('Apps Script Sync Error:', err.message);
    }
  }

  // 2. Đồng bộ qua gdrive CLI (cả file BM01 gốc & file CSDL học sinh đăng ký)
  if (fs.existsSync(GDRIVE_CMD)) {
    const resBm01 = await uploadOrUpdateDriveFile(EXCEL_PATH, 'BM01-danh-sach-TS-vong-thi-cap-co-so');
    if (!resBm01.ok && resBm01.reason === 'needs_auth') {
      appState.meta.driveSyncStatus = 'needs_auth';
      appState.meta.driveSyncMessage = 'Cần đăng nhập Google Drive để đồng bộ tự động lên thư mục Drive.';
      saveJsonState();
      broadcastSSE({ type: 'state_updated', state: appState });
      return resBm01;
    }

    const resStudents = await uploadOrUpdateDriveFile(STUDENTS_EXCEL_PATH, 'CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac');
    if (resBm01.ok && resStudents.ok) {
      appState.meta.lastDriveSync = new Date().toISOString();
      appState.meta.driveSyncStatus = 'synced';
      appState.meta.driveSyncMessage = 'Đã đồng bộ cả 2 file (BM01 & CSDL Học sinh đăng ký) lên Google Drive!';
      saveJsonState();
      broadcastSSE({ type: 'state_updated', state: appState });
      return { ok: true, mode: 'gdrive_cli' };
    }
  }

  appState.meta.driveSyncStatus = 'ready';
  saveJsonState();
  return { ok: false, reason: 'no_bridge' };
}

/**
 * Kéo dữ liệu mới nhất từ Google Drive về Local Excel & Web (Chiều Google Drive -> Local/Web)
 */
async function pullFromGoogleDrive() {
  // 1. Qua Google Apps Script Web App
  if (appState.meta.appsScriptUrl && appState.meta.appsScriptUrl.startsWith('https://script.google.com/')) {
    try {
      const res = await fetch(`${appState.meta.appsScriptUrl}?action=pull`);
      const payload = await res.json();
      if (payload && payload.ok) {
        if (payload.xlsxBase64) {
          isWritingExcel = true;
          fs.writeFileSync(EXCEL_PATH, Buffer.from(payload.xlsxBase64, 'base64'));
          lastWriteTimestamp = Date.now();
          setTimeout(() => { isWritingExcel = false; }, 800);
          await readFromLocalExcel();
        } else if (payload.data) {
          if (payload.data.bm01Rows) appState.bm01Rows = payload.data.bm01Rows;
          if (payload.data.students) appState.students = payload.data.students;
          await writeToLocalExcel();
        }
        appState.meta.lastDriveSync = new Date().toISOString();
        appState.meta.driveSyncStatus = 'synced';
        appState.meta.driveSyncMessage = 'Đã tải và đồng bộ dữ liệu mới nhất từ Google Drive về máy!';
        saveJsonState();
        broadcastSSE({ type: 'state_updated', state: appState });
        return { ok: true, source: 'apps_script' };
      }
    } catch (e) {
      console.error('Pull from Apps Script error:', e.message);
    }
  }

  // 2. Qua gdrive CLI
  if (fs.existsSync(GDRIVE_CMD)) {
    return new Promise((resolve) => {
      execFile(
        'cmd.exe',
        ['/c', GDRIVE_CMD, 'readonly', 'search', '--parent-id', DRIVE_FOLDER_ID, '--name-contains', 'BM01-danh-sach-TS-vong-thi-cap-co-so', '--json'],
        { timeout: 12000 },
        (err, stdout) => {
          if (err) return resolve({ ok: false, error: err.message });
          let fileId = '';
          try {
            const parsed = JSON.parse(stdout);
            const list = Array.isArray(parsed) ? parsed : (parsed.files || []);
            if (list.length > 0) fileId = list[0].id;
          } catch (_) {}

          if (!fileId) return resolve({ ok: false, message: 'Chưa có file BM01 trên thư mục Drive, hệ thống sẽ tải file từ dự án lên.' });

          isWritingExcel = true;
          execFile(
            'cmd.exe',
            ['/c', GDRIVE_CMD, 'readonly', 'download', fileId, '--out', EXCEL_PATH],
            { timeout: 20000 },
            async (dlErr) => {
              setTimeout(() => { isWritingExcel = false; }, 800);
              if (dlErr) return resolve({ ok: false, error: dlErr.message });
              await readFromLocalExcel();
              appState.meta.lastDriveSync = new Date().toISOString();
              appState.meta.driveSyncStatus = 'synced';
              appState.meta.driveSyncMessage = 'Đã đồng bộ từ Google Drive về thư mục dự án!';
              saveJsonState();
              broadcastSSE({ type: 'state_updated', state: appState });
              resolve({ ok: true, source: 'gdrive_cli' });
            }
          );
        }
      );
    });
  }

  return { ok: false, message: 'Chưa cấu hình kết nối Google Drive.' };
}

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(payload);
    } catch (_) {}
  });
}

// Theo dõi sự thay đổi trực tiếp trên file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx trong thư mục dự án
let watchDebounce = null;
if (!IS_VERCEL && fs.existsSync(EXCEL_PATH)) {
  fs.watch(EXCEL_PATH, (eventType) => {
    if (isWritingExcel) return;
    if (Date.now() - lastWriteTimestamp < 1500) return;
    clearTimeout(watchDebounce);
    watchDebounce = setTimeout(async () => {
      console.log(`[File Watcher] Phát hiện thay đổi trực tiếp trên file ${path.basename(EXCEL_PATH)} (${eventType})`);
      const ok = await readFromLocalExcel();
      if (ok) {
        broadcastSSE({
          type: 'state_updated',
          state: appState,
          notification: 'Đã tự động cập nhật dữ liệu mới từ file Excel trong thư mục dự án!'
        });
        await syncToGoogleDrive();
      }
    }, 600);
  });
}

async function ensureCloudStateLoaded() {
  if (IS_VERCEL && !hasHydratedFromCloud) {
    hasHydratedFromCloud = true;
    try {
      await pullFromGoogleDrive();
    } catch (_) {}
  }
}

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';
const ADMIN_TOKEN = 'nss-admin-token-2026-2027';

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['x-admin-token'] || req.query.token || '';
  if (authHeader === ADMIN_TOKEN) {
    return next();
  }
  return res.status(401).json({
    ok: false,
    message: 'Vui lòng đăng nhập tài khoản Quản trị (admin) để thực hiện thao tác này!'
  });
}

// ==================== REST API ENDPOINTS ====================

// Đăng nhập trang Quản trị CSDL (Tài khoản: admin, Mật khẩu: admin)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (String(username || '').trim() === ADMIN_USER && String(password || '') === ADMIN_PASS) {
    return res.json({
      ok: true,
      token: ADMIN_TOKEN,
      user: { username: ADMIN_USER, role: 'Quản trị viên CSDL - THPT Nguyễn Sinh Sắc' }
    });
  }
  return res.status(401).json({
    ok: false,
    message: 'Sai tài khoản hoặc mật khẩu quản trị!'
  });
});

app.get('/api/admin/verify', (req, res) => {
  const token = req.headers['x-admin-token'] || '';
  res.json({ ok: token === ADMIN_TOKEN });
});

// SSE stream để đồng bộ thời gian thực trên mọi thiết bị (Điện thoại / Máy tính)
app.get('/api/stream', async (req, res) => {
  await ensureCloudStateLoaded();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', state: appState })}\n\n`);
  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// Lấy toàn bộ trạng thái CSDL (Mẫu BM01 + Danh sách học sinh + Trạng thái đồng bộ)
app.get('/api/state', async (req, res) => {
  await ensureCloudStateLoaded();
  res.json({ ok: true, state: appState });
});

function normalizeDobServer(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  }
  return s;
}

// Học sinh Trường THPT Nguyễn Sinh Sắc đăng ký tham gia
app.post('/api/students/register', async (req, res) => {
  try {
    await ensureCloudStateLoaded();
    const {
      fullName,
      dob,
      gender,
      className,
      cccd,
      phone,
      email,
      examLang,
      parentName,
      parentPhone,
      consent
    } = req.body;

    if (!fullName || !dob || !className || !phone || !email || !parentName || !parentPhone) {
      return res.status(400).json({
        ok: false,
        message: 'Vui lòng điền đầy đủ các trường thông tin bắt buộc (*)!'
      });
    }

    if (!consent) {
      return res.status(400).json({
        ok: false,
        message: 'Thí sinh và Phụ huynh cần đồng ý với quy định và chính sách bảo vệ dữ liệu cá nhân của BTC!'
      });
    }

    if (appState.students.length >= 500) {
      return res.status(400).json({
        ok: false,
        message: 'Trường THPT Nguyễn Sinh Sắc đã đạt giới hạn tối đa 500 suất thi Vòng cấp cơ sở theo quy định!'
      });
    }

    // Kiểm tra trùng SĐT hoặc CCCD
    const normalizedPhone = String(phone).trim();
    const normalizedCccd = String(cccd || '').trim();
    const duplicate = appState.students.find(
      (s) =>
        (normalizedCccd && s.cccd === normalizedCccd) ||
        (s.phone === normalizedPhone && s.fullName.toLowerCase() === String(fullName).trim().toLowerCase())
    );
    if (duplicate) {
      return res.status(400).json({
        ok: false,
        message: `Thí sinh "${fullName}" (Mã ĐK: ${duplicate.id}) đã có trong danh sách đăng ký!`
      });
    }

    const nextNum = appState.students.length + 1;
    const newStudent = {
      id: `NSS-AI-${String(nextNum).padStart(3, '0')}`,
      fullName: String(fullName).trim(),
      dob: normalizeDobServer(dob),
      gender: String(gender || 'Nam').trim(),
      className: String(className).trim().toUpperCase(),
      cccd: normalizedCccd,
      phone: normalizedPhone,
      email: String(email).trim(),
      examLang: examLang === 'Tiếng Anh' ? 'Tiếng Anh' : 'Tiếng Việt',
      parentName: String(parentName).trim(),
      parentPhone: String(parentPhone).trim(),
      consent: true,
      createdAt: nowVN()
    };

    appState.students.push(newStudent);
    if (appState.bm01Rows.length === 0) {
      appState.bm01Rows = JSON.parse(JSON.stringify(defaultState.bm01Rows));
    }
    if (appState.meta.autoCountFromStudents) {
      appState.bm01Rows[0].studentCount = appState.students.length;
    }

    await writeToLocalExcel();
    broadcastSSE({
      type: 'state_updated',
      state: appState,
      notification: `Chúc mừng ${newStudent.fullName} (Lớp ${newStudent.className}) đã đăng ký thành công!`
    });

    // Đồng bộ lên Google Drive (trên Vercel cần await để không bị ngắt tiến trình nền)
    if (IS_VERCEL) {
      await syncToGoogleDrive().catch(() => {});
    } else {
      syncToGoogleDrive().catch(() => {});
    }

    res.json({
      ok: true,
      message: 'Đăng ký tham gia Cuộc thi AI OR BEHIND 2026-2027 thành công!',
      student: newStudent,
      state: appState
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Lỗi máy chủ: ' + err.message });
  }
});

// Cập nhật hoặc xóa thông tin học sinh trong danh sách (Yêu cầu quyền Admin)
app.put('/api/students/:id', requireAdminAuth, async (req, res) => {
  await ensureCloudStateLoaded();
  const { id } = req.params;
  const idx = appState.students.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, message: 'Không tìm thấy thí sinh!' });

  appState.students[idx] = {
    ...appState.students[idx],
    ...req.body,
    dob: req.body.dob ? normalizeDobServer(req.body.dob) : normalizeDobServer(appState.students[idx].dob),
    id: appState.students[idx].id
  };

  await writeToLocalExcel();
  broadcastSSE({ type: 'state_updated', state: appState });
  if (IS_VERCEL) {
    await syncToGoogleDrive().catch(() => {});
  } else {
    syncToGoogleDrive().catch(() => {});
  }
  res.json({ ok: true, state: appState });
});

app.delete('/api/students/:id', requireAdminAuth, async (req, res) => {
  await ensureCloudStateLoaded();
  const { id } = req.params;
  appState.students = appState.students.filter((s) => s.id !== id);
  appState.students.forEach((s, i) => {
    s.id = `NSS-AI-${String(i + 1).padStart(3, '0')}`;
  });
  if (appState.meta.autoCountFromStudents && appState.bm01Rows.length > 0) {
    appState.bm01Rows[0].studentCount = appState.students.length;
  }

  await writeToLocalExcel();
  broadcastSSE({ type: 'state_updated', state: appState });
  if (IS_VERCEL) {
    await syncToGoogleDrive().catch(() => {});
  } else {
    syncToGoogleDrive().catch(() => {});
  }
  res.json({ ok: true, state: appState });
});

// Cập nhật trực tiếp bảng BM01 (Header + các dòng trường THPT trên giao diện Web)
app.post('/api/bm01/update', requireAdminAuth, async (req, res) => {
  try {
    await ensureCloudStateLoaded();
    const { meta, bm01Rows } = req.body;
    if (meta) {
      appState.meta = { ...appState.meta, ...meta };
    }
    if (Array.isArray(bm01Rows)) {
      appState.bm01Rows = bm01Rows.map((r, idx) => ({
        stt: idx + 1,
        schoolName: String(r.schoolName || 'Trường THPT Nguyễn Sinh Sắc').trim(),
        ward: String(r.ward || '').trim(),
        studentCount: Number(r.studentCount) || 0,
        contactName: String(r.contactName || '').trim(),
        contactRole: String(r.contactRole || '').trim(),
        contactEmail: String(r.contactEmail || '').trim(),
        contactPhone: String(r.contactPhone || '').trim()
      }));
    }

    await writeToLocalExcel();
    broadcastSSE({
      type: 'state_updated',
      state: appState,
      notification: 'Đã lưu biểu mẫu BM01 vào file Excel trong thư mục dự án!'
    });

    const syncRes = await syncToGoogleDrive();
    res.json({ ok: true, state: appState, sync: syncRes });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Đồng bộ thủ công 2 chiều (Đẩy lên Drive / Kéo từ Drive / Đọc lại từ Excel Local)
app.post('/api/sync', requireAdminAuth, async (req, res) => {
  const { direction, appsScriptUrl } = req.body || {};
  if (appsScriptUrl !== undefined) {
    appState.meta.appsScriptUrl = String(appsScriptUrl).trim();
    saveJsonState();
  }

  if (direction === 'from_local_excel') {
    await readFromLocalExcel();
    broadcastSSE({ type: 'state_updated', state: appState });
    return res.json({ ok: true, message: 'Đã đọc lại file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx từ thư mục dự án!', state: appState });
  }

  if (direction === 'from_drive') {
    const pullRes = await pullFromGoogleDrive();
    return res.json({ ...pullRes, state: appState });
  }

  // Mặc định: Ghi xuống Local Excel trước rồi đồng bộ lên Google Drive
  await writeToLocalExcel();
  const pushRes = await syncToGoogleDrive();
  res.json({ ok: true, sync: pushRes, state: appState });
});

// Tải file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx trực tiếp từ trình duyệt (Giữ nguyên 100% định dạng mẫu gốc)
app.get('/api/download-bm01', async (req, res) => {
  await ensureCloudStateLoaded();
  await writeToLocalExcel();
  res.download(EXCEL_PATH, 'BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx');
});

// Tải file CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx (Danh sách học sinh đăng ký chi tiết)
app.get('/api/download-students-excel', async (req, res) => {
  await ensureCloudStateLoaded();
  await writeToLocalExcel();
  res.download(STUDENTS_EXCEL_PATH, 'CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx');
});

// Trang Dashboard Admin Quản lý CSDL
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Lấy nội dung mã Google Apps Script để người dùng copy nhanh nếu muốn
app.get('/api/apps-script-code', (req, res) => {
  const scriptPath = path.join(__dirname, 'google-drive-sync-script.gs');
  const code = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';
  res.json({ ok: true, code, folderId: DRIVE_FOLDER_ID, folderUrl: DRIVE_FOLDER_URL });
});

// Khởi tạo dữ liệu ban đầu vào file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx khi chạy máy chủ Local
if (!IS_VERCEL) {
  (async () => {
    await readFromLocalExcel();
    await writeToLocalExcel();
    app.listen(PORT, () => {
      console.log(`================================================================`);
      console.log(`🚀 CỔNG THÔNG TIN & ĐĂNG KÝ CUỘC THI AI OR BEHIND 2026 - 2027`);
      console.log(`🏫 ĐƠN VỊ: TRƯỜNG THPT NGUYỄN SINH SẮC (TÂN CHÂU - AN GIANG)`);
      console.log(`🌐 Địa chỉ Web: http://localhost:${PORT}`);
      console.log(`📂 CSDL Local: ${EXCEL_PATH}`);
      console.log(`☁️  Google Drive: ${DRIVE_FOLDER_URL}`);
      console.log(`================================================================`);
    });
  })();
}

module.exports = app;

