/**
 * ============================================================
 *  MRRR Team Finland Boys Group — Member Database Viewer Script
 *  Firebase v9 Modular SDK | Search, Sorting & Authorized Edit Modal
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
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

/* ── Firebase Configuration (same as index.js) ──────────── */
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
let allMembers         = []; // Master array loaded from Firestore
let selectedMemberId   = null;
let selectedMemberData = null;

// Constants for Validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{7,20}$/;
const MAX_PHOTO_SIZE_MB   = 5;
const MAX_PHOTO_BYTES     = MAX_PHOTO_SIZE_MB * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* ── DOM References ───────────────────────────────────────── */
const membersGrid         = document.getElementById("membersGrid");
const loadingState        = document.getElementById("loadingState");
const noResultsState      = document.getElementById("noResultsState");

const countTotalText      = document.getElementById("countTotal");
const countJerseyText     = document.getElementById("countJersey");

const searchInput         = document.getElementById("searchInput");
const sortControlSelect   = document.getElementById("sortControl");
const jerseyFilterControl = document.getElementById("jerseyFilterControl");

const toast               = document.getElementById("toast");

/* Page Gate Elements */
const pageGate            = document.getElementById("pageGate");
const dashboardWrapper    = document.getElementById("dashboardWrapper");
const gatePasswordInput   = document.getElementById("gatePassword");
const gateErrorText       = document.getElementById("gateError");
const btnGateSubmit       = document.getElementById("btnGateSubmit");

/* Modal Elements */
const editModal           = document.getElementById("editModal");
const phaseVerify         = document.getElementById("phaseVerify");
const phaseEdit           = document.getElementById("phaseEdit");
const verifyMemberName    = document.getElementById("verifyMemberName");
const verifyPasswordInput = document.getElementById("verifyPassword");
const verifyPasswordError = document.getElementById("verifyPasswordError");

const btnSubmitVerify     = document.getElementById("btnSubmitVerify");
const btnCancelVerify1    = document.getElementById("btnCancelVerify1");
const btnCancelVerify2    = document.getElementById("btnCancelVerify2");

/* Modal Edit Form Elements */
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

const btnSaveChanges          = document.getElementById("btnSaveChanges");
const saveBtnLabel            = document.getElementById("saveBtnLabel");
const saveBtnSpinner          = document.getElementById("saveBtnSpinner");

const btnCancelEdit1          = document.getElementById("btnCancelEdit1");
const btnCancelEdit2          = document.getElementById("btnCancelEdit2");

/* Helper to track photo deletion/changes in edit state */
let editPhotoState = {
  file: null,          // Holds new selected file if any
  removedOld: false,   // True if they deleted their existing picture
  currentUrl: null     // Store existing URL if present
};

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
   DATA RETRIEVAL
   ═══════════════════════════════════════════════════════════ */
async function fetchMembers(showSuccessToast = true) {
  try {
    const q = query(collection(db, "members"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    allMembers = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Only show approved members (status is Active or not specified)
      if (data.membershipStatus === "Active" || !data.membershipStatus) {
        allMembers.push({
          id: docSnap.id,
          ...data
        });
      }
    });

    // Populate dashboard statistics counters
    const total = allMembers.length;
    const jerseyInterested = allMembers.filter(
      m => m.jersey && m.jersey.interested === true
    ).length;

    animateCounter(countTotalText, total);
    animateCounter(countJerseyText, jerseyInterested);

    // Hide loader
    loadingState.style.display = "none";

    // Initial render
    applyFiltersAndSort();
    
    if (showSuccessToast) {
      showToast(`Loaded ${allMembers.length} members successfully.`, "success");
    }

  } catch (err) {
    console.error("Error fetching database members:", err);
    loadingState.innerHTML = `
      <div style="color: var(--clr-error); font-weight: 700; font-size: 16px;">
        ⚠️ Failed to fetch members
      </div>
      <p class="loading-text">${err.message || "Please check your network connection."}</p>
    `;
    showToast("Error loading members list.", "error");
  }
}

/* ═══════════════════════════════════════════════════════════
   MEMBER CARD RENDERING
   ═══════════════════════════════════════════════════════════ */
function renderMembers(membersList) {
  // Remove existing member cards (keep loaders and empty states hidden)
  const existingCards = membersGrid.querySelectorAll(".member-card");
  existingCards.forEach(card => card.remove());

  if (membersList.length === 0) {
    noResultsState.style.display = "flex";
    return;
  }
  
  noResultsState.style.display = "none";

  membersList.forEach((member) => {
    const card = document.createElement("div");
    card.className = "member-card";

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

    // Jersey Badge HTML
    let jerseyBadgeHTML = "";
    if (member.jersey && member.jersey.interested === true) {
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--yes">
          <span>Jersey Ordered</span>
        </div>
      `;
    } else {
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--no">
          <span>No Jersey Interest</span>
        </div>
      `;
    }

    // Card Inner Markup (Notice the raw password reveal elements have been completely removed!)
    card.innerHTML = `
      <div class="member-profile-header">
        <div class="avatar-wrapper">
          ${avatarHTML}
        </div>
        <div class="member-title-area">
          <h2 class="member-name" title="${member.fullName}">${member.fullName}</h2>
          <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
            <span class="member-id-badge" style="margin-top: 0;">${member.memberId || "MRRR-FIN"}</span>
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9999px; background: rgba(16, 185, 129, 0.1); color: #10b981; font-size: 11.5px; font-weight: 600; border: 1px solid rgba(16, 185, 129, 0.2);">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Active
            </span>
          </div>
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
      </div>

      <div class="update-btn-wrapper">
        <button type="button" class="update-btn" data-id="${member.id}" aria-label="Update Information for ${member.fullName}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Update Information
        </button>
      </div>

      <p class="member-reg-date" title="Registration date">Joined: ${regDateStr}</p>
    `;

    membersGrid.appendChild(card);
  });

  // Attach click handlers to "Update Information" buttons
  attachUpdateClickHandlers();
}

/* ═══════════════════════════════════════════════════════════
   FILTERING AND SORTING ENGINE
   ═══════════════════════════════════════════════════════════ */
function applyFiltersAndSort() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const currentSort = sortControlSelect.value;
  const jerseyFilter = jerseyFilterControl ? jerseyFilterControl.value : "all";

  // 1. FILTERING
  let filtered = allMembers.filter((member) => {
    const nameMatch  = member.fullName ? member.fullName.toLowerCase().includes(searchTerm) : false;
    const emailMatch = member.email ? member.email.toLowerCase().includes(searchTerm) : false;
    const matchesSearch = nameMatch || emailMatch;
    
    let matchesJersey = true;
    const isJerseyInterested = member.jersey && member.jersey.interested === true;
    
    if (jerseyFilter === "ordered") {
      matchesJersey = isJerseyInterested;
    } else if (jerseyFilter === "none") {
      matchesJersey = !isJerseyInterested;
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
  renderMembers(filtered);
}

// Trigger real-time search filtering on typing and sort selection changes
if (searchInput) {
  searchInput.addEventListener("input", applyFiltersAndSort);
}
if (sortControlSelect) {
  sortControlSelect.addEventListener("change", applyFiltersAndSort);
}
if (jerseyFilterControl) {
  jerseyFilterControl.addEventListener("change", applyFiltersAndSort);
}

/* ═══════════════════════════════════════════════════════════
   MODAL DISPLAY & TRANSITION LOGIC
   ═══════════════════════════════════════════════════════════ */
function closeModal() {
  editModal.classList.remove("is-open");
  setTimeout(() => {
    editModal.style.display = "none";
    // Reset Verification phase
    verifyPasswordInput.value = "";
    verifyPasswordError.textContent = "";
    document.getElementById("fieldVerifyPassword")?.classList.remove("has-error");

    // Reset Form phase
    editMemberForm.reset();
    clearPhotoPreview();
    
    selectedMemberId   = null;
    selectedMemberData = null;
    
    // Clear validation error highlights
    phaseEdit.querySelectorAll(".field-group").forEach((g) => {
      g.classList.remove("has-error", "is-valid");
      const errEl = g.querySelector(".field-error");
      if (errEl) errEl.textContent = "";
    });
  }, 200);
}

function attachUpdateClickHandlers() {
  const updateBtns = membersGrid.querySelectorAll(".update-btn");
  
  updateBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const memberId = btn.getAttribute("data-id");
      selectedMemberId = memberId;
      selectedMemberData = allMembers.find(m => m.id === memberId);
      
      if (!selectedMemberData) return;

      // Prefill names for verify challenge
      verifyMemberName.textContent = selectedMemberData.fullName;
      verifyPasswordInput.value = "";
      verifyPasswordError.textContent = "";

      // Show modal & Verification phase
      editModal.style.display = "flex";
      // Force repaint then add open class for smooth opacity transition
      setTimeout(() => {
        editModal.classList.add("is-open");
        phaseVerify.style.display = "block";
        phaseEdit.style.display = "none";
        verifyPasswordInput.focus();
      }, 20);
    });
  });
}

// Close listeners
[btnCancelVerify1, btnCancelVerify2, btnCancelEdit1, btnCancelEdit2].forEach(btn => {
  btn.addEventListener("click", closeModal);
});

// Close when clicking outside modal card
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) {
    closeModal();
  }
});

/* ═══════════════════════════════════════════════════════════
   PHASE 1: PASSKEY CHALLENGE
   ═══════════════════════════════════════════════════════════ */
btnSubmitVerify.addEventListener("click", () => {
  const inputPw = verifyPasswordInput.value;
  const targetGroup = verifyPasswordInput.closest(".field-group");
  
  if (!inputPw) {
    verifyPasswordError.textContent = "Please enter your passkey.";
    targetGroup?.classList.add("has-error");
    return;
  }

  // Compare challenge password (secure check in memory)
  if (inputPw === selectedMemberData.password) {
    // Correct! Transition to Phase 2 Form Editor
    phaseVerify.style.display = "none";
    phaseEdit.style.display = "block";
    prefillEditForm();
  } else {
    // Incorrect password
    verifyPasswordError.textContent = "Incorrect passkey. Please try again.";
    targetGroup?.classList.add("has-error");
    verifyPasswordInput.focus();
  }
});

verifyPasswordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    btnSubmitVerify.click();
  }
});

verifyPasswordInput.addEventListener("input", () => {
  verifyPasswordError.textContent = "";
  verifyPasswordInput.closest(".field-group")?.classList.remove("has-error");
});

/* ═══════════════════════════════════════════════════════════
   PHASE 2: EDIT PROFILE PREFILL & TOGGLES
   ═══════════════════════════════════════════════════════════ */
function prefillEditForm() {
  const m = selectedMemberData;
  
  // 1. Prefill basic fields
  editFullNameInput.value = m.fullName || "";
  editCityInput.value     = m.city || "";
  editPhoneInput.value    = m.phone || "";
  editEmailInput.value    = m.email || "";

  // 2. Prefill photo state
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

  // 3. Prefill jersey preference
  const jerseyInterested = m.jersey && m.jersey.interested === true;
  
  if (jerseyInterested) {
    document.getElementById("editJerseyInterestYes").checked = true;
    editJerseyDetailsPanel.classList.add("is-open");
    editJerseyDetailsPanel.setAttribute("aria-hidden", "false");
    editJerseySizeSelect.value   = m.jersey.size || "";
    editJerseyNumberInput.value  = m.jersey.number || "";
  } else {
    document.getElementById("editJerseyInterestNo").checked = true;
    editJerseyDetailsPanel.classList.remove("is-open");
    editJerseyDetailsPanel.setAttribute("aria-hidden", "true");
    editJerseySizeSelect.value   = "";
    editJerseyNumberInput.value  = "";
  }
}

/* Jersey preference change listener (Yes/No toggle) */
document.querySelectorAll('input[name="editJerseyInterest"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const wantsJersey = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";

    if (wantsJersey) {
      editJerseyDetailsPanel.classList.add("is-open");
      editJerseyDetailsPanel.setAttribute("aria-hidden", "false");
    } else {
      editJerseyDetailsPanel.classList.remove("is-open");
      editJerseyDetailsPanel.setAttribute("aria-hidden", "true");
      editJerseySizeSelect.value  = "";
      editJerseyNumberInput.value = "";
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   PHOTO EDITING PREVIEWS & DRAG/DROP
   ═══════════════════════════════════════════════════════════ */
function showPhotoPreview(file) {
  const reader  = new FileReader();
  reader.onload = (e) => {
    editPhotoPreviewImg.src               = e.target.result;
    editPhotoPreviewWrapper.style.display = "flex";
    editPhotoPlaceholder.style.display    = "none";
  };
  reader.readAsDataURL(file);
}

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
  editPhotoState.removedOld = true; // Mark old URL to be overwritten
  showPhotoPreview(file);
});

// Remove Photo Button click
editPhotoRemoveBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearPhotoPreview();
  editPhotoState.file = null;
  editPhotoState.removedOld = true;
  editPhotoState.currentUrl = null;
});

// Drag & drop
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

// Keyboard support
editPhotoDropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    editProfilePhotoInput.click();
  }
});

/* ═══════════════════════════════════════════════════════════
   FORM VALIDATION HELPERS
   ═══════════════════════════════════════════════════════════ */
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

  /* Name */
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

  /* City */
  const cityGroup = editCityInput.closest(".field-group");
  const cityError = document.getElementById("editCityError");
  if (!editCityInput.value.trim()) {
    setFieldError(cityGroup, cityError, "City is required.");
    isValid = false;
  } else {
    setFieldValid(cityGroup, cityError);
  }

  /* Phone */
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

  /* Email */
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

  /* Jersey sub-fields (only required when "yes") */
  const editJerseyInterested = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";
  if (editJerseyInterested) {
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
  }

  return isValid;
}

/* ═══════════════════════════════════════════════════════════
   FIREBASE STORAGE UPLOAD (IMAGE SAVE)
   ═══════════════════════════════════════════════════════════ */
function uploadProfilePhoto(file, memberId) {
  return new Promise((resolve, reject) => {
    const ext     = file.name.split(".").pop().toLowerCase() || "jpg";
    const path    = `profile-photos/${memberId}/photo_${Date.now()}.${ext}`; // timestamped to avoid cache
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

/* ═══════════════════════════════════════════════════════════
   SUBMIT BUTTON STATE
   ═══════════════════════════════════════════════════════════ */
function setSaveLoading(isSaving) {
  btnSaveChanges.disabled         = isSaving;
  saveBtnLabel.style.display     = isSaving ? "none" : "block";
  saveBtnSpinner.style.display   = isSaving ? "flex" : "none";
}

/* ═══════════════════════════════════════════════════════════
   SAVE CHANGES (SUBMIT TRIGGER)
   ═══════════════════════════════════════════════════════════ */
btnSaveChanges.addEventListener("click", async () => {
  // 1. Validate form fields
  if (!validateEditForm()) {
    showToast("Please correct the validation errors.", "error");
    return;
  }

  setSaveLoading(true);

  try {
    const memberDocRef = doc(db, "members", selectedMemberId);

    // 2. Upload photo if a new one was picked
    let photoURL = selectedMemberData.profilePhoto; // Default to existing
    
    if (editPhotoState.removedOld) {
      if (editPhotoState.file) {
        showToast("Uploading new profile photo…", "info");
        photoURL = await uploadProfilePhoto(editPhotoState.file, selectedMemberData.memberId);
      } else {
        photoURL = null; // Removed and not replaced
      }
    }

    // 3. Collect updated data
    const wantsJersey = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";
    
    const updatedData = {
      fullName:     editFullNameInput.value.trim(),
      city:         editCityInput.value.trim(),
      phone:        editPhoneInput.value.trim(),
      email:        editEmailInput.value.trim().toLowerCase(),
      profilePhoto: photoURL,
      jersey: {
        interested: wantsJersey,
        size:       wantsJersey ? editJerseySizeSelect.value   : null,
        number:     wantsJersey ? parseInt(editJerseyNumberInput.value, 10) : null
      }
    };

    // 4. Update Document in Firestore
    showToast("Saving changes in database…", "info");
    await updateDoc(memberDocRef, updatedData);

    // 5. Success transitions
    showToast("Member updated successfully! 🎉", "success", 4000);
    closeModal();
    
    // 6. Reload members silently (without heavy page refresh)
    await fetchMembers(false);

  } catch (err) {
    console.error("Save profile updates failed:", err);
    showToast(`Save failed: ${err.message || "Unknown error."}`, "error", 6000);
  } finally {
    setSaveLoading(false);
  }
});

/* ═══════════════════════════════════════════════════════════
   INITIAL LOAD
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  fetchMembers(false);
});
