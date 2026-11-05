let adminState = {
  meta: {},
  bm01Rows: [],
  students: []
};

const ADMIN_TOKEN_KEY = 'nss_admin_token';

function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'x-admin-token': getAdminToken(),
    ...extra
  };
}

function showLoginScreen() {
  const overlay = document.getElementById('adminLoginOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLoginScreen() {
  const overlay = document.getElementById('adminLoginOverlay');
  if (overlay) overlay.style.display = 'none';
}

function logoutAdmin() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  showLoginScreen();
  showToast('🔒 Đã đăng xuất khỏi phiên Quản trị!');
}

async function checkAdminSession() {
  const token = getAdminToken();
  if (!token) {
    showLoginScreen();
    return false;
  }
  try {
    const res = await fetch('/api/admin/verify', {
      headers: { 'x-admin-token': token }
    });
    const data = await res.json();
    if (data && data.ok) {
      hideLoginScreen();
      return true;
    }
  } catch (_) {}
  showLoginScreen();
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('adminLoginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errBox = document.getElementById('loginErrorMsg');
    const btn = document.getElementById('loginSubmitBtn');

    errBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = '⏳ Đang xác thực...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        errBox.textContent = data.message || 'Sai tài khoản hoặc mật khẩu!';
        errBox.style.display = 'block';
      } else {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        hideLoginScreen();
        showToast('🎉 Đăng nhập Quản trị CSDL thành công!');
        await loadAdminData();
      }
    } catch (err) {
      errBox.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
      errBox.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = '🔐 ĐĂNG NHẬP QUẢN TRỊ';
    }
  });
});

async function loadAdminData() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.ok) applyAdminState(data.state);
  } catch (_) {}
}

function applyAdminState(state) {
  if (!state) return;
  adminState = state;

  const students = Array.isArray(state.students) ? state.students : [];
  const bm01Rows = Array.isArray(state.bm01Rows) ? state.bm01Rows : [];
  const totalCount = bm01Rows.length > 0 ? (Number(bm01Rows[0].studentCount) || students.length) : students.length;

  // 1. Cập nhật KPI Cards
  document.getElementById('kpiTotalStudents').textContent = totalCount;
  document.getElementById('admCountBadge').textContent = students.length;
  document.getElementById('kpiProgressBar').style.width = `${Math.min(100, Math.max(2, (totalCount / 500) * 100))}%`;
  document.getElementById('kpiRemainingText').textContent = `Còn ${Math.max(0, 500 - totalCount)} / 500 suất Vòng cơ sở`;

  const g10 = students.filter((s) => String(s.className || '').startsWith('10')).length;
  const g11 = students.filter((s) => String(s.className || '').startsWith('11')).length;
  const g12 = students.filter((s) => String(s.className || '').startsWith('12')).length;
  document.getElementById('kpiGradeBreakdown').textContent = `K10: ${g10} • K11: ${g11} • K12: ${g12}`;

  const tvCount = students.filter((s) => s.examLang !== 'Tiếng Anh').length;
  const taCount = students.filter((s) => s.examLang === 'Tiếng Anh').length;
  document.getElementById('kpiLangBreakdown').textContent = `🇻🇳 TV: ${tvCount} • 🇬🇧 TA: ${taCount}`;

  const meta = state.meta || {};
  if (meta.lastLocalSync) {
    document.getElementById('kpiLastSyncTime').textContent =
      'Cập nhật: ' + new Date(meta.lastLocalSync).toLocaleString('vi-VN');
  }

  // 2. Cập nhật các ô Meta của BM01
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = v || '';
  };
  setVal('admMetaSoGddt', meta.soGddt);
  setVal('admMetaNguoiPt', meta.nguoiPhuTrach);
  setVal('admMetaChucVu', meta.chucVuPhuTrach);
  setVal('admMetaSdt', meta.dienThoaiPhuTrach);
  setVal('admMetaEmail', meta.emailPhuTrach);
  setVal('admAppsScriptUrl', meta.appsScriptUrl);

  const autoCheck = document.getElementById('admMetaAutoCount');
  if (autoCheck) autoCheck.checked = meta.autoCountFromStudents !== false;

  renderAdminStudentTable();
  renderAdminBm01Table();
}

function switchAdminTab(tab) {
  ['students', 'bm01', 'docs', 'drive'].forEach((t) => {
    const btn = document.getElementById(`admTab_${t}`);
    const panel = document.getElementById(`admPanel_${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
  });
}

// ==================== TAB 1: QUẢN LÝ DANH SÁCH THÍ SINH ====================
function renderAdminStudentTable() {
  const tbody = document.getElementById('admStudentTableBody');
  if (!tbody) return;

  const q = (document.getElementById('admSearchInput')?.value || '').trim().toLowerCase();
  const grade = document.getElementById('admGradeFilter')?.value || '';
  const lang = document.getElementById('admLangFilter')?.value || '';

  const filtered = (adminState.students || []).filter((s) => {
    const matchQ =
      !q ||
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.className && s.className.toLowerCase().includes(q)) ||
      (s.cccd && s.cccd.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q));
    const matchGrade = !grade || String(s.className || '').startsWith(grade);
    const matchLang = !lang || s.examLang === lang;
    return matchQ && matchGrade && matchLang;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13" style="text-align:center; padding:28px; color:#64748b;">
          Chưa có thí sinh nào trong danh sách. Bấm <strong>"➕ Thêm Thí sinh mới"</strong> hoặc để học sinh đăng ký từ Trang chủ.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (s, i) => `
      <tr>
        <td style="font-weight:700;">${i + 1}</td>
        <td><span class="student-code-badge">${escapeHtml(s.id)}</span></td>
        <td><strong>${escapeHtml(s.fullName)}</strong></td>
        <td>${escapeHtml(s.dob)}</td>
        <td>${escapeHtml(s.gender)}</td>
        <td><span class="student-class-badge">${escapeHtml(s.className)}</span></td>
        <td>${escapeHtml(s.cccd)}</td>
        <td>${escapeHtml(s.phone)}</td>
        <td>${escapeHtml(s.email)}</td>
        <td>${escapeHtml(s.examLang)}</td>
        <td>${escapeHtml(s.parentName)}<br /><span style="font-size:0.75rem; color:#64748b;">${escapeHtml(s.parentPhone)}</span></td>
        <td style="font-size:0.76rem; color:#64748b;">${escapeHtml(s.createdAt)}</td>
        <td style="text-align:center; white-space:nowrap;">
          <button type="button" onclick="openStudentModal('${escapeHtml(s.id)}')" style="border:none; background:#dbeafe; color:#1d4ed8; padding:5px 9px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.75rem; margin-right:4px;">
            ✏️ Sửa
          </button>
          <button type="button" onclick="deleteStudentAdmin('${escapeHtml(s.id)}')" style="border:none; background:#fee2e2; color:#dc2626; padding:5px 9px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.75rem;">
            🗑️ Xóa
          </button>
        </td>
      </tr>
    `
    )
    .join('');
}

function openStudentModal(studentId = '') {
  const modal = document.getElementById('admStudentModal');
  const title = document.getElementById('admModalTitle');
  const form = document.getElementById('admStudentForm');
  if (!modal || !form) return;

  if (studentId) {
    const st = (adminState.students || []).find((x) => x.id === studentId);
    if (!st) return;
    title.textContent = `✏️ Chỉnh sửa Thí sinh (${st.id})`;
    document.getElementById('editStudentId').value = st.id;
    document.getElementById('admStName').value = st.fullName || '';
    document.getElementById('admStDob').value = st.dob || '';
    document.getElementById('admStClass').value = st.className || '';
    document.getElementById('admStGender').value = st.gender || 'Nam';
    document.getElementById('admStCccd').value = st.cccd || '';
    document.getElementById('admStLang').value = st.examLang || 'Tiếng Việt';
    document.getElementById('admStPhone').value = st.phone || '';
    document.getElementById('admStEmail').value = st.email || '';
    document.getElementById('admStParentName').value = st.parentName || '';
    document.getElementById('admStParentPhone').value = st.parentPhone || '';
  } else {
    title.textContent = '➕ Thêm Thí sinh Mới vào CSDL BM01';
    form.reset();
    document.getElementById('editStudentId').value = '';
  }

  modal.classList.add('open');
}

function closeStudentModal() {
  document.getElementById('admStudentModal')?.classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admStudentForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editStudentId').value;
    const payload = {
      fullName: document.getElementById('admStName').value,
      dob: document.getElementById('admStDob').value,
      className: document.getElementById('admStClass').value,
      gender: document.getElementById('admStGender').value,
      cccd: document.getElementById('admStCccd').value,
      examLang: document.getElementById('admStLang').value,
      phone: document.getElementById('admStPhone').value,
      email: document.getElementById('admStEmail').value,
      parentName: document.getElementById('admStParentName').value,
      parentPhone: document.getElementById('admStParentPhone').value,
      consent: true
    };

    try {
      const url = editId ? `/api/students/${encodeURIComponent(editId)}` : '/api/students/register';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.ok) {
        showToast('⚠️ ' + (data.message || 'Lỗi lưu dữ liệu!'));
      } else {
        applyAdminState(data.state);
        closeStudentModal();
        showToast('✅ Đã lưu thông tin thí sinh vào BM01.xlsx & đồng bộ!');
      }
    } catch (err) {
      showToast('⚠️ Lỗi: ' + err.message);
    }
  });
});

async function deleteStudentAdmin(id) {
  if (!confirm(`Xác nhận xóa thí sinh mã ${id} khỏi CSDL?`)) return;
  const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  const data = await res.json();
  if (data.ok) {
    applyAdminState(data.state);
    showToast(`🗑️ Đã xóa thí sinh ${id} và cập nhật lại bảng BM01!`);
  } else {
    showToast('⚠️ ' + (data.message || 'Không thể xóa!'));
  }
}

// ==================== TAB 2: QUẢN LÝ BIỂU MẪU BM01 CHUẨN ====================
function renderAdminBm01Table() {
  const tbody = document.getElementById('admBm01TableBody');
  if (!tbody) return;

  const rows = adminState.bm01Rows && adminState.bm01Rows.length > 0
    ? adminState.bm01Rows
    : [{
        stt: 1,
        schoolName: 'Trường THPT Nguyễn Sinh Sắc',
        ward: 'Phường Long Thạnh, TX. Tân Châu, An Giang',
        studentCount: (adminState.students || []).length,
        contactName: 'Ban Tổ chức Cấp Trường - THPT Nguyễn Sinh Sắc',
        contactRole: 'Giáo viên phụ trách Tin học / Đoàn Thanh niên',
        contactEmail: 'c3nguyensinhsac@angiang.edu.vn',
        contactPhone: '0918000000'
      }];

  tbody.innerHTML = rows
    .map(
      (r, idx) => `
      <tr>
        <td style="text-align:center; font-weight:700;">${idx + 1}</td>
        <td><input type="text" class="bm01-cell-input" value="${escapeHtml(r.schoolName)}" onchange="updateBm01AdminCell(${idx}, 'schoolName', this.value)" /></td>
        <td><input type="text" class="bm01-cell-input" value="${escapeHtml(r.ward)}" onchange="updateBm01AdminCell(${idx}, 'ward', this.value)" /></td>
        <td><input type="number" min="0" max="500" class="bm01-cell-input count-input" value="${Number(r.studentCount) || 0}" onchange="updateBm01AdminCell(${idx}, 'studentCount', this.value)" /></td>
        <td><input type="text" class="bm01-cell-input" value="${escapeHtml(r.contactName)}" onchange="updateBm01AdminCell(${idx}, 'contactName', this.value)" /></td>
        <td><input type="text" class="bm01-cell-input" value="${escapeHtml(r.contactRole)}" onchange="updateBm01AdminCell(${idx}, 'contactRole', this.value)" /></td>
        <td><input type="email" class="bm01-cell-input" value="${escapeHtml(r.contactEmail)}" onchange="updateBm01AdminCell(${idx}, 'contactEmail', this.value)" /></td>
        <td><input type="text" class="bm01-cell-input" value="${escapeHtml(r.contactPhone)}" onchange="updateBm01AdminCell(${idx}, 'contactPhone', this.value)" /></td>
        <td style="text-align:center;">
          ${rows.length > 1
            ? `<button type="button" onclick="removeBm01RowAdmin(${idx})" style="border:none; background:#fee2e2; color:#dc2626; width:28px; height:28px; border-radius:6px; cursor:pointer;">✕</button>`
            : `<span style="font-size:0.74rem; color:#64748b;">Gốc</span>`
          }
        </td>
      </tr>
    `
    )
    .join('');
}

function updateBm01AdminCell(idx, field, val) {
  if (!adminState.bm01Rows[idx]) return;
  if (field === 'studentCount') {
    adminState.bm01Rows[idx][field] = Math.min(500, Math.max(0, parseInt(val, 10) || 0));
    if (idx === 0) {
      adminState.meta.autoCountFromStudents = false;
      document.getElementById('admMetaAutoCount').checked = false;
    }
  } else {
    adminState.bm01Rows[idx][field] = val;
  }
}

function addBm01RowAdmin() {
  adminState.bm01Rows.push({
    stt: adminState.bm01Rows.length + 1,
    schoolName: 'Trường THPT Nguyễn Sinh Sắc (Đợt bổ sung)',
    ward: 'TX. Tân Châu, An Giang',
    studentCount: 0,
    contactName: '',
    contactRole: '',
    contactEmail: '',
    contactPhone: ''
  });
  renderAdminBm01Table();
}

function removeBm01RowAdmin(idx) {
  if (adminState.bm01Rows.length <= 1) return;
  adminState.bm01Rows.splice(idx, 1);
  renderAdminBm01Table();
  saveBm01FromAdmin();
}

function toggleAutoCountAdmin(checked) {
  adminState.meta.autoCountFromStudents = checked;
  if (checked && adminState.bm01Rows.length > 0) {
    adminState.bm01Rows[0].studentCount = (adminState.students || []).length;
  }
  saveBm01FromAdmin();
}

async function saveBm01FromAdmin() {
  const payload = {
    meta: {
      ...adminState.meta,
      soGddt: document.getElementById('admMetaSoGddt').value,
      nguoiPhuTrach: document.getElementById('admMetaNguoiPt').value,
      chucVuPhuTrach: document.getElementById('admMetaChucVu').value,
      dienThoaiPhuTrach: document.getElementById('admMetaSdt').value,
      emailPhuTrach: document.getElementById('admMetaEmail').value,
      autoCountFromStudents: document.getElementById('admMetaAutoCount').checked
    },
    bm01Rows: adminState.bm01Rows
  };

  const res = await fetch('/api/bm01/update', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.ok) {
    applyAdminState(data.state);
    showToast('✅ Đã lưu Biểu mẫu BM01 vào file Excel dự án & đồng bộ Google Drive!');
  } else {
    showToast('⚠️ ' + (data.message || 'Lỗi lưu BM01!'));
  }
}

// ==================== TAB 3: XEM FILE PDF TRỰC TIẾP ====================
function switchAdminPdf(url, btn) {
  document.getElementById('admPdfIframe').src = url;
  document.getElementById('admDocExternalLink').href = url;
  document.getElementById('admDocBtn1751').className = 'btn btn-outline';
  document.getElementById('admDocBtn8344').className = 'btn btn-outline';
  btn.className = 'btn btn-blue';
}

// ==================== TAB 4: ĐỒNG BỘ 2 CHIỀU GOOGLE DRIVE ====================
async function triggerAdminSync(direction) {
  showToast('🔄 Đang thực hiện đồng bộ CSDL 2 chiều...');
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ direction })
  });
  const data = await res.json();
  if (data.state) applyAdminState(data.state);
  showToast(data.ok ? '✅ Đồng bộ hoàn tất!' : 'ℹ️ ' + (data.message || 'Đã cập nhật Local Excel.'));
}

async function saveAdminDriveUrl() {
  const url = document.getElementById('admAppsScriptUrl').value;
  const res = await fetch('/api/sync', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ direction: 'to_drive', appsScriptUrl: url })
  });
  const data = await res.json();
  if (data.state) applyAdminState(data.state);
  showToast('✅ Đã lưu URL cầu nối Google Drive & đồng bộ!');
}

async function copyAppsScriptFromAdmin() {
  const res = await fetch('/api/apps-script-code');
  const data = await res.json();
  if (data.code) {
    await navigator.clipboard.writeText(data.code);
    showToast('📋 Đã sao chép mã google-drive-sync-script.gs!');
  }
}

// ==================== CHỨC NĂNG IN DANH SÁCH HỌC SINH ĐĂNG KÝ (CHUẨN A4) ====================
function printStudentList() {
  const container = document.getElementById('printReportContainer');
  if (!container) return;

  const meta = adminState.meta || {};
  const nguoiPt = document.getElementById('admMetaNguoiPt')?.value || meta.nguoiPhuTrach || 'Cán bộ phụ trách cuộc thi';
  const q = (document.getElementById('admSearchInput')?.value || '').trim().toLowerCase();
  const grade = document.getElementById('admGradeFilter')?.value || '';
  const lang = document.getElementById('admLangFilter')?.value || '';

  const allStudents = Array.isArray(adminState.students) ? adminState.students : [];
  const filtered = allStudents.filter((s) => {
    const matchQ =
      !q ||
      (s.fullName && s.fullName.toLowerCase().includes(q)) ||
      (s.className && s.className.toLowerCase().includes(q)) ||
      (s.cccd && s.cccd.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q));
    const matchGrade = !grade || String(s.className || '').startsWith(grade);
    const matchLang = !lang || s.examLang === lang;
    return matchQ && matchGrade && matchLang;
  });

  const stRowsHtml =
    filtered.length > 0
      ? filtered
          .map(
            (s, idx) => `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td style="text-align:center; font-weight:bold;">${escapeHtml(s.id)}</td>
            <td><strong>${escapeHtml(s.fullName)}</strong></td>
            <td style="text-align:center;">${escapeHtml(s.dob)}</td>
            <td style="text-align:center;">${escapeHtml(s.gender)}</td>
            <td style="text-align:center; font-weight:bold;">${escapeHtml(s.className)}</td>
            <td style="text-align:center;">${escapeHtml(s.cccd)}</td>
            <td style="text-align:center;">${escapeHtml(s.phone)}</td>
            <td>${escapeHtml(s.email)}</td>
            <td style="text-align:center;">${escapeHtml(s.examLang)}</td>
            <td>${escapeHtml(s.parentName)}<br /><span style="font-size:9.5pt;">SĐT: ${escapeHtml(s.parentPhone)}</span></td>
            <td style="text-align:center; font-size:9.5pt;">${escapeHtml(s.createdAt)}</td>
          </tr>
        `
          )
          .join('')
      : `
        <tr>
          <td colspan="12" style="text-align:center; padding:18px; font-style:italic;">
            Hiện chưa có học sinh nào trong danh sách đăng ký.
          </td>
        </tr>
      `;

  const filterNote =
    grade || lang || q
      ? `<div style="text-align:center; font-style:italic; font-size:10.5pt; margin-bottom:6px;">
          (Bộ lọc đang áp dụng: ${grade ? 'Khối ' + escapeHtml(grade) + ' • ' : ''}${lang ? 'Ngôn ngữ: ' + escapeHtml(lang) + ' • ' : ''}${q ? 'Từ khóa: "' + escapeHtml(q) + '"' : ''})
        </div>`
      : '';

  container.innerHTML = `
    <div class="print-bm01-sheet">
      <div class="print-logos-row" style="border-bottom:1.5px solid #000; padding-bottom:8px; margin-bottom:10px;">
        <div style="text-align:center; font-size:11pt; line-height:1.35;">
          SỞ GIÁO DỤC VÀ ĐÀO TẠO TỈNH AN GIANG<br />
          <strong>TRƯỜNG THPT NGUYỄN SINH SẮC</strong><br />
          <span>Tân Châu – An Giang</span>
        </div>
        <div style="text-align:center; font-size:11pt; line-height:1.35;">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br />
          <strong>Độc lập – Tự do – Hạnh phúc</strong><br />
          <span>-------------------</span>
        </div>
      </div>

      <div class="print-title" style="font-size:15pt; margin:10px 0 6px;">
        DANH SÁCH HỌC SINH ĐĂNG KÝ THAM DỰ VÒNG THI CẤP CƠ SỞ<br />
        CUỘC THI AI OR BEHIND NĂM HỌC 2026 - 2027
      </div>
      <div style="text-align:center; font-size:11.5pt; font-weight:bold; margin-bottom:8px;">
        Đơn vị: TRƯỜNG THPT NGUYỄN SINH SẮC • Tổng số thí sinh trong danh sách: ${filtered.length} / 500 học sinh
      </div>
      ${filterNote}

      <table class="print-grid-table" style="font-size:10.5pt;">
        <thead>
          <tr>
            <th style="width:36px;">STT</th>
            <th style="width:82px;">Mã ĐK</th>
            <th>Họ và tên học sinh</th>
            <th style="width:78px;">Ngày sinh</th>
            <th style="width:52px;">Giới tính</th>
            <th style="width:54px;">Lớp</th>
            <th style="width:105px;">Số CCCD / Định danh</th>
            <th style="width:88px;">SĐT Học sinh</th>
            <th>Email nhận code Gmetrix</th>
            <th style="width:76px;">Đề thi</th>
            <th>Họ tên &amp; SĐT Phụ huynh</th>
            <th style="width:88px;">Thời gian ĐK</th>
          </tr>
        </thead>
        <tbody>
          ${stRowsHtml}
        </tbody>
      </table>

      <div class="print-signatures">
        <div style="width:42%;">
          <strong>NGƯỜI LẬP DANH SÁCH</strong><br />
          <span style="font-style:italic; font-size:10pt;">(Ký và ghi rõ họ tên)</span>
          <div style="height:65px;"></div>
          <strong>${escapeHtml(nguoiPt)}</strong>
        </div>
        <div style="width:48%;">
          <em>Tân Châu, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</em><br />
          <strong>HIỆU TRƯỞNG TRƯỜNG THPT NGUYỄN SINH SẮC</strong><br />
          <span style="font-style:italic; font-size:10pt;">(Ký tên và đóng dấu)</span>
          <div style="height:65px;"></div>
          <strong>BAN GIÁM HIỆU</strong>
        </div>
      </div>
    </div>
  `;

  window.print();
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'toast-msg';
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.addEventListener('DOMContentLoaded', async () => {
  const ok = await checkAdminSession();
  if (ok) {
    await loadAdminData();
  }

  try {
    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.state && getAdminToken()) applyAdminState(payload.state);
      if (payload.notification && getAdminToken()) showToast(payload.notification);
    };
  } catch (_) {}
});
