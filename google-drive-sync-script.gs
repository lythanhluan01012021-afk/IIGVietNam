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

function doGet(e) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const action = (e && e.parameter && e.parameter.action) || 'pull';

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
