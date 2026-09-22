document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('video');
    const countdownEl = document.getElementById('countdown');
    const flashEl = document.getElementById('flash');
    const photoIndexEl = document.getElementById('photo-index');
    const totalSlotsText = document.getElementById('total-slots-text');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadGifBtn = document.getElementById('download-gif-btn');
    const strip = document.getElementById('booth-strip');
    const photoSlotsContainer = document.getElementById('photo-slots-container');
    const stripFooterText = document.getElementById('strip-footer-text');
    const stripDateText = document.getElementById('strip-date-text');
    const customTextInput = document.getElementById('custom-text-input');
    const layoutSelect = document.getElementById('layout-select');
    const timerSelect = document.getElementById('timer-select');
    const uploadInput = document.getElementById('upload-input');

    // Filter Sliders
    const sliderBrightness = document.getElementById('slider-brightness');
    const sliderContrast = document.getElementById('slider-contrast');
    const sliderSaturate = document.getElementById('slider-saturate');
    const valBrightness = document.getElementById('val-brightness');
    const valContrast = document.getElementById('val-contrast');
    const valSaturate = document.getElementById('val-saturate');

    // App States
    let currentFilter = 'filter-normal';
    let currentFrameColor = '#ffffff';
    let currentTemplate = 'classic';
    let currentShape = 'square';
    let maxSlots = 4;
    let timerDelay = 5;
    let photosTaken = 0;
    let stream = null;
    let defaultFooterText = 'Memorable Day';
    let retakeTargetIndex = null;
    let audioCtx = null;
    const capturedImages = [null, null, null, null];
    const isUploadedPhoto = [false, false, false, false];

    // Manual Adjust Values
    let manualAdj = { brightness: 100, contrast: 100, saturate: 100 };

    // Set Tanggal
    const today = new Date();
    stripDateText.innerText = today.toLocaleDateString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    // Audio Synth Beep & Shutter
    function playAudio(type) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            if (type === 'beep') {
                osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.1);
            } else if (type === 'shutter') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.08);
            }
        } catch (e) {}
    }

    // Inisialisasi Kamera
    async function initCamera() {
        try {
            if (stream) stream.getTracks().forEach(track => track.stop());
            
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: 'user',
                    width: { ideal: 1920, max: 3840 },
                    height: { ideal: 1080, max: 2160 }
                }
            });
            video.srcObject = stream;
        } catch (err) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                video.srcObject = stream;
            } catch (fallbackErr) {
                alert('Akses kamera ditolak atau tidak ditemukan.');
            }
        }
    }

    // Pattern Mask Heart Ukuran Lebih Besar Maksimal
    function drawHeartMask(ctx, x, y, w, h) {
        ctx.beginPath();
        
        const topY = y + h * 0.18;
        const bottomY = y + h * 0.99;
        const centerX = x + w / 2;
        
        ctx.moveTo(centerX, topY);
        
        // Sisi Kiri
        ctx.bezierCurveTo(
            x + w * 0.12, y - h * 0.18,
            x - w * 0.35, y + h * 0.40,
            centerX,      bottomY
        );
        
        // Sisi Kanan
        ctx.bezierCurveTo(
            x + w * 1.35, y + h * 0.40,
            x + w * 0.88, y - h * 0.18,
            centerX,      topY
        );

        ctx.closePath();
        ctx.clip();
    }

    // Update Live CSS Filter + Manual Adjustment
    function updateAppliedFilter() {
        video.className = `w-full h-full object-cover ${currentFilter}`;
        video.style.filter = getCombinedFilterStyle(currentFilter);

        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`canvas-${i}`);
            if (!canvas.classList.contains('hidden')) {
                const uploadedClass = isUploadedPhoto[i - 1] ? 'uploaded-frame' : '';
                const heartClass = currentShape === 'heart' ? 'heart-shape-active' : '';
                canvas.className = `w-full h-full captured-frame ${uploadedClass} ${currentFilter} ${heartClass}`;
                canvas.style.filter = getCombinedFilterStyle(currentFilter);
            }
        }
    }

    function getCombinedFilterStyle(preset) {
        const presets = {
            'filter-vintage': 'sepia(0.35) contrast(0.95) brightness(1.05) saturate(1.1)',
            'filter-bw': 'grayscale(1) contrast(1.15) brightness(1.02)',
            'filter-warm': 'saturate(1.2) sepia(0.12) brightness(1.03)',
            'filter-cool': 'hue-rotate(10deg) saturate(1.1) brightness(1.03)',
            'filter-normal': ''
        };
        const base = presets[preset] || '';
        const pro = `brightness(${manualAdj.brightness}%) contrast(${manualAdj.contrast}%) saturate(${manualAdj.saturate}%)`;
        return `${base} ${pro}`.trim();
    }

    // Sliders Filter Listener
    [sliderBrightness, sliderContrast, sliderSaturate].forEach(slider => {
        if (!slider) return;
        slider.addEventListener('input', () => {
            manualAdj.brightness = sliderBrightness.value;
            manualAdj.contrast = sliderContrast.value;
            manualAdj.saturate = sliderSaturate.value;

            if (valBrightness) valBrightness.innerText = `${manualAdj.brightness}%`;
            if (valContrast) valContrast.innerText = `${manualAdj.contrast}%`;
            if (valSaturate) valSaturate.innerText = `${manualAdj.saturate}%`;

            updateAppliedFilter();
        });
    });

    // Event Listener Unggah Foto
    uploadInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        let slotIdx = photosTaken < maxSlots ? photosTaken : 0;

        files.slice(0, maxSlots - slotIdx).forEach((file, index) => {
            const currentSlot = slotIdx + index;
            if (currentSlot >= maxSlots) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    drawUploadedImageToCanvas(img, currentSlot);
                    photosTaken = Math.max(photosTaken, currentSlot + 1);
                    photoIndexEl.innerText = photosTaken;

                    if (photosTaken >= maxSlots) {
                        finishSession();
                    } else {
                        downloadBtn.disabled = false;
                        downloadGifBtn.disabled = false;
                        showRetakeBtns();
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        uploadInput.value = '';
    });

    function drawUploadedImageToCanvas(img, slotIdx) {
        const targetCanvas = document.getElementById(`canvas-${slotIdx + 1}`);
        const ctx = targetCanvas.getContext('2d');

        const targetWidth = 1440;
        const targetHeight = 1080;
        targetCanvas.width = targetWidth;
        targetCanvas.height = targetHeight;

        const imgRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;

        let sWidth, sHeight, sx, sy;
        if (imgRatio > targetRatio) {
            sHeight = img.height;
            sWidth = img.height * targetRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = img.width;
            sHeight = img.width / targetRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        }

        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        capturedImages[slotIdx] = targetCanvas.toDataURL('image/png', 1.0);
        isUploadedPhoto[slotIdx] = true;

        const heartClass = currentShape === 'heart' ? 'heart-shape-active' : '';
        targetCanvas.className = `w-full h-full captured-frame uploaded-frame ${currentFilter} ${heartClass}`;
        targetCanvas.style.filter = getCombinedFilterStyle(currentFilter);
        targetCanvas.classList.remove('hidden');
    }

    customTextInput.addEventListener('input', (e) => {
        const text = e.target.value.trim();
        stripFooterText.innerText = text !== '' ? text : defaultFooterText;
    });

    layoutSelect.addEventListener('change', (e) => {
        maxSlots = parseInt(e.target.value);
        totalSlotsText.innerText = maxSlots;
        
        for (let i = 1; i <= 4; i++) {
            const slot = document.getElementById(`canvas-${i}`).parentElement;
            if (i <= maxSlots) {
                slot.classList.remove('hidden');
            } else {
                slot.classList.add('hidden');
            }
        }
        resetPhotobooth();
    });

    timerSelect.addEventListener('change', (e) => {
        timerDelay = parseInt(e.target.value);
    });

    function applyFrameTemplate(template) {
        strip.style.paddingTop = '';
        strip.style.paddingBottom = '';

        if (template === 'grid2x2') {
            strip.style.width = '320px';
            photoSlotsContainer.className = 'grid grid-cols-2 gap-2.5 z-0';
        } else if (template === 'polaroid') {
            strip.style.width = '260px';
            strip.style.paddingTop = '24px';
            strip.style.paddingBottom = '32px';
            photoSlotsContainer.className = 'grid grid-cols-1 gap-4 z-0';
        } else {
            strip.style.width = '240px';
            strip.style.paddingTop = '16px';
            strip.style.paddingBottom = '16px';
            photoSlotsContainer.className = 'grid grid-cols-1 gap-3 z-0';
        }
    }

    function applyFrameShape(shape) {
        currentShape = shape;

        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`canvas-${i}`);
            const parentSlot = canvas.parentElement;

            if (shape === 'heart') {
                canvas.classList.add('heart-shape-active');
                if (parentSlot) parentSlot.classList.add('heart-shape-active');
            } else {
                canvas.classList.remove('heart-shape-active');
                if (parentSlot) parentSlot.classList.remove('heart-shape-active');
            }
        }
    }

    function startPhotobooth() {
        photosTaken = 0;
        retakeTargetIndex = null;
        startBtn.disabled = true;
        startBtn.innerText = 'Bersiap...';
        downloadBtn.disabled = true;
        downloadGifBtn.disabled = true;
        hideAllRetakeBtns();
        
        for (let i = 1; i <= maxSlots; i++) {
            document.getElementById(`canvas-${i}`).classList.add('hidden');
            isUploadedPhoto[i - 1] = false;
            capturedImages[i - 1] = null;
        }
        takeNextPhoto();
    }

    function takeNextPhoto() {
        if (photosTaken >= maxSlots) {
            finishSession();
            return;
        }

        let count = timerDelay;
        countdownEl.classList.remove('hidden');
        countdownEl.innerText = count;
        playAudio('beep');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.innerText = count;
                playAudio('beep');
            } else {
                clearInterval(interval);
                countdownEl.classList.add('hidden');

                playAudio('shutter');
                flashEl.classList.remove('hidden');
                setTimeout(() => flashEl.classList.add('hidden'), 150);

                snapPhoto(photosTaken);
                photosTaken++;
                photoIndexEl.innerText = photosTaken;

                setTimeout(takeNextPhoto, 1200);
            }
        }, 1000);
    }

    function startSingleRetake(slotIndex) {
        retakeTargetIndex = slotIndex;
        startBtn.disabled = true;
        downloadBtn.disabled = true;
        downloadGifBtn.disabled = true;
        hideAllRetakeBtns();

        let count = timerDelay;
        countdownEl.classList.remove('hidden');
        countdownEl.innerText = count;
        playAudio('beep');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownEl.innerText = count;
                playAudio('beep');
            } else {
                clearInterval(interval);
                countdownEl.classList.add('hidden');

                playAudio('shutter');
                flashEl.classList.remove('hidden');
                setTimeout(() => flashEl.classList.add('hidden'), 150);

                snapPhoto(retakeTargetIndex);
                finishSession();
            }
        }, 1000);
    }

    function snapPhoto(slotIdx) {
        const targetCanvas = document.getElementById(`canvas-${slotIdx + 1}`);
        const ctx = targetCanvas.getContext('2d');

        const targetWidth = 1440;
        const targetHeight = 1080;
        targetCanvas.width = targetWidth;
        targetCanvas.height = targetHeight;

        const vWidth = video.videoWidth || 1280;
        const vHeight = video.videoHeight || 720;
        const targetRatio = targetWidth / targetHeight;
        const videoRatio = vWidth / vHeight;

        let sWidth, sHeight, sx, sy;
        if (videoRatio > targetRatio) {
            sHeight = vHeight;
            sWidth = vHeight * targetRatio;
            sx = (vWidth - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = vWidth;
            sHeight = vWidth / targetRatio;
            sx = 0;
            sy = (vHeight - sHeight) / 2;
        }

        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        capturedImages[slotIdx] = targetCanvas.toDataURL('image/png', 1.0);
        isUploadedPhoto[slotIdx] = false;

        const heartClass = currentShape === 'heart' ? 'heart-shape-active' : '';
        targetCanvas.className = `w-full h-full captured-frame ${currentFilter} ${heartClass}`;
        targetCanvas.style.filter = getCombinedFilterStyle(currentFilter);
        targetCanvas.classList.remove('hidden');
    }

    function finishSession() {
        startBtn.disabled = false;
        startBtn.innerText = 'Mulai Foto';
        downloadBtn.disabled = false;
        downloadGifBtn.disabled = false;
        showRetakeBtns();
    }

    function showRetakeBtns() {
        for (let i = 0; i < maxSlots; i++) {
            const btn = document.querySelector(`.btn-retake[data-slot="${i + 1}"]`);
            if (btn) btn.classList.remove('hidden');
        }
    }

    function hideAllRetakeBtns() {
        document.querySelectorAll('.btn-retake').forEach(b => b.classList.add('hidden'));
    }

    function resetPhotobooth() {
        photosTaken = 0;
        retakeTargetIndex = null;
        photoIndexEl.innerText = '0';
        startBtn.disabled = false;
        startBtn.innerText = 'Mulai Foto';
        downloadBtn.disabled = true;
        downloadGifBtn.disabled = true;
        hideAllRetakeBtns();
        
        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`canvas-${i}`);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.classList.add('hidden');
            isUploadedPhoto[i - 1] = false;
            capturedImages[i - 1] = null;
        }
    }

    // Export PNG HD Canvas
    function downloadImage() {
        downloadBtn.disabled = true;
        downloadBtn.innerText = 'Mengunduh...';

        const masterCanvas = document.createElement('canvas');
        const mCtx = masterCanvas.getContext('2d');

        let stripWidth, stripHeight, padding, photoGap, photoW, photoH, footerH;

        if (currentTemplate === 'grid2x2') {
            stripWidth = 1800;
            padding = 80;
            photoGap = 40;
            photoW = (stripWidth - (padding * 2) - photoGap) / 2;
            photoH = photoW * (3 / 4);
            footerH = 260;
            const rows = Math.ceil(maxSlots / 2);
            stripHeight = (padding * 2) + (photoH * rows) + (photoGap * (rows - 1)) + footerH;
        } else {
            stripWidth = 1600;
            padding = currentTemplate === 'polaroid' ? 100 : 80;
            photoGap = currentTemplate === 'polaroid' ? 60 : 50;
            photoW = stripWidth - (padding * 2);
            photoH = photoW * (3 / 4);
            footerH = currentTemplate === 'polaroid' ? 320 : 260;
            stripHeight = (padding * 2) + (photoH * maxSlots) + (photoGap * (maxSlots - 1)) + footerH;
        }

        masterCanvas.width = stripWidth;
        masterCanvas.height = stripHeight;

        mCtx.fillStyle = currentFrameColor;
        mCtx.fillRect(0, 0, stripWidth, stripHeight);

        const imagePromises = [];

        for (let i = 0; i < maxSlots; i++) {
            if (!capturedImages[i]) continue;

            const p = new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve({ img, index: i });
                img.onerror = () => resolve(null);
                img.src = capturedImages[i];
            });

            imagePromises.push(p);
        }

        Promise.all(imagePromises).then((loadedResults) => {
            const validResults = loadedResults.filter(item => item !== null);

            validResults.forEach(({ img, index }) => {
                let posX, posY;
                if (currentTemplate === 'grid2x2') {
                    const col = index % 2;
                    const row = Math.floor(index / 2);
                    posX = padding + col * (photoW + photoGap);
                    posY = padding + row * (photoH + photoGap);
                } else {
                    posX = padding;
                    posY = padding + (index * (photoH + photoGap));
                }

                mCtx.save();

                if (currentShape === 'heart') {
                    drawHeartMask(mCtx, posX, posY, photoW, photoH);
                }

                mCtx.filter = getCombinedFilterStyle(currentFilter);

                if (!isUploadedPhoto[index]) {
                    mCtx.translate(posX + photoW, posY);
                    mCtx.scale(-1, 1);
                    mCtx.drawImage(img, 0, 0, photoW, photoH);
                } else {
                    mCtx.drawImage(img, posX, posY, photoW, photoH);
                }

                mCtx.restore();
            });

            mCtx.filter = 'none';
            const isDarkFrame = ['#1e293b', '#590d22', '#ff4d6d'].includes(currentFrameColor);
            
            mCtx.fillStyle = isDarkFrame ? '#ffffff' : '#334155';
            mCtx.font = 'bold 48px Arial, sans-serif';
            mCtx.textAlign = 'center';
            mCtx.fillText(stripFooterText.innerText.toUpperCase(), stripWidth / 2, stripHeight - 120);

            mCtx.font = '28px Arial, sans-serif';
            mCtx.fillStyle = isDarkFrame ? '#f1f5f9' : '#94a3b8';
            mCtx.fillText(stripDateText.innerText, stripWidth / 2, stripHeight - 65);

            const link = document.createElement('a');
            link.download = `zeetsnap-${currentTemplate}-${Date.now()}.png`;
            link.href = masterCanvas.toDataURL('image/png', 1.0);
            link.click();

            downloadBtn.disabled = false;
            downloadBtn.innerText = 'Unduh Foto';
        }).catch(err => {
            console.error('Gagal mengunduh gambar:', err);
            alert('Terjadi kesalahan saat mengunduh gambar.');
            downloadBtn.disabled = false;
            downloadBtn.innerText = 'Unduh Foto';
        });
    }

    // Export GIF Boomerang
    function downloadGIF() {
        downloadGifBtn.disabled = true;
        downloadGifBtn.innerText = 'Sedang Memproses GIF...';

        const activeImages = capturedImages.slice(0, maxSlots);
        let flippedImages = [];
        let processedCount = 0;

        const exportWidth = 1280;
        const exportHeight = 960;

        activeImages.forEach((imgSrc, index) => {
            if (!imgSrc) return;
            const img = new Image();
            img.src = imgSrc;
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                const tCtx = tempCanvas.getContext('2d');
                
                tempCanvas.width = exportWidth;
                tempCanvas.height = exportHeight;

                tCtx.save();
                
                if (currentShape === 'heart') {
                    drawHeartMask(tCtx, 0, 0, exportWidth, exportHeight);
                }

                tCtx.filter = getCombinedFilterStyle(currentFilter);

                if (!isUploadedPhoto[index]) {
                    tCtx.translate(exportWidth, 0);
                    tCtx.scale(-1, 1);
                    tCtx.drawImage(img, 0, 0, exportWidth, exportHeight);
                } else {
                    tCtx.drawImage(img, 0, 0, exportWidth, exportHeight);
                }

                tCtx.restore();

                flippedImages[index] = tempCanvas.toDataURL('image/png');
                processedCount++;

                if (processedCount === activeImages.filter(Boolean).length) {
                    const boomerangImages = [...flippedImages, ...flippedImages.slice().reverse().slice(1, -1)];

                    gifshot.createGIF({
                        images: boomerangImages,
                        interval: 0.35,
                        gifWidth: exportWidth,
                        gifHeight: exportHeight,
                        numFrames: boomerangImages.length,
                    }, function (obj) {
                        if (!obj.error) {
                            const link = document.createElement('a');
                            link.download = `zeetsnap-boomerang-${Date.now()}.gif`;
                            link.href = obj.image;
                            link.click();
                        } else {
                            alert('Gagal membuat GIF Boomerang.');
                        }
                        downloadGifBtn.disabled = false;
                        downloadGifBtn.innerText = 'Unduh GIF Boomerang';
                    });
                }
            };
        });
    }

    // Event Listeners: Filter Buttons
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('filter-active'));
            e.currentTarget.classList.add('filter-active');
            currentFilter = e.currentTarget.dataset.filter;
            updateAppliedFilter();
        });
    });

    // Event Listeners: Shape Buttons
    document.querySelectorAll('.btn-shape').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-shape').forEach(b => {
                b.classList.remove('shape-active', 'border-stone-300', 'bg-stone-50', 'font-bold');
                b.classList.add('border-stone-200', 'bg-white');
            });
            const target = e.currentTarget;
            target.classList.add('shape-active', 'border-stone-300', 'bg-stone-50', 'font-bold');
            applyFrameShape(target.dataset.shape);
        });
    });

    // Event Listeners: Template Buttons
    document.querySelectorAll('.btn-template').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-template').forEach(b => {
                b.classList.remove('template-active', 'border-stone-300', 'bg-stone-50', 'font-bold');
                b.classList.add('border-stone-200', 'bg-white');
            });
            const target = e.currentTarget;
            target.classList.add('template-active', 'border-stone-300', 'bg-stone-50', 'font-bold');
            currentTemplate = target.dataset.template;
            applyFrameTemplate(currentTemplate);
        });
    });

    // Event Listeners: Color Buttons
    document.querySelectorAll('.btn-frame').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-frame').forEach(b => b.classList.remove('frame-active'));
            const target = e.currentTarget;
            target.classList.add('frame-active');
            currentFrameColor = target.dataset.color;
            defaultFooterText = target.dataset.footer;
            strip.style.backgroundColor = currentFrameColor;
            
            if (!customTextInput.value.trim()) {
                stripFooterText.innerText = defaultFooterText;
            }
        });
    });

    // Event Listener: Single Retake Buttons
    document.querySelectorAll('.btn-retake').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const slotIdx = parseInt(e.currentTarget.dataset.slot) - 1;
            startSingleRetake(slotIdx);
        });
    });

    startBtn.addEventListener('click', startPhotobooth);
    resetBtn.addEventListener('click', resetPhotobooth);
    downloadBtn.addEventListener('click', downloadImage);
    downloadGifBtn.addEventListener('click', downloadGIF);

    initCamera();
});