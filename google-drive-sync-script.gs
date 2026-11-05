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
  const files = folder.getFilesByName(filename);
  if (files.hasNext()) {
    const file = files.next();
    try {
      const fileId = file.getId();
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
        return file;
      }
    } catch (e) {
      Logger.log('Lỗi patch in-place: ' + e.toString());
    }

    // Fallback nếu chưa cấp quyền UrlFetchApp: tạo file mới để đảm bảo dữ liệu LUÔN ĐƯỢC LƯU
    const newFile = folder.createFile(blob);
    try {
      file.setTrashed(true);
    } catch (_) {}
    return newFile;
  } else {
    return folder.createFile(blob);
  }
}
