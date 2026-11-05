// ==================== STATE & GLOBAL VARIABLES ====================
let clientState = {
  meta: {
    soGddt: 'tỉnh An Giang',
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

// ==================== 1. LIVESHOW TRƯỢT TỰ ĐỘNG 5 BANNER & LIGHTBOX PHÓNG TO ====================
const TOTAL_BANNER_SLIDES = 5;
const SLIDE_INTERVAL_MS = 5500;
const BANNER_VERSION = '20261105-2';
let currentBannerSlide = 0;
let slideProgress = 0;
let isSlidePaused = false;
let currentLightboxSlide = 0;

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

function openBannerLightbox(index) {
  currentLightboxSlide = typeof index === 'number' ? index : currentBannerSlide;
  isSlidePaused = true;
  updateLightboxUI();
  document.getElementById('bannerLightboxModal')?.classList.add('open');
}

function closeBannerLightbox(e) {
  if (e && e.target && e.target.id !== 'bannerLightboxModal') return;
  document.getElementById('bannerLightboxModal')?.classList.remove('open');
  isSlidePaused = false;
}

function changeLightboxSlide(step) {
  currentLightboxSlide = (currentLightboxSlide + step + TOTAL_BANNER_SLIDES) % TOTAL_BANNER_SLIDES;
  goToBannerSlide(currentLightboxSlide);
  updateLightboxUI();
}

function goToLightboxSlide(idx) {
  currentLightboxSlide = (idx + TOTAL_BANNER_SLIDES) % TOTAL_BANNER_SLIDES;
  goToBannerSlide(currentLightboxSlide);
  updateLightboxUI();
}

function updateLightboxUI() {
  const img = document.getElementById('lightboxBannerImg');
  const title = document.getElementById('lightboxSlideTitle');
  if (img) {
    img.src = `/assets/${currentLightboxSlide + 1}.png?v=${BANNER_VERSION}`;
  }
  if (title) {
    title.textContent = `Banner ${currentLightboxSlide + 1} / ${TOTAL_BANNER_SLIDES} — Cuộc thi AI OR BEHIND 2026-2027`;
  }
  const dots = document.querySelectorAll('#lightboxDots .slide-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentLightboxSlide);
  });
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
  let touchStartY = 0;
  wrap.addEventListener('touchstart', (e) => {
    isSlidePaused = true;
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  wrap.addEventListener('touchend', (e) => {
    isSlidePaused = false;
    const diffX = touchStartX - e.changedTouches[0].screenX;
    const diffY = touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(diffX) > 36 && Math.abs(diffX) > Math.abs(diffY)) {
      changeBannerSlide(diffX > 0 ? 1 : -1);
    }
  }, { passive: true });

  // Hỗ trợ vuốt ngang trong chế độ phóng to Lightbox
  const lbModal = document.getElementById('bannerLightboxModal');
  if (lbModal) {
    let lbStartX = 0;
    lbModal.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        lbStartX = e.changedTouches[0].screenX;
      }
    }, { passive: true });
    lbModal.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1 && lbStartX) {
        const diff = lbStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) > 45) {
          changeLightboxSlide(diff > 0 ? 1 : -1);
        }
        lbStartX = 0;
      }
    }, { passive: true });
  }
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

// ==================== 3. TRÌNH XEM FILE TRỰC TIẾP TRÊN GIAO DIỆN (TỐI ƯU DI ĐỘNG) ====================
const DOC_FILES = {
  cv1751: '/docs/CV-1751-IIG-The-le-AI-or-Behind-2026-2027.pdf',
  cv8344: '/docs/CV-8344-SGDDT-An-Giang-AI-or-Behind.pdf',
  bm01: '/api/download-bm01'
};

let currentDocTab = 'cv1751';
let currentDocMode = window.innerWidth < 768 ? 'reader' : 'pdf';

const MOBILE_DOC_SUMMARIES = {
  cv1751: `
    <div class="m-reader-card">
      <div class="m-reader-badge">CÔNG VĂN SỐ 1751/2026/CV-IIG • THỂ LỆ CHÍNH THỨC</div>
      <h3>CUỘC THI "AI OR BEHIND" NĂM HỌC 2026 – 2027</h3>
      <p class="m-reader-lead">
        Do <strong>Tập đoàn Công nghiệp – Viễn thông Quân đội (Viettel)</strong> và <strong>Tổ chức Giáo dục IIG Việt Nam</strong> phối hợp tổ chức hoàn toàn <strong>miễn phí 100%</strong> cho học sinh THPT toàn quốc.
      </p>

      <div class="m-reader-section">
        <h4>🎯 1. Đối tượng &amp; Quyền lợi khi tham gia</h4>
        <ul>
          <li><strong>Đối tượng:</strong> Học sinh lớp 10, 11, 12 năm học 2026–2027 tại Trường THPT Nguyễn Sinh Sắc (tối đa 500 suất thi Vòng cấp cơ sở/trường).</li>
          <li><strong>Miễn phí 100%:</strong> Toàn bộ thí sinh đăng ký hợp lệ được cấp miễn phí tài khoản ôn luyện và bài thi <strong>Gmetrix Generative AI Foundations</strong>.</li>
          <li><strong>Chứng nhận &amp; Chứng chỉ Quốc tế:</strong>
            <br/>• Đạt <strong>≥ 700/1000 điểm</strong> tại Vòng Cấp cơ sở: Nhận <strong>Giấy chứng nhận điện tử</strong> của Ban Tổ chức.
            <br/>• Đạt <strong>≥ 700/1000 điểm</strong> tại Vòng Quốc gia: Được cấp miễn phí <strong>Chứng chỉ Quốc tế Generative AI Foundations</strong> của Tập đoàn Giáo dục <strong>Pearson (Hoa Kỳ)</strong> có giá trị toàn cầu.
          </li>
        </ul>
      </div>

      <div class="m-reader-section">
        <h4>🗓️ 2. Lộ trình 3 Vòng thi chi tiết</h4>
        <ul>
          <li><strong>Vòng 1 – Cấp cơ sở (02/11/2026 – 30/12/2026):</strong>
            <br/>• Hạn đăng ký danh sách: Trước ngày <strong>30/11/2026</strong>.
            <br/>• Hình thức: Thi trực tuyến trên máy tính tại trường bài thi <em>Gmetrix Generative AI Foundations</em> (50 phút, 35–40 câu hỏi, thang điểm 1000).
            <br/>• Ngôn ngữ: Học sinh tự chọn <strong>Tiếng Việt</strong> hoặc <strong>Tiếng Anh</strong>.
          </li>
          <li><strong>Vòng 2 – Cấp Quốc gia (Ngày 14/03/2027):</strong>
            <br/>• Dành cho <strong>Top 500 đội tuyển</strong> xuất sắc nhất toàn quốc (mỗi đội 3–5 học sinh cùng trường).
            <br/>• Thi trực tuyến có giám sát bài thi chính thức <em>Generative AI Foundations</em> của Pearson.
          </li>
          <li><strong>Vòng 3 – Chung kết Quốc gia (Ngày 11/04/2027):</strong>
            <br/>• Dành cho <strong>Top 30 đội tuyển</strong> xuất sắc nhất cả nước thi tập trung tại Hà Nội, Đà Nẵng, TP. Hồ Chí Minh.
            <br/>• Gồm 2 phần: Bài thi quốc tế <em>AI - IT Specialist</em> và Thuyết trình bảo vệ <em>Dự án ứng dụng AI</em> bằng Tiếng Anh.
          </li>
        </ul>
      </div>

      <div class="m-reader-section">
        <h4>🏆 3. Cơ cấu Giải thưởng (Tổng giá trị hơn 1 Tỷ đồng)</h4>
        <ul>
          <li>🥇 <strong>01 Giải Nhất Quốc gia:</strong> <strong>100.000.000 VNĐ</strong> + Huy chương Vàng + Bằng khen.</li>
          <li>🥈 <strong>03 Giải Nhì Quốc gia:</strong> <strong>50.000.000 VNĐ / giải</strong> + Huy chương Bạc.</li>
          <li>🥉 <strong>06 Giải Ba Quốc gia:</strong> <strong>30.000.000 VNĐ / giải</strong> + Huy chương Đồng.</li>
          <li>🎖️ <strong>20 Giải Khuyến khích:</strong> <strong>10.000.000 VNĐ / giải</strong> + Giấy chứng nhận.</li>
          <li>🏫 Ngoài ra còn có Giải Tập thể dành cho các Sở GD&amp;ĐT và Trường THPT có phong trào xuất sắc.</li>
        </ul>
      </div>

      <div class="m-reader-footer-cta">
        <a href="/docs/CV-1751-IIG-The-le-AI-or-Behind-2026-2027.pdf" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%;">
          📥 Mở / Tải Toàn văn PDF Công văn 1751 &amp; Thể lệ (9 Trang)
        </a>
      </div>
    </div>
  `,
  cv8344: `
    <div class="m-reader-card">
      <div class="m-reader-badge">CÔNG VĂN SỐ 8344/SGDĐT-QLCL&amp;CNTT • SỞ GD&amp;ĐT AN GIANG</div>
      <h3>V/V THAM GIA CUỘC THI "AI OR BEHIND" NĂM HỌC 2026 – 2027</h3>
      <p class="m-reader-lead">
        Văn bản chỉ đạo của <strong>Sở Giáo dục và Đào tạo tỉnh An Giang</strong> gửi các trường THPT và trường phổ thông có nhiều cấp học (trong đó có cấp THPT) trên địa bàn tỉnh.
      </p>

      <div class="m-reader-section">
        <h4>📌 1. Nội dung triển khai tại Trường THPT Nguyễn Sinh Sắc</h4>
        <ul>
          <li>Tuyên truyền, phổ biến rộng rãi nội dung và Thể lệ Cuộc thi <strong>"AI or Behind" năm học 2026–2027</strong> đến toàn thể giáo viên, phụ huynh và học sinh khối 10, 11, 12.</li>
          <li>Khuyến khích học sinh đăng ký tham gia trên tinh thần tự nguyện, hoàn toàn <strong>miễn phí</strong>, nhằm nâng cao năng lực ứng dụng Trí tuệ nhân tạo (Gen AI) theo chuẩn quốc tế.</li>
          <li>Nhà trường cử cán bộ/giáo viên làm đầu mối tiếp nhận tài khoản Gmetrix và hướng dẫn học sinh ôn luyện, dự thi Vòng cấp cơ sở tại phòng máy của trường.</li>
        </ul>
      </div>

      <div class="m-reader-section">
        <h4>⏰ 2. Mốc thời gian quan trọng cần lưu ý</h4>
        <ul>
          <li><strong>Hạn chót đăng ký danh sách cấp trường (Biểu mẫu BM01):</strong> Hoàn thành trước ngày <strong>30/11/2026</strong>.</li>
          <li><strong>Tổ chức thi Vòng cấp cơ sở tại trường:</strong> Từ ngày <strong>02/11/2026 đến hết ngày 30/12/2026</strong>.</li>
          <li><strong>Số lượng định mức:</strong> Tối đa <strong>500 học sinh / trường THPT</strong>.</li>
        </ul>
      </div>

      <div class="m-reader-footer-cta">
        <a href="/docs/CV-8344-SGDDT-An-Giang-AI-or-Behind.pdf" target="_blank" rel="noopener" class="btn btn-primary" style="width:100%;">
          📥 Mở / Tải Toàn văn PDF Công văn 8344 của Sở GD&amp;ĐT An Giang
        </a>
      </div>
    </div>
  `
};

function openFileViewer(tabKey = 'cv1751') {
  const modal = document.getElementById('docViewerModal');
  if (!modal) return;
  currentDocMode = window.innerWidth < 768 ? 'reader' : 'pdf';
  modal.classList.add('open');
  switchFileViewerTab(tabKey);
}

function setDocViewerMode(mode) {
  currentDocMode = mode;
  updateDocViewerContent();
}

function switchFileViewerTab(tabKey) {
  currentDocTab = tabKey;
  ['cv1751', 'cv8344', 'bm01'].forEach((k) => {
    const btn = document.getElementById(`dvTab_${k}`);
    if (btn) btn.classList.toggle('active', k === tabKey);
  });

  const dlLink = document.getElementById('dvDownloadLink');
  if (dlLink) {
    dlLink.href = DOC_FILES[tabKey] || DOC_FILES.cv1751;
  }

  updateDocViewerContent();
}

function updateDocViewerContent() {
  const modeBar = document.getElementById('dvModeSwitchBar');
  const readerBox = document.getElementById('dvMobileReaderBox');
  const pdfBox = document.getElementById('dvPdfBox');
  const bm01Box = document.getElementById('dvBm01Box');
  const pdfFrame = document.getElementById('dvPdfFrame');
  const btnReader = document.getElementById('btnModeMobileReader');
  const btnPdf = document.getElementById('btnModePdfEmbed');

  if (btnReader) btnReader.classList.toggle('active', currentDocMode === 'reader');
  if (btnPdf) btnPdf.classList.toggle('active', currentDocMode === 'pdf');

  if (currentDocTab === 'bm01') {
    if (modeBar) modeBar.style.display = 'none';
    if (readerBox) readerBox.style.display = 'none';
    if (pdfBox) pdfBox.style.display = 'none';
    if (bm01Box) bm01Box.style.display = 'block';
    renderBm01Preview();
    return;
  }

  if (modeBar) modeBar.style.display = 'flex';
  if (bm01Box) bm01Box.style.display = 'none';

  if (currentDocMode === 'reader') {
    if (pdfBox) pdfBox.style.display = 'none';
    if (readerBox) {
      readerBox.style.display = 'block';
      readerBox.innerHTML = MOBILE_DOC_SUMMARIES[currentDocTab] || MOBILE_DOC_SUMMARIES.cv1751;
    }
  } else {
    if (readerBox) readerBox.style.display = 'none';
    if (pdfBox) pdfBox.style.display = 'block';
    const targetUrl = DOC_FILES[currentDocTab];
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
        <div style="font-size:0.78rem; color:#475569; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
          <span>Đề thi: <strong>${escapeHtml(st.examLang)}</strong></span>
          <span>🕒 ${escapeHtml(st.createdAt || '')}</span>
        </div>
      </div>
    `
    )
    .join('');
}

// ==================== 5. FORM ĐĂNG KÝ HỌC SINH & CHUẨN HÓA NGÀY SINH dd/MM/YYYY ====================
function autoFormatDobInput(input) {
  if (!input) return;
  let digits = input.value.replace(/\D/g, '').slice(0, 8);
  let formatted = '';
  if (digits.length > 0) {
    formatted = digits.slice(0, 2);
  }
  if (digits.length >= 3) {
    formatted += '/' + digits.slice(2, 4);
  }
  if (digits.length >= 5) {
    formatted += '/' + digits.slice(4, 8);
  }
  input.value = formatted;
}

function syncPickerToDobText(picker, targetInputId) {
  if (!picker || !picker.value) return;
  const parts = picker.value.split('-'); // YYYY-MM-DD
  if (parts.length === 3) {
    const target = document.getElementById(targetInputId);
    if (target) {
      target.value = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
}

function normalizeDobDdMmYyyy(raw) {
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

function isValidDobDdMmYyyy(dobStr) {
  const m = String(dobStr || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1950 || year > 2025) return false;
  return true;
}

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
    const normalizedDob = normalizeDobDdMmYyyy(document.getElementById('stDob').value);
    if (!isValidDobDdMmYyyy(normalizedDob)) {
      showToast('⚠️ Vui lòng nhập Ngày sinh đúng định dạng dd/MM/YYYY (VD: 15/08/2009)!');
      document.getElementById('stDob')?.focus();
      return;
    }

    const payload = {
      fullName: document.getElementById('stFullName').value,
      dob: normalizedDob,
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
