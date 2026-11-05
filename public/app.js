// ==================== STATE & GLOBAL VARIABLES ====================
let clientState = {
  meta: {
    soGddt: 'Sở Giáo dục và Đào tạo tỉnh An Giang',
    nguoiPhuTrach: 'Thầy/Cô Phụ trách CNTT & Đoàn Trường',
    chucVuPhuTrach: 'Cán bộ phụ trách cuộc thi',
    dienThoaiPhuTrach: '02963 822 xxx',
    emailPhuTrach: 'c3nguyensinhsac@angiang.edu.vn',
    autoCountFromStudents: true,
    appsScriptUrl: ''
  },
  bm01Rows: [],
  students: []
};

// ==================== 1. LIVESHOW TRƯỢT TỰ ĐỘNG 5 BANNER ====================
const TOTAL_BANNER_SLIDES = 5;
const SLIDE_INTERVAL_MS = 5500;
let currentBannerSlide = 0;
let slideProgress = 0;
let isSlidePaused = false;

function updateBannerSlideshowUI() {
  const track = document.getElementById('bannerSlidesTrack');
  if (track) {
    track.style.transform = `translateX(-${currentBannerSlide * 20}%)`;
  }
  const dots = document.querySelectorAll('#bannerSlideDots .slide-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentBannerSlide);
  });
}

function goToBannerSlide(index) {
  currentBannerSlide = (index + TOTAL_BANNER_SLIDES) % TOTAL_BANNER_SLIDES;
  slideProgress = 0;
  updateBannerSlideshowUI();
  updateSlideProgressBar();
}

function changeBannerSlide(step) {
  goToBannerSlide(currentBannerSlide + step);
}

function updateSlideProgressBar() {
  const bar = document.getElementById('slideProgressBar');
  if (bar) {
    bar.style.width = `${Math.min(100, slideProgress)}%`;
  }
}

function initBannerSlideshow() {
  const wrap = document.getElementById('heroSlideshow');
  if (!wrap) return;

  setInterval(() => {
    if (isSlidePaused) return;
    slideProgress += 100 / (SLIDE_INTERVAL_MS / 100);
    if (slideProgress >= 100) {
      slideProgress = 0;
      currentBannerSlide = (currentBannerSlide + 1) % TOTAL_BANNER_SLIDES;
      updateBannerSlideshowUI();
    }
    updateSlideProgressBar();
  }, 100);

  wrap.addEventListener('mouseenter', () => { isSlidePaused = true; });
  wrap.addEventListener('mouseleave', () => { isSlidePaused = false; });

  // Hỗ trợ vuốt cảm ứng trên điện thoại
  let touchStartX = 0;
  wrap.addEventListener('touchstart', (e) => {
    isSlidePaused = true;
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  wrap.addEventListener('touchend', (e) => {
    isSlidePaused = false;
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 42) {
      changeBannerSlide(diff > 0 ? 1 : -1);
    }
  }, { passive: true });
}

// ==================== 2. ĐỒNG HỒ ĐẾM NGƯỢC 30/11/2026 ====================
function initCountdown() {
  const deadline = new Date('2026-11-30T23:59:59+07:00').getTime();
  const updateClock = () => {
    const diff = Math.max(0, deadline - Date.now());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);

    const elD = document.getElementById('cdDays');
    const elH = document.getElementById('cdHours');
    const elM = document.getElementById('cdMins');
    if (elD) elD.textContent = String(days).padStart(2, '0');
    if (elH) elH.textContent = String(hours).padStart(2, '0');
    if (elM) elM.textContent = String(mins).padStart(2, '0');
  };
  updateClock();
  setInterval(updateClock, 15000);
}

// ==================== 3. TRÌNH XEM FILE TRỰC TIẾP TRÊN GIAO DIỆN ====================
const DOC_FILES = {
  cv1751: '/docs/CV-1751-IIG-The-le-AI-or-Behind-2026-2027.pdf',
  cv8344: '/docs/CV-8344-SGDDT-An-Giang-AI-or-Behind.pdf',
  bm01: '/api/download-bm01'
};

function openFileViewer(tabKey = 'cv1751') {
  const modal = document.getElementById('docViewerModal');
  if (!modal) return;
  modal.classList.add('open');
  switchFileViewerTab(tabKey);
}

function switchFileViewerTab(tabKey) {
  ['cv1751', 'cv8344', 'bm01'].forEach((k) => {
    const btn = document.getElementById(`dvTab_${k}`);
    if (btn) btn.classList.toggle('active', k === tabKey);
  });

  const pdfBox = document.getElementById('dvPdfBox');
  const bm01Box = document.getElementById('dvBm01Box');
  const pdfFrame = document.getElementById('dvPdfFrame');
  const dlLink = document.getElementById('dvDownloadLink');

  if (dlLink) {
    dlLink.href = DOC_FILES[tabKey] || DOC_FILES.cv1751;
  }

  if (tabKey === 'bm01') {
    if (pdfBox) pdfBox.style.display = 'none';
    if (bm01Box) bm01Box.style.display = 'block';
    renderBm01Preview();
  } else {
    if (bm01Box) bm01Box.style.display = 'none';
    if (pdfBox) pdfBox.style.display = 'block';
    const targetUrl = DOC_FILES[tabKey];
    if (pdfFrame && pdfFrame.getAttribute('data-src') !== targetUrl) {
      pdfFrame.src = targetUrl;
      pdfFrame.setAttribute('data-src', targetUrl);
    }
  }
}

function closeFileViewer() {
  document.getElementById('docViewerModal')?.classList.remove('open');
}

function renderBm01Preview() {
  const tbody = document.getElementById('bm01PreviewBody');
  if (!tbody) return;
  const rows = clientState.bm01Rows && clientState.bm01Rows.length > 0
    ? clientState.bm01Rows
    : [{
        stt: 1,
        schoolName: 'Trường THPT Nguyễn Sinh Sắc',
        ward: 'Phường Long Thạnh, TX. Tân Châu, An Giang',
        studentCount: (clientState.students || []).length,
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
        <td><strong>${escapeHtml(r.schoolName)}</strong></td>
        <td>${escapeHtml(r.ward)}</td>
        <td style="text-align:center; font-weight:800; color:var(--nss-lotus); font-size:1.05rem;">${Number(r.studentCount) || 0}</td>
        <td>${escapeHtml(r.contactName)}</td>
        <td>${escapeHtml(r.contactRole)}</td>
        <td>${escapeHtml(r.contactEmail)}</td>
        <td>${escapeHtml(r.contactPhone)}</td>
      </tr>
    `
    )
    .join('');
}

// ==================== 4. CẬP NHẬT GIAO DIỆN & TRA CỨU HỌC SINH ====================
function applyStateToUI(state) {
  if (!state) return;
  clientState = state;

  const totalStudents = Array.isArray(state.students) ? state.students.length : 0;
  const bm01Rows = Array.isArray(state.bm01Rows) ? state.bm01Rows : [];
  const mainCount = bm01Rows.length > 0 ? (Number(bm01Rows[0].studentCount) || totalStudents) : totalStudents;

  const heroCountEl = document.getElementById('heroStudentCount');
  const heroRemEl = document.getElementById('heroRemainingSlots');
  const tabBadgeEl = document.getElementById('tabStudentCountBadge');

  if (heroCountEl) heroCountEl.textContent = mainCount;
  if (tabBadgeEl) tabBadgeEl.textContent = totalStudents;
  if (heroRemEl) heroRemEl.textContent = `(Còn ${Math.max(0, 500 - mainCount)} suất)`;

  renderBm01Preview();
  renderStudentList();
}

function renderStudentList() {
  const container = document.getElementById('studentListContainer');
  if (!container) return;

  const query = (document.getElementById('searchStudentInput')?.value || '').trim().toLowerCase();
  const list = (clientState.students || []).filter((st) => {
    if (!query) return true;
    return (
      (st.fullName && st.fullName.toLowerCase().includes(query)) ||
      (st.className && st.className.toLowerCase().includes(query)) ||
      (st.id && st.id.toLowerCase().includes(query))
    );
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:20px; color:#64748b; font-size:0.86rem;">
        Chưa có thí sinh trong danh sách tìm kiếm. Hãy điền Phiếu đăng ký phía trên để ghi danh!
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .slice()
    .reverse()
    .slice(0, 12)
    .map(
      (st) => `
      <div class="student-card-item">
        <div class="student-card-top">
          <span class="student-code-badge">${escapeHtml(st.id)}</span>
          <span class="student-class-badge">Lớp ${escapeHtml(st.className)}</span>
        </div>
        <div style="font-size:0.96rem; font-weight:800; color:var(--nss-blue-dark);">
          ${escapeHtml(st.fullName)}
        </div>
        <div style="font-size:0.78rem; color:#475569; display:flex; justify-content:space-between;">
          <span>Đề thi: <strong>${escapeHtml(st.examLang)}</strong></span>
          <span>🕒 ${escapeHtml(st.createdAt || '')}</span>
        </div>
      </div>
    `
    )
    .join('');
}

// ==================== 5. FORM ĐĂNG KÝ HỌC SINH ====================
function fillClassPrefix(cls) {
  const input = document.getElementById('stClass');
  if (input) {
    input.value = cls;
    input.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('studentRegForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitRegBtn');
    const payload = {
      fullName: document.getElementById('stFullName').value,
      dob: document.getElementById('stDob').value,
      className: document.getElementById('stClass').value,
      gender: document.getElementById('stGender').value,
      cccd: document.getElementById('stCccd').value,
      examLang: document.getElementById('stExamLang').value,
      phone: document.getElementById('stPhone').value,
      email: document.getElementById('stEmail').value,
      parentName: document.getElementById('stParentName').value,
      parentPhone: document.getElementById('stParentPhone').value,
      consent: document.getElementById('stConsent').checked
    };

    btn.disabled = true;
    btn.textContent = '⏳ Đang lưu đăng ký...';

    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.ok) {
        showToast('⚠️ ' + (data.message || 'Vui lòng điền đủ thông tin!'));
      } else {
        applyStateToUI(data.state);
        form.reset();
        document.getElementById('stConsent').checked = true;
        openTicketModal(data.student);
      }
    } catch (err) {
      showToast('⚠️ Lỗi kết nối: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✅ GỬI ĐĂNG KÝ THAM GIA NGAY';
    }
  });
});

function openTicketModal(student) {
  const modal = document.getElementById('ticketModal');
  const box = document.getElementById('ticketContentBox');
  if (!modal || !box || !student) return;
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
      <strong style="color:var(--nss-blue);">Mã ĐK: ${escapeHtml(student.id)}</strong>
      <span class="student-class-badge">Lớp ${escapeHtml(student.className)}</span>
    </div>
    <div><strong>Họ và tên:</strong> ${escapeHtml(student.fullName)}</div>
    <div><strong>Đơn vị:</strong> Trường THPT Nguyễn Sinh Sắc</div>
    <div><strong>Ngôn ngữ thi:</strong> ${escapeHtml(student.examLang)}</div>
    <div style="margin-top:8px; font-size:0.76rem; color:#166534; background:#dcfce7; padding:6px 10px; border-radius:8px; font-weight:700;">
      ✓ Đã cập nhật vào file BM01 &amp; đồng bộ Google Drive!
    </div>
  `;
  modal.classList.add('open');
}

function closeTicketModal() {
  document.getElementById('ticketModal')?.classList.remove('open');
}

function setMobNavActive(el) {
  document.querySelectorAll('.mobile-bottom-nav .mob-nav-item').forEach((item) => item.classList.remove('active'));
  el.classList.add('active');
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
  initBannerSlideshow();
  initCountdown();

  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    if (data.ok) applyStateToUI(data.state);
  } catch (_) {}

  try {
    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.state) applyStateToUI(payload.state);
      if (payload.notification) showToast(payload.notification);
    };
  } catch (_) {}
});
