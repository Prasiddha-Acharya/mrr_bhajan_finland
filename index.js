/**
 * ============================================================
 *  MRR Team Finland Boys Group — Member Registration Script
 *  Firebase v9 Modular SDK | Red Theme | Jersey Support
 * ============================================================
 */

/* ── Firebase SDK Imports ─────────────────────────────────── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";


/* ── Firebase Configuration ───────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyB4wZzceKofQAiVeQMbrkTZBZLXcB9Z5OI",
  authDomain: "mrr-bhajan-finland.firebaseapp.com",
  projectId: "mrr-bhajan-finland",
  storageBucket: "mrr-bhajan-finland.firebasestorage.app",
  messagingSenderId: "913989931388",
  appId: "1:913989931388:web:c9be6b50f662ffe65394f9"
};

/* Initialize Firebase services */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);


/* ── Constants ────────────────────────────────────────────── */
const MEMBERS_COLLECTION = "members";
const MEMBER_ID_PREFIX = "MRR-FIN-";
const MAX_PHOTO_SIZE_MB = 5;
const MAX_PHOTO_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s\-().]{7,20}$/;


/* ═══════════════════════════════════════════════════════════
   PIN HASHING UTILITY
   ═══════════════════════════════════════════════════════════ */
async function hashPin(pin) {
  if (!pin) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── DOM References ───────────────────────────────────────── */
const formCard = document.getElementById("formCard");
const successCard = document.getElementById("successCard");
const registrationForm = document.getElementById("registrationForm");

const fullNameInput = document.getElementById("fullName");
const cityInput = document.getElementById("city");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const pinCodeInput = document.getElementById("pinCode");
const confirmPinCodeInput = document.getElementById("confirmPinCode");
const profilePhotoInput = document.getElementById("profilePhoto");
const photoDropzone = document.getElementById("photoDropzone");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const photoPreviewWrapper = document.getElementById("photoPreviewWrapper");
const photoPreviewImg = document.getElementById("photoPreview");
const photoRemoveBtn = document.getElementById("photoRemoveBtn");

/* Jersey fields */
const jerseyDetailsPanel = document.getElementById("jerseyDetailsPanel");
const jerseyPriceInfo = document.getElementById("jerseyPriceInfo");
const jerseySizeSelect = document.getElementById("jerseySize");
const jerseyNumberInput = document.getElementById("jerseyNumber");
const paymentGatewayPanel = document.getElementById("paymentGatewayPanel");
const mobilePayBtn = document.getElementById("mobilePayBtn");

/* Login Modal */
const openLoginModalBtn = document.getElementById("openLoginModalBtn");
const loginModal = document.getElementById("loginModal");
const closeLoginModalBtn = document.getElementById("closeLoginModalBtn");
const loginEmailInput = document.getElementById("loginEmail");
const modalPinCodeInput = document.getElementById("loginPin");
const toggleLoginPinBtn = document.getElementById("toggleLoginPin");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const loginSubmitBtnLabel = document.getElementById("loginSubmitBtnLabel");
const loginSubmitBtnSpinner = document.getElementById("loginSubmitBtnSpinner");
const loginEmailError = document.getElementById("loginEmailError");
const modalPinCodeError = document.getElementById("loginPinError");

/* Edit Mode State */
let currentEditMemberId = null;
let currentEditMemberData = null;

/** Helper: get the checked jersey type radio value ("player"|"fan"|null) */
function getJerseyTypeValue() {
  const checked = document.querySelector('input[name="jerseyType"]:checked');
  return checked ? checked.value : null;
}

/** Helper: get the checked jersey sleeve radio value ("half"|"full"|null) */
function getJerseySleeveValue() {
  const checked = document.querySelector('input[name="jerseySleeve"]:checked');
  return checked ? checked.value : null;
}

/* Jersey pricing info content per type */
const JERSEY_PRICE_DATA = {
  player: {
    price: "€20",
    label: "Player Jersey",
    desc: "Includes Jersey, Shorts &amp; Track"
  },
  fan: {
    price: "€15",
    label: "Fan Jersey",
    desc: "Includes Jersey Set (Jersey &amp; Shorts)"
  }
};

/** Shows the pricing info box for the selected jersey type */
function updateJerseyPriceInfo() {
  const type = getJerseyTypeValue();
  if (!type || !JERSEY_PRICE_DATA[type]) {
    jerseyPriceInfo.style.display = "none";
    jerseyPriceInfo.innerHTML = "";
    if (paymentGatewayPanel) paymentGatewayPanel.style.display = "none";
    return;
  }
  const d = JERSEY_PRICE_DATA[type];
  jerseyPriceInfo.innerHTML = `
    <span class="jersey-price-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display: block;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    </span>
    <span class="jersey-price-text">
      You need to pay <strong>${d.price}</strong> for ${d.label}.
      <br><span class="jersey-price-includes">${d.desc}</span>
    </span>
  `;
  jerseyPriceInfo.style.display = "flex";
  if (paymentGatewayPanel) paymentGatewayPanel.style.display = "flex";
}

document.querySelectorAll('input[name="jerseyType"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    updateJerseyPriceInfo();
    /* Clear any type validation error as soon as user picks something */
    const typeGroup = document.getElementById("fieldJerseyType");
    const typeError = document.getElementById("jerseyTypeError");
    if (getJerseyTypeValue()) setFieldValid(typeGroup, typeError);
  });
});

document.querySelectorAll('input[name="jerseySleeve"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const sleeveGroup = document.getElementById("fieldJerseySleeve");
    const sleeveError = document.getElementById("jerseySleeveError");
    if (getJerseySleeveValue()) setFieldValid(sleeveGroup, sleeveError);
  });
});

/** Helper: get the currently checked jersey interest radio value ("yes"|"no"|null) */
function getJerseyInterestValue() {
  const checked = document.querySelector('input[name="jerseyInterest"]:checked');
  return checked ? checked.value : null;
}

/* Submit */
const submitBtn = document.getElementById("submitBtn");
const submitBtnLabel = document.getElementById("submitBtnLabel");
const submitBtnSpinner = document.getElementById("submitBtnSpinner");

/* Success card */
const successMemberId = document.getElementById("successMemberId");
const successName = document.getElementById("successName");
const successJerseyRow = document.getElementById("successJerseyRow");
const successJerseyInfo = document.getElementById("successJerseyInfo");
const registerAnotherBtn = document.getElementById("registerAnotherBtn");

/* Toast */
const toast = document.getElementById("toast");


/* ═══════════════════════════════════════════════════════════
   TOAST UTILITY
   ═══════════════════════════════════════════════════════════ */
let toastTimer = null;

/**
 * Shows a toast notification.
 * @param {string} message  - Text to display.
 * @param {'success'|'error'|'info'} type - Visual variant.
 * @param {number} duration - Auto-dismiss after ms.
 */
function showToast(message, type = "info", duration = 4000) {
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;
  toastTimer = setTimeout(() => toast.classList.remove("toast--visible"), duration);
}

let mobilePayClicked = false;

if (mobilePayBtn) {
  mobilePayBtn.addEventListener("click", () => {
    mobilePayClicked = true;
    showToast("MobilePay launched! Please return here to complete your registration after payment.", "success");
  });
}


/* ═══════════════════════════════════════════════════════════
   JERSEY INTEREST — TOGGLE PANEL (radio buttons)
   ═══════════════════════════════════════════════════════════ */

/**
 * Listens to changes on both radio buttons and shows/hides the
 * jersey details panel with a CSS-driven animation.
 */
document.querySelectorAll('input[name="jerseyInterest"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const wantsJersey = getJerseyInterestValue() === "yes";

    if (wantsJersey) {
      jerseyDetailsPanel.classList.add("is-open");
      jerseyDetailsPanel.setAttribute("aria-hidden", "false");
      jerseySizeSelect.required = true;
      jerseyNumberInput.required = true;
    } else {
      jerseyDetailsPanel.classList.remove("is-open");
      jerseyDetailsPanel.setAttribute("aria-hidden", "true");
      jerseySizeSelect.required = false;
      jerseyNumberInput.required = false;
      jerseySizeSelect.value = "";
      jerseyNumberInput.value = "";
      jerseyPriceInfo.style.display = "none";
      jerseyPriceInfo.innerHTML = "";
      if (paymentGatewayPanel) paymentGatewayPanel.style.display = "none";
      /* Uncheck all jersey type radio buttons */
      document.querySelectorAll('input[name="jerseyType"]').forEach(r => r.checked = false);
      clearFieldError(document.getElementById("fieldJerseyType"), document.getElementById("jerseyTypeError"));
      clearFieldError(document.getElementById("fieldJerseySize"), document.getElementById("jerseySizeError"));
      clearFieldError(document.getElementById("fieldJerseyNumber"), document.getElementById("jerseyNumberError"));
    }
  });
});


/* ═══════════════════════════════════════════════════════════
   FIELD VALIDATION HELPERS
   ═══════════════════════════════════════════════════════════ */

function setFieldError(fieldGroup, errorEl, message) {
  fieldGroup.classList.add("has-error");
  fieldGroup.classList.remove("is-valid");
  errorEl.textContent = message;
}

function clearFieldError(fieldGroup, errorEl) {
  fieldGroup.classList.remove("has-error");
  errorEl.textContent = "";
}

function setFieldValid(fieldGroup, errorEl) {
  clearFieldError(fieldGroup, errorEl);
  fieldGroup.classList.add("is-valid");
}


/* ═══════════════════════════════════════════════════════════
   FULL FORM VALIDATION
   ═══════════════════════════════════════════════════════════ */

/**
 * Validates all visible/required fields.
 * @returns {boolean} True if all fields pass.
 */
function validateForm() {
  let isValid = true;

  /* ── Full Name ── */
  const nameGroup = document.getElementById("fieldFullName");
  const nameError = document.getElementById("fullNameError");
  const nameVal = fullNameInput.value.trim();
  if (!nameVal) {
    setFieldError(nameGroup, nameError, "Full name is required.");
    isValid = false;
  } else if (nameVal.length < 2) {
    setFieldError(nameGroup, nameError, "Name must be at least 2 characters.");
    isValid = false;
  } else {
    setFieldValid(nameGroup, nameError);
  }

  /* ── City ── */
  const cityGroup = document.getElementById("fieldCity");
  const cityError = document.getElementById("cityError");
  if (!cityInput.value.trim()) {
    setFieldError(cityGroup, cityError, "City of residence is required.");
    isValid = false;
  } else {
    setFieldValid(cityGroup, cityError);
  }

  /* ── Phone ── */
  const phoneGroup = document.getElementById("fieldPhone");
  const phoneError = document.getElementById("phoneError");
  const rawPhone = phoneInput.value.trim();
  if (!rawPhone) {
    setFieldError(phoneGroup, phoneError, "Phone number is required.");
    isValid = false;
  } else if (!PHONE_REGEX.test(rawPhone)) {
    setFieldError(phoneGroup, phoneError, "Enter a valid phone number (e.g. +358 40 1234567).");
    isValid = false;
  } else {
    setFieldValid(phoneGroup, phoneError);
  }

  /* ── Email ── */
  const emailGroup = document.getElementById("fieldEmail");
  const emailError = document.getElementById("emailError");
  const rawEmail = emailInput.value.trim();
  if (!rawEmail) {
    setFieldError(emailGroup, emailError, "Email address is required.");
    isValid = false;
  } else if (!EMAIL_REGEX.test(rawEmail)) {
    setFieldError(emailGroup, emailError, "Enter a valid email address.");
    isValid = false;
  } else {
    setFieldValid(emailGroup, emailError);
  }

  /* ── 4-Digit PIN ── */
  const pinGroup = document.getElementById("fieldPinCode");
  const pinError = document.getElementById("pinCodeError");
  const pinVal = pinCodeInput.value;
  if (!pinVal) {
    setFieldError(pinGroup, pinError, "PIN is required.");
    isValid = false;
  } else if (!/^[0-9]{4}$/.test(pinVal)) {
    setFieldError(pinGroup, pinError, "PIN must be exactly 4 numeric digits.");
    isValid = false;
  } else {
    setFieldValid(pinGroup, pinError);
  }

  /* ── Confirm PIN ── */
  const cpinGroup = document.getElementById("fieldConfirmPinCode");
  const cpinError = document.getElementById("confirmPinCodeError");
  const cpinVal = confirmPinCodeInput.value;
  if (!cpinVal) {
    setFieldError(cpinGroup, cpinError, "Please confirm your PIN.");
    isValid = false;
  } else if (cpinVal !== pinVal) {
    setFieldError(cpinGroup, cpinError, "PINs do not match.");
    isValid = false;
  } else {
    setFieldValid(cpinGroup, cpinError);
  }

  /* ── Photo (optional — size check only) ── */
  const photoGroup = document.getElementById("fieldPhoto");
  const photoError = document.getElementById("photoError");
  const photoFile = profilePhotoInput.files[0];
  if (photoFile) {
    if (!ALLOWED_PHOTO_TYPES.includes(photoFile.type)) {
      setFieldError(photoGroup, photoError, "Unsupported file type. Use PNG, JPG, or WEBP.");
      isValid = false;
    } else if (photoFile.size > MAX_PHOTO_BYTES) {
      setFieldError(photoGroup, photoError, `Photo must be under ${MAX_PHOTO_SIZE_MB} MB.`);
      isValid = false;
    } else {
      clearFieldError(photoGroup, photoError);
    }
  } else {
    clearFieldError(photoGroup, photoError);
  }

  /* ── Jersey Interest (must pick one) ── */
  const jiGroup = document.getElementById("fieldJerseyInterest");
  const jiError = document.getElementById("jerseyInterestError");
  if (!getJerseyInterestValue()) {
    setFieldError(jiGroup, jiError, "Please select whether you are interested in a jersey.");
    isValid = false;
  } else {
    setFieldValid(jiGroup, jiError);
  }

  /* ── Jersey sub-fields (only required when "yes") ── */
  if (getJerseyInterestValue() === "yes") {

    /* Jersey Type */
    const typeGroup = document.getElementById("fieldJerseyType");
    const typeError = document.getElementById("jerseyTypeError");
    if (!getJerseyTypeValue()) {
      setFieldError(typeGroup, typeError, "Please select a jersey type.");
      isValid = false;
    } else {
      setFieldValid(typeGroup, typeError);
    }

    /* Jersey Sleeve */
    const sleeveGroup = document.getElementById("fieldJerseySleeve");
    const sleeveError = document.getElementById("jerseySleeveError");
    if (!getJerseySleeveValue()) {
      setFieldError(sleeveGroup, sleeveError, "Please select a sleeve type.");
      isValid = false;
    } else {
      setFieldValid(sleeveGroup, sleeveError);
    }

    const sizeGroup = document.getElementById("fieldJerseySize");
    const sizeError = document.getElementById("jerseySizeError");
    if (!jerseySizeSelect.value) {
      setFieldError(sizeGroup, sizeError, "Please select your jersey size.");
      isValid = false;
    } else {
      setFieldValid(sizeGroup, sizeError);
    }

    const numGroup = document.getElementById("fieldJerseyNumber");
    const numError = document.getElementById("jerseyNumberError");
    const numVal = parseInt(jerseyNumberInput.value, 10);
    if (!jerseyNumberInput.value) {
      setFieldError(numGroup, numError, "Jersey number is required.");
      isValid = false;
    } else if (isNaN(numVal) || numVal < 1 || numVal > 99) {
      setFieldError(numGroup, numError, "Jersey number must be between 1 and 99.");
      isValid = false;
    } else {
      setFieldValid(numGroup, numError);
    }
  }

  return isValid;
}


/* ═══════════════════════════════════════════════════════════
   REAL-TIME LIVE VALIDATION (blur + input)
   ═══════════════════════════════════════════════════════════ */

function attachLiveValidation(inputEl, fieldGroupId, errorId, validator) {
  const group = document.getElementById(fieldGroupId);
  const error = document.getElementById(errorId);

  inputEl.addEventListener("blur", () => {
    const msg = validator(inputEl.value.trim());
    if (msg) setFieldError(group, error, msg);
    else setFieldValid(group, error);
  });

  inputEl.addEventListener("input", () => {
    if (group.classList.contains("has-error")) {
      const msg = validator(inputEl.value.trim());
      if (!msg) setFieldValid(group, error);
    }
  });
}

attachLiveValidation(fullNameInput, "fieldFullName", "fullNameError", (v) => {
  if (!v) return "Full name is required.";
  if (v.length < 2) return "Name must be at least 2 characters.";
  return null;
});

attachLiveValidation(cityInput, "fieldCity", "cityError", (v) =>
  v ? null : "City of residence is required."
);

attachLiveValidation(phoneInput, "fieldPhone", "phoneError", (v) => {
  if (!v) return "Phone number is required.";
  if (!PHONE_REGEX.test(v)) return "Enter a valid phone number (e.g. +358 40 1234567).";
  return null;
});

attachLiveValidation(emailInput, "fieldEmail", "emailError", (v) => {
  if (!v) return "Email address is required.";
  if (!EMAIL_REGEX.test(v)) return "Enter a valid email address.";
  return null;
});

attachLiveValidation(pinCodeInput, "fieldPinCode", "pinCodeError", (v) => {
  if (!v) return "PIN is required.";
  if (!/^[0-9]{4}$/.test(v)) return "PIN must be exactly 4 numeric digits.";
  return null;
});

confirmPinCodeInput.addEventListener("blur", () => {
  const cpinGroup = document.getElementById("fieldConfirmPinCode");
  const cpinError = document.getElementById("confirmPinCodeError");
  const cpinVal = confirmPinCodeInput.value;
  const pinVal = pinCodeInput.value;
  if (!cpinVal) {
    setFieldError(cpinGroup, cpinError, "Please confirm your PIN.");
  } else if (cpinVal !== pinVal) {
    setFieldError(cpinGroup, cpinError, "PINs do not match.");
  } else {
    setFieldValid(cpinGroup, cpinError);
  }
});

confirmPinCodeInput.addEventListener("input", () => {
  const cpinGroup = document.getElementById("fieldConfirmPinCode");
  const cpinError = document.getElementById("confirmPinCodeError");
  if (cpinGroup.classList.contains("has-error")) {
    if (confirmPinCodeInput.value === pinCodeInput.value) {
      setFieldValid(cpinGroup, cpinError);
    }
  }
});

/* Live validation for jersey number */
jerseyNumberInput.addEventListener("input", () => {
  const numGroup = document.getElementById("fieldJerseyNumber");
  const numError = document.getElementById("jerseyNumberError");
  if (!numGroup.classList.contains("has-error")) return;
  const v = parseInt(jerseyNumberInput.value, 10);
  if (!isNaN(v) && v >= 1 && v <= 99) setFieldValid(numGroup, numError);
});


/* ═══════════════════════════════════════════════════════════
   PHOTO PREVIEW
   ═══════════════════════════════════════════════════════════ */

function showPhotoPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreviewImg.src = e.target.result;
    photoPreviewWrapper.style.display = "flex";
    photoPlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
}

function clearPhotoPreview() {
  profilePhotoInput.value = "";
  photoPreviewImg.src = "";
  photoPreviewWrapper.style.display = "none";
  photoPlaceholder.style.display = "flex";
}

profilePhotoInput.addEventListener("change", () => {
  const file = profilePhotoInput.files[0];
  const photoGroup = document.getElementById("fieldPhoto");
  const photoError = document.getElementById("photoError");

  if (!file) { clearPhotoPreview(); return; }

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    setFieldError(photoGroup, photoError, "Unsupported file type. Use PNG, JPG, or WEBP.");
    clearPhotoPreview();
    return;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    setFieldError(photoGroup, photoError, `Photo must be under ${MAX_PHOTO_SIZE_MB} MB.`);
    clearPhotoPreview();
    return;
  }

  clearFieldError(photoGroup, photoError);
  showPhotoPreview(file);
});

photoRemoveBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearPhotoPreview();
});

/* Drag & drop */
photoDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  photoDropzone.classList.add("drag-over");
});
photoDropzone.addEventListener("dragleave", () => photoDropzone.classList.remove("drag-over"));
photoDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  photoDropzone.classList.remove("drag-over");
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  profilePhotoInput.files = dt.files;
  profilePhotoInput.dispatchEvent(new Event("change"));
});

/* Keyboard */
photoDropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    profilePhotoInput.click();
  }
});


/* ═══════════════════════════════════════════════════════════
   MEMBER ID GENERATOR
   ═══════════════════════════════════════════════════════════ */

/**
 * Queries the "members" collection to determine the next sequential
 * member number formatted as MRR-FIN-XXXX.
 * Falls back to a timestamp-based ID on error.
 *
 * @returns {Promise<string>}
 */
async function generateMemberId() {
  try {
    const q = query(collection(db, MEMBERS_COLLECTION), orderBy("createdAt", "desc"), limit(50));
    const snap = await getDocs(q);

    let maxSeq = 0;
    snap.forEach((doc) => {
      const id = doc.data().memberId || "";
      const match = id.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });

    return `${MEMBER_ID_PREFIX}${String(maxSeq + 1).padStart(4, "0")}`;
  } catch (err) {
    console.error("generateMemberId error:", err);
    return `${MEMBER_ID_PREFIX}${Date.now()}`;
  }
}


/* ═══════════════════════════════════════════════════════════
   PROFILE PHOTO UPLOAD
   ═══════════════════════════════════════════════════════════ */

/**
 * Uploads the profile photo to Firebase Storage.
 * @param {File}   file
 * @param {string} memberId
 * @returns {Promise<string>} Download URL
 */
function uploadProfilePhoto(file, memberId) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase() || "jpg";
    const path = `profile-photos/${memberId}/photo.${ext}`;
    const fileRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(fileRef, file, { contentType: file.type });

    uploadTask.on(
      "state_changed",
      null,
      (err) => reject(err),
      async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
    );
  });
}


/* ═══════════════════════════════════════════════════════════
   SUBMIT BUTTON STATE
   ═══════════════════════════════════════════════════════════ */

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtnLabel.style.display = isLoading ? "none" : "flex";
  submitBtnSpinner.style.display = isLoading ? "flex" : "none";
}


/* ═══════════════════════════════════════════════════════════
   FORM SUBMISSION
   ═══════════════════════════════════════════════════════════ */

registrationForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  /* 1. Validate all fields */
  if (!validateForm()) {
    showToast("Please fix the errors highlighted above.", "error");
    const firstError = registrationForm.querySelector(".field-group.has-error");
    if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  /* 2. Enter loading state */
  setLoading(true);

  try {

    /* 3. Generate unique Member ID or use existing in Edit Mode */
    const memberId = currentEditMemberId ? currentEditMemberData.memberId : await generateMemberId();

    /* 4. Collect core form values */
    const fullName = fullNameInput.value.trim();
    const city = cityInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const pin = await hashPin(pinCodeInput.value);
    const photoFile = profilePhotoInput.files[0] || null;

    /* 5. Collect jersey values */
    const jerseyInterested = getJerseyInterestValue() === "yes";
    const jerseyType = jerseyInterested ? getJerseyTypeValue() : null;
    const jerseySleeve = jerseyInterested ? getJerseySleeveValue() : null;
    const jerseySize = jerseyInterested ? jerseySizeSelect.value : null;
    const jerseyNumber = jerseyInterested ? parseInt(jerseyNumberInput.value, 10) : null;

    /* 6. Upload profile photo (if provided) */
    let profilePhotoURL = null;
    if (photoFile) {
      showToast("Uploading photo…", "info", 30_000);
      profilePhotoURL = await uploadProfilePhoto(photoFile, memberId);
    }

    /* 7. Build Firestore document
         jersey sub-fields stored nested for clean data model */
    const memberData = {
      memberId,
      fullName,
      city,
      phone,
      email,
      pin,                                 // 4-digit PIN for future updates
      profilePhoto: profilePhotoURL || (currentEditMemberId ? currentEditMemberData.profilePhoto : null),   
      membershipStatus: currentEditMemberId ? currentEditMemberData.membershipStatus : "Pending",
      paymentStatus: currentEditMemberId ? currentEditMemberData.paymentStatus : (jerseyInterested ? (mobilePayClicked ? "Maybe" : "No") : "N/A"),
      jersey: {
        interested: jerseyInterested,
        type: jerseyType,             // "player" | "fan" | null
        sleeve: jerseySleeve,         // "half" | "full" | null
        size: jerseySize,             // null if not interested
        number: jerseyNumber            // null if not interested
      },
      createdAt: currentEditMemberId ? currentEditMemberData.createdAt : serverTimestamp()
    };

    /* 8. Save to Firestore "members" collection */
    if (currentEditMemberId) {
      showToast("Updating registration…", "info", 30_000);
      await updateDoc(doc(db, MEMBERS_COLLECTION, currentEditMemberId), memberData);
    } else {
      showToast("Saving registration…", "info", 30_000);
      await addDoc(collection(db, MEMBERS_COLLECTION), memberData);
    }

    /* 9. Update success card */
    successMemberId.textContent = memberId;
    successName.textContent = fullName;

    if (jerseyInterested) {
      const typeLabel = jerseyType === "player" ? "Player Jersey" : "Fan Jersey";
      const sleeveLabel = jerseySleeve === "full" ? "Full Sleeve" : "Half Sleeve";
      const price = jerseyType === "player" ? "€20" : "€15";
      successJerseyRow.style.display = "flex";
      successJerseyInfo.textContent = `${typeLabel} (${sleeveLabel}) · ${price} · Size ${jerseySize}, No. ${jerseyNumber}`;
    } else {
      successJerseyRow.style.display = "none";
    }

    /* 10. Show success screen */
    formCard.style.display = "none";
    successCard.style.display = "block";
    showToast(currentEditMemberId ? "Details updated successfully! 🎉" : "Registration saved successfully! 🎉", "success", 5000);

    /* 11. Reset form for next use */
    currentEditMemberId = null;
    currentEditMemberData = null;
    submitBtnLabel.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Register as Member
    `;
    mobilePayClicked = false;
    registrationForm.reset();
    clearPhotoPreview();
    jerseyDetailsPanel.classList.remove("is-open");
    jerseyDetailsPanel.setAttribute("aria-hidden", "true");
    jerseySizeSelect.required = false;
    jerseyNumberInput.required = false;
    jerseyPriceInfo.style.display = "none";
    jerseyPriceInfo.innerHTML = "";
    if (paymentGatewayPanel) paymentGatewayPanel.style.display = "none";
    /* Uncheck all jersey type radio buttons */
    document.querySelectorAll('input[name="jerseyType"]').forEach(r => r.checked = false);
    /* Uncheck all jersey sleeve radio buttons */
    document.querySelectorAll('input[name="jerseySleeve"]').forEach(r => r.checked = false);
    /* Uncheck all jersey interest radio buttons */
    document.querySelectorAll('input[name="jerseyInterest"]').forEach(r => r.checked = false);
    registrationForm.querySelectorAll(".field-group").forEach((g) =>
      g.classList.remove("has-error", "is-valid")
    );

  } catch (err) {
    console.error("Registration error:", err);
    showToast(
      `Registration failed: ${err.message || "Unknown error. Please try again."}`,
      "error",
      8000
    );
  } finally {
    setLoading(false);
  }
});


/* ═══════════════════════════════════════════════════════════
   PASSWORD VISIBILITY TOGGLE (EYE BUTTON)
   ═══════════════════════════════════════════════════════════ */
const togglePinCodeBtn = document.getElementById("togglePinCode");
const toggleConfirmPinCodeBtn = document.getElementById("toggleConfirmPinCode");

function setupPinCodeToggle(btn, inputEl) {
  if (!btn || !inputEl) return;

  btn.addEventListener("click", () => {
    const isPassword = inputEl.type === "password";
    inputEl.type = isPassword ? "text" : "password";

    // Update SVG and accessibility labels
    btn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");

    if (isPassword) {
      // Switch to hidden slash eye SVG
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      `;
    } else {
      // Switch to standard open eye SVG
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      `;
    }
  });
}

setupPinCodeToggle(togglePinCodeBtn, pinCodeInput);
setupPinCodeToggle(toggleConfirmPinCodeBtn, confirmPinCodeInput);





/* ═══════════════════════════════════════════════════════════
   MEMBER LOGIN & EDIT MODE
   ═══════════════════════════════════════════════════════════ */

if (openLoginModalBtn) {
  openLoginModalBtn.addEventListener("click", () => {
    loginModal.style.display = "flex";
    loginEmailInput.value = "";
    modalPinCodeInput.value = "";
    clearFieldError(document.getElementById("loginFieldEmail"), loginEmailError);
    clearFieldError(document.getElementById("loginFieldPin"), modalPinCodeError);
  });
}

if (closeLoginModalBtn) {
  closeLoginModalBtn.addEventListener("click", () => {
    loginModal.style.display = "none";
  });
}

setupPinCodeToggle(toggleLoginPinBtn, modalPinCodeInput);

if (loginSubmitBtn) {
  loginSubmitBtn.addEventListener("click", async () => {
    const email = loginEmailInput.value.trim().toLowerCase();
    const pin = modalPinCodeInput.value;
    const emailGroup = document.getElementById("loginFieldEmail");
    const pinGroup = document.getElementById("loginFieldPin");
    
    let valid = true;
    if (!email || !EMAIL_REGEX.test(email)) {
      setFieldError(emailGroup, loginEmailError, "Enter a valid email address.");
      valid = false;
    } else {
      setFieldValid(emailGroup, loginEmailError);
    }
    
    if (!pin || !/^[0-9]{4}$/.test(pin)) {
      setFieldError(pinGroup, modalPinCodeError, "PIN must be exactly 4 numeric digits.");
      valid = false;
    } else {
      setFieldValid(pinGroup, modalPinCodeError);
    }
    
    if (!valid) return;
    
    // Auth
    loginSubmitBtn.disabled = true;
    loginSubmitBtnLabel.style.display = "none";
    loginSubmitBtnSpinner.style.display = "flex";
    
    try {
      const q = query(collection(db, MEMBERS_COLLECTION), where("email", "==", email), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setFieldError(emailGroup, loginEmailError, "No member found with this email.");
        return;
      }
      
      const memberDoc = snap.docs[0];
      const data = memberDoc.data();
      
      if (data.pin !== await hashPin(pin)) {
        setFieldError(pinGroup, modalPinCodeError, "Incorrect PIN.");
        return;
      }
      
      // Success! Enter Edit Mode
      currentEditMemberId = memberDoc.id;
      currentEditMemberData = data;
      
      // Populate Form
      fullNameInput.value = data.fullName || "";
      cityInput.value = data.city || "";
      phoneInput.value = data.phone || "";
      emailInput.value = data.email || "";
      pinCodeInput.value = "";
      confirmPinCodeInput.value = "";
      
      // Validate inputs natively
      fullNameInput.dispatchEvent(new Event('input'));
      cityInput.dispatchEvent(new Event('input'));
      phoneInput.dispatchEvent(new Event('input'));
      emailInput.dispatchEvent(new Event('input'));
      pinCodeInput.dispatchEvent(new Event('input'));
      confirmPinCodeInput.dispatchEvent(new Event('input'));
      
      // Jersey Logic
      if (data.jersey && data.jersey.interested) {
        // SCENARIO A: Already registered for a jersey
        // Close modal
        loginModal.style.display = "none";
        
        // Hide form and show success card with custom message
        formCard.style.display = "none";
        successCard.style.display = "block";
        
        const successTitle = document.querySelector(".success-title");
        const successDesc = document.querySelector(".success-desc");
        
        if (successTitle) successTitle.textContent = "Nothing to do for now!";
        if (successDesc) successDesc.innerHTML = "Everything is filled already. You have successfully completed your details and selected your jersey preference.";
        
        successMemberId.textContent = data.memberId || "";
        successName.textContent = data.fullName || "";
        
        const typeLabel = data.jersey.type === "player" ? "Player Jersey" : "Fan Jersey";
        const sleeveLabel = data.jersey.sleeve === "full" ? "Full Sleeve" : "Half Sleeve";
        const price = data.jersey.type === "player" ? "€20" : "€15";
        successJerseyRow.style.display = "flex";
        successJerseyInfo.textContent = `${typeLabel} (${sleeveLabel}) · ${price} · Size ${data.jersey.size}, No. ${data.jersey.number}`;
        
        // Ensure spinner resets since we return early
        loginSubmitBtn.disabled = false;
        loginSubmitBtnLabel.style.display = "flex";
        loginSubmitBtnSpinner.style.display = "none";
        return; 
      } else {
        // SCENARIO B: Registered but no jersey preference yet
        // Hide the top information form fields
        document.getElementById("fieldFullName").style.display = "none";
        document.getElementById("fieldCity").style.display = "none";
        document.getElementById("fieldPhone").style.display = "none";
        document.getElementById("fieldEmail").style.display = "none";
        document.getElementById("fieldPinCode").style.display = "none";
        document.getElementById("fieldConfirmPinCode").style.display = "none";
        document.getElementById("fieldPhoto").style.display = "none";
        
        const loginPrompt = document.querySelector(".header-login-prompt");
        if (loginPrompt) loginPrompt.style.display = "none";
        
        const headerDesc = document.querySelector(".header-desc");
        if (headerDesc) headerDesc.innerHTML = "Please select your jersey preference below to complete your order.";
        
        // Ensure jersey is unselected initially (so they have to select "Yes")
        if (data.jersey) {
          if (data.jersey.type === "player") document.getElementById("jerseyTypePlayer").checked = true;
          else if (data.jersey.type === "fan") document.getElementById("jerseyTypeFan").checked = true;
          
          if (data.jersey.sleeve === "full") document.getElementById("jerseySleeveFull").checked = true;
          else if (data.jersey.sleeve === "half") document.getElementById("jerseySleeveHalf").checked = true;
          
          jerseySizeSelect.value = data.jersey.size || "";
        }
        document.getElementById("jerseyInterestNo").checked = true;
        document.getElementById("jerseyInterestYes").checked = false;
        document.getElementById("jerseyInterestNo").dispatchEvent(new Event("change"));
        
        // Change Submit button text
        submitBtnLabel.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Confirm Jersey Selection
        `;
        
        // Close modal & scroll to top
        loginModal.style.display = "none";
        showToast("Identity verified! Please select your jersey preference below.", "success", 6000);
        formCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      
    } catch (err) {
      console.error("Login error:", err);
      showToast("Authentication failed. Please try again.", "error");
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtnLabel.style.display = "flex";
      loginSubmitBtnSpinner.style.display = "none";
    }
  });
}
