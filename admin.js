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

const searchInput       = document.getElementById("searchInput");
const sortControlSelect = document.getElementById("sortControl");

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
const editPaymentStatusSelect  = document.getElementById("editPaymentStatus");

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
      const jType = member.jersey.type === "player" ? "Player" : (member.jersey.type === "fan" ? "Fan" : "Jersey");
      const jSleeve = member.jersey.sleeve === "full" ? "Full-slv" : (member.jersey.sleeve === "half" ? "Half-slv" : "");
      
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--yes">
          <span><strong>${jType}</strong> ${jSleeve ? '('+jSleeve+')' : ''}</span>
          <span>&nbsp;&#8231;&nbsp; Size <strong>${member.jersey.size || "N/A"}</strong></span>
          <span>&nbsp;&#8231;&nbsp; No. <strong>${member.jersey.number || "—"}</strong></span>
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

    // Determine card action layout based on active Tab
    let actionsHTML = "";
    const showMarkPaidBtn = isJerseyInterested && (member.paymentStatus !== "Done" && member.paymentStatus !== "Paid");
    
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

    if (activeTab === "pending") {
      actionsHTML = `
        <div class="approval-actions-wrapper">
          ${markPaidBtnHTML}
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

  const activeList = activeTab === "pending" ? pendingMembers : activeMembers;

  // 1. FILTERING
  let filtered = activeList.filter((member) => {
    const nameMatch  = member.fullName ? member.fullName.toLowerCase().includes(searchTerm) : false;
    const emailMatch = member.email ? member.email.toLowerCase().includes(searchTerm) : false;
    return nameMatch || emailMatch;
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

/* ═══════════════════════════════════════════════════════════
   BUTTON ACTION HANDLERS (APPROVE, EDIT, DELETE REQUEST & PROFILE)
   ═══════════════════════════════════════════════════════════ */
function attachActionHandlers() {
  const approveBtns = membersGrid.querySelectorAll(".btn-approve");
  const editBtns    = membersGrid.querySelectorAll(".btn-edit");
  const deleteBtns  = membersGrid.querySelectorAll(".btn-delete");
  const deleteProfileBtns = membersGrid.querySelectorAll(".btn-delete-profile");
  const markPaidBtns = membersGrid.querySelectorAll(".btn-mark-paid");

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
    
    applyFiltersAndSort();
  });

  tabActiveBtn.addEventListener("click", () => {
    if (activeTab === "active") return;
    activeTab = "active";
    
    tabActiveBtn.classList.add("active");
    tabPendingBtn.classList.remove("active");
    
    searchInput.value = "";
    searchInput.placeholder = "Search active members by name or email…";
    
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

    if (m.jersey.sleeve === "full") document.getElementById("editJerseySleeveFull").checked = true;
    else if (m.jersey.sleeve === "half") document.getElementById("editJerseySleeveHalf").checked = true;

    editJerseySizeSelect.value   = m.jersey.size || "";
    editJerseyNumberInput.value  = m.jersey.number || "";
    
    if (editPaymentStatusSelect) {
      editPaymentStatusSelect.value = m.paymentStatus || "No";
    }
  } else {
    document.getElementById("editJerseyInterestNo").checked = true;
    editJerseyDetailsPanel.classList.remove("is-open");
    editJerseyDetailsPanel.setAttribute("aria-hidden", "true");
    
    document.querySelectorAll('input[name="editJerseyType"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="editJerseySleeve"]').forEach(r => r.checked = false);
    
    editJerseySizeSelect.value   = "";
    editJerseyNumberInput.value  = "";
    
    if (editPaymentStatusSelect) {
      editPaymentStatusSelect.value = m.paymentStatus || "N/A";
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
      document.querySelectorAll('input[name="editJerseySleeve"]').forEach(r => r.checked = false);
      editJerseySizeSelect.value  = "";
      editJerseyNumberInput.value = "";
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
  if (!validateEditForm()) {
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

    const wantsJersey = document.querySelector('input[name="editJerseyInterest"]:checked')?.value === "yes";
    
    const updatedData = {
      fullName:     editFullNameInput.value.trim(),
      city:         editCityInput.value.trim(),
      phone:        editPhoneInput.value.trim(),
      email:        editEmailInput.value.trim().toLowerCase(),
      profilePhoto: photoURL,
      paymentStatus: wantsJersey ? (editPaymentStatusSelect ? editPaymentStatusSelect.value : "No") : "N/A",
      jersey: {
        interested: wantsJersey,
        type:       wantsJersey ? (document.querySelector('input[name="editJerseyType"]:checked')?.value || null) : null,
        sleeve:     wantsJersey ? (document.querySelector('input[name="editJerseySleeve"]:checked')?.value || null) : null,
        size:       wantsJersey ? editJerseySizeSelect.value   : null,
        number:     wantsJersey ? parseInt(editJerseyNumberInput.value, 10) : null
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
   INITIAL LOAD
   ═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  checkGateAuthorization();
});
