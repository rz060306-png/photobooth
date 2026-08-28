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

    // Filter Pro Sliders
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
    let maxSlots = 4;
    let timerDelay = 5;
    let photosTaken = 0;
    let stream = null;
    let defaultFooterText = 'Memorable Day';
    let retakeTargetIndex = null;
    const capturedImages = [null, null, null, null];

    // Filter Pro Manual Values
    let manualAdj = { brightness: 100, contrast: 100, saturate: 100 };

    // Set Tanggal
    const today = new Date();
    stripDateText.innerText = today.toLocaleDateString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    // Audio Synth Beep & Shutter
    function playAudio(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'beep') {
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'shutter') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.08);
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

    // Update Live CSS Filter + Manual Pro Adjustment
    function updateAppliedFilter() {
        const proFilterStr = `brightness(${manualAdj.brightness}%) contrast(${manualAdj.contrast}%) saturate(${manualAdj.saturate}%)`;
        
        video.className = `w-full h-full object-cover ${currentFilter}`;
        video.style.filter = getCombinedFilterStyle(currentFilter);

        for (let i = 1; i <= 4; i++) {
            const canvas = document.getElementById(`canvas-${i}`);
            if (!canvas.classList.contains('hidden')) {
                canvas.className = `w-full h-full captured-frame ${currentFilter}`;
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

    // Sliders Filter Pro Listener
    [sliderBrightness, sliderContrast, sliderSaturate].forEach(slider => {
        slider.addEventListener('input', () => {
            manualAdj.brightness = sliderBrightness.value;
            manualAdj.contrast = sliderContrast.value;
            manualAdj.saturate = sliderSaturate.value;

            valBrightness.innerText = `${manualAdj.brightness}%`;
            valContrast.innerText = `${manualAdj.contrast}%`;
            valSaturate.innerText = `${manualAdj.saturate}%`;

            updateAppliedFilter();
        });
    });

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

    // Alur Sesi Foto Utama
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

    // Single Retake Photo Slot Logic
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

        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        capturedImages[slotIdx] = targetCanvas.toDataURL('image/png', 1.0);

        targetCanvas.className = `w-full h-full captured-frame ${currentFilter}`;
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
        }
    }

    // Export PNG HD Canvas
    function downloadImage() {
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

        let imagesLoaded = 0;
        for (let i = 0; i < maxSlots; i++) {
            const img = new Image();
            img.src = capturedImages[i];
            img.onload = function () {
                let posX, posY;
                if (currentTemplate === 'grid2x2') {
                    const col = i % 2;
                    const row = Math.floor(i / 2);
                    posX = padding + col * (photoW + photoGap);
                    posY = padding + row * (photoH + photoGap);
                } else {
                    posX = padding;
                    posY = padding + (i * (photoH + photoGap));
                }

                mCtx.save();
                mCtx.translate(posX + photoW, posY);
                mCtx.scale(-1, 1);
                mCtx.filter = getCombinedFilterStyle(currentFilter);
                mCtx.drawImage(img, 0, 0, photoW, photoH);
                mCtx.restore();

                imagesLoaded++;
                if (imagesLoaded === maxSlots) {
                    mCtx.filter = 'none';
                    mCtx.fillStyle = currentFrameColor === '#1e293b' ? '#f8fafc' : '#334155';
                    mCtx.font = 'bold 48px Arial, sans-serif';
                    mCtx.textAlign = 'center';
                    mCtx.fillText(stripFooterText.innerText.toUpperCase(), stripWidth / 2, stripHeight - 120);

                    mCtx.font = '28px Arial, sans-serif';
                    mCtx.fillStyle = '#94a3b8';
                    mCtx.fillText(stripDateText.innerText, stripWidth / 2, stripHeight - 65);

                    const link = document.createElement('a');
                    link.download = `zeetsnap-${currentTemplate}-${Date.now()}.png`;
                    link.href = masterCanvas.toDataURL('image/png', 1.0);
                    link.click();
                }
            };
        }
    }

    // Export Animated GIF Boomerang
   // Export Animated GIF Boomerang (Un-mirrored)
   // Export Animated GIF Boomerang (Un-mirrored & Efek Filter Tetap Aktif)
    // Export Animated GIF Boomerang (HD Quality, Fixed Aspect Ratio, Un-mirrored, Filter Active)
function downloadGIF() {
    downloadGifBtn.disabled = true;
    downloadGifBtn.innerText = 'Sedang Memproses GIF...';

    const activeImages = capturedImages.slice(0, maxSlots);
    let flippedImages = [];
    let processedCount = 0;

    // Gunakan resolusi tinggi 1280x960 (Rasio 4:3 HD)
    const exportWidth = 1280;
    const exportHeight = 960;

    activeImages.forEach((imgSrc, index) => {
        const img = new Image();
        img.src = imgSrc;
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const tCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = exportWidth;
            tempCanvas.height = exportHeight;

            tCtx.save();
            // 1. Terapkan Filter & Adjust Pro
            tCtx.filter = getCombinedFilterStyle(currentFilter);
            
            // 2. Un-mirror (Flip Horizontal)
            tCtx.translate(tempCanvas.width, 0);
            tCtx.scale(-1, 1);
            
            // 3. Draw Foto HD (Menjaga Aspect Ratio)
            tCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
            tCtx.restore();

            flippedImages[index] = tempCanvas.toDataURL('image/png');
            processedCount++;

            if (processedCount === activeImages.length) {
                // Buat Urutan Boomerang (Maju-Mundur)
                const boomerangImages = [...flippedImages, ...flippedImages.slice().reverse().slice(1, -1)];

                gifshot.createGIF({
                    images: boomerangImages,
                    interval: 0.35,
                    gifWidth: exportWidth,   // 1280px (Tetap HD)
                    gifHeight: exportHeight, // 960px (Menjaga Rasio 4:3 agar TIDAK GEPENG)
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
                    downloadGifBtn.innerText = '🎬 Unduh GIF Boomerang';
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