/**
 * ============================================================
 *  MRRR Team Finland Boys Group — Administration Console Script
 *  Firebase v9 Modular SDK | Secured by mrrfinland1216 passcode
 * ============================================================
 */

/* ── Firebase SDK Imports ─────────────────────────────────── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

/* ── Firebase Configuration ───────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyB4wZzceKofQAiVeQMbrkTZBZLXcB9Z5OI",
  authDomain:        "mrr-bhajan-finland.firebaseapp.com",
  projectId:         "mrr-bhajan-finland",
  storageBucket:     "mrr-bhajan-finland.firebasestorage.app",
  messagingSenderId: "913989931388",
  appId:             "1:913989931388:web:c9be6b50f662ffe65394f9"
};

/* Initialize Services */
const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);

/* ── State variables ──────────────────────────────────────── */
let pendingMembers     = []; // Pending requests
let activeMembers      = [];  // Approved member profiles
let activeTab          = "active"; // Current administrative view ("pending" | "active")
let selectedMemberId   = null;
let selectedMemberData = null;

// Constants for Validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{7,20}$/;
const MAX_PHOTO_SIZE_MB   = 5;
const MAX_PHOTO_BYTES     = MAX_PHOTO_SIZE_MB * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* ── DOM References ───────────────────────────────────────── */
const membersGrid       = document.getElementById("membersGrid");
const loadingState      = document.getElementById("loadingState");
const noResultsState    = document.getElementById("noResultsState");
const noResultsTitle    = document.getElementById("noResultsTitle");
const noResultsDesc     = document.getElementById("noResultsDesc");

const countPendingText  = document.getElementById("countPending");
const countActiveText   = document.getElementById("countActive");
const countAdminPaymentDoneText    = document.getElementById("countAdminPaymentDone");
const countAdminPaymentPendingText = document.getElementById("countAdminPaymentPending");

const searchInput       = document.getElementById("searchInput");
const sortControlSelect = document.getElementById("sortControl");
const adminJerseyFilterControl = document.getElementById("adminJerseyFilterControl");

const tabPendingBtn     = document.getElementById("tabPending");
const tabActiveBtn      = document.getElementById("tabActive");

const toast             = document.getElementById("toast");

/* Page Gate Elements */
const pageGate          = document.getElementById("pageGate");
const dashboardWrapper  = document.getElementById("dashboardWrapper");
const gatePinCodeInput = document.getElementById("gatePinCode");
const gateErrorText     = document.getElementById("gateError");
const btnGateSubmit     = document.getElementById("btnGateSubmit");

/* Modal Profile Editor Elements */
const editModal           = document.getElementById("editModal");
const editMemberForm      = document.getElementById("editMemberForm");
const editFullNameInput   = document.getElementById("editFullName");
const editCityInput       = document.getElementById("editCity");
const editPhoneInput      = document.getElementById("editPhone");
const editEmailInput      = document.getElementById("editEmail");

const editPhotoDropzone       = document.getElementById("editPhotoDropzone");
const editProfilePhotoInput   = document.getElementById("editProfilePhoto");
const editPhotoPlaceholder    = document.getElementById("editPhotoPlaceholder");
const editPhotoPreviewWrapper = document.getElementById("editPhotoPreviewWrapper");
const editPhotoPreviewImg     = document.getElementById("editPhotoPreview");
const editPhotoRemoveBtn      = document.getElementById("editPhotoRemoveBtn");

const editJerseyDetailsPanel   = document.getElementById("editJerseyDetailsPanel");
const editJerseySizeSelect     = document.getElementById("editJerseySize");
const editJerseyNumberInput    = document.getElementById("editJerseyNumber");
const editJerseyNameInput      = document.getElementById("editJerseyName");
const editJerseyQuantityInput  = document.getElementById("editJerseyQuantity");
const editPaymentStatusSelect  = document.getElementById("editPaymentStatus");
const editAdditionalPaymentStatusSelect = document.getElementById("editAdditionalPaymentStatus");

const btnSaveChanges          = document.getElementById("btnSaveChanges");
const saveBtnLabel            = document.getElementById("saveBtnLabel");
const saveBtnSpinner          = document.getElementById("saveBtnSpinner");

const btnCancelEdit1          = document.getElementById("btnCancelEdit1");
const btnCancelEdit2          = document.getElementById("btnCancelEdit2");

/* Helper to track photo changes in edit state */
let editPhotoState = {
  file: null,
  removedOld: false,
  currentUrl: null
};

/* ═══════════════════════════════════════════════════════════
   ADMIN EXTRA JERSEY PANELS — HTML BUILDER
   ═══════════════════════════════════════════════════════════ */

const ADMIN_CHECK_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const ADMIN_JERSEY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>`;

function buildEditExtraJerseyPanelHTML(idx, prefill) {
  const num = idx + 1;
  const p   = `eEx${idx}`;
  const f   = prefill || {};

  return `
<div class="jersey-extra-panel" id="editExtraPanel_${idx}" data-extra-index="${idx}">
  <div class="jersey-extra-panel__header">
    ${ADMIN_JERSEY_ICON}
    <span class="jersey-extra-panel__badge">${num}</span>
    Jersey #${num} — Details
  </div>

  <!-- Type -->
  <div class="field-group" id="${p}_fieldType" style="grid-column:span 2;">
    <label class="field-label">Jersey Type <span class="required-star">*</span></label>
    <div class="radio-pill-group" role="radiogroup" aria-describedby="${p}_typeError">
      <label class="radio-pill"><input type="radio" id="${p}_typePlayer" name="${p}_type" value="player" class="radio-pill__input"${f.type==="player"?" checked":""}><span class="radio-pill__check">${ADMIN_CHECK_SVG}</span><span class="radio-pill__text">Player</span></label>
      <label class="radio-pill"><input type="radio" id="${p}_typeFan" name="${p}_type" value="fan" class="radio-pill__input"${f.type==="fan"?" checked":""}><span class="radio-pill__check">${ADMIN_CHECK_SVG}</span><span class="radio-pill__text">Fan</span></label>
    </div>
    <span class="field-error" id="${p}_typeError" role="alert"></span>
  </div>

  <!-- Style -->
  <div class="field-group" id="${p}_fieldStyle" style="grid-column:span 2;">
    <label class="field-label">Jersey Style <span class="required-star">*</span></label>
    <div class="radio-pill-group" role="radiogroup" aria-describedby="${p}_styleError">
      <label class="radio-pill"><input type="radio" id="${p}_styleBtn" name="${p}_style" value="button_collar" class="radio-pill__input"${f.style==="button_collar"?" checked":""}><span class="radio-pill__check">${ADMIN_CHECK_SVG}</span><span class="radio-pill__text">Button Collar</span></label>
      <label class="radio-pill"><input type="radio" id="${p}_stylePlain" name="${p}_style" value="plain_neck" class="radio-pill__input"${f.style==="plain_neck"?" checked":""}><span class="radio-pill__check">${ADMIN_CHECK_SVG}</span><span class="radio-pill__text">Plain Neck</span></label>
    </div>
    <span class="field-error" id="${p}_styleError" role="alert"></span>
  </div>

  <!-- Sleeve -->
  <div class="field-group" id="${p}_fieldSleeve" style="grid-column:span 2;">
    <label class="field-label">Sleeve <span class="required-star">*</span></label>
    <div class="radio-pill-group" role="radiogroup" aria-describedby="${p}_sleeveError">
      <label class="radio-pill"><input type="radio" id="${p}_sleeveHalf" name="${p}_sleeve" value="half" class="radio-pill__input"${f.sleeve==="half"?" checked":""}><span class="radio-pill__check">${ADMIN_CHECK_SVG}</span><span class="radio-pill__text">Half</span></label>
      <label class="radio-pill"><input type="radio" id="${p}_sleeveFull" name="${p}_sleeve" value="full" class="radio-pill__input"${f.sleeve==="full"?" checked":""}><span class="radio-pill__check">${ADMIN_CHECK_SVG}</span><span class="radio-pill__text">Full</span></label>
    </div>
    <span class="field-error" id="${p}_sleeveError" role="alert"></span>
  </div>

  <!-- Size -->
  <div class="field-group" id="${p}_fieldSize">
    <label class="field-label" for="${p}_size">Size <span class="required-star">*</span></label>
    <select id="${p}_size" class="field-input" aria-describedby="${p}_sizeError">
      <option value="" disabled${!f.size?" selected":""}>Select…</option>
      <option value="XS"${f.size==="XS"?" selected":""}>XS</option>
      <option value="S"${f.size==="S"?" selected":""}>S</option>
      <option value="M"${f.size==="M"?" selected":""}>M</option>
      <option value="L"${f.size==="L"?" selected":""}>L</option>
      <option value="XL"${f.size==="XL"?" selected":""}>XL</option>
      <option value="XXL"${f.size==="XXL"?" selected":""}>XXL</option>
      <option value="XXXL"${f.size==="XXXL"?" selected":""}>XXXL</option>
    </select>
    <span class="field-error" id="${p}_sizeError" role="alert"></span>
  </div>

  <!-- Number -->
  <div class="field-group" id="${p}_fieldNumber">
    <label class="field-label" for="${p}_number">No. <span class="required-star">*</span></label>
    <input type="number" id="${p}_number" class="field-input" placeholder="1–99" min="1" max="99"${f.number ? ` value="${f.number}"` : ""}>
    <span class="field-error" id="${p}_numberError" role="alert"></span>
  </div>

  <!-- Name -->
  <div class="field-group" id="${p}_fieldName" style="grid-column:span 2;">
    <label class="field-label" for="${p}_name">Name on Jersey <span class="required-star">*</span></label>
    <input type="text" id="${p}_name" class="field-input" placeholder="e.g. ACHARYA"${f.name ? ` value="${f.name}"` : ""}>
    <span class="field-error" id="${p}_nameError" role="alert"></span>
  </div>
</div>`;
}

function renderEditAdditionalJerseyPanels(qty, prefillExtras) {
  const container = document.getElementById("editAdditionalJerseyPanels");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 1; i < qty; i++) {
    const prefill = prefillExtras && prefillExtras[i - 1] ? prefillExtras[i - 1] : null;
    container.insertAdjacentHTML("beforeend", buildEditExtraJerseyPanelHTML(i, prefill));
    const p = `eEx${i}`;
    document.querySelectorAll(`input[name="${p}_type"]`).forEach(radio => {
      radio.addEventListener("change", () => {
        const type = document.querySelector(`input[name="${p}_type"]:checked`)?.value;
        if (type === "player") { const el = document.getElementById(`${p}_styleBtn`); if (el) el.checked = true; }
        else if (type === "fan") { const el = document.getElementById(`${p}_stylePlain`); if (el) el.checked = true; }
      });
    });
  }
}

function validateEditExtraPanels(qty) {
  let isValid = true;
  for (let i = 1; i < qty; i++) {
    const p = `eEx${i}`;
    if (!document.querySelector(`input[name="${p}_type"]:checked`)) {
      const g = document.getElementById(`${p}_fieldType`); const e = document.getElementById(`${p}_typeError`);
      if (g && e) setFieldError(g, e, "Select a jersey type."); isValid = false;
    } else { const g = document.getElementById(`${p}_fieldType`); const e = document.getElementById(`${p}_typeError`); if (g && e) setFieldValid(g, e); }
    if (!document.querySelector(`input[name="${p}_style"]:checked`)) {
      const g = document.getElementById(`${p}_fieldStyle`); const e = document.getElementById(`${p}_styleError`);
      if (g && e) setFieldError(g, e, "Select a jersey style."); isValid = false;
    } else { const g = document.getElementById(`${p}_fieldStyle`); const e = document.getElementById(`${p}_styleError`); if (g && e) setFieldValid(g, e); }
    if (!document.querySelector(`input[name="${p}_sleeve"]:checked`)) {
      const g = document.getElementById(`${p}_fieldSleeve`); const e = document.getElementById(`${p}_sleeveError`);
      if (g && e) setFieldError(g, e, "Select a sleeve."); isValid = false;
    } else { const g = document.getElementById(`${p}_fieldSleeve`); const e = document.getElementById(`${p}_sleeveError`); if (g && e) setFieldValid(g, e); }
    const sizeEl = document.getElementById(`${p}_size`);
    if (sizeEl && !sizeEl.value) {
      const g = document.getElementById(`${p}_fieldSize`); const e = document.getElementById(`${p}_sizeError`);
      if (g && e) setFieldError(g, e, "Select size."); isValid = false;
    } else { const g = document.getElementById(`${p}_fieldSize`); const e = document.getElementById(`${p}_sizeError`); if (g && e) setFieldValid(g, e); }
    const numEl = document.getElementById(`${p}_number`);
    if (numEl) {
      const nv = parseInt(numEl.value, 10);
      if (!numEl.value || isNaN(nv) || nv < 1 || nv > 99) {
        const g = document.getElementById(`${p}_fieldNumber`); const e = document.getElementById(`${p}_numberError`);
        if (g && e) setFieldError(g, e, "Number must be 1–99."); isValid = false;
      } else { const g = document.getElementById(`${p}_fieldNumber`); const e = document.getElementById(`${p}_numberError`); if (g && e) setFieldValid(g, e); }
    }
    const nameEl = document.getElementById(`${p}_name`);
    if (nameEl && !nameEl.value.trim()) {
      const g = document.getElementById(`${p}_fieldName`); const e = document.getElementById(`${p}_nameError`);
      if (g && e) setFieldError(g, e, "Name is required."); isValid = false;
    } else { const g = document.getElementById(`${p}_fieldName`); const e = document.getElementById(`${p}_nameError`); if (g && e) setFieldValid(g, e); }
  }
  return isValid;
}

function collectEditExtraPanelsData(qty) {
  const extras = [];
  for (let i = 1; i < qty; i++) {
    const p = `eEx${i}`;
    const numEl = document.getElementById(`${p}_number`);
    extras.push({
      type:   document.querySelector(`input[name="${p}_type"]:checked`)?.value   || null,
      style:  document.querySelector(`input[name="${p}_style"]:checked`)?.value  || null,
      sleeve: document.querySelector(`input[name="${p}_sleeve"]:checked`)?.value || null,
      size:   document.getElementById(`${p}_size`)?.value || null,
      number: numEl ? (parseInt(numEl.value, 10) || null) : null,
      name:   document.getElementById(`${p}_name`)?.value?.trim()?.toUpperCase() || null
    });
  }
  return extras;
}

/* Quantity listener — render extra panels live in admin modal */
if (editJerseyQuantityInput) {
  editJerseyQuantityInput.addEventListener("input", () => {
    const qty = parseInt(editJerseyQuantityInput.value, 10) || 1;
    if (qty >= 1 && qty <= 10) renderEditAdditionalJerseyPanels(qty);
  });
}

/* ═══════════════════════════════════════════════════════════
   TOAST UTILITY
   ═══════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(message, type = "info", duration = 3500) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className   = `toast toast--${type} toast--visible`;
  toastTimer = setTimeout(() => toast.classList.remove("toast--visible"), duration);
}

/* ═══════════════════════════════════════════════════════════
   STATS ANIMATION
   ═══════════════════════════════════════════════════════════ */
function animateCounter(element, targetValue) {
  if (isNaN(targetValue) || targetValue === 0) {
    element.textContent = "0";
    return;
  }

  let start = 0;
  const duration = 600; // ms
  const stepTime = Math.max(Math.floor(duration / targetValue), 15);
  
  const timer = setInterval(() => {
    start += 1;
    element.textContent = start;
    if (start >= targetValue) {
      element.textContent = targetValue;
      clearInterval(timer);
    }
  }, stepTime);
}

/* ═══════════════════════════════════════════════════════════
   DATABASE DATA RETRIEVAL
   ═══════════════════════════════════════════════════════════ */
async function fetchAdminData(showSuccessToast = true) {
  try {
    const q = query(collection(db, "members"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    pendingMembers = [];
    activeMembers  = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const member = {
        id: docSnap.id,
        ...data
      };

      if (data.membershipStatus === "Pending") {
        pendingMembers.push(member);
      } else if (data.membershipStatus === "Active" || !data.membershipStatus) {
        activeMembers.push(member);
      }
    });

    // Populate stats
    animateCounter(countPendingText, pendingMembers.length);
    animateCounter(countActiveText, activeMembers.length);

    // Payment stats (across all members)
    const allFetched = [...pendingMembers, ...activeMembers];
    const paymentDone = allFetched.filter(
      m => m.jersey && m.jersey.interested === true &&
        (m.paymentStatus === "Done" || m.paymentStatus === "Paid")
    ).length;
    const paymentPending = allFetched.filter(
      m => m.jersey && m.jersey.interested === true &&
        m.paymentStatus !== "Done" && m.paymentStatus !== "Paid"
    ).length;
    if (countAdminPaymentDoneText) animateCounter(countAdminPaymentDoneText, paymentDone);
    if (countAdminPaymentPendingText) animateCounter(countAdminPaymentPendingText, paymentPending);

    // Hide loader
    loadingState.style.display = "none";

    // Initial render
    applyFiltersAndSort();
    
    if (showSuccessToast) {
      showToast("Database records synced successfully.", "success");
    }

  } catch (err) {
    console.error("Error fetching administration data:", err);
    loadingState.innerHTML = `
      <div style="color: var(--clr-error); font-weight: 700; font-size: 16px;">
        ⚠️ Failed to fetch registrations
      </div>
      <p class="loading-text">${err.message || "Please check your network connection."}</p>
    `;
    showToast("Error loading administration data.", "error");
  }
}

/* ═══════════════════════════════════════════════════════════
   CARD RENDERING & ACTIONS
   ═══════════════════════════════════════════════════════════ */
function renderAdminGrid(membersList) {
  // Remove existing cards
  const existingCards = membersGrid.querySelectorAll(".member-card");
  existingCards.forEach(card => card.remove());

  if (membersList.length === 0) {
    if (activeTab === "pending") {
      noResultsTitle.textContent = "No pending requests found";
      noResultsDesc.textContent  = "All registration requests have been processed! Great job!";
    } else {
      noResultsTitle.textContent = "No approved members found";
      noResultsDesc.textContent  = "No profiles exist inside the active database currently.";
    }
    noResultsState.style.display = "flex";
    return;
  }
  
  noResultsState.style.display = "none";

  membersList.forEach((member) => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.id = `card-${member.id}`;

    // Format registration date
    let regDateStr = "—";
    if (member.createdAt) {
      const d = member.createdAt.toDate ? member.createdAt.toDate() : new Date(member.createdAt);
      regDateStr = d.toLocaleDateString("en-FI", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    }

    // Avatar HTML: check if profile photo exists
    let avatarHTML = "";
    if (member.profilePhoto) {
      avatarHTML = `<img src="${member.profilePhoto}" alt="${member.fullName}" class="avatar-img">`;
    } else {
      avatarHTML = `
        <div class="avatar-placeholder" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      `;
    }

    // Contact info formatting
    const phoneCallUrl = `tel:${member.phone.replace(/\s+/g, "")}`;
    const emailMailtoUrl = `mailto:${member.email}`;

    // Jersey Badge HTML & Payment Badge HTML
    let jerseyBadgeHTML = "";
    let paymentBadgeHTML = "";
    const isJerseyInterested = member.jersey && member.jersey.interested === true;
    
    if (isJerseyInterested) {
          const jType   = member.jersey.type === "player" ? "Player" : (member.jersey.type === "fan" ? "Fan" : "Jersey");
      const jStyle  = member.jersey.style === "button_collar" ? "Btn-Collar" : (member.jersey.style === "plain_neck" ? "Plain-Neck" : (member.jersey.type === "player" ? "Btn-Collar" : "Plain-Neck"));
      const jSleeve = member.jersey.sleeve === "full" ? "Full-slv" : (member.jersey.sleeve === "half" ? "Half-slv" : "");
      const jQty    = member.jersey.quantity || 1;
      
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--yes">
          <span><strong>${jType}</strong> (${jStyle})</span>
          <span>&nbsp;&#8231;&nbsp; ${jSleeve}</span>
          <span>&nbsp;&#8231;&nbsp; Size <strong>${member.jersey.size || "N/A"}</strong></span>
          <span>&nbsp;&#8231;&nbsp; No. <strong>${member.jersey.number || "—"}</strong></span>
          ${jQty > 1 ? `<span>&nbsp;&#8231;&nbsp; Qty: <strong>${jQty}</strong></span>` : ""}
        </div>
      `;
      
      const pStatus = member.paymentStatus || "No";
      let badgeClass = "payment-badge--no";
      let badgeLabel = "Not Paid (No)";
      let badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      
      if (pStatus === "Done" || pStatus === "Paid") {
        badgeClass = "payment-badge--done";
        badgeLabel = "Paid (Done)";
        badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (pStatus === "Maybe") {
        badgeClass = "payment-badge--maybe";
        badgeLabel = "Clicked Pay (Maybe)";
        badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
      }
      
      paymentBadgeHTML = `
        <div class="payment-badge-wrapper">
          <div class="payment-pill-badge ${badgeClass}">
            ${badgeIcon}
            <span>Payment: <strong>${badgeLabel}</strong></span>
          </div>
        </div>
      `;
    } else {
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--no">
          <span>No Jersey Interest</span>
        </div>
      `;
      
      paymentBadgeHTML = `
        <div class="payment-badge-wrapper">
          <div class="payment-pill-badge" style="background:#f3f4f6; color:#6b7280; border-color:#e5e7eb;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <span>Payment: <strong>N/A</strong></span>
          </div>
        </div>
      `;
    }

    // Additional Payment Badge — only for jersey-interested members
    let addlPaymentBadgeHTML = "";
    if (isJerseyInterested) {
      const addlPayStatus = member.additionalPaymentStatus || "Unpaid";
      let addlBadgeClass = "addl-payment-badge--unpaid";
      let addlBadgeLabel = "Unpaid";
      let addlBadgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

      if (addlPayStatus === "Paid") {
        addlBadgeClass = "addl-payment-badge--paid";
        addlBadgeLabel = "Paid";
        addlBadgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else if (addlPayStatus === "Partial") {
        addlBadgeClass = "addl-payment-badge--partial";
        addlBadgeLabel = "Partially Paid";
        addlBadgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      } else if (addlPayStatus === "Waived") {
        addlBadgeClass = "addl-payment-badge--waived";
        addlBadgeLabel = "Waived";
        addlBadgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/></svg>`;
      }

      addlPaymentBadgeHTML = `
        <div class="addl-payment-badge-wrapper">
          <div class="addl-payment-pill-badge ${addlBadgeClass}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;opacity:0.7;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>Add. Payment: <strong>${addlBadgeLabel}</strong></span>
            ${addlBadgeIcon}
          </div>
        </div>
      `;
    }

    // Determine card action layout based on active Tab
    let actionsHTML = "";
    const showMarkPaidBtn    = isJerseyInterested && (member.paymentStatus !== "Done" && member.paymentStatus !== "Paid");
    const showMarkAddlPaidBtn = isJerseyInterested && (member.additionalPaymentStatus || "Unpaid") !== "Paid";
    
    let markPaidBtnHTML = "";
    if (showMarkPaidBtn) {
      markPaidBtnHTML = `
        <button type="button" class="btn-mark-paid" data-id="${member.id}" aria-label="Mark as paid for ${member.fullName}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Mark Paid
        </button>
      `;
    }

    let markAddlPaidBtnHTML = "";
    if (showMarkAddlPaidBtn) {
      markAddlPaidBtnHTML = `
        <button type="button" class="btn-mark-addl-paid" data-id="${member.id}" aria-label="Mark additional payment as paid for ${member.fullName}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><polyline points="6 15 9 18 14 13"/>
          </svg>
          Addl. Paid
        </button>
      `;
    }

    if (activeTab === "pending") {
      actionsHTML = `
        <div class="approval-actions-wrapper">
          ${markPaidBtnHTML}
          ${markAddlPaidBtnHTML}
          <button type="button" class="btn-approve" data-id="${member.id}" aria-label="Approve registration for ${member.fullName}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Approve
          </button>
          <button type="button" class="btn-edit" data-id="${member.id}" aria-label="Edit registration for ${member.fullName}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button type="button" class="btn-delete" data-id="${member.id}" aria-label="Delete registration for ${member.fullName}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Delete
          </button>
        </div>
      `;
    } else {
      // Active tab: Show Edit button and Delete Profile button
      actionsHTML = `
        <div class="approval-actions-wrapper">
          ${markPaidBtnHTML}
          ${markAddlPaidBtnHTML}
          <button type="button" class="btn-edit" data-id="${member.id}" aria-label="Edit active member profile for ${member.fullName}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button type="button" class="btn-delete-profile" data-id="${member.id}" aria-label="Delete active member profile for ${member.fullName}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Delete Profile
          </button>
        </div>
      `;
    }

    // Card Inner Markup
    card.innerHTML = `
      <div class="member-profile-header">
        <div class="avatar-wrapper">
          ${avatarHTML}
        </div>
        <div class="member-title-area">
          <h2 class="member-name" title="${member.fullName}">${member.fullName}</h2>
          <span class="member-id-badge" style="background: ${activeTab === 'pending' ? 'rgba(255, 100, 100, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${activeTab === 'pending' ? '#ff5722' : '#10b981'};">${member.memberId || "MRRR-FIN"}</span>
        </div>
      </div>

      <div class="member-details">
        <div class="detail-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>City: <strong>${member.city || "Finland"}</strong></span>
        </div>

        <div class="detail-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
          <a href="${emailMailtoUrl}" title="Email ${member.fullName}">${member.email}</a>
        </div>

        <div class="detail-item">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <a href="${phoneCallUrl}" title="Call ${member.fullName}">${member.phone}</a>
        </div>
      </div>

      <div class="jersey-badge-wrapper">
        ${jerseyBadgeHTML}
        ${paymentBadgeHTML}
        ${addlPaymentBadgeHTML}
      </div>

      ${actionsHTML}

      <p class="member-reg-date" title="Registration date">${activeTab === 'pending' ? 'Submitted' : 'Joined'}: ${regDateStr}</p>
    `;

    membersGrid.appendChild(card);
  });

  // Attach action button handlers
  attachActionHandlers();
}

/* ═══════════════════════════════════════════════════════════
   FILTERING AND SORTING ENGINE
   ═══════════════════════════════════════════════════════════ */
function applyFiltersAndSort() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const currentSort = sortControlSelect.value;
  const jerseyFilter = adminJerseyFilterControl ? adminJerseyFilterControl.value : "all";

  const activeList = activeTab === "pending" ? pendingMembers : activeMembers;

  // 1. FILTERING
  let filtered = activeList.filter((member) => {
    const nameMatch  = member.fullName ? member.fullName.toLowerCase().includes(searchTerm) : false;
    const emailMatch = member.email ? member.email.toLowerCase().includes(searchTerm) : false;
    const matchesSearch = nameMatch || emailMatch;

    let matchesJersey = true;
    const isJerseyInterested = member.jersey && member.jersey.interested === true;
    const isPaymentDone = isJerseyInterested &&
      (member.paymentStatus === "Done" || member.paymentStatus === "Paid");
    const isAddlPaid = isJerseyInterested && member.additionalPaymentStatus === "Paid";

    if (jerseyFilter === "ordered") {
      matchesJersey = isJerseyInterested;
    } else if (jerseyFilter === "payment_done") {
      matchesJersey = isPaymentDone;
    } else if (jerseyFilter === "payment_pending") {
      matchesJersey = isJerseyInterested && !isPaymentDone;
    } else if (jerseyFilter === "none") {
      matchesJersey = !isJerseyInterested;
    } else if (jerseyFilter === "addl_paid") {
      matchesJersey = isAddlPaid;
    } else if (jerseyFilter === "addl_unpaid") {
      matchesJersey = isJerseyInterested && !isAddlPaid;
    }

    return matchesSearch && matchesJersey;
  });

  // 2. SORTING
  filtered.sort((a, b) => {
    if (currentSort === "newest" || currentSort === "oldest") {
      const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return currentSort === "newest" ? timeB - timeA : timeA - timeB;
    }

    if (currentSort === "nameAsc" || currentSort === "nameDesc") {
      const nameA = a.fullName ? a.fullName.toLowerCase() : "";
      const nameB = b.fullName ? b.fullName.toLowerCase() : "";
      const comp = nameA.localeCompare(nameB);
      return currentSort === "nameAsc" ? comp : -comp;
    }
    return 0;
  });

  // 3. RENDER
  renderAdminGrid(filtered);
}

// Live typing search triggers
if (searchInput) {
  searchInput.addEventListener("input", applyFiltersAndSort);
}
if (sortControlSelect) {
  sortControlSelect.addEventListener("change", applyFiltersAndSort);
}
if (adminJerseyFilterControl) {
  adminJerseyFilterControl.addEventListener("change", applyFiltersAndSort);
}

/* ═══════════════════════════════════════════════════════════
   BUTTON ACTION HANDLERS (APPROVE, EDIT, DELETE REQUEST & PROFILE)
   ═══════════════════════════════════════════════════════════ */
function attachActionHandlers() {
  const approveBtns = membersGrid.querySelectorAll(".btn-approve");
  const editBtns    = membersGrid.querySelectorAll(".btn-edit");
  const deleteBtns  = membersGrid.querySelectorAll(".btn-delete");
  const deleteProfileBtns = membersGrid.querySelectorAll(".btn-delete-profile");
  const markPaidBtns = membersGrid.querySelectorAll(".btn-mark-paid");
  const markAddlPaidBtns = membersGrid.querySelectorAll(".btn-mark-addl-paid");

  // Mark Additional Paid Quick Button
  markAddlPaidBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.getAttribute("data-id");
      const member = pendingMembers.find(m => m.id === memberId) || activeMembers.find(m => m.id === memberId);
      if (!member) return;

      btn.disabled = true;
      try {
        showToast(`Marking additional payment as Paid for ${member.fullName}…`, "info");

        const docRef = doc(db, "members", memberId);
        await updateDoc(docRef, { additionalPaymentStatus: "Paid" });

        showToast(`${member.fullName}'s additional payment marked as Paid! ✅`, "success");
        await fetchAdminData(false);

      } catch (err) {
        console.error("Failed to mark additional paid:", err);
        showToast(`Failed to update additional payment: ${err.message}`, "error");
        btn.disabled = false;
      }
    });
  });

  // Mark Paid Manual Trigger
  markPaidBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.getAttribute("data-id");
      const targetCard = document.getElementById(`card-${memberId}`);
      const member = pendingMembers.find(m => m.id === memberId) || activeMembers.find(m => m.id === memberId);
      if (!member) return;

      btn.disabled = true;
      try {
        showToast(`Updating payment status for ${member.fullName}…`, "info");
        
        const docRef = doc(db, "members", memberId);
        await updateDoc(docRef, { paymentStatus: "Done" });

        showToast(`${member.fullName}'s jersey marked as Paid! 💰`, "success");
        await fetchAdminData(false);

      } catch (err) {
        console.error("Failed to mark paid:", err);
        showToast(`Failed to update payment: ${err.message}`, "error");
        btn.disabled = false;
      }
    });
  });

  approveBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.getAttribute("data-id");
      const targetCard = document.getElementById(`card-${memberId}`);
      const member = pendingMembers.find(m => m.id === memberId);
      if (!member) return;

      btn.disabled = true;
      const delBtn = targetCard.querySelector(".btn-delete");
      const edBtn = targetCard.querySelector(".btn-edit");
      const mpBtn = targetCard.querySelector(".btn-mark-paid");
      if (delBtn) delBtn.disabled = true;
      if (edBtn) edBtn.disabled = true;
      if (mpBtn) mpBtn.disabled = true;

      try {
        showToast(`Approving ${member.fullName}…`, "info");
        
        const docRef = doc(db, "members", memberId);
        await updateDoc(docRef, { membershipStatus: "Active" });

        showToast(`${member.fullName} approved successfully! 🎉`, "success");

        // Animate card exit
        targetCard.classList.add("removing");
        setTimeout(async () => {
          targetCard.remove();
          await fetchAdminData(false);
        }, 400);

      } catch (err) {
        console.error("Failed to approve member:", err);
        showToast(`Approval failed: ${err.message}`, "error");
        btn.disabled = false;
        if (delBtn) delBtn.disabled = false;
        if (edBtn) edBtn.disabled = false;
        if (mpBtn) mpBtn.disabled = false;
      }
    });
  });

  editBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const memberId = btn.getAttribute("data-id");
      selectedMemberId = memberId;
      selectedMemberData = pendingMembers.find(m => m.id === memberId) || activeMembers.find(m => m.id === memberId);
      
      if (!selectedMemberData) return;

      // Prefill form directly
      prefillEditForm();

      // Show modal instantly
      editModal.style.display = "flex";
      setTimeout(() => {
        editModal.classList.add("is-open");
        editFullNameInput.focus();
      }, 20);
    });
  });

  deleteBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.getAttribute("data-id");
      const targetCard = document.getElementById(`card-${memberId}`);
      const member = pendingMembers.find(m => m.id === memberId);
      if (!member) return;

      const confirmDelete = confirm(`Are you sure you want to permanently delete the registration request for ${member.fullName}?`);
      if (!confirmDelete) return;

      btn.disabled = true;
      const appBtn = targetCard.querySelector(".btn-approve");
      const edBtn = targetCard.querySelector(".btn-edit");
      const mpBtn = targetCard.querySelector(".btn-mark-paid");
      if (appBtn) appBtn.disabled = true;
      if (edBtn) edBtn.disabled = true;
      if (mpBtn) mpBtn.disabled = true;

      try {
        showToast(`Deleting request for ${member.fullName}…`, "info");
        
        const docRef = doc(db, "members", memberId);
        await deleteDoc(docRef);

        showToast(`Registration request for ${member.fullName} deleted.`, "success");

        // Animate card exit
        targetCard.classList.add("removing");
        setTimeout(async () => {
          targetCard.remove();
          await fetchAdminData(false);
        }, 400);

      } catch (err) {
        console.error("Failed to delete request:", err);
        showToast(`Deletion failed: ${err.message}`, "error");
        btn.disabled = false;
        if (appBtn) appBtn.disabled = false;
        if (edBtn) edBtn.disabled = false;
        if (mpBtn) mpBtn.disabled = false;
      }
    });
  });

  deleteProfileBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.getAttribute("data-id");
      const targetCard = document.getElementById(`card-${memberId}`);
      const member = activeMembers.find(m => m.id === memberId);
      if (!member) return;

      const confirmDelete = confirm(`⚠️ WARNING: Are you sure you want to permanently delete the approved profile for ${member.fullName}? This will erase their profile completely and is irreversible!`);
      if (!confirmDelete) return;

      btn.disabled = true;
      const edBtn = targetCard.querySelector(".btn-edit");
      const mpBtn = targetCard.querySelector(".btn-mark-paid");
      if (edBtn) edBtn.disabled = true;
      if (mpBtn) mpBtn.disabled = true;

      try {
        showToast(`Deleting profile for ${member.fullName}…`, "info");
        
        const docRef = doc(db, "members", memberId);
        await deleteDoc(docRef);

        showToast(`Member profile for ${member.fullName} deleted.`, "success");

        // Animate card exit
        targetCard.classList.add("removing");
        setTimeout(async () => {
          targetCard.remove();
          await fetchAdminData(false);
        }, 400);

      } catch (err) {
        console.error("Failed to delete active profile:", err);
        showToast(`Deletion failed: ${err.message}`, "error");
        btn.disabled = false;
        if (edBtn) edBtn.disabled = false;
        if (mpBtn) mpBtn.disabled = false;
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   ADMIN TABS ENGINE
   ═══════════════════════════════════════════════════════════ */
function setupTabs() {
  if (!tabPendingBtn || !tabActiveBtn) return;

  tabPendingBtn.addEventListener("click", () => {
    if (activeTab === "pending") return;
    activeTab = "pending";
    
    tabPendingBtn.classList.add("active");
    tabActiveBtn.classList.remove("active");
    
    searchInput.value = "";
    searchInput.placeholder = "Search pending requests by name or email…";
    if (adminJerseyFilterControl) adminJerseyFilterControl.value = "all";
    
    applyFiltersAndSort();
  });

  tabActiveBtn.addEventListener("click", () => {
    if (activeTab === "active") return;
    activeTab = "active";
    
    tabActiveBtn.classList.add("active");
    tabPendingBtn.classList.remove("active");
    
    searchInput.value = "";
    searchInput.placeholder = "Search active members by name or email…";
    if (adminJerseyFilterControl) adminJerseyFilterControl.value = "all";
    
    applyFiltersAndSort();
  });
}

/* ═══════════════════════════════════════════════════════════
   MODAL DISPLAY, PREFILL & PHOTO UPLOAD LOGIC
   ═══════════════════════════════════════════════════════════ */
function closeModal() {
  editModal.classList.remove("is-open");
  setTimeout(() => {
    editModal.style.display = "none";
    editMemberForm.reset();
    clearPhotoPreview();
    const editExtraCont = document.getElementById("editAdditionalJerseyPanels");
    if (editExtraCont) editExtraCont.innerHTML = "";
    
    selectedMemberId   = null;
    selectedMemberData = null;
    
    // Clear validation error highlights
    editModal.querySelectorAll(".field-group").forEach((g) => {
      g.classList.remove("has-error", "is-valid");
      const errEl = g.querySelector(".field-error");
      if (errEl) errEl.textContent = "";
    });
  }, 200);
}

// Modal Close Listeners
[btnCancelEdit1, btnCancelEdit2].forEach(btn => {
  btn.addEventListener("click", closeModal);
});
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeModal();
});

function prefillEditForm() {
  const m = selectedMemberData;
  
  editFullNameInput.value = m.fullName || "";
  editCityInput.value     = m.city || "";
  editPhoneInput.value    = m.phone || "";
  editEmailInput.value    = m.email || "";

  editPhotoState = {
    file: null,
    removedOld: false,
    currentUrl: m.profilePhoto
  };

  if (m.profilePhoto) {
    editPhotoPreviewImg.src              = m.profilePhoto;
    editPhotoPreviewWrapper.style.display = "flex";
    editPhotoPlaceholder.style.display    = "none";
  } else {
    clearPhotoPreview();
  }

  const jerseyInterested = m.jersey && m.jersey.interested === true;
  
  if (jerseyInterested) {
    document.getElementById("editJerseyInterestYes").checked = true;
    editJerseyDetailsPanel.classList.add("is-open");
    editJerseyDetailsPanel.setAttribute("aria-hidden", "false");
    
    if (m.jersey.type === "player") document.getElementById("editJerseyTypePlayer").checked = true;
    else if (m.jersey.type === "fan") document.getElementById("editJerseyTypeFan").checked = true;

    /* Pre-select jersey style; fall back to type-based default for legacy records */
    if (m.jersey.style === "button_collar") {
      document.getElementById("editJerseyStyleButtonCollar").checked = true;
    } else if (m.jersey.style === "plain_neck") {
      document.getElementById("editJerseyStylePlainNeck").checked = true;
    } else if (m.jersey.type === "player") {
      document.getElementById("editJerseyStyleButtonCollar").checked = true;
    } else if (m.jersey.type === "fan") {
      document.getElementById("editJerseyStylePlainNeck").checked = true;
    }

    if (m.jersey.sleeve === "full") document.getElementById("editJerseySleeveFull").checked = true;
    else if (m.jersey.sleeve === "half") document.getElementById("editJerseySleeveHalf").checked = true;

    editJerseySizeSelect.value   = m.jersey.size || "";
    editJerseyNumberInput.value  = m.jersey.number || "";
    editJerseyNameInput.value    = m.jersey.name || "";
    const prefillQty = m.jersey.quantity || 1;
    if (editJerseyQuantityInput) editJerseyQuantityInput.value = prefillQty;
    /* Render saved extra panels */
    if (prefillQty > 1) renderEditAdditionalJerseyPanels(prefillQty, m.jersey.extras || []);
    else { const c = document.getElementById("editAdditionalJerseyPanels"); if (c) c.innerHTML = ""; }
    
    if (editPaymentStatusSelect) {
      editPaymentStatusSelect.value = m.paymentStatus || "No";
    }
    if (editAdditionalPaymentStatusSelect) {
      editAdditionalPaymentStatusSelect.value = m.additionalPaymentStatus || "Unpaid";
    }
  } else {
    document.getElementById("editJerseyInterestNo").checked = true;
    editJerseyDetailsPanel.classList.remove("is-open");
    editJerseyDetailsPanel.setAttribute("aria-hidden", "true");
    
    document.querySelectorAll('input[name="editJerseyType"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="editJerseySleeve"]').forEach(r => r.checked = false);
    
    editJerseySizeSelect.value   = "";
    editJerseyNumberInput.value  = "";
    editJerseyNameInput.value    = "";
    if (editJerseyQuantityInput) editJerseyQuantityInput.value = "1";
    const editExtraCont = document.getElementById("editAdditionalJerseyPanels");
    if (editExtraCont) editExtraCont.innerHTML = "";
    
    if (editPaymentStatusSelect) {
      editPaymentStatusSelect.value = m.paymentStatus || "N/A";
    }
    if (editAdditionalPaymentStatusSelect) {
      editAdditionalPaymentStatusSelect.value = m.additionalPaymentStatus || "Unpaid";
    }
  }
}

/* Jersey preference change listener */
document.querySelectorAll('input[name="editJerseyInterest"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const wantsJersey = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";

    if (wantsJersey) {
      editJerseyDetailsPanel.classList.add("is-open");
      editJerseyDetailsPanel.setAttribute("aria-hidden", "false");
      if (editPaymentStatusSelect && editPaymentStatusSelect.value === "N/A") {
        editPaymentStatusSelect.value = "No";
      }
    } else {
      editJerseyDetailsPanel.classList.remove("is-open");
      editJerseyDetailsPanel.setAttribute("aria-hidden", "true");
      document.querySelectorAll('input[name="editJerseyType"]').forEach(r => r.checked = false);
      document.querySelectorAll('input[name="editJerseyStyle"]').forEach(r => r.checked = false);
      document.querySelectorAll('input[name="editJerseySleeve"]').forEach(r => r.checked = false);
      editJerseySizeSelect.value   = "";
      editJerseyNumberInput.value  = "";
      editJerseyNameInput.value    = "";
      if (editJerseyQuantityInput) editJerseyQuantityInput.value = "1";
      if (editPaymentStatusSelect) {
        editPaymentStatusSelect.value = "N/A";
      }
    }
  });
});

/* Photo Dropzone Previews & Handlers */
function showPhotoPreview(file) {
  const reader  = new FileReader();
  reader.onload = (e) => {
    editPhotoPreviewImg.src               = e.target.result;
    editPhotoPreviewWrapper.style.display = "flex";
    editPhotoPlaceholder.style.display    = "none";
  };
  reader.readAsDataURL(file);
}

// Function collision safeguard
function clearPhotoPreview() {
  editProfilePhotoInput.value           = "";
  editPhotoPreviewImg.src               = "";
  editPhotoPreviewWrapper.style.display = "none";
  editPhotoPlaceholder.style.display    = "flex";
}

editProfilePhotoInput.addEventListener("change", () => {
  const file = editProfilePhotoInput.files[0];
  const photoGroup = editPhotoDropzone.closest(".field-group");
  const photoError = document.getElementById("editPhotoError");

  if (!file) {
    if (!editPhotoState.currentUrl) clearPhotoPreview();
    return;
  }

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    photoError.textContent = "Unsupported file type. Use PNG, JPG, or WEBP.";
    photoGroup?.classList.add("has-error");
    clearPhotoPreview();
    return;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    photoError.textContent = `Photo must be under ${MAX_PHOTO_SIZE_MB} MB.`;
    photoGroup?.classList.add("has-error");
    clearPhotoPreview();
    return;
  }

  photoError.textContent = "";
  photoGroup?.classList.remove("has-error");
  
  editPhotoState.file = file;
  editPhotoState.removedOld = true;
  showPhotoPreview(file);
});

editPhotoRemoveBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearPhotoPreview();
  editPhotoState.file = null;
  editPhotoState.removedOld = true;
  editPhotoState.currentUrl = null;
});

editPhotoDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  editPhotoDropzone.classList.add("drag-over");
});
editPhotoDropzone.addEventListener("dragleave", () => editPhotoDropzone.classList.remove("drag-over"));
editPhotoDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  editPhotoDropzone.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  editProfilePhotoInput.files = dt.files;
  editProfilePhotoInput.dispatchEvent(new Event("change"));
});
editPhotoDropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    editProfilePhotoInput.click();
  }
});

/* Form Validations */
function setFieldError(fieldGroup, errorEl, message) {
  fieldGroup.classList.add("has-error");
  fieldGroup.classList.remove("is-valid");
  if (errorEl) errorEl.textContent = message;
}

function setFieldValid(fieldGroup, errorEl) {
  fieldGroup.classList.remove("has-error");
  fieldGroup.classList.add("is-valid");
  if (errorEl) errorEl.textContent = "";
}

function validateEditForm() {
  let isValid = true;

  const nameGroup = editFullNameInput.closest(".field-group");
  const nameError = document.getElementById("editFullNameError");
  const nameVal   = editFullNameInput.value.trim();
  if (!nameVal) {
    setFieldError(nameGroup, nameError, "Full name is required.");
    isValid = false;
  } else if (nameVal.length < 2) {
    setFieldError(nameGroup, nameError, "Name must be at least 2 characters.");
    isValid = false;
  } else {
    setFieldValid(nameGroup, nameError);
  }

  const cityGroup = editCityInput.closest(".field-group");
  const cityError = document.getElementById("editCityError");
  if (!editCityInput.value.trim()) {
    setFieldError(cityGroup, cityError, "City is required.");
    isValid = false;
  } else {
    setFieldValid(cityGroup, cityError);
  }

  const phoneGroup = editPhoneInput.closest(".field-group");
  const phoneError = document.getElementById("editPhoneError");
  const rawPhone   = editPhoneInput.value.trim();
  if (!rawPhone) {
    setFieldError(phoneGroup, phoneError, "Phone is required.");
    isValid = false;
  } else if (!PHONE_REGEX.test(rawPhone)) {
    setFieldError(phoneGroup, phoneError, "Enter a valid phone (e.g. +358 40 1234567).");
    isValid = false;
  } else {
    setFieldValid(phoneGroup, phoneError);
  }

  const emailGroup = editEmailInput.closest(".field-group");
  const emailError = document.getElementById("editEmailError");
  const rawEmail   = editEmailInput.value.trim();
  if (!rawEmail) {
    setFieldError(emailGroup, emailError, "Email is required.");
    isValid = false;
  } else if (!EMAIL_REGEX.test(rawEmail)) {
    setFieldError(emailGroup, emailError, "Enter a valid email address.");
    isValid = false;
  } else {
    setFieldValid(emailGroup, emailError);
  }

  const editJerseyInterested = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";
  if (editJerseyInterested) {
    const typeGroup = document.getElementById("fieldEditJerseyType");
    const typeError = document.getElementById("editJerseyTypeError");
    if (!document.querySelector('input[name="editJerseyType"]:checked')) {
      setFieldError(typeGroup, typeError, "Select a jersey type.");
      isValid = false;
    } else {
      setFieldValid(typeGroup, typeError);
    }

    const styleGroup = document.getElementById("fieldEditJerseyStyle");
    const styleError = document.getElementById("editJerseyStyleError");
    if (!document.querySelector('input[name="editJerseyStyle"]:checked')) {
      setFieldError(styleGroup, styleError, "Select a jersey style.");
      isValid = false;
    } else {
      setFieldValid(styleGroup, styleError);
    }

    const sleeveGroup = document.getElementById("fieldEditJerseySleeve");
    const sleeveError = document.getElementById("editJerseySleeveError");
    if (!document.querySelector('input[name="editJerseySleeve"]:checked')) {
      setFieldError(sleeveGroup, sleeveError, "Select a sleeve type.");
      isValid = false;
    } else {
      setFieldValid(sleeveGroup, sleeveError);
    }

    const sizeGroup = editJerseySizeSelect.closest(".field-group");
    const sizeError = document.getElementById("editJerseySizeError");
    if (!editJerseySizeSelect.value) {
      setFieldError(sizeGroup, sizeError, "Select your jersey size.");
      isValid = false;
    } else {
      setFieldValid(sizeGroup, sizeError);
    }

    const numGroup = editJerseyNumberInput.closest(".field-group");
    const numError = document.getElementById("editJerseyNumberError");
    const numVal   = parseInt(editJerseyNumberInput.value, 10);
    if (!editJerseyNumberInput.value) {
      setFieldError(numGroup, numError, "Number is required.");
      isValid = false;
    } else if (isNaN(numVal) || numVal < 1 || numVal > 99) {
      setFieldError(numGroup, numError, "Number must be 1 to 99.");
      isValid = false;
    } else {
      setFieldValid(numGroup, numError);
    }

    const nameGroup = editJerseyNameInput.closest(".field-group");
    const nameError = document.getElementById("editJerseyNameError");
    if (!editJerseyNameInput.value.trim()) {
      setFieldError(nameGroup, nameError, "Name on jersey is required.");
      isValid = false;
    } else {
      setFieldValid(nameGroup, nameError);
    }

    const qtyGroup = document.getElementById("fieldEditJerseyQuantity");
    const qtyError = document.getElementById("editJerseyQuantityError");
    if (qtyGroup && editJerseyQuantityInput) {
      const qtyVal = parseInt(editJerseyQuantityInput.value, 10);
      if (!editJerseyQuantityInput.value || isNaN(qtyVal) || qtyVal < 1 || qtyVal > 10) {
        setFieldError(qtyGroup, qtyError, "Enter a quantity between 1 and 10.");
        isValid = false;
      } else {
        setFieldValid(qtyGroup, qtyError);
      }
    }
  }

  return isValid;
}

function uploadProfilePhoto(file, memberId) {
  return new Promise((resolve, reject) => {
    const ext     = file.name.split(".").pop().toLowerCase() || "jpg";
    const path    = `profile-photos/${memberId}/photo_${Date.now()}.${ext}`;
    const fileRef = storageRef(storage, path);
    const task    = uploadBytesResumable(fileRef, file, { contentType: file.type });

    task.on(
      "state_changed",
      null,
      (err) => reject(err),
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

function setSaveLoading(isSaving) {
  btnSaveChanges.disabled         = isSaving;
  saveBtnLabel.style.display     = isSaving ? "none" : "block";
  saveBtnSpinner.style.display   = isSaving ? "flex" : "none";
}

/* Save Admin Changes Trigger */
btnSaveChanges.addEventListener("click", async () => {
  const wantsJersey    = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";
  const adminJerseyQty = wantsJersey ? (parseInt(editJerseyQuantityInput?.value, 10) || 1) : 0;

  if (!validateEditForm() || (wantsJersey && !validateEditExtraPanels(adminJerseyQty))) {
    showToast("Please correct the validation errors.", "error");
    return;
  }

  setSaveLoading(true);

  try {
    const memberDocRef = doc(db, "members", selectedMemberId);

    let photoURL = selectedMemberData.profilePhoto;
    
    if (editPhotoState.removedOld) {
      if (editPhotoState.file) {
        showToast("Uploading new profile photo…", "info");
        photoURL = await uploadProfilePhoto(editPhotoState.file, selectedMemberData.memberId);
      } else {
        photoURL = null;
      }
    }

    const adminQty    = wantsJersey ? adminJerseyQty : null;
    const adminExtras  = wantsJersey && adminJerseyQty > 1 ? collectEditExtraPanelsData(adminJerseyQty) : [];

    const updatedData = {
      fullName:     editFullNameInput.value.trim(),
      city:         editCityInput.value.trim(),
      phone:        editPhoneInput.value.trim(),
      email:        editEmailInput.value.trim().toLowerCase(),
      profilePhoto: photoURL,
      paymentStatus: wantsJersey ? (editPaymentStatusSelect ? editPaymentStatusSelect.value : "No") : "N/A",
      additionalPaymentStatus: editAdditionalPaymentStatusSelect ? editAdditionalPaymentStatusSelect.value : "Unpaid",
      jersey: {
        interested: wantsJersey,
        type:       wantsJersey ? (document.querySelector('input[name="editJerseyType"]:checked')?.value || null) : null,
        style:      wantsJersey ? (document.querySelector('input[name="editJerseyStyle"]:checked')?.value || null) : null,
        sleeve:     wantsJersey ? (document.querySelector('input[name="editJerseySleeve"]:checked')?.value || null) : null,
        size:       wantsJersey ? editJerseySizeSelect.value   : null,
        number:     wantsJersey ? parseInt(editJerseyNumberInput.value, 10) : null,
        name:       wantsJersey ? editJerseyNameInput.value.trim().toUpperCase() : null,
        quantity:   adminQty,
        extras:     adminExtras
      }
    };

    showToast("Saving changes in database…", "info");
    await updateDoc(memberDocRef, updatedData);

    showToast("Member updated successfully! 🎉", "success", 4000);
    closeModal();
    
    // Reload administration database silently
    await fetchAdminData(false);

  } catch (err) {
    console.error("Save profile updates failed:", err);
    showToast(`Save failed: ${err.message || "Unknown error."}`, "error", 6000);
  } finally {
    setSaveLoading(false);
  }
});

/* ═══════════════════════════════════════════════════════════
   PAGE GATE (SECURITY OVERLAY) LOGIC
   ═══════════════════════════════════════════════════════════ */
function checkGateAuthorization() {
  const isAuthorized = sessionStorage.getItem("mrr_admin_authorized") === "true";
  
  if (isAuthorized) {
    if (pageGate) pageGate.style.display = "none";
    if (dashboardWrapper) dashboardWrapper.style.display = "flex";
    fetchAdminData(true);
  } else {
    if (pageGate) pageGate.style.display = "flex";
    if (dashboardWrapper) dashboardWrapper.style.display = "none";
    if (gatePinCodeInput) setTimeout(() => gatePinCodeInput.focus(), 100);
    setupGateListeners();
  }
}

function handleGateSubmit() {
  if (!gatePinCodeInput || !gateErrorText) return;
  const enteredCode = gatePinCodeInput.value.trim();
  const fieldGroup = gatePinCodeInput.closest(".field-group");
  
  if (!enteredCode) {
    gateErrorText.textContent = "Please enter the password.";
    fieldGroup?.classList.add("has-error");
    gatePinCodeInput.focus();
    return;
  }
  
  if (enteredCode === "mrrfinland1216") {
    sessionStorage.setItem("mrr_admin_authorized", "true");
    if (pageGate) pageGate.classList.add("fade-out");
    if (dashboardWrapper) dashboardWrapper.style.display = "flex";
    fetchAdminData(true);
    
    setTimeout(() => {
      if (pageGate) pageGate.style.display = "none";
    }, 400);
  } else {
    gateErrorText.textContent = "Access denied. Incorrect security code.";
    fieldGroup?.classList.add("has-error");
    gatePinCodeInput.focus();
    gatePinCodeInput.select();
  }
}

function setupGateListeners() {
  if (btnGateSubmit) {
    btnGateSubmit.addEventListener("click", handleGateSubmit);
  }
  
  if (gatePinCodeInput) {
    gatePinCodeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleGateSubmit();
      }
    });
    
    gatePinCodeInput.addEventListener("input", () => {
      gateErrorText.textContent = "";
      const fieldGroup = gatePinCodeInput.closest(".field-group");
      fieldGroup?.classList.remove("has-error");
    });
  }
}

/* ═══════════════════════════════════════════════════════════
   JERSEY ORDER SHEET — BEAUTIFUL EXCEL DOWNLOAD
   ═══════════════════════════════════════════════════════════ */

/**
 * Generates a properly formatted SpreadsheetML (.xls) Excel file.
 * Uses the Excel 2003 XML (SpreadsheetML) format which Excel recognises
 * natively — no "file format mismatch" warning.
 *
 * Columns: SN | Full Name | Bottom wear | Jersey Style |
 *          Sleeve | Size | No. | Name on Jersey
 */
function downloadJerseySummaryExcel() {
  const jerseyMembers = activeMembers.filter(
    m => m.jersey && m.jersey.interested === true &&
         (m.paymentStatus === "Done" || m.paymentStatus === "Paid")
  );

  if (jerseyMembers.length === 0) {
    showToast("No active members with paid jersey orders found.", "error");
    return;
  }

  const now      = new Date();
  const fileDate = now.toISOString().slice(0, 10);

  // ── Flatten: 1 row per jersey (primary + extras) ─────────
  const flatJerseyList = [];
  jerseyMembers.forEach((m) => {
    flatJerseyList.push({ member: m, jerseyData: m.jersey });
    if (m.jersey.extras && Array.isArray(m.jersey.extras)) {
      m.jersey.extras.forEach(extra => {
        flatJerseyList.push({ member: m, jerseyData: extra });
      });
    }
  });

  // ── Helper: escape XML special characters ────────────────
  function esc(v) {
    if (v == null) return "—";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ── Helper: build a styled Cell element ──────────────────
  function cell(value, styleId) {
    const type = typeof value === "number" ? "Number" : "String";
    const safeVal = type === "Number" ? value : esc(value);
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${safeVal}</Data></Cell>`;
  }

  // ── Build data rows ───────────────────────────────────────
  const memberJerseyIndex = {};
  const dataRows = flatJerseyList.map((item, i) => {
    const { member, jerseyData } = item;
    memberJerseyIndex[member.id] = (memberJerseyIndex[member.id] || 0) + 1;
    const isExtraRow = memberJerseyIndex[member.id] > 1;
    const isPlayer   = jerseyData.type === "player";

    const bottomWear   = isPlayer ? "Shorts + Track" : "Shorts";
    const jerseyStyle  = jerseyData.style === "button_collar" ? "Button Collar"
                       : jerseyData.style === "plain_neck"    ? "Plain Neck"
                       : isPlayer ? "Button Collar" : "Plain Neck";
    const sleeve       = jerseyData.sleeve === "full" ? "Full Sleeve"
                       : jerseyData.sleeve === "half" ? "Half Sleeve" : "—";
    const jerseyName   = (jerseyData.name && jerseyData.name.trim())
                       ? jerseyData.name.trim().toUpperCase()
                       : (member.fullName ? member.fullName.trim().split(/\s+/)[0].toUpperCase() : "—");

    const rowStyleSuffix = i % 2 === 0 ? "Even" : "Odd";
    const bwStyle        = isPlayer ? "TrackYes" : "TrackNo";
    const extraStyle     = isExtraRow ? "Extra" : "";

    return `
    <Row ss:Height="24">
      ${cell(i + 1,                             "SeqNum")}
      ${cell(member.fullName || "—",            `FullName${rowStyleSuffix}${extraStyle}`)}
      ${cell(bottomWear,                         bwStyle)}
      ${cell(jerseyStyle,                        `Style${rowStyleSuffix}`)}
      ${cell(sleeve,                             `Sleeve${rowStyleSuffix}`)}
      ${cell(jerseyData.size || "—",            "SizeCell")}
      ${cell(jerseyData.number || "—",          "NumCell")}
      ${cell(jerseyName,                         `JerseyName${rowStyleSuffix}`)}
    </Row>`;
  }).join("\n");

  // ── Full SpreadsheetML document ───────────────────────────
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">

  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>MRR Team Finland — Jersey Order Sheet</Title>
    <Created>${now.toISOString()}</Created>
  </DocumentProperties>

  <Styles>
    <!-- Title banner -->
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="0"/>
      <Font ss:FontName="Segoe UI" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#8A0505" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#5A0000"/>
      </Borders>
    </Style>

    <!-- Column headers -->
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#8A0505" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#5A0000"/>
        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5A0000"/>
        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5A0000"/>
        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5A0000"/>
      </Borders>
    </Style>
    <Style ss:ID="HeaderLeft">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#8A0505" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#5A0000"/>
        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5A0000"/>
        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5A0000"/>
        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5A0000"/>
      </Borders>
    </Style>

    <!-- Row data base borders -->
    <Style ss:ID="Base">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="10"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
      </Borders>
    </Style>

    <!-- Sequence number -->
    <Style ss:ID="SeqNum">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#B91C1C"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
        <Border ss:Position="Right"  ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
        <Border ss:Position="Left"   ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
        <Border ss:Position="Top"    ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/>
      </Borders>
    </Style>

    <!-- Full Name — even / odd -->
    <Style ss:ID="FullNameEven">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="FullNameOdd">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#FDE8E8" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="FullNameEvenExtra">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#C00B0B"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="FullNameOddExtra">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#FDE8E8" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#C00B0B"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>

    <!-- Bottom wear: Track=yes (player) — green -->
    <Style ss:ID="TrackYes">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#065F46"/>
      <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <!-- Bottom wear: Track=no (fan) — amber -->
    <Style ss:ID="TrackNo">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#92400E"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>

    <!-- Jersey Style — even / odd -->
    <Style ss:ID="StyleEven">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#6D28D9"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="StyleOdd">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#6D28D9"/>
      <Interior ss:Color="#FDE8E8" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>

    <!-- Sleeve — even / odd -->
    <Style ss:ID="SleeveEven">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F766E"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="SleeveOdd">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#0F766E"/>
      <Interior ss:Color="#FDE8E8" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>

    <!-- Size & Number cells — blue tint -->
    <Style ss:ID="SizeCell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="12" ss:Bold="1" ss:Color="#1E40AF"/>
      <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="NumCell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="12" ss:Bold="1" ss:Color="#1E40AF"/>
      <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>

    <!-- Name on Jersey — even / odd -->
    <Style ss:ID="JerseyNameEven">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="12" ss:Bold="1" ss:Color="#9F1239"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
    <Style ss:ID="JerseyNameOdd">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Segoe UI" ss:Size="12" ss:Bold="1" ss:Color="#9F1239"/>
      <Interior ss:Color="#FDE8E8" ss:Pattern="Solid"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E0B4B4"/></Borders>
    </Style>
  </Styles>

  <Worksheet ss:Name="Jersey Orders">
    <Table ss:DefaultRowHeight="20">
      <!-- Column widths -->
      <Column ss:Width="36"/>
      <Column ss:Width="160"/>
      <Column ss:Width="110"/>
      <Column ss:Width="120"/>
      <Column ss:Width="100"/>
      <Column ss:Width="54"/>
      <Column ss:Width="54"/>
      <Column ss:Width="140"/>

      <!-- Title row -->
      <Row ss:Height="36">
        <Cell ss:MergeAcross="7" ss:StyleID="Title">
          <Data ss:Type="String">MRR TEAM FINLAND — Jersey Order Sheet</Data>
        </Cell>
      </Row>

      <!-- Spacer -->
      <Row ss:Height="6"/>

      <!-- Header row -->
      <Row ss:Height="28">
        <Cell ss:StyleID="Header"><Data ss:Type="String">SN</Data></Cell>
        <Cell ss:StyleID="HeaderLeft"><Data ss:Type="String">Full Name</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Bottom wear</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Jersey Style</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Sleeve</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Size</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">No.</Data></Cell>
        <Cell ss:StyleID="HeaderLeft"><Data ss:Type="String">Name on Jersey</Data></Cell>
      </Row>

      <!-- Data rows -->
      ${dataRows}

    </Table>

    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>3</SplitHorizontal>
      <TopRowBottomPane>3</TopRowBottomPane>
      <ActivePane>2</ActivePane>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

  /* ── Trigger download ───────────────────────────────────── */
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=UTF-8"
  });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `MRR_Jersey_Order_Sheet_${fileDate}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Jersey order sheet downloaded — ${flatJerseyList.length} jersey(s) total. ✅`, "success");
}

/* Wire up download button */
const btnDownloadSummaryExcel = document.getElementById("btnDownloadSummaryExcel");
if (btnDownloadSummaryExcel) {
  btnDownloadSummaryExcel.addEventListener("click", downloadJerseySummaryExcel);
}

/* ═══════════════════════════════════════════════════════════
   INITIAL LOAD
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  checkGateAuthorization();
});



