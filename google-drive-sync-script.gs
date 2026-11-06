/**
 * GOOGLE APPS SCRIPT - CẦU NỐI ĐỒNG BỘ CSDL THỜI GIAN THỰC (WEB <-> GOOGLE DRIVE)
 * Thư mục Google Drive đích: 1a_hJhS5wetmMRktY6qfSVCqNN3pQUuCb
 * Đơn vị: Trường THPT Nguyễn Sinh Sắc (Tân Châu - An Giang)
 * Cuộc thi: AI OR BEHIND năm học 2026 - 2027
 *
 * =========================================================================
 * BƯỚC QUAN TRỌNG NHẤT ĐỂ KÍCH HOẠT QUYỀN TRUY CẬP (Chỉ làm 1 lần duy nhất):
 * 1. Dán toàn bộ mã này vào https://script.google.com
 * 2. Trên thanh công cụ phía trên, tại ô chọn hàm, chọn hàm:
 *    👉 [ KHOI_DONG_VA_CAP_QUYEN_GOOGLE ]
 * 3. Bấm nút ▶️ [ Chạy ] (Run).
 * 4. Google sẽ hiện bảng "Cần có quyền truy cập":
 *    -> Bấm "Xem xét quyền" (Review permissions)
 *    -> Chọn tài khoản Google của Thầy
 *    -> Bấm chữ "Nâng cao" (Advanced) ở góc dưới
 *    -> Bấm "Đi tới IIGVN (không an toàn)"
 *    -> Bấm "Cho phép" (Allow).
 * 5. Sau đó bấm "Triển khai" (Deploy) -> "Quản lý bản triển khai" -> Sửa (✏️) -> Phiên bản mới -> Triển khai.
 * =========================================================================
 */

const FOLDER_ID = '1a_hJhS5wetmMRktY6qfSVCqNN3pQUuCb';
const XLSX_FILENAME = 'BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx';
const STUDENTS_XLSX_FILENAME = 'CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx';
const GSHEET_NAME = 'CSDL_Hoc_Sinh_Dang_Ky_THPT_Nguyen_Sinh_Sac';
const JSON_STATE_FILENAME = 'BM01-sync-state.json';
const SCRIPT_VERSION = 'v4-active-sync';

/**
 * HÀM KHỞI ĐỘNG & CẤP QUYỀN ĐẦY ĐỦ CHO GOOGLE SHEETS + GOOGLE DRIVE
 * (Thầy bấm nút "Chạy" hàm này để mở khóa toàn bộ quyền)
 */
function KHOI_DONG_VA_CAP_QUYEN_GOOGLE() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('1. Đã kết nối thư mục Google Drive: ' + folder.getName());

  // Kiểm tra hoặc tạo Google Sheet trực tuyến
  let ss = null;
  const sheetFiles = folder.getFilesByName(GSHEET_NAME);
  if (sheetFiles.hasNext()) {
    ss = SpreadsheetApp.openById(sheetFiles.next().getId());
    Logger.log('2. Đã tìm thấy Google Sheet CSDL: ' + ss.getUrl());
  } else {
    ss = SpreadsheetApp.create(GSHEET_NAME);
    const ssFile = DriveApp.getFileById(ss.getId());
    folder.addFile(ssFile);
    DriveApp.getRootFolder().removeFile(ssFile);
    Logger.log('2. Đã tạo mới Google Sheet CSDL: ' + ss.getUrl());
  }

  const sheet = ss.getSheets()[0];
  sheet.setName('DS Thí Sinh Đăng Ký');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'STT',
      'Mã ĐK',
      'Họ và tên học sinh',
      'Ngày sinh',
      'Giới tính',
      'Lớp',
      'Số CCCD / Định danh',
      'SĐT Học sinh',
      'Email nhận code Gmetrix',
      'Ngôn ngữ bài thi',
      'Họ tên Phụ huynh',
      'SĐT Phụ huynh',
      'Thời gian đăng ký'
    ]);
  }

  Logger.log('🎉 CẤP QUYỀN THÀNH CÔNG 100%! Giờ Thầy chỉ cần Triển khai phiên bản mới.');
  DON_DEP_TAT_CA_FILE_TRUNG_LAP();
}

/**
 * HÀM DỌN DẸP TỰ ĐỘNG TẤT CẢ FILE TRÙNG LẶP TRÊN GOOGLE DRIVE
 * Quét toàn bộ thư mục, giữ lại đúng 1 bản mới nhất cho mỗi loại file, dọn dẹp các bản sao thừa.
 */
function DON_DEP_TAT_CA_FILE_TRUNG_LAP() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('Bắt đầu dọn dẹp thư mục: ' + folder.getName());

  const targetNames = [XLSX_FILENAME, STUDENTS_XLSX_FILENAME, JSON_STATE_FILENAME];
  targetNames.forEach(function(name) {
    const files = folder.getFilesByName(name);
    const list = [];
    while (files.hasNext()) {
      list.push(files.next());
    }
    Logger.log('Tệp: ' + name + ' -> Tìm thấy ' + list.length + ' bản.');
    if (list.length > 1) {
      // Sắp xếp theo thời gian sửa đổi giảm dần (bản mới nhất ở đầu)
      list.sort(function(a, b) {
        return b.getLastUpdated().getTime() - a.getLastUpdated().getTime();
      });
      // Giữ lại list[0], đưa các bản cũ vào thùng rác
      for (let i = 1; i < list.length; i++) {
        try {
          list[i].setTrashed(true);
          Logger.log('  -> Đã đưa bản sao cũ ' + list[i].getId() + ' vào thùng rác.');
        } catch (_) {}
      }
    }
  });
  Logger.log('🎉 ĐÃ DỌN DẸP SẠCH SẼ TOÀN BỘ FILE TRÙNG LẶP!');
}

/**
 * HÀM KHÔI PHỤC TOÀN BỘ FILE TỪ THÙNG RÁC VỀ LẠI THƯ MỤC DRIVE
 * (Nếu Thầy muốn lấy lại tất cả các bản nháp cũ để kiểm tra đối chiếu)
 */
function KHOI_PHUC_TAT_CA_FILE_TU_THUNG_RAC() {
  const trashed = DriveApp.getTrashedFiles();
  let count = 0;
  while (trashed.hasNext()) {
    const f = trashed.next();
    const name = f.getName();
    if (name.indexOf('CSDL-Thi-Sinh-Dang-Ky') !== -1 || name.indexOf('BM01-danh-sach-TS') !== -1) {
      f.setTrashed(false);
      count++;
      Logger.log('Đã khôi phục file: ' + name + ' (ID: ' + f.getId() + ')');
    }
  }
  Logger.log('🎉 HOÀN TẤT! Đã khôi phục ' + count + ' file từ Thùng rác về lại Google Drive.');
}

/**
 * HÀM PHÂN TÍCH NHỊ PHÂN FILE .XLSX TRỰC TIẾP TRÊN BỘ NHỚ APPS SCRIPT
 * Trích xuất dữ liệu học sinh từ các file .xlsx kể cả khi file đang nằm trong thùng rác
 */
function parseXlsxStudentsFromBlob(blob) {
  const list = [];
  try {
    const unzipped = Utilities.unzip(blob);
    let sharedStringsXml = '';
    let sheetXml = '';
    for (let i = 0; i < unzipped.length; i++) {
      const entryName = unzipped[i].getName();
      if (entryName === 'xl/sharedStrings.xml') {
        sharedStringsXml = unzipped[i].getDataAsString('UTF-8');
      } else if (entryName === 'xl/worksheets/sheet1.xml') {
        sheetXml = unzipped[i].getDataAsString('UTF-8');
      }
    }
    if (!sheetXml) return list;

    // Phân tích Shared Strings (Chuỗi dùng chung)
    const sst = [];
    const siRegex = /<si\b[\s\S]*?<\/si>/g;
    let siMatch;
    while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
      const siStr = siMatch[0];
      const tMatches = siStr.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches.map(function(t) {
        return t.replace(/<t\b[^>]*>/, '').replace(/<\/t>/, '');
      }).join('');
      sst.push(text);
    }

    // Phân tích dòng dữ liệu trong sheet1.xml
    const rowRegex = /<row\b[^>]*r="(\d+)"[\s\S]*?<\/row>/g;
    let rMatch;
    while ((rMatch = rowRegex.exec(sheetXml)) !== null) {
      const rowNum = parseInt(rMatch[1], 10);
      if (rowNum < 5) continue; // Bỏ qua tiêu đề 4 dòng đầu

      const rowStr = rMatch[0];
      const cellRegex = /<c\b[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g;
      let cMatch;
      const cells = {};
      while ((cMatch = cellRegex.exec(rowStr)) !== null) {
        const col = cMatch[1];
        const attrStr = cMatch[2] || '';
        const bodyStr = cMatch[3] || '';
        const isString = /t="s"/.test(attrStr);
        const vMatch = bodyStr.match(/<v>([\s\S]*?)<\/v>/);
        let val = '';
        if (vMatch) {
          const rawVal = vMatch[1];
          if (isString) {
            const idx = parseInt(rawVal, 10);
            val = sst[idx] !== undefined ? sst[idx] : rawVal;
          } else {
            val = rawVal;
          }
        } else {
          const isMatch = bodyStr.match(/<is><t>([\s\S]*?)<\/t><\/is>/);
          if (isMatch) val = isMatch[1];
        }
        cells[col] = String(val).trim();
      }

      const fullName = cells['C'] || '';
      if (fullName && fullName !== 'Họ và tên học sinh (*)' && fullName !== 'STT') {
        list.push({
          id: cells['B'] || '',
          fullName: fullName,
          dob: cells['D'] || '',
          gender: cells['E'] || 'Nam',
          className: cells['F'] || '',
          cccd: cells['G'] || '',
          phone: cells['H'] || '',
          email: cells['I'] || '',
          examLang: cells['J'] || 'Tiếng Việt',
          parentName: cells['K'] || '',
          parentPhone: cells['L'] || '',
          consent: true,
          createdAt: cells['N'] || ''
        });
      }
    }
  } catch (err) {
    Logger.log('Lỗi phân tích file XLSX blob: ' + err.toString());
  }
  return list;
}

/**
 * HÀM TRUY VẾT & TỔNG HỢP TOÀN BỘ CSDL TỪ THÙNG RÁC VÀ THƯ MỤC DRIVE
 * Quét sạch từng file trong thùng rác và Drive, trích xuất tất cả học sinh đã từng đăng ký,
 * gom toàn bộ vào 1 file CSDL duy nhất, cập nhật Google Sheet và đồng bộ 2 chiều!
 */
function TRUY_VET_VA_TONG_HOP_TOAN_BO_CSDL_TU_THUNG_RAC() {
  Logger.log('=====================================================');
  Logger.log('🔍 BẮT ĐẦU QUÁ TRÌNH TRUY VẾT CSDL TỪ THÙNG RÁC DRIVE');
  Logger.log('=====================================================');

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const studentMap = {};
  let filesScanned = 0;
  let trashFilesFound = 0;

  function addStudent(st, source) {
    if (!st || !st.fullName) return;
    const name = String(st.fullName).trim();
    if (!name || name === 'STT' || name.startsWith('Họ và tên')) return;

    // Khóa định danh duy nhất: ưu tiên CCCD -> SĐT -> Tên + Lớp
    let key = '';
    if (st.cccd && String(st.cccd).trim().length >= 9) {
      key = 'cccd_' + String(st.cccd).trim();
    } else if (st.phone && String(st.phone).trim().length >= 8) {
      key = 'phone_' + String(st.phone).trim();
    } else {
      key = 'name_' + name.toLowerCase() + '_' + (st.className || '').toLowerCase().trim();
    }

    if (!studentMap[key]) {
      studentMap[key] = {
        id: st.id || '',
        fullName: name,
        dob: st.dob || '',
        gender: st.gender || 'Nam',
        className: st.className || '',
        cccd: st.cccd || '',
        phone: st.phone || '',
        email: st.email || '',
        examLang: st.examLang || 'Tiếng Việt',
        parentName: st.parentName || '',
        parentPhone: st.parentPhone || '',
        consent: true,
        createdAt: st.createdAt || '',
        source: source
      };
      Logger.log('  [+] Tìm thấy thí sinh: ' + name + ' | Lớp ' + (st.className || '') + ' | CCCD: ' + (st.cccd || '') + ' (' + source + ')');
    } else {
      // Hợp nhất dữ liệu để lấy đủ các trường thông tin nhất
      const existing = studentMap[key];
      Object.keys(st).forEach(function(k) {
        if (!existing[k] && st[k]) existing[k] = st[k];
      });
    }
  }

  // 1. Quét các file đang có trong thư mục IIGVN
  const activeFiles = folder.getFiles();
  while (activeFiles.hasNext()) {
    const f = activeFiles.next();
    filesScanned++;
    const name = f.getName();
    if (name === JSON_STATE_FILENAME) {
      try {
        const json = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
        if (json && Array.isArray(json.students)) {
          json.students.forEach(function(s) { addStudent(s, 'Drive Folder: ' + name); });
        }
      } catch (_) {}
    } else if (name === STUDENTS_XLSX_FILENAME || name.indexOf('CSDL-Thi-Sinh-Dang-Ky') !== -1) {
      const parsed = parseXlsxStudentsFromBlob(f.getBlob());
      parsed.forEach(function(s) { addStudent(s, 'Drive Folder: ' + name); });
    }
  }

  // 2. Quét toàn bộ file trong THÙNG RÁC của Google Drive
  const trashed = DriveApp.getTrashedFiles();
  while (trashed.hasNext()) {
    const f = trashed.next();
    const name = f.getName();
    const isTarget = (
      name.indexOf('CSDL-Thi-Sinh-Dang-Ky') !== -1 ||
      name.indexOf('BM01-danh-sach-TS') !== -1 ||
      name.indexOf('BM01-sync-state') !== -1 ||
      name.indexOf('CSDL_Hoc_Sinh_Dang_Ky') !== -1
    );

    if (isTarget) {
      trashFilesFound++;
      filesScanned++;
      const srcName = 'Thùng rác: ' + name;

      if (name.indexOf('.json') !== -1) {
        try {
          const json = JSON.parse(f.getBlob().getDataAsString('UTF-8'));
          if (json && Array.isArray(json.students)) {
            json.students.forEach(function(s) { addStudent(s, srcName); });
          }
        } catch (_) {}
      } else if (name.indexOf('.xlsx') !== -1) {
        const parsed = parseXlsxStudentsFromBlob(f.getBlob());
        parsed.forEach(function(s) { addStudent(s, srcName); });
      } else if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
        try {
          const ss = SpreadsheetApp.openById(f.getId());
          const sheet = ss.getSheets()[0];
          const rows = sheet.getDataRange().getValues();
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (row[2]) {
              addStudent({
                id: row[1] || '',
                fullName: row[2] || '',
                dob: row[3] || '',
                gender: row[4] || '',
                className: row[5] || '',
                cccd: row[6] || '',
                phone: row[7] || '',
                email: row[8] || '',
                examLang: row[9] || 'Tiếng Việt',
                parentName: row[10] || '',
                parentPhone: row[11] || '',
                createdAt: row[12] || ''
              }, srcName);
            }
          }
        } catch (_) {}
      }
    }
  }

  // 3. Chuẩn hóa và sắp xếp lại danh sách học sinh theo thời gian
  const rawList = Object.keys(studentMap).map(function(k) { return studentMap[k]; });
  rawList.sort(function(a, b) {
    const tA = a.createdAt || '';
    const tB = b.createdAt || '';
    return tA.localeCompare(tB);
  });

  const consolidatedStudents = rawList.map(function(st, idx) {
    return {
      id: 'NSS-AI-' + String(idx + 1).padStart(3, '0'),
      fullName: st.fullName,
      dob: st.dob || '',
      gender: st.gender || 'Nam',
      className: st.className || '',
      cccd: st.cccd || '',
      phone: st.phone || '',
      email: st.email || '',
      examLang: st.examLang || 'Tiếng Việt',
      parentName: st.parentName || '',
      parentPhone: st.parentPhone || '',
      consent: true,
      createdAt: st.createdAt || ''
    };
  });

  Logger.log('-----------------------------------------------------');
  Logger.log('📊 KẾT QUẢ TRUY VẾT & HỢP NHẤT:');
  Logger.log('  - Tổng số file quét trong thùng rác: ' + trashFilesFound);
  Logger.log('  - Tổng số thí sinh hợp nhất: ' + consolidatedStudents.length + ' học sinh');
  consolidatedStudents.forEach(function(s, i) {
    Logger.log('    ' + (i + 1) + '. ' + s.fullName + ' | ' + s.className + ' | ' + s.dob + ' | CCCD: ' + s.cccd + ' | SĐT: ' + s.phone);
  });
  Logger.log('-----------------------------------------------------');

  // 4. Ghi trực tiếp danh sách hợp nhất vào Google Sheet "CSDL_Hoc_Sinh_Dang_Ky_THPT_Nguyen_Sinh_Sac"
  let gsheetUrl = '';
  try {
    let ss = null;
    const sheetFiles = folder.getFilesByName(GSHEET_NAME);
    if (sheetFiles.hasNext()) {
      ss = SpreadsheetApp.openById(sheetFiles.next().getId());
    } else {
      ss = SpreadsheetApp.create(GSHEET_NAME);
      const ssFile = DriveApp.getFileById(ss.getId());
      folder.addFile(ssFile);
      DriveApp.getRootFolder().removeFile(ssFile);
    }
    gsheetUrl = ss.getUrl();
    const sheet = ss.getSheets()[0];
    sheet.setName('DS Thí Sinh Đăng Ký');
    sheet.clearContents();

    const headers = [
      'STT', 'Mã ĐK', 'Họ và tên học sinh', 'Ngày sinh', 'Giới tính', 'Lớp',
      'Số CCCD / Định danh', 'SĐT Học sinh', 'Email nhận code Gmetrix',
      'Ngôn ngữ bài thi', 'Họ tên Phụ huynh', 'SĐT Phụ huynh', 'Thời gian đăng ký'
    ];
    const rows = [headers];
    consolidatedStudents.forEach(function(st, idx) {
      rows.push([
        idx + 1,
        st.id,
        st.fullName,
        st.dob,
        st.gender,
        st.className,
        st.cccd,
        st.phone,
        st.email,
        st.examLang,
        st.parentName,
        st.parentPhone,
        st.createdAt
      ]);
    });
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe');
    Logger.log('✅ Đã cập nhật toàn bộ ' + consolidatedStudents.length + ' thí sinh vào Google Sheet: ' + gsheetUrl);
  } catch (sheetErr) {
    Logger.log('Lỗi cập nhật Google Sheet: ' + sheetErr.toString());
  }

  // 5. Cập nhật file trạng thái BM01-sync-state.json trong thư mục Drive
  try {
    let stateObj = {
      meta: {
        soGddt: 'tỉnh An Giang',
        nguoiPhuTrach: 'Thầy/Cô Phụ trách CNTT & Đoàn Trường',
        chucVuPhuTrach: 'Cán bộ phụ trách cuộc thi',
        dienThoaiPhuTrach: '02963 822 xxx',
        emailPhuTrach: 'c3nguyensinhsac@angiang.edu.vn',
        autoCountFromStudents: true,
        driveFolderId: FOLDER_ID,
        driveFolderUrl: 'https://drive.google.com/drive/folders/' + FOLDER_ID + '?usp=sharing',
        appsScriptUrl: ScriptApp.getService().getUrl() || '',
        lastDriveSync: new Date().toISOString(),
        driveSyncStatus: 'synced',
        driveSyncMessage: 'Đã truy vết & hợp nhất CSDL toàn diện từ Thùng rác Google Drive!'
      },
      bm01Rows: [
        {
          stt: 1,
          schoolName: 'Trường THPT Nguyễn Sinh Sắc',
          ward: 'Phường Long Thạnh, TX. Tân Châu, An Giang',
          studentCount: consolidatedStudents.length,
          contactName: 'Ban Tổ chức Cấp Trường - THPT Nguyễn Sinh Sắc',
          contactRole: 'Giáo viên phụ trách Tin học / Đoàn Thanh niên',
          contactEmail: 'c3nguyensinhsac@angiang.edu.vn',
          contactPhone: '0918000000'
        }
      ],
      students: consolidatedStudents
    };
    const jsonStr = JSON.stringify(stateObj, null, 2);
    const existingState = folder.getFilesByName(JSON_STATE_FILENAME);
    if (existingState.hasNext()) {
      existingState.next().setContent(jsonStr);
    } else {
      folder.createFile(JSON_STATE_FILENAME, jsonStr, MimeType.PLAIN_TEXT);
    }
    Logger.log('✅ Đã cập nhật file BM01-sync-state.json với ' + consolidatedStudents.length + ' thí sinh.');
  } catch (stateErr) {
    Logger.log('Lỗi cập nhật sync-state: ' + stateErr.toString());
  }

  Logger.log('🎉 TRUY VẾT & HỢP NHẤT TOÀN DIỆN THÀNH CÔNG RỰC RỠ!');
  return {
    ok: true,
    trashFilesScanned: trashFilesFound,
    totalFilesScanned: filesScanned,
    studentsCount: consolidatedStudents.length,
    students: consolidatedStudents,
    gsheetUrl: gsheetUrl
  };
}

function doGet(e) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const action = (e && e.parameter && e.parameter.action) || 'pull';

    // Thao tác truy vết và hợp nhất CSDL từ Thùng rác
    if (action === 'trace_and_consolidate') {
      const traceResult = TRUY_VET_VA_TONG_HOP_TOAN_BO_CSDL_TU_THUNG_RAC();
      return jsonResponse(traceResult);
    }

    if (action === 'status') {
      const files = folder.getFilesByName(XLSX_FILENAME);
      const hasFile = files.hasNext();
      const fileInfo = hasFile ? files.next() : null;

      const sheetFiles = folder.getFilesByName(GSHEET_NAME);
      const hasSheet = sheetFiles.hasNext();
      const sheetUrl = hasSheet ? sheetFiles.next().getUrl() : null;

      return jsonResponse({
        ok: true,
        version: SCRIPT_VERSION,
        folderId: FOLDER_ID,
        folderName: folder.getName(),
        xlsxExists: hasFile,
        xlsxUrl: fileInfo ? fileInfo.getUrl() : null,
        sheetExists: hasSheet,
        sheetUrl: sheetUrl,
        lastUpdated: fileInfo ? fileInfo.getLastUpdated().toISOString() : null
      });
    }

    // Đọc trạng thái JSON đồng bộ 2 chiều hoặc file XLSX trên Drive
    const stateFiles = folder.getFilesByName(JSON_STATE_FILENAME);
    let stateData = null;
    let stateUpdated = null;
    if (stateFiles.hasNext()) {
      const sf = stateFiles.next();
      stateUpdated = sf.getLastUpdated().toISOString();
      stateData = JSON.parse(sf.getBlob().getDataAsString('UTF-8'));
    }

    const xlsxFiles = folder.getFilesByName(XLSX_FILENAME);
    let xlsxBase64 = null;
    let xlsxUpdated = null;
    let xlsxUrl = null;
    if (xlsxFiles.hasNext()) {
      const xf = xlsxFiles.next();
      xlsxUpdated = xf.getLastUpdated().toISOString();
      xlsxUrl = xf.getUrl();
      xlsxBase64 = Utilities.base64Encode(xf.getBlob().getBytes());
    }

    return jsonResponse({
      ok: true,
      folderId: FOLDER_ID,
      stateUpdated: stateUpdated,
      xlsxUpdated: xlsxUpdated,
      xlsxUrl: xlsxUrl,
      data: stateData,
      xlsxBase64: xlsxBase64
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const payload = JSON.parse(e.postData.contents);

    let xlsxUrl = null;
    let updatedTime = new Date().toISOString();
    let patchError = null;
    let sheetError = null;

    // 1. Lưu/Cập nhật file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx trên Google Drive
    if (payload.xlsxBase64) {
      try {
        const bytes = Utilities.base64Decode(payload.xlsxBase64);
        const blob = Utilities.newBlob(
          bytes,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          XLSX_FILENAME
        );
        const file = upsertBinaryFile(folder, XLSX_FILENAME, blob);
        xlsxUrl = file.getUrl();
        updatedTime = file.getLastUpdated().toISOString();
      } catch (errXlsx) {
        patchError = 'XLSX error: ' + errXlsx.toString();
      }
    }

    // 2. Lưu/Cập nhật file CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx trên Google Drive
    if (payload.studentsXlsxBase64) {
      try {
        const stBytes = Utilities.base64Decode(payload.studentsXlsxBase64);
        const stBlob = Utilities.newBlob(
          stBytes,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          STUDENTS_XLSX_FILENAME
        );
        upsertBinaryFile(folder, STUDENTS_XLSX_FILENAME, stBlob);
      } catch (errSt) {
        patchError = (patchError ? patchError + ' | ' : '') + 'Students XLSX error: ' + errSt.toString();
      }
    }

    // 3. Tạo / Cập nhật trực tiếp Google Sheet "CSDL_Hoc_Sinh_Dang_Ky_THPT_Nguyen_Sinh_Sac" trong thư mục Drive
    try {
      if (payload.data && Array.isArray(payload.data.students)) {
        let ss = null;
        const sheetFiles = folder.getFilesByName(GSHEET_NAME);
        if (sheetFiles.hasNext()) {
          ss = SpreadsheetApp.openById(sheetFiles.next().getId());
        } else {
          ss = SpreadsheetApp.create(GSHEET_NAME);
          const ssFile = DriveApp.getFileById(ss.getId());
          folder.addFile(ssFile);
          DriveApp.getRootFolder().removeFile(ssFile);
        }

        const sheet = ss.getSheets()[0];
        sheet.setName('DS Thí Sinh Đăng Ký');
        sheet.clearContents();

        const headers = [
          'STT',
          'Mã ĐK',
          'Họ và tên học sinh',
          'Ngày sinh',
          'Giới tính',
          'Lớp',
          'Số CCCD / Định danh',
          'SĐT Học sinh',
          'Email nhận code Gmetrix',
          'Ngôn ngữ bài thi',
          'Họ tên Phụ huynh',
          'SĐT Phụ huynh',
          'Thời gian đăng ký'
        ];
        const rows = [headers];
        payload.data.students.forEach(function (st, idx) {
          rows.push([
            idx + 1,
            st.id || '',
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
            st.createdAt || ''
          ]);
        });
        sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

        // Định dạng tiêu đề cột cho đẹp mắt
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe');
      }
    } catch (sheetErr) {
      sheetError = sheetErr.toString();
    }

    // 4. Lưu file trạng thái JSON để đồng bộ 2 chiều cực nhanh
    if (payload.data) {
      const jsonStr = JSON.stringify(payload.data, null, 2);
      const existingState = folder.getFilesByName(JSON_STATE_FILENAME);
      if (existingState.hasNext()) {
        const sf = existingState.next();
        sf.setContent(jsonStr);
      } else {
        folder.createFile(JSON_STATE_FILENAME, jsonStr, MimeType.PLAIN_TEXT);
      }
    }

    return jsonResponse({
      ok: true,
      version: SCRIPT_VERSION,
      sheetError: sheetError,
      patchError: patchError,
      message: 'Đã đồng bộ CSDL BM01 lên Google Drive thành công!',
      folderId: FOLDER_ID,
      xlsxUrl: xlsxUrl,
      updatedAt: updatedTime
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Cập nhật file nhị phân (.xlsx) trực tiếp tại chỗ (in-place)
 * Ưu tiên PATCH qua REST API để không đổi File ID và không bao giờ đưa file vào thùng rác.
 * Nếu chưa cấp quyền PATCH, an toàn tạo file mới và dọn dẹp file cũ.
 */
function upsertBinaryFile(folder, filename, blob) {
  const existingFiles = [];
  const files = folder.getFilesByName(filename);
  while (files.hasNext()) {
    existingFiles.push(files.next());
  }

  if (existingFiles.length > 0) {
    const primaryFile = existingFiles[0];
    let inPlaceSuccess = false;
    try {
      const fileId = primaryFile.getId();
      const url = 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media';
      const res = UrlFetchApp.fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
        },
        contentType: blob.getContentType(),
        payload: blob.getBytes(),
        muteHttpExceptions: true
      });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        inPlaceSuccess = true;
      }
    } catch (e) {
      Logger.log('Lỗi patch in-place: ' + e.toString());
    }

    if (inPlaceSuccess) {
      // Dọn dẹp tất cả các bản sao thừa còn lại, chỉ giữ lại primaryFile duy nhất!
      for (let i = 1; i < existingFiles.length; i++) {
        try { existingFiles[i].setTrashed(true); } catch (_) {}
      }
      return primaryFile;
    }

    // Nếu không patch in-place được: tạo 1 file mới và dọn dẹp TẤT CẢ các file cũ
    const newFile = folder.createFile(blob);
    for (let i = 0; i < existingFiles.length; i++) {
      try { existingFiles[i].setTrashed(true); } catch (_) {}
    }
    return newFile;
  } else {
    return folder.createFile(blob);
  }
}
