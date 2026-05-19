// --- App Configuration & State Management ---
const state = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  model: 'gemini-2.0-flash',
  selectedBubble: null,
  zoom: 1.0,
  imageLoaded: false,
  imageFile: null,       // Local file object if uploaded
  imageUrl: '',          // Proxied image URL if using external link
  originalWidth: 0,
  originalHeight: 0,
  isDragging: false,
  isResizing: false,
  
  // Dragging sub-state
  dragTarget: null,
  dragStartX: 0,
  dragStartY: 0,
  dragStartLeftPercent: 0,
  dragStartTopPercent: 0,
  
  // Resizing sub-state
  resizeTarget: null,
  resizeStartWidthPercent: 0,
  resizeStartHeightPercent: 0,
  resizeStartX: 0,
  resizeStartY: 0,
  
  // Default bubble style settings
  defaultStyle: {
    fontFamily: "'Comic Neue', cursive",
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#ffffff',
    backgroundOpacity: 95,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    fontStyle: 'normal',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: '#000000'
  }
};

// --- DOM Elements Cache ---
const el = {
  apiKeyInput: document.getElementById('api-key-input'),
  toggleApiKeyBtn: document.getElementById('toggle-api-key-btn'),
  apiStatusBadge: document.getElementById('api-status-badge'),
  modelSelect: document.getElementById('model-select'),
  imageUrlInput: document.getElementById('image-url-input'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  fileName: document.getElementById('file-name'),
  translateBtn: document.getElementById('translate-btn'),
  
  // Styling Controls
  fontFamilySelect: document.getElementById('font-family-select'),
  fontSizeInput: document.getElementById('font-size-input'),
  fontColorInput: document.getElementById('font-color-input'),
  bgColorInput: document.getElementById('bg-color-input'),
  bgOpacityInput: document.getElementById('bg-opacity-input'),
  textCaseSelect: document.getElementById('text-case-select'),
  toggleBold: document.getElementById('toggle-bold'),
  toggleItalic: document.getElementById('toggle-italic'),
  alignLeft: document.getElementById('align-left'),
  alignCenter: document.getElementById('align-center'),
  alignRight: document.getElementById('align-right'),
  borderWidthInput: document.getElementById('border-width-input'),
  borderColorInput: document.getElementById('border-color-input'),
  applySelectedBtn: document.getElementById('apply-selected-btn'),
  
  // Action Buttons
  addBubbleBtn: document.getElementById('add-bubble-btn'),
  clearWorkspaceBtn: document.getElementById('clear-workspace-btn'),
  exportPdfBtn: document.getElementById('export-pdf-btn'),
  
  // Workspace Components
  imageDimensions: document.getElementById('image-dimensions'),
  bubbleCount: document.getElementById('bubble-count'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  zoomResetBtn: document.getElementById('zoom-reset-btn'),
  welcomePlaceholder: document.getElementById('welcome-placeholder'),
  loadSampleBtn: document.getElementById('load-sample-btn'),
  loadingOverlay: document.getElementById('loading-overlay'),
  canvasViewport: document.getElementById('canvas-viewport'),
  workspaceContainer: document.getElementById('workspace-container'),
  mangaImage: document.getElementById('manga-image'),
  bubblesOverlay: document.getElementById('bubbles-overlay'),
  
  // JDownloader Integration Elements
  sendToJdBtn: document.getElementById('send-to-jd-btn'),
  jdPortInput: document.getElementById('jd-port-input')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initApiKey();
  initDragAndDrop();
  initWorkspaceEvents();
  initStylingControls();
  initActionButtons();
  
  // Load sample on click from welcome screen
  if (el.loadSampleBtn) {
    el.loadSampleBtn.addEventListener('click', loadSampleImage);
  }
});

// --- API Key & Settings Setup ---
function initApiKey() {
  if (state.apiKey) {
    el.apiKeyInput.value = state.apiKey;
    updateApiStatusBadge(true);
  } else {
    updateApiStatusBadge(false);
  }

  el.apiKeyInput.addEventListener('input', (e) => {
    state.apiKey = e.target.value.trim();
    localStorage.setItem('gemini_api_key', state.apiKey);
    updateApiStatusBadge(state.apiKey.length > 0);
  });

  el.toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = el.apiKeyInput.type === 'password';
    el.apiKeyInput.type = isPassword ? 'text' : 'password';
    el.toggleApiKeyBtn.querySelector('i').className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });

  el.modelSelect.addEventListener('change', (e) => {
    state.model = e.target.value;
  });
}

function updateApiStatusBadge(configured) {
  if (configured) {
    el.apiStatusBadge.className = 'status-indicator status-on';
    el.apiStatusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> API Key configurada';
  } else {
    el.apiStatusBadge.className = 'status-indicator status-off';
    el.apiStatusBadge.innerHTML = '<i class="fa-solid fa-circle"></i> API Key no configurada';
  }
}

// --- Drag & Drop Image Handling ---
function initDragAndDrop() {
  const dropZone = el.dropZone;
  
  // Click drop zone triggers file selection
  dropZone.addEventListener('click', () => el.fileInput.click());
  
  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleLocalImage(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleLocalImage(files[0]);
    }
  });
}

function handleLocalImage(file) {
  if (!file.type.startsWith('image/')) {
    alert('Por favor, selecciona una imagen válida (JPG o PNG).');
    return;
  }
  
  state.imageFile = file;
  state.imageUrl = '';
  el.imageUrlInput.value = ''; // Clear URL input since we uploaded a file
  el.fileName.textContent = `Archivo: ${file.name} (${formatBytes(file.size)})`;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    loadImageToWorkspace(e.target.result);
  };
  reader.readAsDataURL(file);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function loadSampleImage() {
  const sampleUrl = "https://cdn.readdetectiveconan.com/file/mangap/9750/10001000/019cf132-0da5-7289-8d00-313691a3d668/3.jpeg";
  el.imageUrlInput.value = sampleUrl;
  el.fileName.textContent = '';
  state.imageFile = null;
  
  // Use proxy to avoid CORS
  const proxiedUrl = `/proxy-image?url=${encodeURIComponent(sampleUrl)}`;
  loadImageToWorkspace(proxiedUrl);
}

// --- Loading image into editor workspace ---
function loadImageToWorkspace(sourceSrc) {
  showLoading(true, "Cargando imagen...");
  
  el.mangaImage.onload = () => {
    state.originalWidth = el.mangaImage.naturalWidth;
    state.originalHeight = el.mangaImage.naturalHeight;
    state.imageLoaded = true;
    
    // Update labels and controls
    el.imageDimensions.innerHTML = `<i class="fa-solid fa-expand"></i> ${state.originalWidth}x${state.originalHeight}px`;
    el.welcomePlaceholder.style.display = 'none';
    el.workspaceContainer.style.display = 'block';
    
    // Set matching container dimensions
    el.workspaceContainer.style.width = `${state.originalWidth}px`;
    el.workspaceContainer.style.height = `${state.originalHeight}px`;
    
    // Enable studio actions
    el.addBubbleBtn.disabled = false;
    el.exportPdfBtn.disabled = false;
    if (el.sendToJdBtn) {
      el.sendToJdBtn.disabled = !el.imageUrlInput.value.trim();
    }
    
    // Reset zoom and clear previous bubbles
    resetZoom();
    clearWorkspace(false); // clear bubbles, keep image
    
    showLoading(false);
  };
  
  el.mangaImage.onerror = () => {
    showLoading(false);
    alert('Error al cargar la imagen. Si es una URL externa, verifica que el enlace sea correcto y público.');
  };
  
  el.mangaImage.src = sourceSrc;
}

function showLoading(show, text = "Cargando...", subtext = "") {
  if (show) {
    el.loadingOverlay.querySelector('.loading-text').textContent = text;
    el.loadingOverlay.querySelector('.loading-subtext').textContent = subtext;
    el.loadingOverlay.style.display = 'flex';
  } else {
    el.loadingOverlay.style.display = 'none';
  }
}

// --- API Translation Flow ---
async function runTranslation() {
  if (!state.imageLoaded) {
    alert('Carga una imagen antes de traducir.');
    return;
  }
  if (!state.apiKey) {
    alert('Por favor, ingresa tu Gemini API Key en el panel de configuración.');
    return;
  }

  showLoading(true, "Analizando con Gemini AI...", "Analizando diálogos, calculando globos y traduciendo...");

  try {
    const formData = new FormData();
    formData.append('apiKey', state.apiKey);
    formData.append('model', state.model);

    if (state.imageFile) {
      formData.append('image', state.imageFile);
    } else {
      const urlToTranslate = el.imageUrlInput.value.trim();
      if (!urlToTranslate) {
        alert('Por favor especifica una URL o sube una imagen local.');
        showLoading(false);
        return;
      }
      formData.append('imageUrl', urlToTranslate);
    }

    const response = await fetch('/translate', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error desconocido en el servidor');
    }

    const data = await response.json();
    
    if (!data.blocks || data.blocks.length === 0) {
      alert('Gemini no detectó globos de texto legibles en inglés. ¡Pero puedes añadirlos manualmente usando el botón "Añadir Globo"!');
    } else {
      renderTranslatedBlocks(data.blocks);
    }
  } catch (error) {
    console.error('Error translating:', error);
    alert(`Error de Traducción: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

function renderTranslatedBlocks(blocks) {
  // Clear any existing bubbles before painting new ones
  clearWorkspace(false);
  
  blocks.forEach(block => {
    createTranslationBubble(block);
  });
  
  updateBubbleCount();
}

// --- Dynamic Bubble Creation ---
function createTranslationBubble(block = null) {
  const isNew = block === null;
  
  // Coordinates from 0 to 1000 [ymin, xmin, ymax, xmax]
  let topPercent, leftPercent, widthPercent, heightPercent;
  let englishText = '';
  let spanishText = 'TEXTO TRADUCIDO';
  
  if (isNew) {
    // Default bubble centered in workspace
    topPercent = 40;
    leftPercent = 40;
    widthPercent = 20;
    heightPercent = 12;
  } else {
    const [ymin, xmin, ymax, xmax] = block.box_2d;
    topPercent = ymin / 10;
    leftPercent = xmin / 10;
    widthPercent = (xmax - xmin) / 10;
    heightPercent = (ymax - ymin) / 10;
    englishText = block.english_text;
    spanishText = block.spanish_text;
  }

  // Build the DOM elements for the bubble
  const bubble = document.createElement('div');
  bubble.className = 'translation-bubble';
  bubble.style.top = `${topPercent}%`;
  bubble.style.left = `${leftPercent}%`;
  bubble.style.width = `${widthPercent}%`;
  bubble.style.height = `${heightPercent}%`;
  
  // Apply default styles
  applyBubbleStyleToElement(bubble, state.defaultStyle);
  
  // Text Editor Box
  const editor = document.createElement('div');
  editor.className = 'bubble-text-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = false;
  editor.textContent = state.defaultStyle.textTransform === 'uppercase' ? spanishText.toUpperCase() : spanishText;
  
  // Save original English text if present
  if (englishText) {
    bubble.dataset.english = englishText;
    
    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'bubble-tooltip';
    tooltip.textContent = `Original: "${englishText}"`;
    bubble.appendChild(tooltip);
  }
  
  // Controls overlay (Drag, Delete)
  const controls = document.createElement('div');
  controls.className = 'bubble-controls';
  
  const dragHandle = document.createElement('span');
  dragHandle.className = 'bubble-ctrl-btn';
  dragHandle.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i>';
  dragHandle.title = 'Arrastrar';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'bubble-ctrl-btn danger-btn';
  deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  deleteBtn.title = 'Eliminar globo';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deselectBubble();
    bubble.remove();
    updateBubbleCount();
  });
  
  controls.appendChild(dragHandle);
  controls.appendChild(deleteBtn);
  
  // Resizing Handle (Bottom Right)
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'bubble-resize-handle handle-se';
  
  bubble.appendChild(editor);
  bubble.appendChild(controls);
  bubble.appendChild(resizeHandle);
  
  // Attach event listeners for mouse actions
  attachBubbleEvents(bubble, editor, dragHandle, resizeHandle);
  
  // Add to overlay
  el.bubblesOverlay.appendChild(bubble);
  updateBubbleCount();
  
  if (isNew) {
    selectBubble(bubble);
    editor.focus();
    // Select all text in editor
    document.execCommand('selectAll', false, null);
  }
}

// --- Interactive Events: Drag, Resize, Select ---
function attachBubbleEvents(bubble, editor, dragHandle, resizeHandle) {
  
  // Select bubble on mousedown/click
  bubble.addEventListener('mousedown', (e) => {
    // Avoid selecting while editing text
    if (document.activeElement === editor) return;
    
    selectBubble(bubble);
    
    // Initiate Dragging if clicked on drag handle or background (not editor/resize)
    if (e.target === bubble || dragHandle.contains(e.target) || e.target === editor) {
      if (document.activeElement !== editor) {
        e.preventDefault(); // Prevent text highlights
        startDrag(bubble, e);
      }
    }
  });

  // Start Resizing
  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectBubble(bubble);
    startResize(bubble, e);
  });
  
  // Direct text edit handling
  editor.addEventListener('focus', () => {
    selectBubble(bubble);
  });
  
  editor.addEventListener('blur', () => {
    // Clean up empty lines or formatting if necessary
  });

  // Avoid drag events bubbling when typing
  editor.addEventListener('mousedown', (e) => {
    if (document.activeElement === editor) {
      e.stopPropagation();
    }
  });
}

function selectBubble(bubble) {
  if (state.selectedBubble === bubble) return;
  
  // Deselect previous
  deselectBubble();
  
  state.selectedBubble = bubble;
  bubble.classList.add('active-bubble');
  
  // Enable sidebar actions for this bubble
  el.applySelectedBtn.disabled = false;
  
  // Load bubble styles into sidebar controls
  loadStylesToSidebar(bubble);
}

function deselectBubble() {
  if (state.selectedBubble) {
    state.selectedBubble.classList.remove('active-bubble');
  }
  state.selectedBubble = null;
  el.applySelectedBtn.disabled = true;
}

// --- Draggable & Resizable Computations in Percentages ---
function startDrag(bubble, event) {
  state.isDragging = true;
  state.dragTarget = bubble;
  state.dragStartX = event.clientX;
  state.dragStartY = event.clientY;
  
  // Read current positioning in percentages
  state.dragStartLeftPercent = parseFloat(bubble.style.left) || 0;
  state.dragStartTopPercent = parseFloat(bubble.style.top) || 0;
  
  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
}

function dragMove(e) {
  if (!state.isDragging || !state.dragTarget) return;
  
  const rect = el.workspaceContainer.getBoundingClientRect();
  const deltaX = e.clientX - state.dragStartX;
  const deltaY = e.clientY - state.dragStartY;
  
  // Convert pixel offsets into percentage coordinates relative to container width/height
  const deltaLeftPercent = (deltaX / rect.width) * 100 * state.zoom;
  const deltaTopPercent = (deltaY / rect.height) * 100 * state.zoom;
  
  let newLeft = state.dragStartLeftPercent + deltaLeftPercent;
  let newTop = state.dragStartTopPercent + deltaTopPercent;
  
  // Constrain bubble within bounds (0% to 100%)
  newLeft = Math.max(0, Math.min(100 - parseFloat(state.dragTarget.style.width), newLeft));
  newTop = Math.max(0, Math.min(100 - parseFloat(state.dragTarget.style.height), newTop));
  
  state.dragTarget.style.left = `${newLeft.toFixed(3)}%`;
  state.dragTarget.style.top = `${newTop.toFixed(3)}%`;
}

function dragEnd() {
  state.isDragging = false;
  state.dragTarget = null;
  document.removeEventListener('mousemove', dragMove);
  document.removeEventListener('mouseup', dragEnd);
}

function startResize(bubble, event) {
  state.isResizing = true;
  state.resizeTarget = bubble;
  state.resizeStartX = event.clientX;
  state.resizeStartY = event.clientY;
  
  // Read current dimensions in percentages
  state.resizeStartWidthPercent = parseFloat(bubble.style.width) || 0;
  state.resizeStartHeightPercent = parseFloat(bubble.style.height) || 0;
  
  document.addEventListener('mousemove', resizeMove);
  document.addEventListener('mouseup', resizeEnd);
}

function resizeMove(e) {
  if (!state.isResizing || !state.resizeTarget) return;
  
  const rect = el.workspaceContainer.getBoundingClientRect();
  const deltaX = e.clientX - state.resizeStartX;
  const deltaY = e.clientY - state.resizeStartY;
  
  // Convert pixels to percentages
  const deltaWidthPercent = (deltaX / rect.width) * 100 * state.zoom;
  const deltaHeightPercent = (deltaY / rect.height) * 100 * state.zoom;
  
  let newWidth = state.resizeStartWidthPercent + deltaWidthPercent;
  let newHeight = state.resizeStartHeightPercent + deltaHeightPercent;
  
  // Keep dimensions within min bounds (3% of page) and max bounds
  newWidth = Math.max(3, Math.min(100 - parseFloat(state.resizeTarget.style.left), newWidth));
  newHeight = Math.max(2, Math.min(100 - parseFloat(state.resizeTarget.style.top), newHeight));
  
  state.resizeTarget.style.width = `${newWidth.toFixed(3)}%`;
  state.resizeTarget.style.height = `${newHeight.toFixed(3)}%`;
}

function resizeEnd() {
  state.isResizing = false;
  state.resizeTarget = null;
  document.removeEventListener('mousemove', resizeMove);
  document.removeEventListener('mouseup', resizeEnd);
}

// --- Global click event inside canvas to deselect ---
function initWorkspaceEvents() {
  el.canvasViewport.addEventListener('mousedown', (e) => {
    // If click is directly on viewport background, clear selection
    if (e.target === el.canvasViewport || e.target === el.workspaceContainer || e.target === el.bubblesOverlay || e.target === el.mangaImage) {
      deselectBubble();
    }
  });
  
  // Zoom Controls
  el.zoomInBtn.addEventListener('click', () => adjustZoom(0.1));
  el.zoomOutBtn.addEventListener('click', () => adjustZoom(-0.1));
  el.zoomResetBtn.addEventListener('click', resetZoom);
  
  // Translate button trigger
  el.translateBtn.addEventListener('click', runTranslation);
}

function adjustZoom(factor) {
  state.zoom = Math.max(0.2, Math.min(3.0, state.zoom + factor));
  applyZoom();
}

function resetZoom() {
  state.zoom = 1.0;
  applyZoom();
}

function applyZoom() {
  el.workspaceContainer.style.transform = `scale(${state.zoom})`;
}

// --- Typography Style Management System ---
function initStylingControls() {
  const controls = [
    el.fontFamilySelect,
    el.fontSizeInput,
    el.fontColorInput,
    el.bgColorInput,
    el.bgOpacityInput,
    el.textCaseSelect,
    el.borderWidthInput,
    el.borderColorInput
  ];
  
  // Live sync styles on control input changes
  controls.forEach(control => {
    control.addEventListener('input', () => {
      const activeStyle = getStyleFromSidebar();
      if (state.selectedBubble) {
        applyBubbleStyleToElement(state.selectedBubble, activeStyle);
      } else {
        // Save as default style for future bubbles
        state.defaultStyle = activeStyle;
      }
    });
  });
  
  // Alignment buttons toggle logic
  [el.alignLeft, el.alignCenter, el.alignRight].forEach(btn => {
    btn.addEventListener('click', () => {
      [el.alignLeft, el.alignCenter, el.alignRight].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const align = btn.dataset.align;
      if (state.selectedBubble) {
        state.selectedBubble.querySelector('.bubble-text-editor').style.textAlign = align;
      } else {
        state.defaultStyle.textAlign = align;
      }
    });
  });
  
  // Bold & Italic button toggles
  el.toggleBold.addEventListener('click', () => {
    el.toggleBold.classList.toggle('active');
    const isBold = el.toggleBold.classList.contains('active');
    
    if (state.selectedBubble) {
      state.selectedBubble.querySelector('.bubble-text-editor').style.fontWeight = isBold ? 'bold' : 'normal';
    } else {
      state.defaultStyle.fontWeight = isBold ? 'bold' : 'normal';
    }
  });

  el.toggleItalic.addEventListener('click', () => {
    el.toggleItalic.classList.toggle('active');
    const isItalic = el.toggleItalic.classList.contains('active');
    
    if (state.selectedBubble) {
      state.selectedBubble.querySelector('.bubble-text-editor').style.fontStyle = isItalic ? 'italic' : 'normal';
    } else {
      state.defaultStyle.fontStyle = isItalic ? 'italic' : 'normal';
    }
  });

  // Apply button trigger
  el.applySelectedBtn.addEventListener('click', () => {
    if (state.selectedBubble) {
      applyBubbleStyleToElement(state.selectedBubble, getStyleFromSidebar());
    }
  });
}

function getStyleFromSidebar() {
  return {
    fontFamily: el.fontFamilySelect.value,
    fontSize: parseInt(el.fontSizeInput.value) || 14,
    color: el.fontColorInput.value,
    backgroundColor: el.bgColorInput.value,
    backgroundOpacity: parseInt(el.bgOpacityInput.value) ?? 95,
    textTransform: el.textCaseSelect.value,
    fontWeight: el.toggleBold.classList.contains('active') ? 'bold' : 'normal',
    fontStyle: el.toggleItalic.classList.contains('active') ? 'italic' : 'normal',
    textAlign: document.querySelector('.toggle-btn[id^="align"].active').dataset.align || 'center',
    borderWidth: parseInt(el.borderWidthInput.value) ?? 2,
    borderColor: el.borderColorInput.value
  };
}

function loadStylesToSidebar(bubble) {
  const editor = bubble.querySelector('.bubble-text-editor');
  
  // De-structure background color and opacity
  const bgStyle = bubble.style.backgroundColor; // format like "rgba(255, 255, 255, 0.95)"
  let hexBg = '#ffffff';
  let opacity = 95;
  
  if (bgStyle.startsWith('rgba')) {
    const parts = bgStyle.match(/[\d\.]+/g);
    if (parts && parts.length === 4) {
      const r = parseInt(parts[0]);
      const g = parseInt(parts[1]);
      const b = parseInt(parts[2]);
      opacity = Math.round(parseFloat(parts[3]) * 100);
      hexBg = rgbToHex(r, g, b);
    }
  } else if (bgStyle.startsWith('rgb')) {
    const parts = bgStyle.match(/\d+/g);
    if (parts && parts.length === 3) {
      hexBg = rgbToHex(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
      opacity = 100;
    }
  }
  
  // Read typography values
  el.fontFamilySelect.value = editor.style.fontFamily || "'Comic Neue', cursive";
  el.fontSizeInput.value = parseInt(editor.style.fontSize) || 14;
  el.fontColorInput.value = rgbToHexColor(editor.style.color) || '#000000';
  el.bgColorInput.value = hexBg;
  el.bgOpacityInput.value = opacity;
  el.textCaseSelect.value = editor.style.textTransform || 'uppercase';
  
  // Set Bold toggle
  const isBold = editor.style.fontWeight === 'bold';
  el.toggleBold.className = `toggle-btn ${isBold ? 'active' : ''}`;
  
  // Set Italic toggle
  const isItalic = editor.style.fontStyle === 'italic';
  el.toggleItalic.className = `toggle-btn ${isItalic ? 'active' : ''}`;
  
  // Set alignment toggles
  const alignment = editor.style.textAlign || 'center';
  [el.alignLeft, el.alignCenter, el.alignRight].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.align === alignment);
  });
  
  // Set borders
  el.borderWidthInput.value = parseInt(bubble.style.borderWidth) ?? 2;
  el.borderColorInput.value = rgbToHexColor(bubble.style.borderColor) || '#000000';
}

function applyBubbleStyleToElement(bubble, style) {
  const editor = bubble.querySelector('.bubble-text-editor');
  
  // Apply Background style (convert hex to rgba with opacity)
  const hex = style.backgroundColor;
  const rgb = hexToRgb(hex);
  const opacityFraction = style.backgroundOpacity / 100;
  
  bubble.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacityFraction})`;
  bubble.style.border = `${style.borderWidth}px solid ${style.borderColor}`;
  bubble.style.borderRadius = style.borderWidth > 0 ? '24px' : '0px'; // pill bubble look
  
  // Apply text editor style
  editor.style.fontFamily = style.fontFamily;
  editor.style.fontSize = `${style.fontSize}px`;
  editor.style.color = style.color;
  editor.style.textTransform = style.textTransform;
  editor.style.fontWeight = style.fontWeight;
  editor.style.fontStyle = style.fontStyle;
  editor.style.textAlign = style.textAlign;
  
  // If the editor already has text and is uppercase, convert it
  if (style.textTransform === 'uppercase') {
    editor.textContent = editor.textContent.toUpperCase();
  }
}

// --- Action Buttons Actions ---
function initActionButtons() {
  el.addBubbleBtn.addEventListener('click', () => {
    createTranslationBubble();
  });
  
  el.clearWorkspaceBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres limpiar todo el espacio de trabajo? Se borrarán la imagen y las traducciones.')) {
      clearWorkspace(true);
    }
  });

  el.exportPdfBtn.addEventListener('click', exportToPDF);
  
  if (el.sendToJdBtn) {
    el.sendToJdBtn.addEventListener('click', sendToJdownloader);
  }
}

async function sendToJdownloader() {
  if (!state.imageLoaded) return;
  
  const originalUrl = el.imageUrlInput.value.trim();
  if (!originalUrl) {
    alert('No hay un enlace de imagen externo para enviar a JDownloader. Esta función requiere una URL de imagen cargada.');
    return;
  }
  
  const port = parseInt(el.jdPortInput.value) || 9666;
  showLoading(true, "Enviando a JDownloader...", "Conectando con tu cliente JDownloader local...");
  
  try {
    const response = await fetch('/send-to-jdownloader', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: originalUrl,
        port: port
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'No se pudo comunicar con JDownloader');
    }
    
    alert('¡Enlace enviado con éxito a JDownloader! Abre tu JDownloader para verificar el capturador de enlaces.');
  } catch (error) {
    console.error('Error sending to JDownloader:', error);
    alert(`Error: ${error.message}. Asegúrate de que JDownloader esté abierto en tu computadora y que la opción 'Click\'n\'Load' esté activa en los ajustes.`);
  } finally {
    showLoading(false);
  }
}

function clearWorkspace(fullClear = true) {
  el.bubblesOverlay.innerHTML = '';
  deselectBubble();
  updateBubbleCount();
  
  if (fullClear) {
    state.imageLoaded = false;
    state.imageFile = null;
    state.imageUrl = '';
    el.imageUrlInput.value = 'https://cdn.readdetectiveconan.com/file/mangap/9750/10001000/019cf132-0da5-7289-8d00-313691a3d668/3.jpeg';
    el.fileName.textContent = '';
    el.mangaImage.src = '';
    el.imageDimensions.innerHTML = '<i class="fa-solid fa-expand"></i> Sin imagen cargada';
    
    el.welcomePlaceholder.style.display = 'block';
    el.workspaceContainer.style.display = 'none';
    el.addBubbleBtn.disabled = true;
    el.exportPdfBtn.disabled = true;
    if (el.sendToJdBtn) {
      el.sendToJdBtn.disabled = true;
    }
  }
}

function updateBubbleCount() {
  const count = el.bubblesOverlay.querySelectorAll('.translation-bubble').length;
  el.bubbleCount.innerHTML = `<i class="fa-solid fa-comment-dots"></i> ${count} Globos`;
}

// --- High Quality PDF Compilation Export via canvas ---
async function exportToPDF() {
  if (!state.imageLoaded) return;
  
  showLoading(true, "Compilando PDF...", "Generando imagen de alta definición a partir de tus traducciones...");
  
  // Deselect currently active bubble to hide edit borders and handles during render capture
  const prevSelected = state.selectedBubble;
  deselectBubble();
  
  // Temporarily reset workspace zoom to 1.0 to get 100% pixel-perfect capture size
  const prevZoom = state.zoom;
  resetZoom();
  
  // Wait brief moment for layout changes to settle
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    const container = el.workspaceContainer;
    
    // Render using html2canvas. We use high DPI scale: 2 for clean rendering in print PDF
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Get actual layout sizes
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // Initialize jsPDF. Scale pixel coordinate bounds directly to match canvas sizes for pixel perfection
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [state.originalWidth, state.originalHeight]
    });
    
    // Add page image at exactly original dimensions
    pdf.addImage(imgData, 'JPEG', 0, 0, state.originalWidth, state.originalHeight);
    
    // Save PDF
    pdf.save('comicpro_traduccion.pdf');
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert(`Error al generar el PDF: ${error.message}`);
  } finally {
    // Restore states
    if (prevSelected) selectBubble(prevSelected);
    adjustZoom(prevZoom - 1.0); // restore zoom
    showLoading(false);
  }
}

// --- Helper Functions: Color Converters ---
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function rgbToHexColor(rgbString) {
  if (!rgbString) return '#000000';
  if (rgbString.startsWith('#')) return rgbString;
  
  const matches = rgbString.match(/\d+/g);
  if (!matches || matches.length < 3) return '#000000';
  
  return rgbToHex(parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2]));
}
