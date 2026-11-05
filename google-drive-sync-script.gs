/**
 * GOOGLE APPS SCRIPT - CẦU NỐI ĐỒNG BỘ 2 CHIỀU (LOCAL EXCEL <-> WEB <-> GOOGLE DRIVE)
 * Thư mục Google Drive đích: 1a_hJhS5wetmMRktY6qfSVCqNN3pQUuCb
 * Trường THPT Nguyễn Sinh Sắc - Cuộc thi AI OR BEHIND năm học 2026 - 2027
 *
 * HƯỚNG DẪN CÀI ĐẶT NHANH (Chỉ 1 phút):
 * 1. Truy cập https://script.google.com -> Bấm "Dự án mới" (New Project).
 * 2. Xóa mã mặc định và dán toàn bộ nội dung file này vào.
 * 3. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 4. Chọn loại: "Ứng dụng web" (Web app):
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 5. Bấm "Triển khai", cấp quyền và sao chép URL Web App dán vào phần Cấu hình Google Drive trên Website.
 */

const FOLDER_ID = '1a_hJhS5wetmMRktY6qfSVCqNN3pQUuCb';
const XLSX_FILENAME = 'BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx';
const STUDENTS_XLSX_FILENAME = 'CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx';
const GSHEET_NAME = 'CSDL_Hoc_Sinh_Dang_Ky_THPT_Nguyen_Sinh_Sac';
const JSON_STATE_FILENAME = 'BM01-sync-state.json';
const SCRIPT_VERSION = 'v3-csdl-sheet';

function doGet(e) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const action = (e && e.parameter && e.parameter.action) || 'pull';

    if (action === 'status') {
      const files = folder.getFilesByName(XLSX_FILENAME);
      const hasFile = files.hasNext();
      const fileInfo = hasFile ? files.next() : null;
      return jsonResponse({
        ok: true,
        version: SCRIPT_VERSION,
        folderId: FOLDER_ID,
        folderName: folder.getName(),
        xlsxExists: hasFile,
        xlsxUrl: fileInfo ? fileInfo.getUrl() : null,
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

    // 1. Lưu/Cập nhật file BM01-danh-sach-TS-vong-thi-cap-co-so.xlsx trên Google Drive
    if (payload.xlsxBase64) {
      const bytes = Utilities.base64Decode(payload.xlsxBase64);
      const blob = Utilities.newBlob(
        bytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        XLSX_FILENAME
      );
      const existing = folder.getFilesByName(XLSX_FILENAME);
      const file = upsertBinaryFile(folder, XLSX_FILENAME, blob);
      xlsxUrl = file.getUrl();
      updatedTime = file.getLastUpdated().toISOString();
    }

    // 2. Lưu/Cập nhật file CSDL-Thi-Sinh-Dang-Ky-THPT-Nguyen-Sinh-Sac.xlsx trên Google Drive
    if (payload.studentsXlsxBase64) {
      const stBytes = Utilities.base64Decode(payload.studentsXlsxBase64);
      const stBlob = Utilities.newBlob(
        stBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        STUDENTS_XLSX_FILENAME
      );
      upsertBinaryFile(folder, STUDENTS_XLSX_FILENAME, stBlob);
    }

    // 3. Tạo / Cập nhật trực tiếp Google Sheet "CSDL_Hoc_Sinh_Dang_Ky_THPT_Nguyen_Sinh_Sac" trong thư mục Drive
    let sheetError = null;
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
      sheet.setName('DS Học Sinh Đăng Ký');
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
 * Cập nhật file nhị phân (.xlsx) trực tiếp tại chỗ (in-place) giữ nguyên 100% File ID,
 * TUYỆT ĐỐI KHÔNG GỌI setTrashed (không bao giờ đưa file vào thùng rác, tránh báo lỗi khi đang mở xem).
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
    return file;
  } else {
    return folder.createFile(blob);
  }
}

