/**
 * ============================================================
 *  MRRR Team Finland Boys Group — Administration Console Script
 *  Firebase v9 Modular SDK | Secured by Prastika@1216 passcode
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
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

/* ── State variables ──────────────────────────────────────── */
let pendingMembers = []; // Pending requests
let activeMembers  = [];  // Approved member profiles
let activeTab      = "pending"; // Current administrative view ("pending" | "active")

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
const gatePasswordInput = document.getElementById("gatePassword");
const gateErrorText     = document.getElementById("gateError");
const btnGateSubmit     = document.getElementById("btnGateSubmit");

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

    // Populate dashboard statistics counters
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

    // Jersey Badge HTML
    let jerseyBadgeHTML = "";
    if (member.jersey && member.jersey.interested === true) {
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--yes">
          <span>Jersey size <strong>${member.jersey.size || "N/A"}</strong></span>
          <span>&nbsp;&#8231;&nbsp; No. <strong>${member.jersey.number || "—"}</strong></span>
        </div>
      `;
    } else {
      jerseyBadgeHTML = `
        <div class="jersey-pill-badge jersey-pill-badge--no">
          <span>No Jersey Interest</span>
        </div>
      `;
    }

    // Determine card action layout based on active Tab
    let actionsHTML = "";
    if (activeTab === "pending") {
      actionsHTML = `
        <div class="approval-actions-wrapper">
          <button type="button" class="btn-approve" data-id="${member.id}" aria-label="Approve registration for ${member.fullName}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Approve
          </button>
          <button type="button" class="btn-delete" data-id="${member.id}" aria-label="Delete registration for ${member.fullName}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Delete
          </button>
        </div>
      `;
    } else {
      // Active tab: Show Delete Profile button
      actionsHTML = `
        <div class="approval-actions-wrapper">
          <button type="button" class="btn-delete-profile" data-id="${member.id}" aria-label="Delete active member profile for ${member.fullName}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
      </div>

      ${actionsHTML}

      <p class="member-reg-date" title="Registration date">${activeTab === 'pending' ? 'Submitted' : 'Joined'}: ${regDateStr}</p>
    `;

    membersGrid.appendChild(card);
  });

  // Attach active action button click handlers
  attachActionHandlers();
}

/* ═══════════════════════════════════════════════════════════
   FILTERING AND SORTING ENGINE
   ═══════════════════════════════════════════════════════════ */
function applyFiltersAndSort() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const currentSort = sortControlSelect.value;

  // Decide which list to use based on tab
  const activeList = activeTab === "pending" ? pendingMembers : activeMembers;

  // 1. FILTERING (Search Term only!)
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
   BUTTON ACTION HANDLERS (APPROVE, DELETE REQUEST & DELETE PROFILE)
   ═══════════════════════════════════════════════════════════ */
function attachActionHandlers() {
  // Pending actions
  const approveBtns = membersGrid.querySelectorAll(".btn-approve");
  const deleteBtns  = membersGrid.querySelectorAll(".btn-delete");
  
  // Active deletion actions
  const deleteProfileBtns = membersGrid.querySelectorAll(".btn-delete-profile");

  approveBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.getAttribute("data-id");
      const targetCard = document.getElementById(`card-${memberId}`);
      const member = pendingMembers.find(m => m.id === memberId);
      if (!member) return;

      btn.disabled = true;
      const delBtn = targetCard.querySelector(".btn-delete");
      if (delBtn) delBtn.disabled = true;

      try {
        showToast(`Approving ${member.fullName}…`, "info");
        
        // Update Firestore membershipStatus to "Active"
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
      }
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
      if (appBtn) appBtn.disabled = true;

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
    if (gatePasswordInput) setTimeout(() => gatePasswordInput.focus(), 100);
    setupGateListeners();
  }
}

function handleGateSubmit() {
  if (!gatePasswordInput || !gateErrorText) return;
  const enteredCode = gatePasswordInput.value.trim();
  const fieldGroup = gatePasswordInput.closest(".field-group");
  
  if (!enteredCode) {
    gateErrorText.textContent = "Please enter the password.";
    fieldGroup?.classList.add("has-error");
    gatePasswordInput.focus();
    return;
  }
  
  // Custom admin passcode requirement: Prastika@1216
  if (enteredCode === "Prastika@1216") {
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
    gatePasswordInput.focus();
    gatePasswordInput.select();
  }
}

function setupGateListeners() {
  if (btnGateSubmit) {
    btnGateSubmit.addEventListener("click", handleGateSubmit);
  }
  
  if (gatePasswordInput) {
    gatePasswordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleGateSubmit();
      }
    });
    
    gatePasswordInput.addEventListener("input", () => {
      gateErrorText.textContent = "";
      const fieldGroup = gatePasswordInput.closest(".field-group");
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
