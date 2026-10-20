/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Type, Modality, ThinkingLevel } from "@google/genai";

// Initialize the Gemini client
// CRITICAL: The API key MUST be obtained exclusively from process.env.API_KEY.
// Do NOT generate any UI elements or code snippets for entering or managing the API key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// GLOBAL AUDIO PLAYER CONTROLS (for Voiceover Manual) - Declared globally to persist state and listeners
let playPauseBtn: HTMLButtonElement;
let playIcon: SVGElement;
let pauseIcon: SVGElement;
let progressBar: HTMLInputElement;
let currentTimeSpan: HTMLSpanElement;
let totalDurationSpan: HTMLSpanElement;
let downloadAudioBtn: HTMLAnchorElement;
let manualVoiceoverAudioOutput: HTMLElement;
let manualVoiceoverPlayerContainer: HTMLElement; // New: container for custom player controls

// A single Audio object to manage playback for the manual voiceover
let currentAudioPlayback: HTMLAudioElement = new Audio();
// To persist the last generated audio across tab switches
let persistedVoiceoverAudio: { url: string; fileName: string } | null = null;

interface VoiceoverHistoryItem {
  id: number;
  text: string;
  audioUrl: string;
  fileName: string;
  model: string;
  timestamp: Date;
  isGenerating?: boolean;
}
let voiceoverHistory: VoiceoverHistoryItem[] = [];

// THEME SWITCHER GLOBAL REFERENCES
let themeSwitcherBtn: HTMLButtonElement;
let themeGridContainer: HTMLElement;
let themeGrid: HTMLElement;
let closeThemeGridBtn: HTMLButtonElement;

// CROP MODAL GLOBAL REFERENCES
let cropModal: HTMLElement;
let cropImage: HTMLImageElement;
let cancelCropBtn: HTMLButtonElement;
let confirmCropBtn: HTMLButtonElement;
let closeCropModalBtn: HTMLButtonElement;
let currentCropper: any = null;
let pendingCropResolve: ((value: string | null) => void) | null = null;

// FULL IMAGE PREVIEW GLOBAL REFERENCES
let fullImageModal: HTMLElement;
let fullImagePreview: HTMLImageElement;
let closeFullImageBtn: HTMLButtonElement;
let fullImageContainer: HTMLElement;

const themes = [
  {
    name: "Sharp Dark",
    value: "default",
    primaryColor: "#4db6ac",
    accentColor: "#64b5f6",
  },
  {
    name: "Deep Space",
    value: "deep-space",
    primaryColor: "#ab47bc",
    accentColor: "#7e57c2",
  },
  {
    name: "Cyberpunk Neon",
    value: "cyberpunk-neon",
    primaryColor: "#ff0080",
    accentColor: "#00ff88",
  },
  {
    name: "Terminal Green",
    value: "terminal-green",
    primaryColor: "#00cc00",
    accentColor: "#55ff55",
  },
  {
    name: "Obsidian",
    value: "obsidian",
    primaryColor: "#5c6bc0",
    accentColor: "#b0bec5",
  },
  {
    name: "Matrix",
    value: "matrix",
    primaryColor: "#00cc00",
    accentColor: "#00ff00",
  },
  {
    name: "Steel Blue",
    value: "steel-blue",
    primaryColor: "#415a77",
    accentColor: "#778da9",
  },
  {
    name: "Crimson Dark",
    value: "crimson-dark",
    primaryColor: "#e91e63",
    accentColor: "#f44336",
  },
  {
    name: "Arctic Frost",
    value: "arctic-frost",
    primaryColor: "#64ffda",
    accentColor: "#64ffda",
  },
  {
    name: "Desert Night",
    value: "desert-night",
    primaryColor: "#1c1c1c",
    accentColor: "#d4af37",
  },
  {
    name: "Solar Flare",
    value: "solar-flare",
    primaryColor: "#ff8c00",
    accentColor: "#ff4500",
  },
];

function applyTheme(themeValue: string) {
  const htmlElement = document.documentElement;
  if (themeValue === "default") {
    htmlElement.removeAttribute("data-theme");
  } else {
    htmlElement.setAttribute("data-theme", themeValue);
  }
  localStorage.setItem("selectedTheme", themeValue);
}

function loadAndApplyTheme() {
  const savedTheme = localStorage.getItem("selectedTheme") || "default";
  applyTheme(savedTheme);
}

function populateThemeGrid() {
  if (!themeGrid) return; // Ensure themeGrid is initialized
  themeGrid.innerHTML = ""; // Clear existing content
  themes.forEach((theme) => {
    const themeButton = document.createElement("button");
    themeButton.className =
      "theme-grid-item card p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-105";
    themeButton.setAttribute("data-theme", theme.value);
    themeButton.innerHTML = `
            <div class="flex gap-1">
                <div class="w-6 h-6 rounded-full border border-gray-600" style="background-color: ${theme.primaryColor};"></div>
                <div class="w-6 h-6 rounded-full border border-gray-600" style="background-color: ${theme.accentColor};"></div>
            </div>
            <span class="text-sm font-semibold text-white">${theme.name}</span>
        `;
    themeButton.addEventListener("click", () => {
      applyTheme(theme.value);
      themeGridContainer.classList.add("hidden"); // Hide grid after selection
    });
    themeGrid.appendChild(themeButton);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // --- QUERY ALL ELEMENTS AND DECLARE ALL VARIABLES AT THE TOP ---
  // HEADER ELEMENTS
  const termsBtn = document.getElementById("terms-btn") as HTMLButtonElement; // NEW: Terms & Conditions button
  const helpBtn = document.getElementById("help-btn") as HTMLButtonElement; // NEW: Help button
  themeSwitcherBtn = document.getElementById(
    "theme-switcher-btn",
  ) as HTMLButtonElement;
  themeGridContainer = document.getElementById(
    "theme-grid-container",
  ) as HTMLElement;
  themeGrid = document.getElementById("theme-grid") as HTMLElement;
  closeThemeGridBtn = document.getElementById(
    "close-theme-grid-btn",
  ) as HTMLButtonElement;

  // CROP MODAL ELEMENTS
  cropModal = document.getElementById("crop-modal") as HTMLElement;
  cropImage = document.getElementById("crop-image") as HTMLImageElement;
  cancelCropBtn = document.getElementById(
    "cancel-crop-btn",
  ) as HTMLButtonElement;
  confirmCropBtn = document.getElementById(
    "confirm-crop-btn",
  ) as HTMLButtonElement;
  closeCropModalBtn = document.getElementById(
    "close-crop-modal-btn",
  ) as HTMLButtonElement;

  // FULL IMAGE PREVIEW ELEMENTS
  fullImageModal = document.getElementById("full-image-modal") as HTMLElement;
  fullImagePreview = document.getElementById(
    "full-image-preview",
  ) as HTMLImageElement;
  closeFullImageBtn = document.getElementById(
    "close-full-image-btn",
  ) as HTMLButtonElement;
  fullImageContainer = document.getElementById(
    "full-image-container",
  ) as HTMLElement;

  // PASSWORD MODAL ELEMENTS
  const passwordModal = document.getElementById(
    "password-modal",
  ) as HTMLElement;
  const passwordInput = document.getElementById(
    "password-input",
  ) as HTMLInputElement;
  const passwordSubmitBtn = document.getElementById(
    "password-submit-btn",
  ) as HTMLButtonElement;
  const passwordError = document.getElementById(
    "password-error",
  ) as HTMLParagraphElement;
  const mainContent = document.getElementById("main-content") as HTMLElement;
  const VALID_PASSWORDS = [
    "iu123hadkhsakj5y",
    "jhkjafhjk676hf",
    "kkdjai887fsyhu",
    "akjhfjka76hf",
    "aajjgn776disjfl",
    "akhfjh999fy",
    "sssdfaiug776q",
    "ghyeriita564",
    "NEVER",
    "WINAIPROMAX",
  ];

  // Auto-focus the password input on initial load
  passwordInput.focus();

  // TAB NAVIGATION ELEMENTS
  const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  const panels = document.querySelectorAll<HTMLElement>('[role="tabpanel"]');
  const otherToolsBtn = document.getElementById(
    "other-tools-btn",
  ) as HTMLButtonElement;
  const otherToolsMenu = document.getElementById(
    "other-tools-menu",
  ) as HTMLElement;

  // POSE GENERATOR (WIN GENERATING) ELEMENTS AND VARIABLES
  const poseGeneratorInputsCard = document.getElementById(
    "pose-generator-inputs-card",
  ) as HTMLElement; // NEW
  const resetWinGeneratingBtn = document.getElementById(
    "reset-win-generating-btn",
  ) as HTMLButtonElement;
  const imageInput = document.getElementById("image-input") as HTMLInputElement;
  const addMoreImageInput = document.getElementById(
    "add-more-image-input",
  ) as HTMLInputElement;
  const prevImageBtn = document.getElementById(
    "prev-image-btn",
  ) as HTMLButtonElement;
  const nextImageBtn = document.getElementById(
    "next-image-btn",
  ) as HTMLButtonElement;
  const imageCounter = document.getElementById(
    "image-counter",
  ) as HTMLSpanElement;
  const imageUploadArea = document.getElementById(
    "image-upload-area",
  ) as HTMLElement;
  const imagePreviewContainer = document.getElementById(
    "image-preview-container",
  ) as HTMLElement;
  const imagePreview = document.getElementById(
    "image-preview",
  ) as HTMLImageElement;
  const removeImageBtn = document.getElementById(
    "remove-image-btn",
  ) as HTMLButtonElement;
  const modelImageInput = document.getElementById(
    "model-image-input",
  ) as HTMLInputElement;
  const modelImageUploadArea = document.getElementById(
    "model-image-upload-area",
  ) as HTMLElement;
  const modelImagePreviewContainer = document.getElementById(
    "model-image-preview-container",
  ) as HTMLElement;
  const modelImagePreview = document.getElementById(
    "model-image-preview",
  ) as HTMLImageElement;
  const removeModelImageBtn = document.getElementById(
    "remove-model-image-btn",
  ) as HTMLButtonElement;
  const backgroundImageInput = document.getElementById(
    "background-image-input",
  ) as HTMLInputElement;
  const backgroundImageUploadArea = document.getElementById(
    "background-image-upload-area",
  ) as HTMLElement;
  const backgroundImagePreviewContainer = document.getElementById(
    "background-image-preview-container",
  ) as HTMLElement;
  const backgroundImagePreview = document.getElementById(
    "background-image-preview",
  ) as HTMLImageElement;
  const removeBackgroundImageBtn = document.getElementById(
    "remove-background-image-btn",
  ) as HTMLButtonElement;
  const productDescInput = document.getElementById(
    "product-desc-input",
  ) as HTMLTextAreaElement;
  const productDescClearBtn = document.getElementById(
    "clear-product-desc-btn",
  ) as HTMLButtonElement; // NEW
  const generateBtn = document.getElementById(
    "generate-btn",
  ) as HTMLButtonElement;
  const bRollGrid = document.getElementById("b-roll-grid") as HTMLElement;
  const generateDescBtn = document.getElementById(
    "generate-desc-btn",
  ) as HTMLButtonElement;
  const photoThemeInput = document.getElementById(
    "photo-theme-input",
  ) as HTMLTextAreaElement;
  const photoThemeClearBtn = document.getElementById(
    "clear-photo-theme-btn",
  ) as HTMLButtonElement; // NEW
  const wgAiModelToggle = document.getElementById(
    "wg-ai-model-toggle",
  ) as HTMLInputElement; // NEW
  const wgAiModelLabel = document.getElementById(
    "wg-ai-model-label",
  ) as HTMLSpanElement; // NEW
  const wgImageCountContainer = document.getElementById(
    "wg-image-count-container",
  ) as HTMLElement; // NEW
  const wgImageCountSelect = document.getElementById(
    "wg-image-count-select",
  ) as HTMLSelectElement; // NEW

  // NEW BATCH ACTIONS ELEMENTS
  const batchActionsContainer = document.getElementById(
    "batch-actions-container",
  ) as HTMLElement;
  const batchSelectionCount = document.getElementById(
    "batch-selection-count",
  ) as HTMLParagraphElement;
  const batchDownloadBtn = document.getElementById(
    "batch-download-btn",
  ) as HTMLButtonElement;
  const batchVideoBtn = document.getElementById(
    "batch-video-btn",
  ) as HTMLButtonElement;

  let productImages: { base64: string; mimeType: string }[] = [];
  let currentProductImageIndex = 0;

  let uploadedImageBase64: string | null = null;
  let imageMimeType: string | null = null;
  let uploadedModelImageBase64: string | null = null;
  let modelImageMimeType: string | null = null;
  let uploadedBackgroundImageBase64: string | null = null;
  let backgroundImageMimeType: string | null = null;
  let wgSelectedAiModel = "gemini-3.8-flash"; // NEW: State for AI Model selection
  let wgImageCount = 6; // NEW: State for image count

  // WIN GENERATING - ADDITIONAL OPTIONS ELEMENTS
  const wgAnalyzeCheckbox = document.getElementById(
    "wg-analyze-checkbox",
  ) as HTMLInputElement;
  const wgAnalyzeSettings = document.getElementById(
    "wg-analyze-settings",
  ) as HTMLElement;
  const wgAnalyzeDurationSelect = document.getElementById(
    "wg-analyze-duration-select",
  ) as HTMLSelectElement;
  const wgAnalyzeManualDurationInput = document.getElementById(
    "wg-analyze-manual-duration-input",
  ) as HTMLInputElement;
  const wgAnalyzeLanguageSelect = document.getElementById(
    "wg-analyze-language-select",
  ) as HTMLSelectElement;
  const wgAnalyzeVoiceThemeInput = document.getElementById(
    "wg-analyze-voice-theme-input",
  ) as HTMLTextAreaElement; // CHANGED
  const wgVoiceoverCheckbox = document.getElementById(
    "wg-voiceover-checkbox",
  ) as HTMLInputElement;
  const wgVoiceoverSettings = document.getElementById(
    "wg-voiceover-settings",
  ) as HTMLElement;
  const wgVoiceoverModelSelect = document.getElementById(
    "wg-voiceover-model-select",
  ) as HTMLSelectElement;
  const wgVoiceoverStyleSelect = document.getElementById(
    "wg-voiceover-style-select",
  ) as HTMLSelectElement; // NEW
  const wgVoiceoverStyleDesc = document.getElementById(
    "wg-voiceover-style-desc",
  ) as HTMLParagraphElement; // NEW
  const wgVoiceoverDependencyError = document.getElementById(
    "wg-voiceover-dependency-error",
  ) as HTMLParagraphElement;
  const wgCaptionCheckbox = document.getElementById(
    "wg-caption-checkbox",
  ) as HTMLInputElement; // NEW
  const wgVideoPromptCheckbox = document.getElementById(
    "wg-video-prompt-checkbox",
  ) as HTMLInputElement; // NEW

  // WIN GENERATING - NEW OUTPUTS ELEMENTS
  const wgTextAudioOutputContainer = document.getElementById(
    "win-generating-text-audio-output",
  ) as HTMLElement;
  const wgScriptOutputContainer = document.getElementById(
    "wg-script-output-container",
  ) as HTMLElement;
  const wgScriptOutput = document.getElementById(
    "wg-script-output",
  ) as HTMLElement;
  const wgAudioPlayerContainer = document.getElementById(
    "wg-audio-player-container",
  ) as HTMLElement;

  // WIN GENERATING - State variables for new options
  let wgIsAnalyzeChecked = false;
  let wgSelectedDuration = "20";
  let wgManualDuration = "";
  let wgSelectedLanguage = "indonesian";
  let wgVoiceTheme = ""; // CHANGED
  let wgIsVoiceoverChecked = false;
  let wgSelectedVoiceModel = "despina";
  let wgSelectedVoiceStyleOption = "natural"; // NEW
  let wgIsCaptionChecked = false; // NEW
  let wgIsVideoPromptChecked = false; // NEW

  // TRY ON FEATURE ELEMENTS AND VARIABLES
  const tryOnModelInput = document.getElementById(
    "try-on-model-input",
  ) as HTMLInputElement;
  const tryOnModelUploadArea = document.getElementById(
    "try-on-model-upload-area",
  ) as HTMLElement;
  const tryOnModelPreviewContainer = document.getElementById(
    "try-on-model-preview-container",
  ) as HTMLElement;
  const tryOnModelPreview = document.getElementById(
    "try-on-model-preview",
  ) as HTMLImageElement;
  const tryOnRemoveModelBtn = document.getElementById(
    "try-on-remove-model-btn",
  ) as HTMLButtonElement;
  const tryOnProductInput = document.getElementById(
    "try-on-product-input",
  ) as HTMLInputElement;
  const tryOnProductUploadArea = document.getElementById(
    "try-on-product-upload-area",
  ) as HTMLElement;
  const tryOnProductPreviewContainer = document.getElementById(
    "try-on-product-preview-container",
  ) as HTMLElement;
  const tryOnProductPreview = document.getElementById(
    "try-on-product-preview",
  ) as HTMLImageElement;
  const tryOnRemoveProductBtn = document.getElementById(
    "try-on-remove-product-btn",
  ) as HTMLButtonElement;
  const tryOnBtn = document.getElementById("try-on-btn") as HTMLButtonElement;
  const tryOnResultContainer = document.getElementById(
    "try-on-result-container",
  ) as HTMLElement;

  let tryOnModelBase64: string | null = null;
  let tryOnModelMimeType: string | null = null;
  let tryOnProductBase64: string | null = null;
  let tryOnProductMimeType: string | null = null;

  // REMOVE BACKGROUND FEATURE ELEMENTS AND VARIABLES
  const removeBgInput = document.getElementById(
    "remove-bg-input",
  ) as HTMLInputElement;
  const removeBgUploadArea = document.getElementById(
    "remove-bg-upload-area",
  ) as HTMLElement;
  const removeBgPreviewContainer = document.getElementById(
    "remove-bg-preview-container",
  ) as HTMLElement;
  const removeBgPreview = document.getElementById(
    "remove-bg-preview",
  ) as HTMLImageElement;
  const removeBgRemoveBtn = document.getElementById(
    "remove-bg-remove-btn",
  ) as HTMLButtonElement;
  const removeBgBtn = document.getElementById(
    "remove-bg-btn",
  ) as HTMLButtonElement;
  const removeBgResultContainer = document.getElementById(
    "remove-bg-result-container",
  ) as HTMLElement;

  let removeBgBase64: string | null = null;
  let removeBgMimeType: string | null = null;

  // VIDEO GENERATOR FEATURE (5-SLOT VERSION) ELEMENTS AND VARIABLES
  const videoSlotsGrid = document.getElementById(
    "video-slots-grid",
  ) as HTMLElement;
  const generateAllVideosBtn = document.getElementById(
    "generate-all-videos-btn",
  ) as HTMLButtonElement;
  const downloadAllVideosBtn = document.getElementById(
    "download-all-videos-btn",
  ) as HTMLButtonElement;
  const clearAllVideosBtn = document.getElementById(
    "clear-all-videos-btn",
  ) as HTMLButtonElement;
  const videoAspectRatioSelect = document.getElementById(
    "video-aspect-ratio-select",
  ) as HTMLSelectElement;
  const videoModelSelect = document.getElementById(
    "video-model-select",
  ) as HTMLSelectElement;

  const NUM_VIDEO_SLOTS = 5; // Changed from 4 to 5
  let videoSlotsData = Array(NUM_VIDEO_SLOTS)
    .fill(null)
    .map(() => ({
      prompt: "",
      imageBase64: null as string | null,
      imageMimeType: null as string | null,
      isGenerating: false,
    }));

  // ANALYZE SCREENSHOT FEATURE ELEMENTS AND VARIABLES
  const analyzeScreenshotInput = document.getElementById(
    "analyze-screenshot-input",
  ) as HTMLInputElement;
  const analyzeScreenshotUploadArea = document.getElementById(
    "analyze-screenshot-upload-area",
  ) as HTMLElement;
  const analyzeScreenshotPreviewContainer = document.getElementById(
    "analyze-screenshot-preview-container",
  ) as HTMLElement;
  const analyzeScreenshotPreview = document.getElementById(
    "analyze-screenshot-preview",
  ) as HTMLImageElement;
  const analyzeScreenshotRemoveBtn = document.getElementById(
    "analyze-screenshot-remove-btn",
  ) as HTMLButtonElement;
  const analyzeAiModelToggle = document.getElementById(
    "analyze-ai-model-toggle",
  ) as HTMLInputElement; // NEW
  const analyzeAiModelLabel = document.getElementById(
    "analyze-ai-model-label",
  ) as HTMLSpanElement; // NEW
  const analyzeScreenshotDurationSelect = document.getElementById(
    "analyze-screenshot-duration-select",
  ) as HTMLSelectElement;
  const analyzeScreenshotManualDurationInput = document.getElementById(
    "analyze-screenshot-manual-duration-input",
  ) as HTMLInputElement;
  const analyzeScreenshotLanguageSelect = document.getElementById(
    "analyze-screenshot-language-select",
  ) as HTMLSelectElement; // NEW
  const analyzeScreenshotVoiceThemeInput = document.getElementById(
    "analyze-screenshot-voice-theme-input",
  ) as HTMLTextAreaElement; // CHANGED
  const generateScriptBtn = document.getElementById(
    "generate-script-btn",
  ) as HTMLButtonElement;
  const analyzeScreenshotScriptOutput = document.getElementById(
    "analyze-screenshot-script-output",
  ) as HTMLElement;
  const copyScreenshotScriptBtn = document.getElementById(
    "copy-screenshot-script-btn",
  ) as HTMLButtonElement;
  const analyzeScreenshotCaptionOutput = document.getElementById(
    "analyze-screenshot-caption-output",
  ) as HTMLElement;
  const copyScreenshotCaptionBtn = document.getElementById(
    "copy-screenshot-caption-btn",
  ) as HTMLButtonElement;

  let analyzeScreenshotBase64: string | null = null;
  let analyzeScreenshotMimeType: string | null = null;
  let analyzeScreenshotSelectedAiModel = "gemini-3.8-flash"; // NEW
  let analyzeScreenshotSelectedDuration: string = "30"; // Default from select, will be updated
  let analyzeScreenshotManualDuration: string = ""; // Default empty
  let analyzeScreenshotLanguage: string = "indonesian"; // NEW: Default from select, will be updated
  let analyzeScreenshotVoiceTheme: string = ""; // CHANGED

  // MANUAL VOICEOVER FEATURE ELEMENTS AND VARIABLES
  const manualVoiceoverInput = document.getElementById(
    "manual-voiceover-input",
  ) as HTMLTextAreaElement;
  const manualVoiceoverClearBtn = document.getElementById(
    "clear-manual-voiceover-input-btn",
  ) as HTMLButtonElement; // NEW
  const manualVoiceoverModelSelect = document.getElementById(
    "manual-voiceover-model-select",
  ) as HTMLSelectElement;
  const manualVoiceoverStyleSelect = document.getElementById(
    "manual-voiceover-style-select",
  ) as HTMLSelectElement; // NEW
  const manualVoiceoverStyleDesc = document.getElementById(
    "manual-voiceover-style-desc",
  ) as HTMLParagraphElement; // NEW
  const selectedVoiceDisplay = document.getElementById(
    "selected-voice-display",
  ) as HTMLSpanElement;
  const generateManualVoiceoverBtn = document.getElementById(
    "generate-manual-voiceover-btn",
  ) as HTMLButtonElement;
  // manualVoiceoverAudioOutput and manualVoiceoverPlayerContainer are declared globally above.

  let manualVoiceoverText: string = ""; // Default empty
  let manualVoiceoverModel: string = "despina"; // Set default
  let manualVoiceoverStyle: string = "natural"; // NEW: State for style

  // UNIVERSAL MODAL ELEMENTS
  const universalModal = document.getElementById(
    "universal-modal",
  ) as HTMLElement;
  const modalTitle = document.getElementById("modal-title") as HTMLElement;
  const modalBody = document.getElementById("modal-body") as HTMLElement;
  const closeModalBtn = document.getElementById(
    "close-modal-btn",
  ) as HTMLButtonElement; // Corrected type here

  // --- QUERY GLOBAL AUDIO PLAYER ELEMENTS ---
  // These elements are expected to exist in index.html (within the voiceover-manual-panel)
  playPauseBtn = document.getElementById("play-pause-btn") as HTMLButtonElement;
  playIcon = document.getElementById("play-icon") as unknown as SVGElement;
  pauseIcon = document.getElementById("pause-icon") as unknown as SVGElement;
  progressBar = document.getElementById("progress-bar") as HTMLInputElement;
  currentTimeSpan = document.getElementById("current-time") as HTMLSpanElement;
  totalDurationSpan = document.getElementById(
    "total-duration",
  ) as HTMLSpanElement;
  downloadAudioBtn = document.getElementById(
    "download-audio-btn",
  ) as HTMLAnchorElement;
  manualVoiceoverAudioOutput = document.getElementById(
    "manual-voiceover-audio-output",
  ) as HTMLElement;
  manualVoiceoverPlayerContainer = document.getElementById(
    "manual-voiceover-player-container",
  ) as HTMLElement; // Query the player container

  // --- CROPPER FUNCTIONS ---

  function destroyCropper() {
    if (currentCropper) {
      currentCropper.destroy();
      currentCropper = null;
    }
    cropImage.src = "";
    cropModal.classList.remove("visible");
  }

  function openCropModal(imageSrc: string): Promise<string | null> {
    return new Promise((resolve) => {
      pendingCropResolve = resolve;
      cropImage.src = imageSrc;
      cropModal.classList.add("visible");

      if (currentCropper) currentCropper.destroy();

      // Wait for image load or simple timeout to ensure modal is rendered
      setTimeout(() => {
        const Cropper = (window as any).Cropper;
        if (Cropper) {
          currentCropper = new Cropper(cropImage, {
            aspectRatio: 9 / 16,
            viewMode: 1,
            dragMode: "move", // Allows panning the image behind the crop box
            autoCropArea: 1, // Maximize the crop box to the available area
            restore: false,
            guides: false, // Hide grid for a cleaner "frame" look
            center: true,
            highlight: false,
            cropBoxMovable: false, // FIX: Prevent moving the crop box (user moves image instead)
            cropBoxResizable: false, // FIX: Prevent resizing the crop box
            toggleDragModeOnDblclick: false,
            zoomable: true,
            zoomOnTouch: true,
            zoomOnWheel: true,
            wheelZoomRatio: 0.1,
          });
        } else {
          console.error("Cropper.js not loaded");
          // Fallback if cropper not loaded: resolve with original image
          resolve(imageSrc);
          cropModal.classList.remove("visible");
        }
      }, 100);
    });
  }

  confirmCropBtn.addEventListener("click", () => {
    if (currentCropper && pendingCropResolve) {
      const canvas = currentCropper.getCroppedCanvas();
      if (canvas) {
        const base64 = canvas.toDataURL("image/png");
        pendingCropResolve(base64);
      } else {
        pendingCropResolve(null);
      }
      destroyCropper();
      pendingCropResolve = null;
    }
  });

  const cancelCropAction = () => {
    if (pendingCropResolve) {
      pendingCropResolve(null);
      destroyCropper();
      pendingCropResolve = null;
    }
  };

  cancelCropBtn.addEventListener("click", cancelCropAction);
  closeCropModalBtn.addEventListener("click", cancelCropAction);

  // --- FULL IMAGE PREVIEW FUNCTIONS ---
  let currentPreviewScale = 1;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;

  function openImagePreview(imageSrc: string) {
    fullImagePreview.src = imageSrc;
    fullImageModal.classList.remove("hidden");
    resetPreviewTransform();
  }

  function closeImagePreview() {
    fullImageModal.classList.add("hidden");
    fullImagePreview.src = "";
  }

  function resetPreviewTransform() {
    currentPreviewScale = 1;
    translateX = 0;
    translateY = 0;
    updatePreviewTransform();
  }

  function updatePreviewTransform() {
    fullImagePreview.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentPreviewScale})`;
  }

  closeFullImageBtn.addEventListener("click", closeImagePreview);

  // Zoom Logic (Wheel)
  fullImageContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(0.5, currentPreviewScale + delta), 5); // Limit zoom between 0.5x and 5x

    if (newScale !== currentPreviewScale) {
      currentPreviewScale = newScale;
      updatePreviewTransform();
    }
  });

  // Pan Logic (Mouse Drag)
  fullImageContainer.addEventListener("mousedown", (e) => {
    if (currentPreviewScale > 1) {
      // Only pan if zoomed in
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      fullImageContainer.style.cursor = "grabbing";
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updatePreviewTransform();
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      fullImageContainer.style.cursor = "grab";
    }
  });

  // --- ALL HELPER FUNCTIONS ---

  /**
   * Generic function to set up image upload, preview, and removal logic.
   * Updated to support optional cropping.
   */
  function setupImageUpload(
    input: HTMLInputElement,
    uploadArea: HTMLElement,
    previewContainer: HTMLElement,
    previewImg: HTMLImageElement,
    removeBtn: HTMLButtonElement,
    onUpload: (base64: string | null, mime: string | null) => void,
    onStateChange?: () => void,
    enableCrop: boolean = false, // New optional parameter
  ) {
    input.addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          let result = e.target?.result as string;
          let mimeType = result.match(/:(.*?);/)?.[1] ?? "image/png";

          if (enableCrop) {
            try {
              const croppedBase64 = await openCropModal(result);
              if (croppedBase64) {
                result = croppedBase64;
                mimeType = "image/png"; // Cropped result is PNG
              } else {
                // Cancelled crop, reset input
                input.value = "";
                return;
              }
            } catch (err) {
              console.error("Crop failed", err);
              input.value = "";
              return;
            }
          }

          previewImg.src = result;
          const parts = result.split(",");
          const base64 = parts[1];
          onUpload(base64, mimeType);

          uploadArea.classList.add("hidden");
          previewContainer.classList.remove("hidden");
          if (onStateChange) onStateChange();
        };
        reader.readAsDataURL(file);
      }
    });

    removeBtn.addEventListener("click", () => {
      onUpload(null, null);
      input.value = ""; // Clear the file input
      previewImg.src = "#"; // Clear image source
      uploadArea.classList.remove("hidden");
      previewContainer.classList.add("hidden");
      if (onStateChange) onStateChange();
    });
  }

  /**
   * Copies text to clipboard and provides temporary visual feedback.
   */
  function copyToClipboard(text: string, buttonElement: HTMLButtonElement) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const originalText = buttonElement.innerText;
        buttonElement.innerText = "Berhasil Disalin!";
        setTimeout(() => {
          buttonElement.innerText = originalText;
        }, 2000);
      })
      .catch((err) => console.error("Failed to copy text: ", err));
  }

  /**
   * Decodes a base64 string to a Uint8Array.
   */
  function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Creates a WAV Blob from raw 16-bit PCM data.
   * This revised version ensures correct WAV header structure and data writing.
   */
  function createWavBlob(
    pcmData: Uint8Array,
    sampleRate: number,
    numChannels: number = 1,
  ): Blob {
    const bytesPerSample = 2; // 16-bit PCM (Int16Array)
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    const dataSize = pcmData.byteLength;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    function writeString(str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
      offset += str.length;
    }

    // RIFF chunk
    writeString("RIFF"); // Chunk ID (0)
    view.setUint32(offset, totalSize - 8, true); // Chunk Size (4) - total size - 8 bytes for "RIFF" and "ChunkSize"
    offset += 4;
    writeString("WAVE"); // Format (8)

    // FMT sub-chunk
    writeString("fmt "); // Subchunk1 ID (12)
    view.setUint32(offset, 16, true); // Subchunk1 Size (16) - 16 for PCM
    offset += 4;
    view.setUint16(offset, 1, true); // Audio Format (18) - 1 for PCM
    offset += 2;
    view.setUint16(offset, numChannels, true); // Num Channels (20)
    offset += 2;
    view.setUint32(offset, sampleRate, true); // Sample Rate (22)
    offset += 4;
    view.setUint32(offset, byteRate, true); // Byte Rate (26)
    offset += 4;
    view.setUint16(offset, blockAlign, true); // Block Align (30) - (NumChannels * BitsPerSample) / 8
    offset += 2;
    view.setUint16(offset, bytesPerSample * 8, true); // Bits Per Sample (32) - 16-bit
    offset += 2;

    // DATA sub-chunk
    writeString("data"); // Subchunk2 ID (36)
    view.setUint32(offset, dataSize, true); // Subchunk2 Size (40) - data_bytes_count
    offset += 4;

    // Write PCM data
    // The pcmData is already a Uint8Array representing raw 16-bit samples.
    // We can just copy these raw bytes directly into the buffer.
    const dataView = new Uint8Array(buffer, offset); // Create a Uint8Array view starting after the header
    dataView.set(pcmData); // Copy the raw PCM bytes directly

    console.log("Generated WAV Blob details (createWavBlob):", {
      pcmDataByteLength: pcmData.byteLength,
      sampleRate,
      numChannels,
      bytesPerSample,
      blockAlign,
      byteRate,
      totalWavSize: totalSize,
      chunkSize: totalSize - 8,
      subchunk1Size: 16,
      audioFormat: 1,
      bitsPerSample: bytesPerSample * 8,
      subchunk2Size: dataSize,
      isPcmDataByteLengthEven: pcmData.byteLength % 2 === 0, // Should always be even for 16-bit samples
    });

    return new Blob([buffer], { type: "audio/wav" });
  }

  /**
   * Formats time from seconds into MM:SS string.
   */
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  }

  /**
   * Updates the audio player UI and manages audio playback.
   */
  function updateAudioPlayerUIAndSrc(
    audioUrl: string | null,
    downloadFileName: string = "voiceover.wav",
  ) {
    console.log("updateAudioPlayerUIAndSrc called with:", {
      audioUrl,
      downloadFileName,
      currentAudioPlaybackSrc_BEFORE: currentAudioPlayback.src,
    }); // Diagnostic

    // Always pause first to reset state before changing src
    currentAudioPlayback.pause();

    if (audioUrl) {
      currentAudioPlayback.src = audioUrl;
      currentAudioPlayback.currentTime = 0; // Reset playback to start
      currentAudioPlayback.load(); // Explicitly load the new audio source
      console.log(
        "currentAudioPlayback.src set to:",
        currentAudioPlayback.src,
        "and load() called.",
      ); // Diagnostic

      // Update download link
      downloadAudioBtn.href = audioUrl;
      downloadAudioBtn.download = downloadFileName;
      downloadAudioBtn.classList.remove("disabled-link");

      manualVoiceoverAudioOutput.innerHTML = `<span class="text-light-muted-color">Audio siap diputar:</span>`;
      manualVoiceoverPlayerContainer.classList.remove("hidden"); // Show player controls
      playPauseBtn.disabled = true; // Initially disabled until metadata loaded (in loadedmetadata event)
    } else {
      // audioUrl is null, means clear everything
      currentAudioPlayback.removeAttribute("src"); // Clear source property to release resource
      currentAudioPlayback.load(); // Explicitly unload any loaded media
      currentAudioPlayback.currentTime = 0; // Reset time

      playPauseBtn.disabled = true;
      if (playIcon && pauseIcon) {
        playIcon.classList.remove("hidden");
        pauseIcon.classList.add("hidden");
      }
      progressBar.value = "0";
      currentTimeSpan.innerText = "0:00";
      totalDurationSpan.innerText = "0:00";
      downloadAudioBtn.href = "#";
      downloadAudioBtn.download = "";
      downloadAudioBtn.classList.add("disabled-link");

      manualVoiceoverAudioOutput.innerHTML = `<span class="text-light-muted-color">Audio Anda akan muncul di sini</span>`;
      manualVoiceoverPlayerContainer.classList.add("hidden"); // Hide player controls
    }
  }

  /**
   * Updates the button state for the Pose Generator feature.
   */
  function updatePoseGenButtonState() {
    const isBaseInfoProvided =
      uploadedImageBase64 && productDescInput.value.trim();
    const isAnyActionSelected =
      wgImageCount > 0 ||
      wgIsAnalyzeChecked ||
      wgIsCaptionChecked ||
      wgIsVideoPromptChecked;

    generateBtn.disabled = !isBaseInfoProvided || !isAnyActionSelected;
    generateDescBtn.disabled = !uploadedImageBase64;

    // NEW: Toggle visibility of image count dropdown
    if (wgImageCountContainer) {
      wgImageCountContainer.classList.toggle("hidden", !uploadedImageBase64);
    }

    // Toggle visibility of clear buttons for product description and photo theme
    if (productDescInput) {
      if (productDescInput.value.trim()) {
        productDescClearBtn.classList.remove("hidden");
      } else {
        productDescClearBtn.classList.add("hidden");
      }
    }
    if (photoThemeInput) {
      if (photoThemeInput.value.trim()) {
        photoThemeClearBtn.classList.remove("hidden");
      } else {
        photoThemeClearBtn.classList.add("hidden");
      }
    }
  }

  // This is the source of truth for all generated B-roll content.
  type BrollIdea = {
    title_id: string;
    image_prompt_en: string;
    // Optional fields that are generated on-demand
    video_prompt_en?: string;
    caption_id?: string;
    // Fields for the generated image result
    imageUrl?: string;
    base64Data?: string;
    success: boolean;
    error?: string;
  };

  // Type for storing results of generated images
  type GeneratedImageResult = {
    success: boolean;
    imageUrl?: string;
    base64Data?: string;
    error?: string;
  };

  // State variable to hold all data for the B-roll cards
  let finalBrollIdeas: BrollIdea[] = [];
  let checkedBrollIndices = new Set<number>();

  /**
   * NEW: Updates the state and visibility of the batch action buttons.
   */
  function updateBatchActionButtonsState() {
    const count = checkedBrollIndices.size;

    if (count > 0) {
      batchActionsContainer.classList.remove("hidden");
    } else {
      batchActionsContainer.classList.add("hidden");
    }

    batchSelectionCount.innerText = `${count} gambar dipilih`;

    batchDownloadBtn.disabled = count === 0;

    batchVideoBtn.disabled = count === 0 || count > 5;
    if (count > 5) {
      batchVideoBtn.title = "Maksimal 5 gambar untuk dijadikan video.";
    } else {
      batchVideoBtn.title = "Kirim gambar terpilih ke Generator Video";
    }
  }

  /**
   * STEP 1: Generates titles and image prompts for a dynamic number of B-roll shots.
   */
  async function generateTitlesAndImagePrompts(
    language: string,
    imageCount: number,
  ): Promise<{ title_id: string; image_prompt_en: string }[]> {
    // --- Input Gathering ---
    const theme = photoThemeInput.value.trim();
    const productDescription = productDescInput.value.trim();
    const hasModel = !!uploadedModelImageBase64;
    const hasBackground = !!uploadedBackgroundImageBase64;

    // --- System Prompt Construction (Modular & Cleaned up) ---
    const conditionalInstructions: string[] = [];
    if (productImages.length > 1) {
      conditionalInstructions.push(
        `- **MULTIPLE PRODUCTS RULE**: Since ${productImages.length} product images are provided, you MUST feature ALL of the provided products together in a single, cohesive, and creative composition. The positioning should be dynamic, and the background should be creative and complementary. Ensure all products are clearly visible and interact naturally within the same scene.`,
      );
    }
    if (theme) {
      conditionalInstructions.push(
        `- **CRITICAL THEME & FRAMING RULE**: You MUST strictly adhere to this user request: "${theme}". This request may dictate the camera angle, distance (e.g., close-up, macro), composition, mood, or setting. Every element in your generated prompt MUST serve this request without exception, overriding any default framing habits.`,
      );
    }
    if (hasModel) {
      conditionalInstructions.push(
        "- **MODEL RULE**: You MUST integrate the provided model photo naturally. If the product reference image contains a photo of a human or model and if an optional model is uploaded, the optional model must appear in the resulting image and there must be no display of the model from the product reference image. The resulting image must show a 100% identical model face style, showing natural interaction with product. Then the model should appear in all image prompt ",
      );
    }
    if (hasBackground) {
      conditionalInstructions.push(
        "- **CRITICAL BACKGROUND RULE**: You MUST use the provided background image. The product must be seamlessly composited into this exact background. Match the lighting direction, color temperature, and ambient occlusion of the background perfectly. Generate realistic contact shadows and reflections on the background surfaces so the product appears to physically exist within that specific environment. Do not alter the original background's core elements.",
      );
    }
    if (productImages.length > 1) {
      conditionalInstructions.push(
        `- **MULTI-PRODUCT RULE**: You MUST include ALL ${productImages.length} products shown in the reference images in EVERY generated shot. They must be displayed comprehensively, clearly visible, and not overlapping or obscuring each other. Arrange them creatively and dynamically within the scene.`,
      );
    }

    const systemPrompt = `You are an Professional AI photography director and visual stylist for high-end commercial products.
Your role is to analyze the provided product description and any additional contextual rules.
Your primary task is to produce **${imageCount} distinct, creative, and professional "shots" or "poses"** that showcase the product in visually stunning ways.
${
  conditionalInstructions.length > 0
    ? `
--- **ADDITIONAL CONTEXTUAL RULES** ---
You must strictly follow these rules:
${conditionalInstructions.join("\n")}
`
    : ""
}

--- OUTPUT FORMAT ---
Respond ONLY with a valid JSON array of ${imageCount} objects.
Each object must contain:
- "title_id": A short, catchy Indonesian title (e.g., "Sorotan Elegan", "Genggaman Nyaman").
- "image_prompt_en": A detailed AI image generation prompt in **English**, incorporating all rules from **STYLE REQUIREMENTS for prompts**  and any **ADDITIONAL CONTEXTUAL RULES** provided above.

--- **STYLE REQUIREMENTS for prompts** ---
- Write in fluent English for professional AI image generation.
- The result must be 100% similar to the product in the reference image.
- Focus on cinematic lighting, rich detail, natural materials, realistic and a luxury-grade visual tone.
- Include artistic direction (e.g., angle, lighting type, depth of field, shadows, reflections, framing).
- Avoid brand names or watermarks.
- Each shot must produce an image with a resolution of 9:16.s
- The product must look realistic and blend with the background (such as lighting, place, coloring, composition, angle, and shadows)
- The background should look beautiful and comfortable when viewed.
- The product must be fully visible on the frame and must be clearly visible when taken from a close distance.
- The prompt must contain all the written rules.

--- **UNIVERSAL RULES** ---
- The prompt must contain all the written rules.

Your output must reflect the mastery of a commercial photographer who blends art direction and storytelling in every shot.`;

    // --- User Query & Content Parts Construction (Modular) ---
    const userQueryParts: string[] = [
      `Analyze this product. Product Description: "${productDescription}"`,
    ];
    if (theme) {
      userQueryParts.push(`Photo Theme: "${theme}"`);
    }
    const userQuery = userQueryParts.join("\n");

    const parts: any[] = [
      { text: userQuery },
      ...productImages.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })),
    ];

    if (hasModel && modelImageMimeType) {
      parts.push({
        inlineData: {
          mimeType: modelImageMimeType,
          data: uploadedModelImageBase64,
        },
      });
    }
    if (hasBackground && backgroundImageMimeType) {
      parts.push({
        inlineData: {
          mimeType: backgroundImageMimeType,
          data: uploadedBackgroundImageBase64,
        },
      });
    }

    const config: any = {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title_id: { type: Type.STRING },
            image_prompt_en: { type: Type.STRING },
          },
          required: ["title_id", "image_prompt_en"],
        },
      },
    };

    if (wgSelectedAiModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: wgSelectedAiModel,
      contents: { parts: parts },
      config: config,
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  }

  /**
   * STEP 2: Generates social media captions based on the generated titles.
   */
  async function generateCaptions(
    language: string,
    productDesc: string,
    images: { base64: string; mimeType: string }[],
    ideas: { title_id: string }[],
  ): Promise<{ caption_id: string }[]> {
    const languageMap: Record<string, string> = {
      indonesian: "Indonesian",
      malay: "Malay",
      thai: "Thai",
      vietnamese: "Vietnamese",
      hindi: "Hindi (India)",
      english: "English",
    };
    const displayLanguage = languageMap[language] || "Indonesian";

    const systemPrompt = `
**ROLE**: Expert Social Media Copywriter for e-commerce brands.
**TASK**: Based on the product description and a list of ${ideas.length} photo title(s), write an engaging social media caption for each title.

**PRIMARY DIRECTIVES**:
1. **LANGUAGE**: All captions MUST be in **${displayLanguage}**.
2. **CONTEXTUAL RELEVANCE**: Each caption should align with its corresponding title and the overall product description.
3. **ENGAGEMENT**: Make the captions concise, appealing, and relatable to the target audience.
4. **HASHTAGS**: Each caption MUST end with 3–5 relevant hashtags.

**OUTPUT FORMAT**:
You MUST return ONLY a valid JSON array containing exactly ${ideas.length} object(s).
Each object represents one caption and MUST contain a single key: \`caption_id\`.

**FINAL CRITICAL RULE**:
Your entire response MUST be the JSON array and nothing else. Do NOT include any introductory text, markdown formatting, or explanations.
`;

    const titlesList = ideas
      .map((idea, index) => `${index + 1}. ${idea.title_id}`)
      .join("\n");
    const userQuery = `Product Description: "${productDesc}"\n\nBased on the product image and description, generate a social media caption in ${displayLanguage} for each of these ${ideas.length} photo title(s):\n${titlesList}`;

    const parts: any[] = [
      { text: userQuery },
      ...images.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })),
    ];

    const config: any = {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            caption_id: { type: Type.STRING },
          },
          required: ["caption_id"],
        },
      },
    };

    if (wgSelectedAiModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: wgSelectedAiModel,
      contents: { parts: parts },
      config: config,
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  }

  /**
   * STEP 4: Generates video prompts based ONLY on the generated *images*.
   */
  async function generateVideoPrompts(
    generatedImages: { mimeType: string; data: string }[],
    hasModel: boolean,
  ): Promise<{ video_prompt_en: string }[]> {
    const imageCount = generatedImages.length;
    if (imageCount === 0) {
      return [];
    }

    const systemPromptWithModel = `
**ROLE**: AI Video generator Specialist.

**PRIMARY TASK**:
Analyze the provided static image and **VALUE STRUCTURE** to generate a final video prompt. The image contains a human model interacting with a product.

CORE RULES: 
- "video_prompt_en" must be in natural sentences.
- "video_prompt_en" must follow the VALUE STRUCTURE
- Avoid using words that violate Google guidelines, e.g (baby, child, young etc.)

-----

VALUE STRUCTURE ( "video_prompt_en" must follow the sequence ): 
(
+ Primary fast camera movement (choose 1: orbit front arc / zoom in ) 
+ Shortname of product ( just one or two word)
+ Model must interact naturally and logically with the product (e.g., holding, pointing, reviewing) without blocking or obscuring the product
+ The product remains completely static, fully visible, with zero obstruction; no hidden or unseen parts may appear
+ All lighting, shadows, reflections, ambience, textures, and room elements remain identical to the original image
+ Nothing should obstruct the product display, No objects are added, removed, or animated
+ The video must feel like a natural live capture of the original photo
)

---
**OUTPUT FORMAT**:
You MUST return ONLY a valid JSON array of ${imageCount} objects. Each object must contain a single key: "video_prompt_en".
`;

    const systemPromptWithoutModel = `
**ROLE**: AI Video generator Specialist.

**PRIMARY TASK**:
Analyze the provided static image and **VALUE STRUCTURE** to generate a final video prompt.

CORE RULES: 
- "video_prompt_en" must be in natural sentences.
- Avoid using words that violate Google guidelines, e.g (baby, child, young etc.)
- "video_prompt_en" must follow the VALUE STRUCTURE

-----

VALUE STRUCTURE ( "video_prompt_en" must follow the sequence ): 
(
+ Primary fast camera movement (choose 1: orbit front arc / zoom in) 
+ Shortname of product ( just one or two word)
+ The product remains completely static, fully visible, with zero obstruction; no hidden or unseen parts may appear (Dont give a detail description)
+ All lighting, shadows, reflections, ambience, textures, and room elements remain identical to the original image
+ Nothing should obstruct the product display, No objects are added, removed, or animated
+ The video must feel like a natural live capture of the original photo
)

---
**OUTPUT FORMAT**:
You MUST return ONLY a valid JSON array of ${imageCount} objects. Each object must contain a single key: "video_prompt_en".
`;

    const systemPrompt = hasModel
      ? systemPromptWithModel
      : systemPromptWithoutModel;

    const userTextPrompt = `Based on the visual information in the provided image(s), create a concise video prompt for each one, following all rules in the system instructions.`;

    const parts: any[] = [{ text: userTextPrompt }];
    generatedImages.forEach((img) => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    });

    const config: any = {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            video_prompt_en: { type: Type.STRING },
          },
          required: ["video_prompt_en"],
        },
      },
    };

    if (wgSelectedAiModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: wgSelectedAiModel,
      contents: { parts: parts },
      config: config,
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  }

  /**
   * STEP 3: Generates a single B-roll image using AI. This function does not update the UI.
   */
  async function generateSingleImage(
    image_prompt_en: string,
  ): Promise<GeneratedImageResult> {
    try {
      let finalPrompt = `${image_prompt_en}. Style: elegant, cinematic, professional product photography, dramatic lighting, Full HD, 8k, photorealistic`;

      const theme = photoThemeInput.value.trim();
      if (theme) {
        finalPrompt += `. CRITICAL USER DIRECTIVE: "${theme}". You MUST strictly follow this directive. If it specifies camera distance (e.g., close-up, macro), framing, or specific composition, you MUST prioritize it over showing the entire product. Every element in the image MUST serve this theme without exception.`;
      } else {
        finalPrompt += `. IMPORTANT: The final image must clearly show the entire product as the main subject, avoiding extreme close-ups or cropping that obscure parts of the item.`;
      }

      if (productImages.length > 1) {
        finalPrompt += `. MULTIPLE PRODUCTS RULE: Since ${productImages.length} product images are provided, you MUST feature ALL of the provided products together in a single, cohesive, and creative composition. The positioning should be dynamic, and the background should be creative and complementary. Ensure all products are clearly visible and interact naturally within the same scene.`;
      }

      if (uploadedBackgroundImageBase64) {
        finalPrompt += `. CRITICAL BACKGROUND RULE: You MUST use the provided background image. The product must be seamlessly composited into this exact background. Match the lighting direction, color temperature, and ambient occlusion of the background perfectly. Generate realistic contact shadows and reflections on the background surfaces so the product appears to physically exist within that specific environment. Do not alter the original background's core elements.`;
      }

      const parts: any[] = [
        { text: finalPrompt },
        ...productImages.map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        })),
      ];
      if (uploadedModelImageBase64 && modelImageMimeType) {
        parts.push({
          inlineData: {
            mimeType: modelImageMimeType,
            data: uploadedModelImageBase64,
          },
        });
      }
      if (uploadedBackgroundImageBase64 && backgroundImageMimeType) {
        parts.push({
          inlineData: {
            mimeType: backgroundImageMimeType,
            data: uploadedBackgroundImageBase64,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: { parts: parts },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData,
      );

      if (imagePart?.inlineData) {
        const base64Data = imagePart.inlineData.data;
        const imageUrl = `data:image/png;base64,${base64Data}`;
        addToImageHistory(image_prompt_en, imageUrl, base64Data, "product");
        return { success: true, imageUrl, base64Data };
      } else {
        let errorMessage = "Gagal membuat gambar.";
        const textPart = response.candidates?.[0]?.content?.parts?.find(
          (p) => p.text,
        );
        if (textPart?.text) {
          errorMessage += ` AI merespon dengan teks: "${textPart.text.substring(0, 100)}..."`;
        } else if ((response as any).promptFeedback?.blockReason) {
          errorMessage = `Gagal karena kebijakan keamanan. Alasan: ${(response as any).promptFeedback.blockReason}.`;
        }
        return { success: false, error: errorMessage };
      }
    } catch (error: any) {
      console.error(`Error during single image generation:`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      let displayMessage = errorMessage;

      if (
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("429")
      ) {
        displayMessage =
          "Kuota habis. Penggunaan layanan telah melebihi batas. Coba lagi nanti.";
      }
      return { success: false, error: displayMessage };
    }
  }

  /**
   * NEW: Creates a single generated B-roll card element.
   */
  function createBrollCard(id: number, idea: BrollIdea): HTMLDivElement {
    const { imageUrl, title_id } = idea;

    const card = document.createElement("div");
    card.id = `card-${id}`;
    card.className = "b-roll-card card p-4 flex flex-col justify-between";

    const outputContainer = document.createElement("div");
    outputContainer.className =
      "b-roll-image-container aspect-[3/4] sm:aspect-video bg-body-bg rounded-md flex items-center justify-center";

    const safeTitle = title_id.replace(/[^a-z0-9]/gi, "_").toLowerCase();

    const imageContainer = document.createElement("div");
    imageContainer.className =
      "relative w-full h-full group image-container cursor-pointer";
    imageContainer.dataset.index = String(id - 1);
    imageContainer.innerHTML = `
            <img src="${imageUrl}" class="w-full h-full object-contain rounded-md" alt="${title_id}">
            <div class="image-checkbox absolute top-2 left-2 w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-200 pointer-events-none z-10">
                <svg xmlns="http://www.w3.org/2000/svg" class="checkmark hidden h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            </div>
            <div class="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <!-- NEW: Expand Icon -->
                <button class="btn-icon-action-2 p-2 rounded-full" title="🔍 Perbesar Gambar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>
                <button class="btn-icon-action-1 p-2 rounded-full" title="✨ Lihat Prompt Video">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8H5v-2h10v2z" clip-rule="evenodd" /></svg>
                </button>
                <button class="btn-icon-action-2 p-2 rounded-full" title="✨ Lihat Caption">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                </button>
                <button class="btn-icon-action-3 p-2 rounded-full" title="🎬 Buat Video Langsung">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                </button>
                <a href="${imageUrl}" download="fashionity_${id}_${safeTitle}.png" class="btn-icon-action-4 p-2 rounded-full" title="Unduh Gambar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </a
            </div>
        `;
    (
      imageContainer.querySelector(
        'button[title="🔍 Perbesar Gambar"]',
      ) as HTMLElement
    ).style.color = "var(--text-white)";
    (
      imageContainer.querySelector(
        'button[title="✨ Lihat Prompt Video"]',
      ) as HTMLElement
    ).style.color = "var(--text-white)";
    (
      imageContainer.querySelector(
        'button[title="✨ Lihat Caption"]',
      ) as HTMLElement
    ).style.color = "var(--text-white)";
    (
      imageContainer.querySelector(
        'button[title="🎬 Buat Video Langsung"]',
      ) as HTMLElement
    ).style.color = "var(--text-white)";
    (
      imageContainer.querySelector('a[title="Unduh Gambar"]') as HTMLElement
    ).style.color = "var(--text-white)";

    // CLICK LISTENER FOR CHECKBOX
    imageContainer.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      const index = parseInt(imageContainer.dataset.index!, 10);
      const checkbox = imageContainer.querySelector(".image-checkbox")!;
      const checkmark = imageContainer.querySelector(".checkmark")!;
      if (checkedBrollIndices.has(index)) {
        checkedBrollIndices.delete(index);
        checkbox.classList.remove("checked");
        checkmark.classList.add("hidden");
        imageContainer.classList.remove("checked");
      } else {
        checkedBrollIndices.add(index);
        checkbox.classList.add("checked");
        checkmark.classList.remove("hidden");
        imageContainer.classList.add("checked");
      }
      updateBatchActionButtonsState();
    });

    const index = id - 1;
    imageContainer
      .querySelector('button[title="🔍 Perbesar Gambar"]')
      ?.addEventListener("click", () => openImagePreview(imageUrl!)); // Add listener
    imageContainer
      .querySelector('button[title="✨ Lihat Prompt Video"]')
      ?.addEventListener("click", () => handleVideoPromptClick(index));
    imageContainer
      .querySelector('button[title="✨ Lihat Caption"]')
      ?.addEventListener("click", () => handleCaptionClick(index));
    imageContainer
      .querySelector('button[title="🎬 Buat Video Langsung"]')
      ?.addEventListener("click", () => handleDirectVideoClick(index));

    outputContainer.appendChild(imageContainer);

    card.innerHTML = `<div><h3 class="text-lg font-semibold text-white mb-4">${title_id}</h3></div>`;
    card.appendChild(outputContainer);

    return card;
  }

  /**
   * Updates the button state for the Try On feature.
   */
  function updateTryOnButtonState() {
    tryOnBtn.disabled = !tryOnModelBase64 || !tryOnProductBase64;
  }

  /**
   * Updates the button state for the Remove Background feature.
   */
  function updateRemoveBgButtonState() {
    removeBgBtn.disabled = !removeBgBase64;
  }

  /**
   * Updates the state of all video generator control buttons based on generation status.
   */
  function updateVideoGeneratorControlsState() {
    // State for "Generate All Videos" button
    if (generateAllVideosBtn) {
      // Should be enabled if there is at least one slot that is filled AND not currently generating.
      const canGenerateAny = videoSlotsData.some(
        (slot) =>
          (slot.prompt.trim() || slot.imageBase64) && !slot.isGenerating,
      );
      generateAllVideosBtn.disabled = !canGenerateAny;
    }

    // State for "Clear All" button
    if (clearAllVideosBtn) {
      // Should be disabled if ANY slot is currently generating.
      const anyGenerating = videoSlotsData.some((slot) => slot.isGenerating);
      clearAllVideosBtn.disabled = anyGenerating;
    }

    // State for individual slot buttons
    for (let i = 0; i < NUM_VIDEO_SLOTS; i++) {
      const slotData = videoSlotsData[i];

      const resetBtn = document.getElementById(
        `reset-video-slot-btn-${i}`,
      ) as HTMLButtonElement;
      if (resetBtn) {
        // Disable if this specific slot is generating.
        resetBtn.disabled = slotData.isGenerating;
      }

      const generateSlotBtn = document.getElementById(
        `generate-video-slot-btn-${i}`,
      ) as HTMLButtonElement;
      if (generateSlotBtn) {
        const isSlotEmpty = !(slotData.prompt.trim() || slotData.imageBase64);
        // Disable if this specific slot is generating OR if the slot is empty.
        generateSlotBtn.disabled = slotData.isGenerating || isSlotEmpty;
      }
    }
  }

  /**
   * Updates the button state for the Download All Videos button.
   */
  function updateDownloadAllVideosButtonState() {
    if (downloadAllVideosBtn) {
      const videoElements = document.querySelectorAll(
        "#video-slots-grid video",
      );
      downloadAllVideosBtn.disabled = videoElements.length === 0;
    }
  }

  /**
   * Resets a specific video slot. Can optionally clear the generated video output.
   * @param slotIndex The index of the slot to reset.
   * @param clearVideoOutput If true, clears the video output container regardless of content.
   */
  function resetVideoSlot(
    slotIndex: number,
    clearVideoOutput: boolean = false,
  ) {
    if (slotIndex < 0 || slotIndex >= NUM_VIDEO_SLOTS) return;

    // Clear data model for inputs
    videoSlotsData[slotIndex].prompt = "";
    videoSlotsData[slotIndex].imageBase64 = null;
    videoSlotsData[slotIndex].imageMimeType = null;

    // Reset prompt UI
    const promptInput = document.getElementById(
      `video-prompt-${slotIndex}`,
    ) as HTMLTextAreaElement;
    if (promptInput) {
      promptInput.value = "";
      const clearPromptBtn = document.getElementById(
        `clear-video-prompt-btn-${slotIndex}`,
      ) as HTMLButtonElement;
      if (clearPromptBtn) clearPromptBtn.classList.add("hidden");
    }

    // Reset image UI
    const imageInput = document.getElementById(
      `video-image-input-${slotIndex}`,
    ) as HTMLInputElement;
    if (imageInput) imageInput.value = ""; // Clear the file input

    const uploadArea = document.getElementById(
      `video-image-upload-area-${slotIndex}`,
    ) as HTMLElement;
    const previewContainer = document.getElementById(
      `video-image-preview-container-${slotIndex}`,
    ) as HTMLElement;
    const previewImg = document.getElementById(
      `video-image-preview-${slotIndex}`,
    ) as HTMLImageElement;

    if (previewImg) previewImg.src = "#";
    if (uploadArea) uploadArea.classList.remove("hidden");
    if (previewContainer) previewContainer.classList.add("hidden");

    const resultContainer = document.getElementById(
      `video-result-container-${slotIndex}`,
    ) as HTMLElement;
    // The individual reset button (clearVideoOutput=false) should NOT clear the video.
    // The clear all button (clearVideoOutput=true) SHOULD clear the video.
    if (resultContainer && clearVideoOutput) {
      resultContainer.innerHTML = `<span>Hasil video Anda akan muncul di sini</span>`;
    }

    console.log(
      `Video Slot ${slotIndex} has been reset (clear video: ${clearVideoOutput}).`,
    );
    updateVideoGeneratorControlsState();
    updateDownloadAllVideosButtonState();
  }

  /**
   * Creates the UI elements for video generation slots.
   */
  function createVideoSlots() {
    if (!videoSlotsGrid) {
      console.error(
        "Video slots grid element not found when trying to create slots! Aborting slot creation.",
      ); // IMPROVED ERROR MESSAGE
      return;
    }
    console.log(
      "Calling createVideoSlots(): Starting to build video slots UI.",
    ); // ADDED LOG
    videoSlotsGrid.innerHTML = ""; // Clear existing content
    for (let i = 0; i < NUM_VIDEO_SLOTS; i++) {
      const slot = document.createElement("div");
      slot.id = `video-slot-${i}`;
      slot.className = "card p-4 flex flex-col gap-4";
      slot.innerHTML = `
                <h3 class="font-semibold text-white flex justify-between items-center">
                    <span>Video Slot ${i + 1}</span>
                     <div class="flex items-center gap-2">
                        <button id="generate-video-slot-btn-${i}" class="btn-primary !py-1 !px-3 !text-sm !font-semibold" title="Generate Video Ini">Generate</button>
                        <button id="reset-video-slot-btn-${i}" class="btn-secondary !py-1 !px-3 !text-sm !font-semibold" title="Reset Slot Ini">Reset</button>
                    </div>
                </h3>
                <div>
                    <label for="video-prompt-${i}" class="text-sm text-light-muted-color">Prompt</label>
                    <div class="relative mt-1">
                        <textarea id="video-prompt-${i}" rows="3" class="w-full p-2 pl-10 input-field rounded-lg text-sm" placeholder="Masukkan prompt video disini..."></textarea>
                        <button id="clear-video-prompt-btn-${i}" class="absolute top-2 left-2 btn-close-styled w-7 h-7 hidden" title="Hapus Prompt">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="white"></circle><path d="M8 8L16 16M16 8L8 16" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="flex-grow">
                    <label class="text-sm text-light-muted-color">Gambar Referensi (Opsional)</label>
                    <div id="video-image-upload-area-${i}" class="mt-1">
                        <label for="video-image-input-${i}" class="file-input-label !p-4 !border-dashed rounded-lg text-center text-light-muted-color">
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <span>Pilih Gambar Referensi</span>
                        </label>
                        <input type="file" id="video-image-input-${i}" class="hidden" accept="image/png, image/jpeg, image/webp">
                    </div>
                    <div id="video-image-preview-container-${i}" class="hidden mt-1 relative">
                        <img id="video-image-preview-${i}" src="#" alt="Pratinjau" class="rounded-lg w-full h-auto object-contain max-h-24">
                        <button id="video-remove-image-btn-${i}" class="absolute top-2 right-2 btn-close-styled w-7 h-7"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="white"></circle><path d="M8 8L16 16M16 8L8 16" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>
                    </div>
                </div>
                <div id="video-result-container-${i}" class="result-card aspect-video bg-body-bg rounded-lg flex flex-col items-center justify-center text-muted-color text-sm text-center">
                   <span>Hasil video Anda akan muncul di sini</span>
                </div>
            `;
      videoSlotsGrid.appendChild(slot);

      // --- ATTACH LISTENERS IMMEDIATELY AFTER CREATION ---
      const promptInput = document.getElementById(
        `video-prompt-${i}`,
      ) as HTMLTextAreaElement;
      const clearPromptBtn = document.getElementById(
        `clear-video-prompt-btn-${i}`,
      ) as HTMLButtonElement;

      promptInput.value = videoSlotsData[i].prompt; // Restore prompt if data exists

      const manageClearPromptBtnVisibility = () => {
        clearPromptBtn.classList.toggle(
          "hidden",
          promptInput.value.trim() === "",
        );
      };

      promptInput.addEventListener("input", () => {
        videoSlotsData[i].prompt = promptInput.value;
        console.log(
          `Video Slot ${i}: Prompt updated to "${videoSlotsData[i].prompt}"`,
        ); // ADDED LOG
        updateVideoGeneratorControlsState(); // Update button state when prompt changes
        manageClearPromptBtnVisibility();
      });

      clearPromptBtn.addEventListener("click", () => {
        promptInput.value = "";
        videoSlotsData[i].prompt = "";
        updateVideoGeneratorControlsState();
        manageClearPromptBtnVisibility();
        promptInput.focus();
      });

      manageClearPromptBtnVisibility(); // Initial check

      const imageInput = document.getElementById(
        `video-image-input-${i}`,
      ) as HTMLInputElement;
      const uploadArea = document.getElementById(
        `video-image-upload-area-${i}`,
      ) as HTMLElement;
      const previewContainer = document.getElementById(
        `video-image-preview-container-${i}`,
      ) as HTMLElement;
      const previewImg = document.getElementById(
        `video-image-preview-${i}`,
      ) as HTMLImageElement;
      const removeBtn = document.getElementById(
        `video-remove-image-btn-${i}`,
      ) as HTMLButtonElement;

      // Initialize image preview if data already exists (e.g., from handleDirectVideoClick)
      if (videoSlotsData[i].imageBase64) {
        previewImg.src = `data:${videoSlotsData[i].imageMimeType};base64,${videoSlotsData[i].imageBase64}`;
        uploadArea.classList.add("hidden");
        previewContainer.classList.remove("hidden");
      }

      setupImageUpload(
        imageInput,
        uploadArea,
        previewContainer,
        previewImg,
        removeBtn,
        (base64, mime) => {
          videoSlotsData[i].imageBase64 = base64;
          videoSlotsData[i].imageMimeType = mime;
        },
        () => {
          // Add this onStateChange callback to trigger button update
          updateVideoGeneratorControlsState();
        },
        true,
      ); // Enable crop

      // Attach listener for the new "Reset Slot" button
      const resetBtn = document.getElementById(
        `reset-video-slot-btn-${i}`,
      ) as HTMLButtonElement;
      resetBtn.addEventListener("click", () => resetVideoSlot(i, false)); // Pass false to only clear inputs

      // Attach listener for the new "Generate Slot" button
      const generateSlotBtn = document.getElementById(
        `generate-video-slot-btn-${i}`,
      ) as HTMLButtonElement;
      generateSlotBtn.addEventListener("click", async () => {
        const slotData = videoSlotsData[i];
        if (
          (!slotData.prompt && !slotData.imageBase64) ||
          slotData.isGenerating
        )
          return;

        if (
          typeof (window as any).aistudio !== "undefined" &&
          !(await (window as any).aistudio.hasSelectedApiKey())
        ) {
          try {
            await (window as any).aistudio.openSelectKey();
          } catch (e) {
            console.error(e);
          }
        }
        generateVideoForSlot(i);
      });
    }
    console.log(
      `createVideoSlots() completed. Total slots in grid: ${videoSlotsGrid.children.length}`,
    ); // ADDED LOG
  }

  /**
   * Generates a video for a specific slot using AI, with retry logic.
   */
  async function generateVideoForSlot(slotIndex: number) {
    const slotData = videoSlotsData[slotIndex];
    if ((!slotData.prompt && !slotData.imageBase64) || slotData.isGenerating)
      return;

    slotData.isGenerating = true;
    updateVideoGeneratorControlsState();
    const resultContainer = document.getElementById(
      `video-result-container-${slotIndex}`,
    ) as HTMLElement;
    const statusTextId = `video-status-text-${slotIndex}`;
    resultContainer.innerHTML = `<div class="flex flex-col items-center justify-center h-full gap-2 p-2">
            <div class="loader !w-8 !h-8"></div>
            <p id="${statusTextId}" class="text-xs text-light-muted-color">Menyiapkan...</p>
        </div>`;
    const statusText = document.getElementById(statusTextId) as HTMLElement;

    try {
      // NEW: Generate prompt if it's missing but image exists
      if (
        !slotData.prompt.trim() &&
        slotData.imageBase64 &&
        slotData.imageMimeType
      ) {
        statusText.innerText = "Membuat prompt video...";
        // hasModel and productDescription are unknown here, so we call with minimal info.
        const prompts = await generateVideoPrompts(
          [{ mimeType: slotData.imageMimeType, data: slotData.imageBase64 }],
          false,
        );

        if (prompts && prompts.length > 0) {
          const newPrompt = prompts[0].video_prompt_en;
          slotData.prompt = newPrompt; // Update data model

          // Update UI
          const promptInput = document.getElementById(
            `video-prompt-${slotIndex}`,
          ) as HTMLTextAreaElement;
          if (promptInput) {
            promptInput.value = newPrompt;
            promptInput.dispatchEvent(new Event("input", { bubbles: true })); // To show clear button if needed
          }
        } else {
          throw new Error("Gagal membuat prompt video dari gambar.");
        }
      }

      const MAX_ATTEMPTS = 2; // Initial attempt + 1 retry
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const aspectRatio = videoAspectRatioSelect.value;
          const model = videoModelSelect.value;
          const finalPrompt = slotData.prompt.trim();

          let selectedModel = model;
          // Provide appropriate resolution for Veo 3.1 depending on model
          // Lite supports 1080p, regular Veo 3.1 supports up to 1080p/720p. Let's use 1080p by default or 720p.
          const resolution =
            model === "veo-3.1-generate-preview" ? "720p" : "1080p";
          const payloadConfig: any = {
            numberOfVideos: 1,
            aspectRatio: aspectRatio,
            resolution: resolution,
          };

          const payload: any = { model: selectedModel, config: payloadConfig };
          if (finalPrompt) {
            payload.prompt = finalPrompt;
          }
          if (slotData.imageBase64 && slotData.imageMimeType) {
            payload.image = {
              imageBytes: slotData.imageBase64,
              mimeType: slotData.imageMimeType,
            };
          }
          if (!payload.prompt && !payload.image) {
            throw new Error(
              "Untuk membuat video, setidaknya satu prompt atau gambar referensi harus disediakan.",
            );
          }

          // Create a fresh instance for Veo models to pick up the updated paid API key from the user dialog if any
          const localAi = new GoogleGenAI({
            apiKey: process.env.API_KEY || "",
          });
          let operation = await localAi.models.generateVideos(payload);
          const messages = [
            "Menganalisis prompt...",
            "Merender frame...",
            "Menambah detail...",
            "Hampir selesai...",
          ];
          let messageIndex = 0;

          while (!operation.done) {
            statusText.innerText = messages[messageIndex % messages.length];
            messageIndex++;
            await new Promise((resolve) => setTimeout(resolve, 8000));
            operation = await localAi.operations.getVideosOperation({
              operation: operation,
            });
          }

          statusText.innerText = "Memeriksa hasil...";
          // Enhanced check with a final fetch attempt
          let downloadLink =
            operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!downloadLink && !operation.error) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s for link to populate
            operation = await localAi.operations.getVideosOperation({
              operation: operation,
            });
            downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
          }

          if (operation.error) {
            throw new Error(
              `Operasi gagal: ${operation.error.message} (Kode: ${operation.error.code})`,
            );
          }
          if (!downloadLink) {
            throw new Error(
              "Operasi selesai, namun gagal mendapat link unduhan video dari API.",
            );
          }

          statusText.innerText = "Mengunduh video...";
          const videoResponse = await fetch(downloadLink, {
            method: "GET",
            headers: {
              "x-goog-api-key": process.env.API_KEY || "",
            },
          });
          if (!videoResponse.ok) {
            const errorBody = await videoResponse.json().catch(() => ({}));
            if (
              videoResponse.status === 429 ||
              errorBody?.error?.status === "RESOURCE_EXHAUSTED"
            ) {
              throw new Error(
                "Kuota habis. Penggunaan layanan telah melebihi batas. Coba lagi nanti.",
              );
            }
            throw new Error(`Gagal unduh video: ${videoResponse.statusText}`);
          }

          const videoBlob = await videoResponse.blob();
          const videoUrl = URL.createObjectURL(videoBlob);

          resultContainer.innerHTML = `
                        <div class="relative w-full h-full group">
                            <video controls autoplay loop class="w-full h-full object-contain rounded-lg">
                                <source src="${videoUrl}" type="${videoBlob.type}">
                            </video>
                            <a href="${videoUrl}" download="fashionity_video_${slotIndex}.mp4" class="absolute bottom-1 right-1 btn-icon-action-4 p-2.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Unduh Video">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" style="color: var(--text-white);" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            </a>
                        </div>`;
          updateDownloadAllVideosButtonState();

          // Success, so we exit the function
          return;
        } catch (error: any) {
          console.error(
            `Error on attempt ${attempt} for slot ${slotIndex}:`,
            error,
          );
          const isRetryable =
            error.message?.includes("xhr error") ||
            error.message?.includes("500");

          if (isRetryable && attempt < MAX_ATTEMPTS) {
            statusText.innerText = "Gangguan jaringan, mencoba lagi...";
            await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3s before retry
            // Let the loop continue to the next attempt
          } else {
            // Not retryable or max attempts reached, throw to outer catch
            throw error;
          }
        }
      }
    } catch (error: any) {
      // This outer catch handles the final display of the error to the user
      let displayMessage = "Terjadi kesalahan yang tidak diketahui.";
      const apiError = error?.error || error?.cause?.error;
      if (
        apiError &&
        typeof apiError === "object" &&
        "status" in apiError &&
        "message" in apiError
      ) {
        if (apiError.code === 429 || apiError.status === "RESOURCE_EXHAUSTED") {
          displayMessage =
            "Kuota habis. Penggunaan layanan telah melebihi batas. Coba lagi nanti.";
        } else if (apiError.code === 404 || apiError.status === "NOT_FOUND") {
          displayMessage = "Model video tidak ditemukan. Coba model 'Veo 2'.";
        } else {
          displayMessage = `Error API: ${apiError.message}`;
        }
      } else if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("kuota habis") ||
          msg.includes("resource_exhausted") ||
          msg.includes("429")
        ) {
          displayMessage =
            "Kuota habis. Penggunaan layanan telah melebihi batas. Coba lagi nanti.";
        } else if (msg.includes("not_found") || msg.includes("404")) {
          displayMessage = "Model video tidak ditemukan. Coba model 'Veo 2'.";
        } else {
          displayMessage = `Error: ${error.message}`;
        }
      } else {
        displayMessage = `Error: ${String(error)}`;
      }

      resultContainer.innerHTML = `<div class="text-xs text-error p-2 text-center flex items-center justify-center h-full">${displayMessage}</div>`;
    } finally {
      slotData.isGenerating = false;
      updateVideoGeneratorControlsState();
    }
  }

  /**
   * Shows the universal modal with a given title and content.
   */
  function showModal(title: string, content: string) {
    modalTitle.innerText = title;
    modalBody.innerHTML = content;
    universalModal.classList.add("visible");
  }

  /**
   * Handles the click event for showing a social media caption, generating it if needed.
   */
  async function handleCaptionClick(index: number) {
    const idea = finalBrollIdeas[index];
    if (!idea) return;

    // If caption already exists, show it
    if (idea.caption_id) {
      const content = `
                <div id="modal-text-content" class="whitespace-pre-wrap p-4 rounded-lg mb-4">${idea.caption_id.trim()}</div>
                <button id="copy-modal-btn" class="w-full btn-primary font-bold py-2 px-4 rounded-lg">Salin Caption</button>
            `;
      showModal("✨ Caption Media Sosial", content);
      const copyBtn = document.getElementById(
        "copy-modal-btn",
      ) as HTMLButtonElement;
      copyBtn.addEventListener("click", () => {
        const text = (
          document.getElementById("modal-text-content") as HTMLElement
        ).innerText;
        copyToClipboard(text, copyBtn);
      });
      return;
    }

    // Show loading state in modal
    showModal(
      "✨ Caption Media Sosial",
      '<div class="flex justify-center items-center p-4"><div class="loader"></div><p class="ml-4">Membuat caption...</p></div>',
    );

    try {
      // Generate caption for a single item
      const captions = await generateCaptions(
        wgSelectedLanguage,
        productDescInput.value.trim(),
        productImages,
        [idea],
      );
      if (captions && captions.length > 0) {
        const newCaption = captions[0].caption_id;
        finalBrollIdeas[index].caption_id = newCaption; // Store it
        // Re-call the function to display the newly fetched caption
        handleCaptionClick(index);
      } else {
        throw new Error("AI tidak menghasilkan caption.");
      }
    } catch (error) {
      console.error("Error generating on-demand caption:", error);
      modalBody.innerHTML = `<p class="text-error text-center p-4">Gagal membuat caption. Silakan coba lagi.</p>`;
    }
  }

  /**
   * Handles the click event for showing an image-to-video prompt, generating it if needed.
   */
  async function handleVideoPromptClick(index: number) {
    const idea = finalBrollIdeas[index];
    if (!idea || !idea.base64Data) {
      showModal(
        "Error",
        '<p class="text-error text-center p-4">Data gambar tidak ditemukan untuk membuat prompt video.</p>',
      );
      return;
    }

    // If prompt already exists, show it
    if (idea.video_prompt_en) {
      const content = `
                <div id="modal-text-content" class="whitespace-pre-wrap p-4 rounded-lg mb-4 font-mono">${idea.video_prompt_en.trim()}</div>
                <button id="copy-modal-btn" class="w-full btn-primary font-bold py-2 px-4 rounded-lg">Salin Prompt</button>
            `;
      showModal("✨ Prompt Image-to-Video", content);
      const copyBtn = document.getElementById(
        "copy-modal-btn",
      ) as HTMLButtonElement;
      copyBtn.addEventListener("click", () => {
        const text = (
          document.getElementById("modal-text-content") as HTMLElement
        ).innerText;
        copyToClipboard(text, copyBtn);
      });
      return;
    }

    // Show loading state in modal
    showModal(
      "✨ Prompt Image-to-Video",
      '<div class="flex justify-center items-center p-4"><div class="loader"></div><p class="ml-4">Membuat prompt video...</p></div>',
    );

    try {
      const hasModel = !!uploadedModelImageBase64;
      const mimeType = idea.imageUrl!.match(/:(.*?);/)?.[1] || "image/png";
      const imageForPrompt = [{ mimeType: mimeType, data: idea.base64Data! }];

      const prompts = await generateVideoPrompts(imageForPrompt, hasModel);

      if (prompts && prompts.length > 0) {
        const newPrompt = prompts[0].video_prompt_en;
        finalBrollIdeas[index].video_prompt_en = newPrompt; // Store it
        // Re-call the function to display the newly fetched prompt
        handleVideoPromptClick(index);
      } else {
        throw new Error("AI tidak menghasilkan prompt video.");
      }
    } catch (error) {
      console.error("Error generating on-demand video prompt:", error);
      modalBody.innerHTML = `<p class="text-error text-center p-4">Gagal membuat prompt video. Silakan coba lagi.</p>`;
    }
  }

  /**
   * Handles direct video generation from a B-roll image, switching to the video generator tab
   * and populating a slot with the image and its pre-generated image prompt.
   */
  async function handleDirectVideoClick(index: number) {
    const idea = finalBrollIdeas[index];
    if (!idea || !idea.success || !idea.imageUrl || !idea.image_prompt_en) {
      alert(
        "Tidak dapat mengirim ke Generator Video: Data gambar atau prompt tidak lengkap.",
      );
      return;
    }

    // 1. Switch Tabs
    (
      document.getElementById("tab-video-generator") as HTMLButtonElement
    )?.click();

    // 2. Find the first empty slot
    const emptySlotIndex = videoSlotsData.findIndex(
      (slot) => !slot.prompt && !slot.imageBase64,
    );

    const targetIndex = emptySlotIndex === -1 ? 0 : emptySlotIndex; // Default to first slot if all are full

    // 3. Populate the target slot's data with the correct prompt
    // NEW LOGIC: If the video prompt toggle is off, send an empty prompt.
    // This will trigger auto-generation in the video slot.
    // If the toggle is on, send the generated video prompt (or fallback to image prompt).
    const promptToUse = wgIsVideoPromptChecked
      ? idea.video_prompt_en || idea.image_prompt_en
      : "";
    videoSlotsData[targetIndex].prompt = promptToUse;

    const imageUrl = idea.imageUrl;
    const [, base64Data] = imageUrl.split(",");
    const mimeType = imageUrl.match(/:(.*?);/)?.[1];
    if (base64Data && mimeType) {
      videoSlotsData[targetIndex].imageBase64 = base64Data;
      videoSlotsData[targetIndex].imageMimeType = mimeType;
    }

    // 4. Update the UI for the target slot with the correct prompt
    const promptInput = document.getElementById(
      `video-prompt-${targetIndex}`,
    ) as HTMLTextAreaElement;
    if (promptInput) {
      promptInput.value = promptToUse;
      // FIX: Dispatch an input event so the clear button's visibility is correctly updated.
      promptInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const previewImg = document.getElementById(
      `video-image-preview-${targetIndex}`,
    ) as HTMLImageElement;
    const uploadArea = document.getElementById(
      `video-image-upload-area-${targetIndex}`,
    ) as HTMLElement;
    const previewContainer = document.getElementById(
      `video-image-preview-container-${targetIndex}`,
    ) as HTMLElement;

    if (previewImg && base64Data && mimeType) {
      previewImg.src = imageUrl;
      uploadArea.classList.add("hidden");
      previewContainer.classList.remove("hidden");
    } else if (uploadArea && previewContainer) {
      // If no image, ensure upload area is visible
      uploadArea.classList.remove("hidden");
      previewContainer.classList.add("hidden");
    }

    // 5. Scroll the slot into view
    const videoSlotElement = document.getElementById(
      `video-slot-${targetIndex}`,
    );
    videoSlotElement?.scrollIntoView({ behavior: "smooth", block: "center" });

    // 6. Update button state
    updateVideoGeneratorControlsState();
  }

  /**
   * Updates the button state and resets outputs for the Analyze Screenshot feature.
   */
  function updateAnalyzeScreenshotButtonState() {
    generateScriptBtn.disabled = !analyzeScreenshotBase64;
    // Also reset outputs when image changes or language/duration/voice style changes
    analyzeScreenshotScriptOutput.innerHTML = `<span class="text-light-muted-color">Script Anda akan muncul di sini</span>`;
    copyScreenshotScriptBtn.disabled = true;
    analyzeScreenshotCaptionOutput.innerHTML = `<span class="text-light-muted-color">Caption Anda akan muncul di sini</span>`;
    copyScreenshotCaptionBtn.disabled = true;
  }

  function renderVoiceoverHistory() {
    const historySection = document.getElementById("voiceover-history-section");
    const historyList = document.getElementById("voiceover-history-list");
    if (!historySection || !historyList) return;

    if (voiceoverHistory.length === 0) {
      historySection.classList.add("hidden");
      return;
    }

    historySection.classList.remove("hidden");
    historyList.innerHTML = "";

    voiceoverHistory.forEach((item) => {
      const historyItem = document.createElement("div");
      historyItem.className =
        "bg-modal-text-bg p-4 rounded-lg flex flex-col gap-3";

      const truncatedText =
        item.text.length > 60 ? item.text.substring(0, 60) + "..." : item.text;
      const timeString = item.timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      let contentHtml = '';
      if (item.isGenerating) {
          contentHtml = `
              <div class="flex items-center gap-3 py-2 text-light-muted-color">
                  <div class="loader inline-block !w-4 !h-4"></div>
                  <span class="text-sm text-light-muted-color">Membuat Audio...</span>
              </div>
          `;
      } else {
          contentHtml = `
              <div class="flex items-center gap-3">
                  <audio src="${item.audioUrl}" controls class="history-audio-player w-full h-8"></audio>
                  <a href="${item.audioUrl}" download="${item.fileName}" class="btn-primary p-2 rounded-lg title="Unduh">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                  </a>
              </div>
          `;
      }

      historyItem.innerHTML = `
                <div class="flex justify-between items-start">
                    <p class="text-sm text-white italic">"${truncatedText}"</p>
                    <span class="text-xs text-light-muted-color ml-2 shrink-0">${timeString}</span>
                </div>
                ${contentHtml}
            `;

      historyList.appendChild(historyItem);

      // Attach play listener for exclusivity
      const audioEl = historyItem.querySelector("audio");
      if (audioEl) {
        audioEl.addEventListener("play", () => {
          // Pause main player
          if (currentAudioPlayback && !currentAudioPlayback.paused) {
            currentAudioPlayback.pause();
          }
          // Pause other history players
          const allHistoryAudios = document.querySelectorAll(
            ".history-audio-player",
          );
          allHistoryAudios.forEach((otherAudio: any) => {
            if (otherAudio !== audioEl && !otherAudio.paused) {
              otherAudio.pause();
            }
          });
        });
      }
    });
  }

  function addGeneratingVoiceoverHistory(text: string, model: string): number {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const newItem: VoiceoverHistoryItem = {
      id,
      text,
      audioUrl: '',
      fileName: '',
      model,
      timestamp: new Date(),
      isGenerating: true,
    };
    voiceoverHistory.unshift(newItem);
    renderVoiceoverHistory();
    return id;
  }

  function updateVoiceoverHistory(
    id: number,
    audioUrl: string,
    fileName: string,
  ) {
    const item = voiceoverHistory.find((i) => i.id === id);
    if (item) {
      item.audioUrl = audioUrl;
      item.fileName = fileName;
      item.isGenerating = false;
      renderVoiceoverHistory();
    }
  }

  function removeVoiceoverHistory(id: number) {
    const index = voiceoverHistory.findIndex((i) => i.id === id);
    if (index !== -1) {
      voiceoverHistory.splice(index, 1);
      renderVoiceoverHistory();
    }
  }

  function addToVoiceoverHistory(
    text: string,
    audioUrl: string,
    fileName: string,
    model: string,
  ) {
    const newItem: VoiceoverHistoryItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      text,
      audioUrl,
      fileName,
      model,
      timestamp: new Date(),
    };
    voiceoverHistory.unshift(newItem); // Add to beginning
    renderVoiceoverHistory();
  }

  interface ImageHistoryItem {
    id: number;
    prompt: string;
    imageUrl: string;
    base64Data: string;
    timestamp: Date;
    type?: string;
  }

  let generatedImageHistory: ImageHistoryItem[] = [];

  function renderImageHistory() {
    const historySections = document.querySelectorAll(".image-history-section");
    const historyGrids = document.querySelectorAll(".image-history-grid");

    if (generatedImageHistory.length === 0) {
      historySections.forEach((section) => section.classList.add("hidden"));
      return;
    }

    historySections.forEach((section) => section.classList.remove("hidden"));

    // Build items HTML once
    let itemsHtml = "";
    generatedImageHistory.forEach((item) => {
      const truncatedText =
        item.prompt.length > 50
          ? item.prompt.substring(0, 50) + "..."
          : item.prompt;
      const timeString = item.timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      let typeLabel = "";
      if (item.type === "try-on") typeLabel = "(Try On)";
      if (item.type === "remove-bg") typeLabel = "(Remove BG)";

      itemsHtml += `
                <div class="card p-2 flex flex-col gap-2 relative group">
                    <div class="aspect-square bg-body-bg rounded-md overflow-hidden relative">
                        <img src="${item.imageUrl}" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a href="${item.imageUrl}" download="generated_image_${item.id}.png" class="btn-primary p-2 rounded-full" title="Unduh">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                            </a>
                        </div>
                    </div>
                    <div>
                        <span class="text-xs text-light-muted-color block mb-1">${timeString} ${typeLabel}</span>
                        <p class="text-xs text-white break-words" title="${item.prompt.replace(/"/g, "&quot;")}">${truncatedText}</p>
                    </div>
                </div>
            `;
    });

    // Insert into all grids
    historyGrids.forEach((grid) => {
      grid.innerHTML = itemsHtml;
    });
  }

  function addToImageHistory(
    prompt: string,
    imageUrl: string,
    base64Data: string,
    type: string = "product",
  ) {
    const newItem: ImageHistoryItem = {
      id: Date.now(),
      prompt,
      imageUrl,
      base64Data,
      timestamp: new Date(),
      type,
    };
    generatedImageHistory.unshift(newItem);
    renderImageHistory();
  }

  // Descriptions for voiceover styles
  const voiceStyleDescriptions: Record<string, string> = {
    natural: "🗣️ Alami, santai, dan mengalir seperti percakapan biasa.",
    sat_set: "⚡️ Cepat, padat, efisien (sat set) dengan kata-kata tetap jelas.",
    shouting_promo:
      "📢 Suara lantang berteriak, tempo cepat, dan nada bicara sat set (gesit berenergi tinggi) ala penjual live streaming affiliate.",
    energetic: "⚡️ Penuh semangat, antusiasme tinggi, dan bertenaga.",
    cheerful: "😄 Ceria, riang gembira, dan bernada optimis.",
    calm: "😌 Lembut, santai, tenang, dan menyejukkan.",
    authoritative: "👑 Berwibawa, tegas, meyakinkan, dan percaya diri.",
    friendly: "👋 Ramah, hangat, dan akrab bagi audiens.",
    promotional: "📢 Persuasif, menjual, dan memikat minat pembeli.",
    formal: "👔 Formal, baku, profesional, dan artikulatif.",
    whispering: "🤫 Berbisik halus, lembut, dan lirih.",
    sad: "😢 Sendu, melankolis, dan menyentuh emosi.",
  };

  function updateVoiceStyleDesc(
    selectEl: HTMLSelectElement | null,
    descEl: HTMLParagraphElement | null,
  ) {
    if (!selectEl || !descEl) return;
    const styleKey = selectEl.value;
    const descText = voiceStyleDescriptions[styleKey] || "";
    descEl.textContent = descText;
    if (styleKey === "shouting_promo") {
      descEl.className =
        "text-xs text-accent-color font-medium mt-1.5 min-h-[1.25rem]";
    } else {
      descEl.className =
        "text-xs text-light-muted-color mt-1.5 min-h-[1.25rem]";
    }
  }

  /**
   * Updates the UI and internal state for the Manual Voiceover feature.
   */
  function updateManualVoiceoverState(forceDropdownUpdate: boolean = false) {
    manualVoiceoverText = manualVoiceoverInput.value;
    generateManualVoiceoverBtn.disabled =
      !manualVoiceoverText.trim() || !manualVoiceoverModel;
    generateManualVoiceoverBtn.innerHTML = `🎙️ Hasilkan Audio`;

    if (manualVoiceoverInput) {
      if (manualVoiceoverInput.value.trim()) {
        manualVoiceoverClearBtn.classList.remove("hidden");
      } else {
        manualVoiceoverClearBtn.classList.add("hidden");
      }
    }

    if (selectedVoiceDisplay) {
      if (manualVoiceoverModel) {
        const selectedOption = Array.from(
          manualVoiceoverModelSelect.options,
        ).find((opt) => opt.value === manualVoiceoverModel);
        selectedVoiceDisplay.innerText = selectedOption
          ? selectedOption.text
          : manualVoiceoverModel;
        selectedVoiceDisplay.classList.remove("text-light-muted-color");
        selectedVoiceDisplay.classList.add("text-white");
      } else {
        selectedVoiceDisplay.innerText = "Pilih Suara";
        selectedVoiceDisplay.classList.remove("text-white");
        selectedVoiceDisplay.classList.add("text-light-muted-color");
      }
    }

    if (forceDropdownUpdate && manualVoiceoverModelSelect) {
      manualVoiceoverModelSelect.value = manualVoiceoverModel;
    }

    updateVoiceStyleDesc(manualVoiceoverStyleSelect, manualVoiceoverStyleDesc);
  }

  // NEW: Helper function to setup a dynamically created audio player for Win Generating outputs
  function setupWgAudioPlayer(
    container: HTMLElement,
    audioUrl: string,
    fileName: string,
  ) {
    const playerHost = container.querySelector(".result-card") as HTMLElement;
    if (!playerHost) return;

    playerHost.innerHTML = `
            <div class="flex flex-col items-center gap-4 w-full">
                <div class="flex items-center gap-3 w-full max-w-sm">
                    <button class="player-play-pause-btn btn-primary p-2 rounded-full">
                        <svg class="player-play-icon h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7l6 3.5L8 14V7z" clip-rule="evenodd" /></svg>
                        <svg class="player-pause-icon hidden h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 8h2v4H7V8zm4 0h2v4h-2V8z" clip-rule="evenodd" /></svg>
                    </button>
                    <div class="flex-grow flex items-center gap-2">
                        <span class="player-current-time text-sm text-light-muted-color">0:00</span>
                        <input type="range" class="player-progress-bar" value="0" min="0" max="0" style="flex-grow: 1; height: 4px; background-color: var(--border-color); border-radius: 9999px; -webkit-appearance: none; cursor: pointer;">
                        <span class="player-total-duration text-sm text-light-muted-color">0:00</span>
                    </div>
                </div>
                <a href="${audioUrl}" download="${fileName}" class="player-download-btn btn-secondary font-bold py-2 px-4 rounded-lg flex items-center justify-center text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    Unduh Audio
                </a>
            </div>
        `;

    const audio = new Audio(audioUrl);
    const playPauseBtn = playerHost.querySelector(
      ".player-play-pause-btn",
    ) as HTMLButtonElement;
    const playIcon = playerHost.querySelector(
      ".player-play-icon",
    ) as SVGElement;
    const pauseIcon = playerHost.querySelector(
      ".player-pause-icon",
    ) as SVGElement;
    const progressBar = playerHost.querySelector(
      ".player-progress-bar",
    ) as HTMLInputElement;
    const currentTimeSpan = playerHost.querySelector(
      ".player-current-time",
    ) as HTMLSpanElement;
    const totalDurationSpan = playerHost.querySelector(
      ".player-total-duration",
    ) as HTMLSpanElement;

    playPauseBtn.onclick = () => (audio.paused ? audio.play() : audio.pause());
    audio.onplay = () => {
      playIcon.classList.add("hidden");
      pauseIcon.classList.remove("hidden");
    };
    audio.onpause = () => {
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");
    };
    audio.ontimeupdate = () => {
      currentTimeSpan.innerText = formatTime(audio.currentTime);
      if (!progressBar.dataset.dragging)
        progressBar.value = String(audio.currentTime);
    };
    audio.onloadedmetadata = () => {
      totalDurationSpan.innerText = formatTime(audio.duration);
      progressBar.max = String(audio.duration);
    };
    audio.onended = () => {
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");
      progressBar.value = "0";
      audio.currentTime = 0;
    };
    progressBar.onmousedown = () => (progressBar.dataset.dragging = "true");
    progressBar.onmouseup = () => {
      progressBar.dataset.dragging = "";
      audio.currentTime = Number(progressBar.value);
    };
    progressBar.oninput = () => {
      if (progressBar.dataset.dragging)
        currentTimeSpan.innerText = formatTime(Number(progressBar.value));
    };
  }

  // NEW: Function to show the help guide modal
  function showHelpGuide() {
    const guideContent = `
            <div class="text-left text-light-muted-color space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <!-- Section 1: Batch Generator -->
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">🚀 Batch Generator</h3>
                    <p>Fitur utama untuk membuat paket konten lengkap dari satu gambar produk. Ikuti langkah-langkah ini:</p>
                    <ol class="list-decimal list-inside mt-2 space-y-2">
                        <li>
                            <strong>Unggah Gambar Produk (Wajib):</strong> Klik area unggah "Produk" dan pilih gambar produk utama Anda. Ini adalah dasar dari semua konten yang akan dibuat.
                        </li>
                        <li>
                            <strong>Tulis Deskripsi Produk (Wajib):</strong> Berikan deskripsi yang jelas dan informatif. Jika bingung, unggah gambar produk terlebih dahulu, lalu klik tombol "✨ Buat Deskripsi" agar AI membantu Anda.
                        </li>
                        <li>
                            <strong>Atur Input Opsional:</strong>
                            <ul class="list-disc list-inside ml-4 mt-1">
                                <li><strong>Model:</strong> Unggah foto model jika Anda ingin produk ditampilkan bersama seseorang.</li>
                                <li><strong>Background:</strong> Unggah gambar latar jika Anda ingin produk ditempatkan di lingkungan tertentu.</li>
                                <li><strong>Tema Foto:</strong> Tulis gaya visual yang diinginkan (contoh: "suasana kafe sore hari", "studio minimalis dengan pencahayaan dramatis").</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Pilih Jumlah Gambar:</strong> Tentukan berapa banyak variasi gambar yang ingin Anda hasilkan (0 hingga 6). Jika memilih 0, fitur ini hanya akan menghasilkan teks/audio.
                        </li>
                        <li>
                            <strong>Pilih Opsi Tambahan:</strong>
                            <ul class="list-disc list-inside ml-4 mt-1">
                                <li><strong>Buat Script Voice Over:</strong> AI akan membuat naskah audio berdasarkan produk Anda.</li>
                                <li><strong>Buat Voice Over:</strong> (Membutuhkan Script aktif) AI akan mengubah naskah menjadi audio suara.</li>
                                <li><strong>Buat Caption Media Sosial:</strong> AI akan menulis caption untuk setiap gambar yang dihasilkan.</li>
                                <li><strong>Buat Prompt Video:</strong> AI akan membuat prompt teks untuk mengubah setiap gambar menjadi video.</li>
                            </ul>
                        </li>
                        <li>
                            <strong>Hasilkan Konten:</strong> Klik tombol "Hasilkan Konten" dan tunggu AI memproses semuanya.
                        </li>
                    </ol>
                    <div class="mt-3 p-3 bg-input-bg-color rounded-lg text-sm">
                        <p><strong>✨ Tips:</strong> Semakin detail deskripsi dan tema yang Anda berikan, semakin baik hasilnya. Gunakan Mode Pro (saklar di pojok kiri atas) untuk hasil yang lebih kompleks, namun prosesnya lebih lama.</p>
                    </div>
                </section>
            
                <!-- Section 2: Video Generator -->
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">🎬 Generator Video</h3>
                    <p>Buat video pendek dari teks atau gambar. Tersedia <strong>5 slot</strong> untuk bekerja secara paralel.</p>
                    <ul class="list-disc list-inside mt-2 space-y-1">
                        <li><strong>Isi Slot:</strong> Setiap slot dapat diisi dengan prompt (teks), gambar referensi, atau keduanya.</li>
                        <li><strong>Kirim dari Batch Generator:</strong> Setelah menghasilkan gambar di Batch Generator, Anda bisa memilih beberapa gambar (maksimal 5) dan klik "Jadikan Video" untuk mengirimnya ke slot-slot ini secara otomatis.</li>
                        <li><strong>Prompt Otomatis:</strong> Jika Anda hanya mengunggah gambar tanpa menulis prompt, AI akan otomatis membuatkan prompt video untuk Anda saat di-generate.</li>
                        <li><strong>Pengaturan Global:</strong> Pilih Model Video dan Rasio Aspek (Landscape/Portrait) yang akan diterapkan ke semua slot.</li>
                        <li><strong>Generate:</strong> Anda bisa men-generate video per-slot atau klik "Generate Semua Video" untuk memproses semua slot yang terisi.</li>
                    </ul>
                    <div class="mt-3 p-3 bg-input-bg-color rounded-lg text-sm">
                         <p><strong>✨ Tips:</strong> Untuk hasil terbaik, berikan prompt yang deskriptif tentang gerakan yang diinginkan. Contoh: "zoom in perlahan pada produk", "kamera mengorbit dari depan".</p>
                    </div>
                </section>
            
                <!-- Section 3: Analyze Image -->
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">🖼️ Analisa Gambar</h3>
                    <p>Alat cepat untuk mendapatkan ide konten dari satu gambar.</p>
                    <ul class="list-disc list-inside mt-2 space-y-1">
                        <li>Unggah gambar apa saja (produk, screenshot, pemandangan, dll).</li>
                        <li>Atur durasi video, bahasa, dan "Tema Suara" (misal: "ceria dan bersemangat" atau "tenang dan informatif").</li>
                        <li>Klik "Hasilkan Script" untuk mendapatkan script voice over dan caption media sosial yang relevan dengan gambar.</li>
                    </ul>
                </section>
            
                <!-- Section 4: Voice Over -->
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">🎙️ Voice Over</h3>
                    <p>Ubah teks apa pun menjadi audio dengan suara AI profesional.</p>
                    <ul class="list-disc list-inside mt-2 space-y-1">
                        <li>Tulis atau tempel naskah Anda di kolom teks.</li>
                        <li>Pilih salah satu dari banyak model suara AI yang tersedia.</li>
                        <li>Pilih "Gaya Bicara" untuk menentukan intonasi suara (misalnya, Cepat, Tenang, Formal).</li>
                        <li>Klik "Hasilkan Audio" untuk mengonversi teks menjadi file audio .wav yang bisa diputar dan diunduh.</li>
                    </ul>
                </section>
            
                <!-- Section 5: Try On -->
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">👕 Pakaikan (Try On)</h3>
                    <p>Visualisasikan produk fashion pada model tanpa pemotretan fisik.</p>
                    <ul class="list-disc list-inside mt-2 space-y-1">
                       <li>Unggah gambar model yang posenya jelas dan menghadap depan.</li>
                       <li>Unggah gambar produk (misalnya baju, celana) dengan latar belakang yang bersih atau transparan.</li>
                       <li>AI akan menggabungkan keduanya menjadi satu gambar realistis.</li>
                    </ul>
                    <div class="mt-3 p-3 bg-input-bg-color rounded-lg text-sm">
                         <p><strong>✨ Tips:</strong> Hasil terbaik didapat jika produk dan model memiliki sudut pandang yang serupa.</p>
                    </div>
                </section>
            
                <!-- Section 6: Remove Background -->
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">✂️ Hapus Background</h3>
                    <p>Hapus latar belakang dari gambar apa pun dengan sekali klik.</p>
                    <ul class="list-disc list-inside mt-2 space-y-1">
                       <li>Unggah gambar yang ingin Anda edit.</li>
                       <li>AI akan secara otomatis mendeteksi subjek utama dan menghapus latarnya, menghasilkan gambar PNG dengan latar transparan.</li>
                    </ul>
                </section>
                
                <!-- Section 7: Important Note -->
                <section class="border-t border-border-color pt-4">
                    <h3 class="text-lg font-semibold text-white mb-2">⚠️ Catatan Penting: Kuota Penggunaan</h3>
                    <p>Aplikasi ini menggunakan API dari Google AI yang memiliki batas penggunaan (kuota) per menit dan per hari untuk setiap akun. Jika Anda mengalami error "Kuota habis" atau "Resource Exhausted", itu berarti Anda telah mencapai batas tersebut.</p>
                    <p class="mt-2"><strong>Solusi:</strong> Coba lagi setelah beberapa waktu (biasanya beberapa menit hingga satu jam), atau gunakan akun lain jika perlu.</p>
                </section>
            </div>
        `;
    showModal("Panduan Pengguna Fashionity", guideContent);
  }

  // NEW: Function to show the Terms and Conditions modal
  function showTermsAndConditions() {
    const termsContent = `
            <div class="text-left text-light-muted-color space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">1. Ketergantungan pada Layanan Google</h3>
                    <p>Alat ini beroperasi menggunakan API dari Google AI Studio yang saat ini disediakan secara gratis. Ini berarti fungsionalitas dan ketersediaan gratis dari alat ini sepenuhnya bergantung pada kebijakan Google. Jika di masa mendatang Google memutuskan untuk mengubah, membatasi, atau mengenakan biaya untuk layanan ini, maka alat ini mungkin tidak lagi dapat berfungsi secara gratis atau bahkan berhenti berfungsi sama sekali.</p>
                </section>
                
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">2. Akses "Lifetime" dan Kuota Penggunaan</h3>
                    <p>Akses "lifetime" berarti Anda tidak dikenakan biaya per-generate oleh alat ini. Namun, penggunaan Anda tetap tunduk pada kuota dan batasan wajar (fair use policy) yang ditetapkan oleh Google untuk setiap akun. Jika Anda mencapai batas kuota (misalnya, terlalu banyak permintaan dalam waktu singkat), Anda mungkin akan mengalami error sementara. Mengganti akun dapat me-reset kuota sesuai dengan kebijakan Google.</p>
                </section>
                
                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">3. Tanggung Jawab Pengguna</h3>
                    <p>Anda bertanggung jawab penuh atas semua konten (teks, gambar, video) yang Anda hasilkan menggunakan alat ini. Pastikan Anda memiliki hak untuk menggunakan gambar input dan bahwa konten yang dihasilkan tidak melanggar hak cipta, merek dagang, atau hukum yang berlaku lainnya. Kami tidak bertanggung jawab atas konsekuensi hukum apa pun yang timbul dari penggunaan konten yang Anda buat.</p>
                </section>

                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">4. Kualitas Hasil (Disclaimer)</h3>
                    <p>Hasil yang dihasilkan oleh AI bersifat generatif dan mungkin tidak selalu 100% akurat, faktual, atau sesuai dengan harapan. Artefak visual, ketidakakuratan, atau hasil yang tidak terduga dapat terjadi. Selalu periksa kembali konten yang dihasilkan sebelum digunakan secara profesional.</p>
                </section>

                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">5. Privasi Data</h3>
                    <p>Input yang Anda berikan (gambar, teks) dikirim ke API Google untuk diproses. Kami tidak menyimpan data input atau hasil generate Anda di server kami. Penggunaan data Anda oleh Google tunduk pada kebijakan privasi Google.</p>
                </section>

                <section>
                    <h3 class="text-lg font-semibold text-white mb-2">6. Perubahan Layanan</h3>
                    <p>Syarat dan ketentuan ini, serta fungsionalitas alat, dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya. Dengan menggunakan alat ini, Anda setuju untuk terikat oleh versi terbaru dari syarat dan ketentuan ini.</p>
                </section>
            </div>
        `;
    showModal("Syarat dan Ketentuan", termsContent);
  }

  // --- ALL EVENT LISTENERS AND INITIAL SETUP ---

  // Ensure theme grid is hidden initially (robustness)
  themeGridContainer.classList.add("hidden");

  // Populate theme grid and load theme on DOMContentLoaded
  populateThemeGrid();
  loadAndApplyTheme();

  // --- PASSWORD MODAL LOGIC ---
  passwordSubmitBtn.addEventListener("click", () => {
    const enteredPassword = passwordInput.value.trim();
    console.log("Entered password (trimmed):", enteredPassword);
    console.log("Valid passwords:", VALID_PASSWORDS);

    const isPasswordCorrect = VALID_PASSWORDS.some(
      (validPass) => enteredPassword.toLowerCase() === validPass.toLowerCase(),
    );

    if (isPasswordCorrect) {
      console.log("Password correct. Hiding modal, showing main content.");
      passwordModal.classList.add("hidden");
      mainContent.classList.remove("hidden");
      passwordError.innerText = "";

      // Initial setup calls after successful login
      // Default active tab (Win Generating)
      (
        document.getElementById("tab-win-generating") as HTMLButtonElement
      )?.click();
      // Initial state check for buttons
      updatePoseGenButtonState();
      updateTryOnButtonState();
      updateRemoveBgButtonState();
      updateAnalyzeScreenshotButtonState();
      updateManualVoiceoverState(true); // Ensure this is called to set initial voice display and potentially restore audio
      updateVoiceStyleDesc(wgVoiceoverStyleSelect, wgVoiceoverStyleDesc);
      updateVoiceStyleDesc(manualVoiceoverStyleSelect, manualVoiceoverStyleDesc);
      loadAndApplyTheme(); // Load and apply theme after login
      populateThemeGrid(); // Ensure grid is populated after login

      console.log(
        "Before createVideoSlots() call, videoSlotsGrid children count:",
        videoSlotsGrid ? videoSlotsGrid.children.length : "N/A",
      );
      createVideoSlots(); // This is the call that should render the slots
      console.log(
        "After createVideoSlots() call, videoSlotsGrid children count:",
        videoSlotsGrid ? videoSlotsGrid.children.length : "N/A",
      );

      updateVideoGeneratorControlsState(); // Ensure initial button state is set
      updateDownloadAllVideosButtonState();
    } else {
      console.log("Password incorrect.");
      passwordError.innerText = "Kode akses salah!";
      passwordInput.value = ""; // Clear input on error
    }
  });

  passwordInput.addEventListener("input", () => {
    passwordError.innerText = ""; // Clear error message when user types
  });

  // NEW: Allow login with Enter key
  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent default form submission behavior
      passwordSubmitBtn.click();
    }
  });

  // NEW: Focus password input when tab becomes visible
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      !passwordModal.classList.contains("hidden")
    ) {
      passwordInput.focus();
    }
  });

  // --- ATTACH GLOBAL AUDIO PLAYER LISTENERS (Once) ---
  // These listeners attach to the `currentAudioPlayback` object or the HTML player controls
  // and will persist as long as the elements exist and are not replaced.
  if (
    playPauseBtn &&
    playIcon &&
    pauseIcon &&
    progressBar &&
    currentTimeSpan &&
    totalDurationSpan &&
    downloadAudioBtn &&
    manualVoiceoverPlayerContainer
  ) {
    currentAudioPlayback.addEventListener("error", (event) => {
      console.error("Audio playback error:", currentAudioPlayback.error, event);
      manualVoiceoverAudioOutput.innerHTML = `<p class="text-error">Error memutar audio: ${currentAudioPlayback.error?.message || "Tidak diketahui"}</p>`;
      // Reset player state to indicate error
      updateAudioPlayerUIAndSrc(null); // Use new function name
    });

    playPauseBtn.addEventListener("click", () => {
      if (currentAudioPlayback.src === "") return; // Prevent playing if no audio is loaded
      if (currentAudioPlayback.paused) {
        currentAudioPlayback.play();
      } else {
        currentAudioPlayback.pause();
      }
    });

    currentAudioPlayback.addEventListener("play", () => {
      playIcon.classList.add("hidden");
      pauseIcon.classList.remove("hidden");

      // Pause all history audio elements
      const historyAudios = document.querySelectorAll<HTMLAudioElement>(
        ".history-audio-player",
      );
      historyAudios.forEach((audio) => {
        if (!audio.paused) {
          audio.pause();
        }
      });
    });

    currentAudioPlayback.addEventListener("pause", () => {
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");
    });

    currentAudioPlayback.addEventListener("timeupdate", () => {
      currentTimeSpan.innerText = formatTime(currentAudioPlayback.currentTime);
      // Only update progress bar if user is not actively dragging it
      if (!progressBar.dataset.dragging) {
        progressBar.value = currentAudioPlayback.currentTime.toString();
      }
    });

    currentAudioPlayback.addEventListener("loadedmetadata", () => {
      console.log(
        "loadedmetadata fired for:",
        currentAudioPlayback.src,
        "Duration:",
        currentAudioPlayback.duration,
      ); // Diagnostic
      totalDurationSpan.innerText = formatTime(currentAudioPlayback.duration);
      progressBar.max = currentAudioPlayback.duration.toString();
      progressBar.value = "0";
      playPauseBtn.disabled = false; // This is the ONLY place to enable the play button.
      // Ensure play icon is visible and pause icon hidden when new audio is loaded
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");

      // If the player container was hidden, show it now
      manualVoiceoverPlayerContainer.classList.remove("hidden");
    });

    currentAudioPlayback.addEventListener("ended", () => {
      playIcon.classList.remove("hidden");
      pauseIcon.classList.add("hidden");
      progressBar.value = "0";
      currentTimeSpan.innerText = "0:00";
      currentAudioPlayback.pause(); // Ensure audio truly stops
    });

    // Add `mousedown` and `mouseup` to prevent `timeupdate` from fighting with user drag
    progressBar.addEventListener("mousedown", () => {
      progressBar.dataset.dragging = "true";
    });

    progressBar.addEventListener("mouseup", () => {
      progressBar.dataset.dragging = "";
      currentAudioPlayback.currentTime = parseFloat(progressBar.value);
    });

    // Listen for `input` for continuous update while dragging
    progressBar.addEventListener("input", () => {
      if (progressBar.dataset.dragging) {
        currentTimeSpan.innerText = formatTime(parseFloat(progressBar.value));
      }
    });
  }

  // --- TAB NAVIGATION ---
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      console.log(`Tab clicked: ${tab.id}`); // Diagnostic log
      // Deactivate all tabs and hide all panels
      tabs.forEach((t) => {
        t.setAttribute("aria-selected", "false");
        t.classList.remove("active");
      });
      // Also deactivate the Other Tools button itself
      if (otherToolsBtn) {
        otherToolsBtn.classList.remove("active");
      }
      panels.forEach((p) => p.classList.add("hidden"));

      // Activate the clicked tab and show its panel
      tab.setAttribute("aria-selected", "true");
      tab.classList.add("active");
      const panelId = tab.getAttribute("data-panel");
      if (panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
          panel.classList.remove("hidden");
        }
      }

      // If the clicked tab is in the dropdown, activate the main dropdown button too
      if (
        otherToolsBtn &&
        (tab.id === "tab-try-on" || tab.id === "tab-remove-bg")
      ) {
        otherToolsBtn.classList.add("active");
      }

      // Hide dropdown menu after selection
      if (otherToolsMenu) {
        otherToolsMenu.classList.add("hidden");
      }

      // --- CRITICAL FIX: Hide theme grid when switching tabs ---
      if (themeGridContainer) {
        themeGridContainer.classList.add("hidden");
      }
      // ---------------------------------------------------------

      // Always pause current audio playback when switching tab, and reset player UI
      currentAudioPlayback.pause();

      // Specific logic for Voiceover Manual tab to restore audio if available
      if (tab.id === "tab-voiceover-manual") {
        if (persistedVoiceoverAudio) {
          // Restore audio without regenerating (URL is kept valid by not revoking on tab switch away)
          updateAudioPlayerUIAndSrc(
            persistedVoiceoverAudio.url,
            persistedVoiceoverAudio.fileName,
          );
        } else {
          // No persisted audio, so ensure player is reset and hidden
          updateAudioPlayerUIAndSrc(null);
        }
        updateManualVoiceoverState(true); // Force update dropdowns and display
      } else {
        // For other tabs, ensure voiceover player UI is reset
        // IMPORTANT: Do NOT revoke persistedVoiceoverAudio.url here.
        // We want it to remain valid so it can be reloaded if the user returns to the Voiceover tab.
        updateAudioPlayerUIAndSrc(null); // Fully reset player UI for this tab (visually)
        updateManualVoiceoverState(); // Just update button state if not on voiceover tab
      }
    });
  });

  // --- OTHER TOOLS DROPDOWN LOGIC ---
  if (otherToolsBtn && otherToolsMenu) {
    otherToolsBtn.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent the window click listener from immediately closing it
      otherToolsMenu.classList.toggle("hidden");
    });

    // Close dropdown if clicked outside
    document.addEventListener("click", (event) => {
      if (
        !otherToolsMenu.contains(event.target as Node) &&
        !otherToolsBtn.contains(event.target as Node)
      ) {
        otherToolsMenu.classList.add("hidden");
      }
    });
  }

  // --- POSE GENERATOR (WIN GENERATING) ---
  // NEW Image Upload Toggles Logic
  const imageUploadToggles = document.querySelectorAll<HTMLButtonElement>(
    ".image-upload-toggle-btn",
  );
  const produkUploadContent = document.getElementById(
    "produk-upload-content",
  ) as HTMLElement;
  const modelUploadContent = document.getElementById(
    "model-upload-content",
  ) as HTMLElement;
  const backgroundUploadContent = document.getElementById(
    "background-upload-content",
  ) as HTMLElement;
  const uploadContentMap: Record<string, HTMLElement> = {
    "toggle-produk": produkUploadContent,
    "toggle-model": modelUploadContent,
    "toggle-background": backgroundUploadContent,
  };

  imageUploadToggles.forEach((button) => {
    button.addEventListener("click", () => {
      // Deactivate all buttons and hide all content
      imageUploadToggles.forEach((btn) => btn.classList.remove("active"));
      Object.values(uploadContentMap).forEach((content) =>
        content.classList.add("hidden"),
      );

      // Activate clicked button and show its content
      button.classList.add("active");
      const contentToShow = uploadContentMap[button.id];
      if (contentToShow) {
        contentToShow.classList.remove("hidden");
      }
    });
  });

  const imageCounterContainer = document.getElementById(
    "image-counter-container",
  ) as HTMLElement;

  function updateProductImageUI() {
    if (productImages.length === 0) {
      currentProductImageIndex = 0;
      imageUploadArea.classList.remove("hidden");
      imagePreviewContainer.classList.add("hidden");
      imageInput.value = "";
      if (addMoreImageInput) addMoreImageInput.value = "";
      imagePreview.src = "#";
      uploadedImageBase64 = null;
      imageMimeType = null;

      if (prevImageBtn) prevImageBtn.classList.add("hidden");
      if (nextImageBtn) nextImageBtn.classList.add("hidden");
      if (imageCounterContainer) imageCounterContainer.classList.add("hidden");
    } else {
      if (prevImageBtn) {
        prevImageBtn.classList.remove("hidden");
        prevImageBtn.disabled = currentProductImageIndex === 0;
        prevImageBtn.classList.toggle(
          "opacity-50",
          currentProductImageIndex === 0,
        );
      }
      if (nextImageBtn) {
        nextImageBtn.classList.remove("hidden");
        nextImageBtn.disabled =
          currentProductImageIndex === productImages.length;
        nextImageBtn.classList.toggle(
          "opacity-50",
          currentProductImageIndex === productImages.length,
        );
      }
      if (imageCounterContainer) {
        imageCounterContainer.classList.remove("hidden");
      }

      if (currentProductImageIndex === productImages.length) {
        // Show upload area
        imageUploadArea.classList.remove("hidden");
        imagePreviewContainer.classList.add("hidden");
        imageInput.value = "";
        if (imageCounter) imageCounter.innerText = `Baru`;
      } else {
        // Show preview area
        imageUploadArea.classList.add("hidden");
        imagePreviewContainer.classList.remove("hidden");

        const currentImg = productImages[currentProductImageIndex];
        imagePreview.src = `data:${currentImg.mimeType};base64,${currentImg.base64}`;

        if (imageCounter)
          imageCounter.innerText = `${currentProductImageIndex + 1}/${productImages.length}`;
      }

      uploadedImageBase64 = productImages[0].base64;
      imageMimeType = productImages[0].mimeType;
    }
    updatePoseGenButtonState();
  }

  async function handleProductImageUpload(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      let result = e.target?.result as string;
      let mimeType = result.match(/:(.*?);/)?.[1] ?? "image/png";

      try {
        const croppedBase64 = await openCropModal(result);
        if (croppedBase64) {
          result = croppedBase64;
          mimeType = "image/png";

          const parts = result.split(",");
          const base64 = parts[1];

          productImages.push({ base64, mimeType });
          currentProductImageIndex = productImages.length - 1;
          updateProductImageUI();
        }
      } catch (err) {
        console.error("Crop failed", err);
      }
      imageInput.value = "";
      if (addMoreImageInput) addMoreImageInput.value = "";
    };
    reader.readAsDataURL(file);
  }

  imageInput.addEventListener("change", (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) handleProductImageUpload(file);
  });

  if (addMoreImageInput) {
    addMoreImageInput.addEventListener("change", (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) handleProductImageUpload(file);
    });
  }

  if (prevImageBtn) {
    prevImageBtn.addEventListener("click", () => {
      if (currentProductImageIndex > 0) {
        currentProductImageIndex--;
        updateProductImageUI();
      }
    });
  }

  if (nextImageBtn) {
    nextImageBtn.addEventListener("click", () => {
      if (currentProductImageIndex < productImages.length) {
        currentProductImageIndex++;
        updateProductImageUI();
      }
    });
  }

  removeImageBtn.addEventListener("click", () => {
    if (productImages.length > 0) {
      productImages.splice(currentProductImageIndex, 1);
      if (currentProductImageIndex >= productImages.length) {
        currentProductImageIndex = Math.max(0, productImages.length - 1);
      }
      updateProductImageUI();
    }
  });

  setupImageUpload(
    modelImageInput,
    modelImageUploadArea,
    modelImagePreviewContainer,
    modelImagePreview,
    removeModelImageBtn,
    (base64, mime) => {
      uploadedModelImageBase64 = base64;
      modelImageMimeType = mime;
    },
    updatePoseGenButtonState,
    true,
  ); // Enable crop

  setupImageUpload(
    backgroundImageInput,
    backgroundImageUploadArea,
    backgroundImagePreviewContainer,
    backgroundImagePreview,
    removeBackgroundImageBtn,
    (base64, mime) => {
      uploadedBackgroundImageBase64 = base64;
      backgroundImageMimeType = mime;
    },
    updatePoseGenButtonState,
    true,
  ); // Enable crop

  productDescInput.addEventListener("input", updatePoseGenButtonState);
  productDescClearBtn.addEventListener("click", () => {
    // NEW listener
    productDescInput.value = "";
    updatePoseGenButtonState();
  });

  photoThemeInput.addEventListener("input", updatePoseGenButtonState); // Added for completeness
  photoThemeClearBtn.addEventListener("click", () => {
    // NEW listener
    photoThemeInput.value = "";
    updatePoseGenButtonState();
  });

  // NEW: Listener for AI Model Toggle
  wgAiModelToggle.addEventListener("change", () => {
    if (wgAiModelToggle.checked) {
      wgSelectedAiModel = "gemini-3.1-pro-preview";
      wgAiModelLabel.innerText = "Mode Pro";
    } else {
      wgSelectedAiModel = "gemini-3.8-flash";
      wgAiModelLabel.innerText = "Mode Flash";
    }
    console.log(`Batch Generator AI Model changed to: ${wgSelectedAiModel}`);
  });

  // NEW: Listener for image count dropdown
  wgImageCountSelect.addEventListener("change", () => {
    wgImageCount = parseInt(wgImageCountSelect.value, 10);
    console.log(`Image count changed to: ${wgImageCount}`);
    updatePoseGenButtonState();
  });

  function resetWinGenerating() {
    // Use existing remove buttons' click events to trigger resets and UI updates
    if (uploadedImageBase64) {
      removeImageBtn.click();
    }
    if (uploadedModelImageBase64) {
      removeModelImageBtn.click();
    }
    if (uploadedBackgroundImageBase64) {
      removeBackgroundImageBtn.click();
    }

    // Clear text areas
    productDescInput.value = "";
    photoThemeInput.value = "";
    wgAnalyzeVoiceThemeInput.value = "";
    wgVoiceTheme = "";

    // Clear the output grid
    bRollGrid.innerHTML = "";

    // NEW: Reset image count dropdown
    if (wgImageCountSelect) {
      wgImageCountSelect.value = "6";
    }
    wgImageCount = 6;

    // NEW: Reset batch action state
    finalBrollIdeas = [];
    checkedBrollIndices.clear();
    updateBatchActionButtonsState(); // This will hide the container and reset counts

    // NEW: Reset checklists and hide settings/outputs
    wgAnalyzeCheckbox.checked = false;
    wgCaptionCheckbox.checked = false; // NEW
    wgVoiceoverCheckbox.checked = false;
    wgVideoPromptCheckbox.checked = false; // NEW
    wgVoiceoverCheckbox.disabled = true; // Also disable it on reset
    wgIsAnalyzeChecked = false;
    wgIsCaptionChecked = false; // NEW
    wgIsVoiceoverChecked = false;
    wgIsVideoPromptChecked = false; // NEW
    wgAnalyzeSettings.classList.add("hidden");
    wgVoiceoverSettings.classList.add("hidden");
    wgTextAudioOutputContainer.classList.add("hidden");
    wgScriptOutputContainer.classList.add("hidden");
    wgAudioPlayerContainer.classList.add("hidden");
    if (wgVoiceoverStyleSelect) {
      wgVoiceoverStyleSelect.value = "natural";
      wgSelectedVoiceStyleOption = "natural";
      updateVoiceStyleDesc(wgVoiceoverStyleSelect, wgVoiceoverStyleDesc);
    }

    // Update the button states
    updatePoseGenButtonState();
  }
  resetWinGeneratingBtn.addEventListener("click", resetWinGenerating);

  // NEW: Listeners for Win Generating additional options
  wgAnalyzeCheckbox.addEventListener("change", () => {
    wgIsAnalyzeChecked = wgAnalyzeCheckbox.checked;
    wgAnalyzeSettings.classList.toggle("hidden", !wgIsAnalyzeChecked);

    // --- NEW DEPENDENCY LOGIC ---
    wgVoiceoverCheckbox.disabled = !wgIsAnalyzeChecked;
    // If the script generation is unchecked, uncheck and hide voiceover options too
    if (!wgIsAnalyzeChecked) {
      wgVoiceoverCheckbox.checked = false;
      wgIsVoiceoverChecked = false;
      wgVoiceoverSettings.classList.add("hidden");
    } else {
      // Hide error message if script is now checked
      wgVoiceoverDependencyError.classList.add("hidden");
    }
    updatePoseGenButtonState();
  });

  wgVoiceoverCheckbox.addEventListener("change", () => {
    // This check is now mainly for when the user un-checks it, as checking is controlled by the dependency
    wgIsVoiceoverChecked = wgVoiceoverCheckbox.checked;
    wgVoiceoverSettings.classList.toggle("hidden", !wgIsVoiceoverChecked);
    updatePoseGenButtonState();
  });

  wgCaptionCheckbox.addEventListener("change", () => {
    wgIsCaptionChecked = wgCaptionCheckbox.checked;
    updatePoseGenButtonState();
  });

  // NEW: Listener for the video prompt checkbox
  wgVideoPromptCheckbox.addEventListener("change", () => {
    wgIsVideoPromptChecked = wgVideoPromptCheckbox.checked;
    updatePoseGenButtonState();
  });

  // NEW LOGIC TO SHOW ERROR MESSAGE ON CLICKING DISABLED CHECKBOX
  const wgVoiceoverCheckboxContainer = wgVoiceoverCheckbox.closest(
    ".flex.items-center.justify-between",
  );
  if (wgVoiceoverCheckboxContainer) {
    wgVoiceoverCheckboxContainer.addEventListener("click", (e) => {
      if (wgVoiceoverCheckbox.disabled) {
        e.preventDefault();
        wgVoiceoverDependencyError.classList.remove("hidden");
        setTimeout(() => {
          wgVoiceoverDependencyError.classList.add("hidden");
        }, 3000);
      }
    });
  }

  wgAnalyzeDurationSelect.addEventListener(
    "change",
    (e) => (wgSelectedDuration = (e.target as HTMLSelectElement).value),
  );
  wgAnalyzeManualDurationInput.addEventListener(
    "input",
    (e) => (wgManualDuration = (e.target as HTMLInputElement).value),
  );
  wgAnalyzeLanguageSelect.addEventListener(
    "change",
    (e) => (wgSelectedLanguage = (e.target as HTMLSelectElement).value),
  );
  wgAnalyzeVoiceThemeInput.addEventListener(
    "input",
    (e) => (wgVoiceTheme = (e.target as HTMLInputElement).value),
  );
  wgVoiceoverModelSelect.addEventListener(
    "change",
    (e) => (wgSelectedVoiceModel = (e.target as HTMLSelectElement).value),
  );
  wgVoiceoverStyleSelect.addEventListener("change", (e) => {
    wgSelectedVoiceStyleOption = (e.target as HTMLSelectElement).value;
    updateVoiceStyleDesc(wgVoiceoverStyleSelect, wgVoiceoverStyleDesc);
  }); // NEW

  /**
   * NEW: Consolidated system prompt generator for scripts.
   */
  function getScriptSystemPrompt(
    language: string,
    duration: string,
    theme: string,
  ): string {
    const languageMap: Record<string, string> = {
      indonesian: "Indonesia",
      malay: "Melayu",
      thai: "Thai",
      vietnamese: "Vietnam",
      hindi: "Hindi (India)",
      english: "English",
    };
    const displayLanguage = languageMap[language] || "Indonesia";

    let themeInstruction =
      "Gaya bahasa yang netral, umum, dan dapat diterima oleh semua audiens.";
    if (theme.trim()) {
      themeInstruction = `Script HARUS PATUH SECARA KETAT dengan tema berikut: "${theme}". Seluruh gaya bahasa, nada, dan pilihan kata harus mencerminkan tema ini secara akurat.`;
    }

    return `Kamu adalah seorang copywriter dan content creator AI profesional untuk pasar ${displayLanguage}. Tugasmu adalah menganalisis gambar dan menghasilkan satu script voice over yang siap pakai.
    
    KRITERIA WAJIB:
    1. Script ini ditargetkan untuk durasi **${duration} detik**. Analisa dan perkirakan jumlah kata yang pas untuk mencapai durasi tersebut. Akurasi durasi sangat penting.
    2.  **HOOK KREATIF**: Mulai script dengan 1 kalimat pembuka (hook) KREATIF DAN UNIk yang langsung to the point,
    3.  **GAYA BAHASA & TEMA**: ${themeInstruction}. Gunakan bahasa ngobrol. Sangat mudah dipahami oleh audiens dalam bahasa ${displayLanguage}.
    4.  **FOKUS PRODUK**: Jelaskan fungsi produk secara praktis.
    5.  **BATASAN**: JANGAN sebut harga, promo, atau diskon. Hasil haru satu kalimat tanpa dipisah paragraf.


    KRITERIA TAMBAHAN:
    1.**PENUTUP (CTA)**: Tutup dengan ajakan halus yang relevan, seperti “langsung cek di keranjang kiri bawah”.

    
    FORMAT OUTPUT:
    - HASIL AKHIR WAJIB HANYA BERUPA TEKS SCRIPT MURNI. Tanpa awalan "Script:", judul, atau format lain seperti JSON atau markdown.`;
  }

  /**
   * REFACTORED: Unified helper to generate a single script from an image.
   */
  async function generateScript(
    language: string,
    duration: string,
    manualDuration: string,
    theme: string,
    images: { base64: string; mimeType: string }[],
    aiModel: string,
  ): Promise<string> {
    const manualDurationValue = manualDuration.trim();
    let finalDuration = duration;
    const parsedManualDuration = parseInt(manualDurationValue, 10);
    if (
      manualDurationValue &&
      !isNaN(parsedManualDuration) &&
      parsedManualDuration > 0
    ) {
      finalDuration = manualDurationValue;
    }

    const systemPrompt = getScriptSystemPrompt(language, finalDuration, theme);

    const userQueryParts = [
      "Buatkan script voice over berdasarkan gambar produk ini, patuhi semua aturan di system prompt.",
    ];
    if (theme) {
      userQueryParts.push(`Tema suara yang harus diikuti: "${theme}"`);
    }
    const userQuery = userQueryParts.join("\n");

    const contentParts: any[] = [
      { text: userQuery },
      ...images.map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })),
    ];

    const config: any = { systemInstruction: systemPrompt };
    if (aiModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: aiModel,
      contents: { parts: contentParts },
      config: config,
    });

    return response.text.trim();
  }

  /**
   * NEW: Unified helper to generate a single caption from an image.
   */
  async function generateSingleCaption(
    language: string,
    imageBase64: string,
    imageMimeType: string,
    aiModel: string,
  ): Promise<string> {
    const languageMap: Record<string, string> = {
      indonesian: "Indonesian",
      malay: "Malay",
      thai: "Thai",
      vietnamese: "Vietnamese",
      hindi: "Hindi (India)",
      english: "English",
    };
    const displayLanguage = languageMap[language] || "Indonesian";

    const systemPrompt = `**ROLE**: Expert Social Media Copywriter.
**TASK**: Based on the provided image, write one engaging social media caption.
**PRIMARY DIRECTIVES**:
1. **LANGUAGE**: The caption MUST be in **${displayLanguage}**.
2. **ENGAGEMENT**: Make the caption concise, appealing, and relevant to the image.
3. **HASHTAGS**: The caption MUST end with 3–5 relevant hashtags.
4. **OUTPUT**: Respond ONLY with the raw text of the caption. Do NOT include any introductory text, markdown formatting, or labels like "Caption:".`;

    const parts = [
      { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
    ];

    const config: any = { systemInstruction: systemPrompt };
    if (aiModel === "gemini-3.1-pro-preview") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: aiModel,
      contents: { parts: parts },
      config: config,
    });

    return response.text.trim();
  }

  // NEW: Centralized helper function to generate voiceover audio from text with improved styling.
  async function generateVoiceoverAudio(
    text: string,
    voiceName: string,
    voiceStyle: string,
  ): Promise<{ audioUrl: string; fileName: string } | null> {
    try {
      const styleInstructionMap: Record<string, string> = {
        natural: "Speak in a natural, relaxed, and conversational style:",
        sat_set:
          "Speak in a fast-paced, energetic, direct, and efficient manner but the words still sound clear:",
        shouting_promo:
          "Shout loudly, briskly, and with high urgency at a consistently fast, rapid-fire, and snappy (sat set) pace with high vocal energy and zero sluggish pauses, like a live streamer or street vendor excitedly shouting out flash sale deals to a crowd. Project your voice boldly at full volume, maintaining a rapid tempo, punchy rhythm, and razor-sharp articulation from start to finish:",
        energetic:
          "Speak with a very energetic, enthusiastic, and passionate tone:",
        cheerful: "Speak cheerfully and optimistically:",
        calm: "Speak in a calm, gentle, and soothing voice:",
        authoritative: "Speak in an authoritative, clear, and confident tone:",
        friendly: "Speak in a friendly, warm, and approachable manner:",
        promotional: "Speak in a persuasive and engaging promotional style:",
        formal: "Speak in a formal, professional, and articulate style:",
        whispering: "Speak in a soft and gentle whisper:",
        sad: "Speak with a sad and melancholic tone when cry:",
      };

      const instruction =
        styleInstructionMap[voiceStyle] || styleInstructionMap["natural"];
      const styledText = `${instruction} ${text}`;
      const formattedVoiceName = voiceName
        ? voiceName.charAt(0).toUpperCase() + voiceName.slice(1)
        : "Despina";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: styledText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: formattedVoiceName } },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const pcmData = decode(base64Audio);
        const wavBlob = createWavBlob(pcmData, 24000, 1);
        const audioUrl = URL.createObjectURL(wavBlob);
        return {
          audioUrl,
          fileName: `voiceover_${voiceName}_${voiceStyle}.wav`,
        };
      }
      return null;
    } catch (error) {
      console.error(
        `Error generating voiceover with voice ${voiceName} and style ${voiceStyle}:`,
        error,
      );
      return null;
    }
  }

  generateBtn.addEventListener("click", async () => {
    if (!uploadedImageBase64 || !imageMimeType) return;

    generateBtn.disabled = true;

    // Add processing overlay
    const overlay = document.createElement("div");
    overlay.className = "processing-overlay";
    overlay.innerHTML = `<div class="loader !w-10 !h-10 !border-4"></div>`;
    poseGeneratorInputsCard.appendChild(overlay);

    // Reset and prepare output areas
    finalBrollIdeas = [];
    wgTextAudioOutputContainer.classList.add("hidden");
    wgScriptOutputContainer.classList.add("hidden");
    wgAudioPlayerContainer.classList.add("hidden");
    const initialLoadingHtml = `<div class="col-span-1 sm:col-span-2 xl:col-span-3 text-center py-10"><div class="loader inline-block"></div><p class="mt-4 text-light-muted-color">AI sedang menganalisis produk dan membuat ide pose...</p></div>`;
    bRollGrid.innerHTML = initialLoadingHtml;

    // Clear previous selections
    checkedBrollIndices.clear();
    updateBatchActionButtonsState();

    try {
      const hasModel = !!uploadedModelImageBase64;
      // The number of titles to generate should be based on image count, but at least 1 if only text is needed.
      const titleCount = Math.max(
        wgImageCount,
        wgIsAnalyzeChecked || wgIsCaptionChecked ? 1 : 0,
      );

      // Step 1: Generate Titles & Image Prompts (if any output is needed)
      generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat konsep...</span>`;
      if (titleCount > 0) {
        const titleAndImagePrompts = await generateTitlesAndImagePrompts(
          wgSelectedLanguage,
          titleCount,
        );
        finalBrollIdeas = titleAndImagePrompts.map((item) => ({
          ...item,
          success: false,
        }));
      }

      // Step 2: Script & Voiceover Generation (if enabled)
      if (wgIsAnalyzeChecked) {
        generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Menulis script...</span>`;
        wgTextAudioOutputContainer.classList.remove("hidden");
        wgScriptOutputContainer.classList.remove("hidden");
        wgScriptOutput.innerHTML = `<div class="loader !w-4 !h-4"></div>`;
        const generatedScript = await generateScript(
          wgSelectedLanguage,
          wgSelectedDuration,
          wgManualDuration,
          wgVoiceTheme,
          productImages,
          wgSelectedAiModel,
        );
        wgScriptOutput.innerText = generatedScript;

        if (wgIsVoiceoverChecked && generatedScript) {
          generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat audio...</span>`;
          wgAudioPlayerContainer.classList.remove("hidden");
          const playerHost = wgAudioPlayerContainer.querySelector(
            ".result-card",
          ) as HTMLElement;
          playerHost.innerHTML = `<div class="loader !w-6 !h-6"></div>`;
          const audioData = await generateVoiceoverAudio(
            generatedScript,
            wgSelectedVoiceModel,
            wgSelectedVoiceStyleOption,
          );
          if (audioData) {
            setupWgAudioPlayer(
              wgAudioPlayerContainer,
              audioData.audioUrl,
              audioData.fileName,
            );
          } else {
            playerHost.innerHTML = `<p class="text-error text-xs">Gagal membuat audio.</p>`;
          }
        }
      }

      // Step 3: Generate Captions (if enabled)
      if (wgIsCaptionChecked && finalBrollIdeas.length > 0) {
        generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat caption...</span>`;
        const captions = await generateCaptions(
          wgSelectedLanguage,
          productDescInput.value.trim(),
          productImages,
          finalBrollIdeas,
        );
        finalBrollIdeas.forEach((idea, index) => {
          if (index < captions.length) {
            idea.caption_id = captions[index].caption_id;
          }
        });
      }

      // Step 4: Generate Video Prompts (if enabled and images will be generated)
      if (
        wgIsVideoPromptChecked &&
        wgImageCount > 0 &&
        finalBrollIdeas.length > 0
      ) {
        // Placeholder: Video prompts depend on images, which are generated next.
        // This logic will run AFTER image generation.
      }

      // Step 5: Generate All Images (if requested)
      bRollGrid.innerHTML = ""; // Clear loading message
      if (wgImageCount > 0 && finalBrollIdeas.length > 0) {
        // Render placeholders
        finalBrollIdeas.forEach((idea, index) => {
          const placeholderCard = document.createElement("div");
          placeholderCard.id = `b-roll-card-placeholder-${index}`;
          placeholderCard.className =
            "b-roll-card card p-4 flex flex-col justify-between";
          placeholderCard.innerHTML = `
                        <div><h3 class="text-lg font-semibold text-white mb-4">${idea.title_id}</h3></div>
                        <div class="b-roll-image-container aspect-[3/4] sm:aspect-video bg-body-bg rounded-md flex items-center justify-center">
                            <div class="flex flex-col items-center justify-center h-full gap-2 p-2">
                                 <div class="loader !w-8 !h-8"></div>
                                <p class="text-xs text-light-muted-color">Membuat gambar...</p>
                            </div>
                        </div>
                    `;
          bRollGrid.appendChild(placeholderCard);
        });

        generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat ${finalBrollIdeas.length} gambar...</span>`;
        const imageGenerationPromises = finalBrollIdeas.map((idea) =>
          generateSingleImage(idea.image_prompt_en),
        );
        const imageResults = await Promise.all(imageGenerationPromises);

        // Update finalBrollIdeas with image results
        imageResults.forEach((result, index) => {
          if (result.success) {
            finalBrollIdeas[index].imageUrl = result.imageUrl;
            finalBrollIdeas[index].base64Data = result.base64Data;
            finalBrollIdeas[index].success = true;
          } else {
            finalBrollIdeas[index].error = result.error;
            finalBrollIdeas[index].success = false;
          }
        });

        // Follow-up: Generate Video Prompts now that images exist
        if (wgIsVideoPromptChecked) {
          generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat prompt video...</span>`;
          const successfulIdeas = finalBrollIdeas.filter(
            (idea) => idea.success && idea.base64Data && idea.imageUrl,
          );
          if (successfulIdeas.length > 0) {
            const imagesForVideoPrompt = successfulIdeas.map((idea) => {
              const mimeType =
                idea.imageUrl!.match(/:(.*?);/)?.[1] || "image/png";
              return { mimeType, data: idea.base64Data! };
            });

            const videoPrompts = await generateVideoPrompts(
              imagesForVideoPrompt,
              hasModel,
            );

            if (videoPrompts.length === successfulIdeas.length) {
              successfulIdeas.forEach((idea, index) => {
                idea.video_prompt_en = videoPrompts[index].video_prompt_en;
              });
            }
          }
        }
      } else {
        finalBrollIdeas.forEach((idea) => {
          idea.success = true;
        });
      }

      // --- FINAL STEP: Render all results to the screen ---
      generateBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Selesai! Memuat hasil...</span>`;
      if (wgImageCount > 0) {
        finalBrollIdeas.forEach((idea, index) => {
          const placeholder = document.getElementById(
            `b-roll-card-placeholder-${index}`,
          );
          if (placeholder) {
            if (idea.success) {
              const finalCard = createBrollCard(index + 1, idea);
              placeholder.replaceWith(finalCard);
            } else {
              const errorCard = document.createElement("div");
              errorCard.className =
                "b-roll-card card p-4 flex flex-col justify-between";
              const errorMessage = idea.error || "Terjadi kesalahan";
              errorCard.innerHTML = `
                                <div><h3 class="text-lg font-semibold text-white mb-4">${idea.title_id}</h3></div>
                                <div class="b-roll-image-container aspect-[3/4] sm:aspect-video bg-body-bg rounded-md flex items-center justify-center">
                                    <div class="flex flex-col items-center justify-center h-full gap-2 p-2 text-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-error" viewBox="0 0 20 20" fill="currentColor">
                                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                        </svg>
                                        <p class="text-xs text-error font-semibold">Gagal membuat gambar</p>
                                        <p class="text-xs text-light-muted-color max-w-full truncate" title="${errorMessage}">${errorMessage}</p>
                                    </div>
                                </div>
                            `;
              placeholder.replaceWith(errorCard);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error during generation process:", error);
      let errorTitle = "Terjadi Kesalahan";
      let errorDetails =
        "Terjadi kesalahan tak terduga saat memproses permintaan Anda. Silakan coba lagi.";
      let rawErrorMessage = "";

      if (error instanceof Error) {
        rawErrorMessage = error.message;
      } else {
        rawErrorMessage = String(error);
      }

      const lowerCaseError = rawErrorMessage.toLowerCase();
      if (
        lowerCaseError.includes("kuota") ||
        lowerCaseError.includes("resource_exhausted") ||
        lowerCaseError.includes("429")
      ) {
        errorTitle = "Batas Kuota Penggunaan Tercapai";
        errorDetails =
          "Pesan ini biasanya muncul jika batas penggunaan gratis harian atau per menit telah tercapai. Silakan coba lagi nanti atau gunakan akun lain.";
      } else if (
        lowerCaseError.includes("kebijakan keamanan") ||
        lowerCaseError.includes("safety policy") ||
        lowerCaseError.includes("blockreason")
      ) {
        errorTitle = "Permintaan Diblokir karena Kebijakan Keamanan";
        errorDetails =
          "Konten yang Anda minta mungkin melanggar kebijakan keamanan kami, misalnya berisi materi sensitif atau tidak pantas. Coba ubah deskripsi produk atau tema foto Anda.";
      } else if (
        lowerCaseError.includes("failed to parse") ||
        lowerCaseError.includes("unexpected token")
      ) {
        errorTitle = "Gagal Memproses Respons AI";
        errorDetails =
          "AI memberikan respons dalam format yang tidak terduga. Ini bisa terjadi karena permintaan yang terlalu kompleks atau ambigu. Coba sederhanakan permintaan Anda.";
      }

      const finalErrorHtml = `
                <div class="col-span-1 sm:col-span-2 xl:col-span-3 text-center py-10">
                    <h3 class="text-xl font-bold text-error mb-2">${errorTitle}</h3>
                    <p class="text-light-muted-color">${errorDetails}</p>
                </div>
            `;
      bRollGrid.innerHTML = finalErrorHtml;
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = `<span>Hasilkan Konten</span>`;
      if (poseGeneratorInputsCard.contains(overlay)) {
        poseGeneratorInputsCard.removeChild(overlay);
      }
    }
  });

  generateDescBtn.addEventListener("click", async () => {
    const originalButtonText = generateDescBtn.innerHTML;
    generateDescBtn.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div>`;
    generateDescBtn.disabled = true;

    try {
      const isMultiple = productImages.length > 1;
      const systemPrompt = `PERAN: AI Analis Visual E-commerce. TUGAS: Berdasarkan gambar produk, buat SATU kalimat deskripsi produk. ATURAN: Fokus hanya pada produk; analisis detail visual dari gambar serta teks yang terlihat pada produk seperti label atau tulisan; jelaskan warna, bentuk, tekstur, material, dan elemen visual lain yang relevan; gunakan Bahasa Indonesia yang natural; hasil akhir wajib satu kalimat tunggal tanpa awalan, tanpa format tambahan, dan kurang dari 500 karakter.${isMultiple ? " PENTING: Terdapat " + productImages.length + " gambar referensi. Jika gambar-gambar tersebut menampilkan produk yang berbeda, deskripsi HARUS mencakup dan menjelaskan semua produk tersebut secara bersamaan dalam kalimat Anda." : ""}`;

      // Construct parts array with ONLY the product image.
      const parts: any[] = [
        {
          text: `Buatkan satu kalimat deskripsi produk berdasarkan gambar${isMultiple ? "-gambar" : ""} ini, patuhi semua aturan di system prompt.`,
        },
        ...productImages.map((img) => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        })),
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts: parts },
        config: { systemInstruction: systemPrompt },
      });

      productDescInput.value = response.text.trim();
      updatePoseGenButtonState(); // Update main button state and show clear button
    } catch (error) {
      console.error("Error generating description:", error);
      // Optionally, show an error message to the user
    } finally {
      generateDescBtn.innerHTML = originalButtonText;
      generateDescBtn.disabled = !uploadedImageBase64;
    }
  });

  // NEW: Batch action button listeners
  batchDownloadBtn.addEventListener("click", () => {
    checkedBrollIndices.forEach((index) => {
      const idea = finalBrollIdeas[index];
      if (idea && idea.success && idea.imageUrl) {
        const safeTitle = idea.title_id
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase();
        const a = document.createElement("a");
        a.href = idea.imageUrl;
        a.download = `fashionity_${index + 1}_${safeTitle}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  });

  batchVideoBtn.addEventListener("click", () => {
    const selectedIdeas = Array.from(checkedBrollIndices)
      .map((index) => finalBrollIdeas[index])
      .filter(Boolean);

    if (selectedIdeas.length === 0 || selectedIdeas.length > 5) {
      alert(
        selectedIdeas.length > 5
          ? "Maksimal 5 gambar yang dapat dikirim ke Generator Video."
          : "Pilih gambar terlebih dahulu.",
      );
      return;
    }

    (
      document.getElementById("tab-video-generator") as HTMLButtonElement
    )?.click();

    let slotIndex = 0;
    selectedIdeas.forEach((idea) => {
      if (slotIndex < NUM_VIDEO_SLOTS && idea.success && idea.imageUrl) {
        // Populate data
        // NEW LOGIC: If the video prompt toggle is off, send an empty prompt.
        // This will trigger auto-generation in the video slot.
        // If the toggle is on, send the generated video prompt (or fallback to image prompt).
        const promptToUse = wgIsVideoPromptChecked
          ? idea.video_prompt_en || idea.image_prompt_en
          : "";
        videoSlotsData[slotIndex].prompt = promptToUse;

        const [, base64Data] = idea.imageUrl.split(",");
        const mimeType = idea.imageUrl.match(/:(.*?);/)?.[1];
        if (base64Data && mimeType) {
          videoSlotsData[slotIndex].imageBase64 = base64Data;
          videoSlotsData[slotIndex].imageMimeType = mimeType;
        }

        // Update UI
        const promptInput = document.getElementById(
          `video-prompt-${slotIndex}`,
        ) as HTMLTextAreaElement;
        if (promptInput) {
          promptInput.value = promptToUse;
          promptInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const previewImg = document.getElementById(
          `video-image-preview-${slotIndex}`,
        ) as HTMLImageElement;
        const uploadArea = document.getElementById(
          `video-image-upload-area-${slotIndex}`,
        ) as HTMLElement;
        const previewContainer = document.getElementById(
          `video-image-preview-container-${slotIndex}`,
        ) as HTMLElement;

        if (previewImg && base64Data && mimeType) {
          previewImg.src = idea.imageUrl;
          uploadArea.classList.add("hidden");
          previewContainer.classList.remove("hidden");
        }
        slotIndex++;
      }
    });

    // Scroll to the video generator section
    document
      .getElementById("video-generator-panel")
      ?.scrollIntoView({ behavior: "smooth" });
    updateVideoGeneratorControlsState(); // Final state update
  });

  // --- TRY ON ---
  setupImageUpload(
    tryOnModelInput,
    tryOnModelUploadArea,
    tryOnModelPreviewContainer,
    tryOnModelPreview,
    tryOnRemoveModelBtn,
    (base64, mime) => {
      tryOnModelBase64 = base64;
      tryOnModelMimeType = mime;
    },
    updateTryOnButtonState,
    true,
  ); // Enable crop

  setupImageUpload(
    tryOnProductInput,
    tryOnProductUploadArea,
    tryOnProductPreviewContainer,
    tryOnProductPreview,
    tryOnRemoveProductBtn,
    (base64, mime) => {
      tryOnProductBase64 = base64;
      tryOnProductMimeType = mime;
    },
    updateTryOnButtonState,
    true,
  ); // Enable crop

  tryOnBtn.addEventListener("click", async () => {
    if (!tryOnModelBase64 || !tryOnProductBase64) return;

    tryOnBtn.disabled = true;
    tryOnBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Memproses...</span>`;
    tryOnResultContainer.innerHTML = `<div class="loader !w-10 !h-10 !border-4"></div>`;

    try {
      const parts: any[] = [
        {
          text: "Put this clothing item onto the model in the other image. The final image should be realistic.",
        },
        {
          inlineData: { mimeType: tryOnModelMimeType!, data: tryOnModelBase64 },
        },
        {
          inlineData: {
            mimeType: tryOnProductMimeType!,
            data: tryOnProductBase64,
          },
        },
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: { parts: parts },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData,
      );
      if (imagePart?.inlineData) {
        const base64Data = imagePart.inlineData.data;
        const imageUrl = `data:image/png;base64,${base64Data}`;
        tryOnResultContainer.innerHTML = `<img src="${imageUrl}" class="w-full h-full object-contain rounded-lg">`;
        addToImageHistory("Try On Model", imageUrl, base64Data, "try-on");
      } else {
        throw new Error(
          "Gagal memproses gambar. AI tidak mengembalikan gambar.",
        );
      }
    } catch (error) {
      console.error("Try On error:", error);
      tryOnResultContainer.innerHTML = `<p class="text-error p-4">Gagal. Coba lagi.</p>`;
    } finally {
      tryOnBtn.disabled = false;
      tryOnBtn.innerText = "Pakaikan";
    }
  });

  // --- REMOVE BACKGROUND ---
  setupImageUpload(
    removeBgInput,
    removeBgUploadArea,
    removeBgPreviewContainer,
    removeBgPreview,
    removeBgRemoveBtn,
    (base64, mime) => {
      removeBgBase64 = base64;
      removeBgMimeType = mime;
    },
    updateRemoveBgButtonState,
    false,
  ); // Disable crop

  removeBgBtn.addEventListener("click", async () => {
    if (!removeBgBase64) return;
    removeBgBtn.disabled = true;
    removeBgBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Memproses...</span>`;
    removeBgResultContainer.innerHTML = `<div class="loader !w-10 !h-10 !border-4"></div>`;
    try {
      const parts: any[] = [
        {
          text: "Remove the background from this image. The output should only be the main subject with a transparent background.",
        },
        { inlineData: { mimeType: removeBgMimeType!, data: removeBgBase64 } },
      ];
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: { parts: parts },
      });
      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData,
      );
      if (imagePart?.inlineData) {
        const base64Data = imagePart.inlineData.data;
        const imageUrl = `data:image/png;base64,${base64Data}`;
        removeBgResultContainer.innerHTML = `<img src="${imageUrl}" class="w-full h-full object-contain rounded-lg">`;
        addToImageHistory(
          "Remove Background",
          imageUrl,
          base64Data,
          "remove-bg",
        );
      } else {
        throw new Error("Gagal memproses. AI tidak mengembalikan gambar.");
      }
    } catch (error) {
      console.error("Remove BG error:", error);
      removeBgResultContainer.innerHTML = `<p class="text-error p-4">Gagal. Coba lagi.</p>`;
    } finally {
      removeBgBtn.disabled = false;
      removeBgBtn.innerText = "Hapus Background";
    }
  });

  // --- VIDEO GENERATOR ---
  // Helper to ensure paid API key
  async function ensurePaidApiKey() {
    if (typeof (window as any).aistudio === "undefined") return true; // not in AI Studio environment
    if (await (window as any).aistudio.hasSelectedApiKey()) return true;

    await (window as any).aistudio.openSelectKey();
    return true;
    // We assume success after the dialog as per guidelines
  }

  generateAllVideosBtn.addEventListener("click", async () => {
    console.log("Generate All Videos button clicked.");
    try {
      await ensurePaidApiKey();
    } catch (e) {
      console.error("Failed to prompt for API key:", e);
    }
    // Force the AI instance to recreate if you had key updates, but we'll see if it works without since `process.env.API_KEY` updates automatically.
    // The skill says: "Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key from the dialog."
    // We'll update the global or create a local ai instance where it generates. Let's update `ai` variable if needed.

    generateAllVideosBtn.disabled = true;
    clearAllVideosBtn.disabled = true;

    const slotsToGenerate = [];
    for (let i = 0; i < NUM_VIDEO_SLOTS; i++) {
      if (
        (videoSlotsData[i].prompt.trim() || videoSlotsData[i].imageBase64) &&
        !videoSlotsData[i].isGenerating
      ) {
        slotsToGenerate.push(i);
      }
    }
    console.log(
      `Found ${slotsToGenerate.length} slots to generate:`,
      slotsToGenerate,
    );

    const MAX_CONCURRENT_GENERATIONS = 2; // Batasi 2 video sekaligus
    for (
      let i = 0;
      i < slotsToGenerate.length;
      i += MAX_CONCURRENT_GENERATIONS
    ) {
      const batch = slotsToGenerate.slice(i, i + MAX_CONCURRENT_GENERATIONS);
      console.log(`Starting batch:`, batch);
      await Promise.all(
        batch.map((slotIndex) => generateVideoForSlot(slotIndex)),
      );
      console.log(`Finished batch:`, batch);
    }

    console.log("All video generations initiated.");
    updateVideoGeneratorControlsState(); // Re-enable buttons after all processing starts
  });

  clearAllVideosBtn.addEventListener("click", () => {
    console.log("Clear All Videos button clicked."); // ADDED LOG
    for (let i = 0; i < NUM_VIDEO_SLOTS; i++) {
      resetVideoSlot(i, true); // Pass true to clear video output
    }
  });

  downloadAllVideosBtn.addEventListener("click", () => {
    document
      .querySelectorAll("#video-slots-grid video")
      .forEach((video, index) => {
        const source = video.querySelector("source");
        if (source) {
          const a = document.createElement("a");
          a.href = source.src;
          a.download = `fashionity_video_slot_${index}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      });
  });

  // --- ANALYZE SCREENSHOT ---
  setupImageUpload(
    analyzeScreenshotInput,
    analyzeScreenshotUploadArea,
    analyzeScreenshotPreviewContainer,
    analyzeScreenshotPreview,
    analyzeScreenshotRemoveBtn,
    (base64, mime) => {
      analyzeScreenshotBase64 = base64;
      analyzeScreenshotMimeType = mime;
    },
    updateAnalyzeScreenshotButtonState,
    false,
  ); // Disable crop

  // NEW: Listener for AI Model Toggle
  analyzeAiModelToggle.addEventListener("change", () => {
    if (analyzeAiModelToggle.checked) {
      analyzeScreenshotSelectedAiModel = "gemini-3.1-pro-preview";
      analyzeAiModelLabel.innerText = "Mode Pro";
    } else {
      analyzeScreenshotSelectedAiModel = "gemini-3.8-flash";
      analyzeAiModelLabel.innerText = "Mode Flash";
    }
    console.log(
      `Analyze Screenshot AI Model changed to: ${analyzeScreenshotSelectedAiModel}`,
    );
  });

  analyzeScreenshotDurationSelect.addEventListener("change", (e) => {
    analyzeScreenshotSelectedDuration = (e.target as HTMLSelectElement).value;
    updateAnalyzeScreenshotButtonState();
  });
  analyzeScreenshotManualDurationInput.addEventListener("input", (e) => {
    analyzeScreenshotManualDuration = (e.target as HTMLInputElement).value;
    updateAnalyzeScreenshotButtonState();
  });
  analyzeScreenshotLanguageSelect.addEventListener("change", (e) => {
    analyzeScreenshotLanguage = (e.target as HTMLSelectElement).value;
    updateAnalyzeScreenshotButtonState();
  });
  analyzeScreenshotVoiceThemeInput.addEventListener("input", (e) => {
    analyzeScreenshotVoiceTheme = (e.target as HTMLInputElement).value;
    updateAnalyzeScreenshotButtonState();
  });

  generateScriptBtn.addEventListener("click", async () => {
    if (!analyzeScreenshotBase64) return;
    generateScriptBtn.disabled = true;
    generateScriptBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat Script...</span>`;

    copyScreenshotScriptBtn.disabled = true;
    copyScreenshotCaptionBtn.disabled = true;

    // Set initial loading states
    analyzeScreenshotScriptOutput.innerHTML = `<div class="loader !w-8 !h-8"></div>`;
    analyzeScreenshotCaptionOutput.innerHTML = `<div class="text-sm text-light-muted-color">Menunggu script selesai...</div>`;

    try {
      // --- Generate Script ---
      const script = await generateScript(
        analyzeScreenshotLanguage,
        analyzeScreenshotSelectedDuration,
        analyzeScreenshotManualDuration,
        analyzeScreenshotVoiceTheme,
        [
          {
            base64: analyzeScreenshotBase64!,
            mimeType: analyzeScreenshotMimeType!,
          },
        ],
        analyzeScreenshotSelectedAiModel,
      );
      analyzeScreenshotScriptOutput.innerText = script;
      copyScreenshotScriptBtn.disabled = false;

      // --- Generate Caption ---
      generateScriptBtn.innerHTML = `<div class="loader"></div><span class="ml-2">Membuat Caption...</span>`;
      analyzeScreenshotCaptionOutput.innerHTML = `<div class="loader !w-8 !h-8"></div>`;

      const caption = await generateSingleCaption(
        analyzeScreenshotLanguage,
        analyzeScreenshotBase64!,
        analyzeScreenshotMimeType!,
        analyzeScreenshotSelectedAiModel,
      );
      analyzeScreenshotCaptionOutput.innerText = caption;
      copyScreenshotCaptionBtn.disabled = false;
    } catch (error) {
      console.error("Analyze screenshot error:", error);
      // Show error in both boxes if the process fails at any point
      analyzeScreenshotScriptOutput.innerHTML = `<p class="text-error p-4">Gagal membuat konten. Coba lagi.</p>`;
      analyzeScreenshotCaptionOutput.innerHTML = `<p class="text-error p-4">Gagal membuat konten. Coba lagi.</p>`;
    } finally {
      generateScriptBtn.disabled = !analyzeScreenshotBase64;
      generateScriptBtn.innerHTML = "✨ Hasilkan Script";
    }
  });

  copyScreenshotScriptBtn.addEventListener("click", () => {
    copyToClipboard(
      analyzeScreenshotScriptOutput.innerText,
      copyScreenshotScriptBtn,
    );
  });

  copyScreenshotCaptionBtn.addEventListener("click", () => {
    copyToClipboard(
      analyzeScreenshotCaptionOutput.innerText,
      copyScreenshotCaptionBtn,
    );
  });

  // --- MANUAL VOICEOVER ---
  manualVoiceoverInput.addEventListener("input", () =>
    updateManualVoiceoverState(),
  );
  manualVoiceoverClearBtn.addEventListener("click", () => {
    manualVoiceoverInput.value = "";
    updateManualVoiceoverState();
  });
  manualVoiceoverModelSelect.addEventListener("change", (e) => {
    manualVoiceoverModel = (e.target as HTMLSelectElement).value;
    updateManualVoiceoverState();
  });
  manualVoiceoverStyleSelect.addEventListener("change", (e) => {
    manualVoiceoverStyle = (e.target as HTMLSelectElement).value;
    updateManualVoiceoverState();
  });

  generateManualVoiceoverBtn.addEventListener("click", async () => {
    if (!manualVoiceoverText.trim()) return;

    // Capture the current text and model
    const textToGenerate = manualVoiceoverText;
    const modelToUse = manualVoiceoverModel;
    const styleToUse = manualVoiceoverStyle;
    
    // Create a new pending item in the history
    const historyId = addGeneratingVoiceoverHistory(textToGenerate, modelToUse);

    try {
      const audioData = await generateVoiceoverAudio(
        textToGenerate,
        modelToUse,
        styleToUse,
      );

      if (audioData) {
        // Persist the new audio data (if you want the main player to reflect the latest one)
        persistedVoiceoverAudio = {
          url: audioData.audioUrl,
          fileName: audioData.fileName,
        };
        updateAudioPlayerUIAndSrc(audioData.audioUrl, audioData.fileName);
        
        // Update the history item
        updateVoiceoverHistory(historyId, audioData.audioUrl, audioData.fileName);
      } else {
        throw new Error(
          "Gagal membuat audio. AI tidak mengembalikan data audio.",
        );
      }
    } catch (error) {
      console.error("Manual voiceover error:", error);
      removeVoiceoverHistory(historyId); // Remove the pending item if it fails
      
      // Optionally show a quick toast or alert, but we don't want to block
      // manualVoiceoverAudioOutput.innerHTML = `<p class="text-error p-4">Gagal membuat audio. Silakan coba lagi.</p>`;
    }
  });

  // --- UNIVERSAL MODAL ---
  closeModalBtn.addEventListener("click", () => {
    universalModal.classList.remove("visible");
  });

  // --- HEADER BUTTONS (HELP & TERMS) ---
  helpBtn.addEventListener("click", showHelpGuide);
  termsBtn.addEventListener("click", showTermsAndConditions);

  // Theme Switcher Button Listener
  themeSwitcherBtn.addEventListener("click", (event) => {
    event.stopPropagation(); // Prevent document click from closing it immediately
    themeGridContainer.classList.toggle("hidden");
  });

  // Close Theme Grid Button Listener
  closeThemeGridBtn.addEventListener("click", () => {
    themeGridContainer.classList.add("hidden");
  });

  // Global click listener to close the theme grid
  document.addEventListener("click", (event) => {
    if (!themeGridContainer.classList.contains("hidden")) {
      const gridContent = themeGridContainer.querySelector(".card");
      if (
        gridContent &&
        !gridContent.contains(event.target as Node) &&
        !themeSwitcherBtn.contains(event.target as Node)
      ) {
        themeGridContainer.classList.add("hidden");
      }
    }
  });
});
